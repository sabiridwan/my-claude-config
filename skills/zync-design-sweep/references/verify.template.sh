#!/bin/bash
# zync-design-sweep — audit (before) + verification (after).
# Set REPO and SCOPE. SCOPE = space-separated dirs to check (exclude done + WIP).
REPO="${REPO:-$(pwd)}"
cd "$REPO" || exit 1
SCOPE="${SCOPE:-src/modules src/components}"
# Paths to skip (WIP + already-fixed primitives). Adjust per project.
SKIP='modules/(gallery|item|shop)|components/image/image\.tsx'

section(){ echo ""; echo "########## $1 ##########"; }

# =================== AUDIT (run BEFORE the sweep to size the work) ===================
if [ "$1" = "audit" ]; then
  section "SHADOW usage (className)"
  grep -rEoh "shadow-[a-z0-9/]+|shadow\b" $SCOPE --include="*.tsx" 2>/dev/null | sort | uniq -c | sort -rn
  section "StyleSheet shadow props"
  grep -rEoh "shadowColor|shadowOffset|shadowOpacity|shadowRadius|elevation" $SCOPE --include="*.tsx" 2>/dev/null | sort | uniq -c | sort -rn
  section "Radius distribution (className)"
  grep -rEoh "rounded-[a-z0-9\[\]-]+|rounded\b" $SCOPE --include="*.tsx" 2>/dev/null | sort | uniq -c | sort -rn
  section "Inline borderRadius values"
  grep -rEoh "borderRadius:\s*[0-9]+" $SCOPE --include="*.tsx" 2>/dev/null | sort | uniq -c | sort -rn
  section "Per-module shadow/radii file counts (find the whales to split)"
  for d in $(ls -d src/modules/*/ 2>/dev/null); do
    sh=$(grep -rl "shadow-\|shadowColor\|shadowOffset\|elevation:" "$d" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
    r=$(grep -rl "rounded-3xl\|rounded-lg\|rounded-md" "$d" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
    [ "$sh" != 0 ] || [ "$r" != 0 ] && printf "  %-20s shadowFiles=%-3s radiiFiles=%-3s\n" "$(basename "$d")" "$sh" "$r"
  done
  exit 0
fi

# =================== VERIFY (run AFTER the sweep) ===================
section "LEFTOVER shadow classes (active, non-comment)"
grep -rn "shadow-" $SCOPE --include="*.tsx" 2>/dev/null | grep -vE "$SKIP" | grep -vE ":\s*//|// " || echo "  none ✓"

section "LEFTOVER StyleSheet shadow props (audit Offset/Opacity/Radius/elevation, NOT just Color)"
grep -rniE "shadowColor|shadowOffset|shadowOpacity|shadowRadius|elevation:" $SCOPE --include="*.tsx" 2>/dev/null | grep -vE "$SKIP" | grep -vE ":\s*//|// " || echo "  none ✓"

section "STRAY radii on surfaces (rounded-3xl/lg/md/sm, active)"
grep -rn "rounded-3xl\|rounded-lg\|rounded-md\|rounded-sm" $SCOPE --include="*.tsx" 2>/dev/null | grep -vE "$SKIP" | grep -vE ":\s*//|// |case '|return 'rounded" || echo "  none ✓"

section "Radius distribution now (should be only 2xl/xl/full/t-2xl)"
grep -rEoh "rounded-(2xl|xl|full|t-2xl|3xl|lg|md|sm)" $SCOPE --include="*.tsx" 2>/dev/null | grep -vE "$SKIP" | sort | uniq -c | sort -rn

section "IMPORT-REGRESSION GUARD: token used but not imported (the #1 agent bug)"
# Adjust TOKEN to the project's token symbol (ApTheme / brand tokens via className don't need this).
TOKEN="${TOKEN:-ApTheme}"
miss=0
for f in $(grep -rln "$TOKEN\." $SCOPE --include="*.tsx" 2>/dev/null | grep -vE "$SKIP"); do
  # ignore files where the only reference is commented
  grep -E "$TOKEN\." "$f" | grep -vqE "^\s*//|// " || continue
  grep -q "import.*$TOKEN" "$f" || { echo "  MISSING IMPORT: $f"; miss=1; }
done
[ "$miss" = 0 ] && echo "  all $TOKEN users import it ✓"

section "TYPECHECK vs BASELINE (run manually — the definitive net-new check)"
cat <<'EOF'
  git stash push -u -m sweep-baseline
  npx tsc --noEmit 2>&1 | grep -E "error TS" | sed -E 's/\(([0-9]+),([0-9]+)\)//' | sort -u > /tmp/base.txt
  git stash pop
  npx tsc --noEmit 2>&1 | grep -E "error TS" | sed -E 's/\(([0-9]+),([0-9]+)\)//' | sort -u > /tmp/cur.txt
  comm -13 /tmp/base.txt /tmp/cur.txt   # <-- MUST be empty (excluding WIP paths). Pre-existing errors are not yours.

  # Logic-preservation audit — MUST be empty:
  git diff -- $SCOPE | grep -E "^-" | grep -vE "^---" \
    | grep -iE "onPress=|onChange=|href=|navigate\(|useState|useEffect|\.map\(|\.filter\(|return |if ?\(|await |async " \
    | grep -viE "className|shadow|rounded|border|style=|color="
EOF

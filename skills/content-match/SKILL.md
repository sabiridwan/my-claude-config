---
name: content-match
description: Use when the user wants to compare two pages, files, or components to verify content matches 100% including text, spacing, indentation, structure, and order. Triggers on "compare page A and B", "make sure content matches", "content-match", "check if these are identical", "sync content between files", or any request to verify or enforce exact parity between two sources.
---

# Content Match

Compares two pages, files, or components and ensures they are 100% identical in content, spacing, indentation, and structure. Reports every difference and fixes them.

## When to Use

- Verifying a translated/duplicated page matches the original
- Ensuring a component was copied correctly across modules
- Confirming a refactored file still has identical output/structure
- Syncing content between two versions of a page

## Workflow

```
1. Read both sources → 2. Diff → 3. Report → 4. Fix (if asked)
```

### 1. Read both sources completely

Read page A and page B in full — never summarise or skip sections. Both must be fully loaded before comparison.

### 2. Run exact diff

Use the strictest comparison available:

```bash
# For files — character-level diff including whitespace
diff -u <file-a> <file-b>

# For directories
diff -rq <dir-a> <dir-b>

# Show whitespace differences explicitly
diff --strip-trailing-cr -u <file-a> <file-b>

# If files are identical
diff <file-a> <file-b> && echo "IDENTICAL"
```

For in-editor/code comparison (when files aren't on disk yet), compare line-by-line including:
- Leading whitespace (tabs vs spaces, indent depth)
- Trailing whitespace
- Blank lines (count and position)
- Line endings (CRLF vs LF)
- Character encoding differences

### 3. Report all differences

Group findings into categories:

| Category | What to check |
|---|---|
| **Missing content** | Lines/blocks in A not in B, or vice versa |
| **Text differences** | Any word, character, or punctuation mismatch |
| **Spacing** | Different indentation depth, tabs vs spaces |
| **Blank lines** | Extra or missing blank lines |
| **Order** | Same content but in different sequence |
| **Formatting** | Casing, wrapping, alignment differences |

Report format:
```
Line 12 — MISSING in B:  "  const foo = bar;"
Line 15 — DIFFERS:
  A: "  return value  "
  B: "  return value"   (trailing space removed)
Line 23 — ORDER: block appears at line 23 in A, line 31 in B
```

If zero differences: report `✓ IDENTICAL — content matches 100%`

### 4. Fix discrepancies (if asked)

Default: **report only** — do not change anything unless the user says "fix it" or "make them match".

When fixing:
- Ask which is the **source of truth** (A or B) if not obvious
- Apply minimal changes to bring the target in line with the source
- Re-run diff after fixing to confirm `IDENTICAL`

## Rules

- **Never round off differences** — "mostly the same" is not a pass. 100% match only.
- **Whitespace counts** — a trailing space is a difference. An extra blank line is a difference.
- **Report first, fix second** — always show the full diff report before making changes.
- **Confirm after fix** — always re-diff after fixing to prove the result is identical.

## Quick Reference

```bash
# Exact file match
diff -u pageA.tsx pageB.tsx

# Ignore line endings only (useful cross-OS)
diff -u --strip-trailing-cr pageA.tsx pageB.tsx

# Count differences
diff pageA.tsx pageB.tsx | grep "^[<>]" | wc -l

# Side-by-side view
diff -y --width=200 pageA.tsx pageB.tsx
```

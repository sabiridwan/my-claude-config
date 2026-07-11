---
name: zync-design-sweep
description: Use to apply a uniform design system across an EXISTING codebase at scale — normalize border radius, remove all shadows, restrain color/type — via parallel agents. Triggers on "uniform border radius", "remove all shadows", "make the whole app consistent", "design sweep", "sweep all pages/modules", "professional pass across sales/ess/etc", "zync-design-sweep", or any request to bulk-normalize UI across many files/modules. Complements zync-design (single-screen taste) with a proven audit → spec → preview → fan-out → verify pipeline.
---

# zync-design-sweep — uniform UI across an existing codebase, at scale

Turn a codebase with inconsistent radii, scattered shadows, and color/type noise into one uniform, restrained system — across dozens of modules and hundreds of files — safely. This is the **bulk** counterpart to `zync-design` (which designs one screen). Use `zync-design` for the taste; use this to land it everywhere.

**Proven on:** msgd-staff (zync-expo) — ~210 files across Sales + ESS + 15 modules + shared components, 0 net-new type errors. Works for any ZyncGold surface (expo / nextjs / standalone) — the only per-project variables are the token names and the file layout.

## Core principle

The change is **mechanical + judgment**: mechanical (strip shadows, normalize radii) is deterministic and scriptable to verify; judgment (which shadow→border, calm which color, unify which tiles) needs per-file reasoning. So: **lock one spec, fan out one agent per module group, then verify mechanically.** Never eyeball 200 files by hand; never let 13 agents each invent their own rules.

## The pipeline (follow in order — each step has a matching todo)

### 1. Read the design layer first
Invoke/read `zync-design` (recipes + ecosystem mapping). Identify the project's standard (expo / nextjs / standalone) and where tokens live (`theme.ts` `ApTheme.*` + NativeWind, or Tailwind `brand-*`). Read 2–3 representative screens + the shared primitives (button, card, container/gradient, typography, header).

### 2. Audit the current state (size the work)
Run the audit block from `references/verify.template.sh` (the "AUDIT" section) to count shadow usages and the radius distribution. This tells you the blast radius and which modules need work. Note which modules have **zero** shadow/radii issues — skip them entirely.

### 3. Lock the spec (single source of truth)
Copy `references/design-spec-template.md` to the scratchpad, fill in the project's real token names and chosen radius value (default **16px cards / 12px inner / full circles**). Every agent reads THIS file. Do not let agents improvise the rules.

### 4. Preview before mass-editing (the checkpoint)
Build a token-accurate before/after HTML mock of 4–6 key surfaces (card, stat, list row, form, a busy screen), render it with Playwright over a **local HTTP server** (the `file:` protocol is blocked — `python3 -m http.server`), and show the user. Iterating on a screenshot costs seconds; redoing 200 files costs a session. If the user gave "no questions asked" autonomy, still render + show it, then proceed without hard-blocking.

### 5. Fan out the sweep (one agent per module group)
Fill the `GROUPS` array in `references/sweep-workflow.template.js` with the module dirs/files (split whales like a 40-file module into 2 groups; assign shared components explicit file lists). Launch it with the Workflow tool. **Fence off WIP:** list any files with uncommitted in-flight work in the `WIP` array and exclude them — never sweep files the user is mid-editing. 13 groups ≈ the sweet spot.

### 6. Verify mechanically (never trust "done")
Run the full `references/verify.template.sh` against the swept scope:
- 0 leftover `shadow-*` classes and 0 StyleSheet shadow props (audit **`shadowOffset`/`shadowOpacity`/`shadowRadius`/`elevation`**, not just `shadowColor` — a file can shadow with offset alone).
- Radius distribution collapsed to your scale (only card/inner/full/sheet-top values).
- **Import-regression guard:** any file referencing `ApTheme.*` (or a token) must import it — filter out commented lines. This is the #1 agent regression.
- **Typecheck-vs-baseline:** `git stash -u` → `tsc --noEmit` at HEAD → capture errors → `git stash pop` → `tsc` again → the *normalized* diff (strip line:col) must be **empty** net-new. Pre-existing errors are not yours; do not fix them.
- **Logic-preservation audit:** grep the diff's removed (`^-`) lines for `onPress|href|navigate|useState|useEffect|\.map\(|return |if \(|await` after excluding visual tokens — must be empty. Visual sweep must not delete behavior.

### 7. Fix stragglers yourself
Agents miss edges (files outside assigned groups, a shared primitive with a prop-based radius API, a `round="lg"` prop, a bottom-sheet shadow keyed only on `shadowOffset`). Fix these directly. Re-run verify until clean.

### 8. Report + record
Summarize per-module counts, the committed-vs-uncommitted split, and what you deliberately left (WIP, semantic colors, single hero numbers). Save a `project`-type memory documenting the enforced system so future work conforms.

## Hard constraints (bake into every agent prompt)

1. **Visual-only.** Only className strings, StyleSheet visual props, inline visual style values, icon color tokens. NEVER touch data/hooks/context/props/nav/conditionals/maps/logic.
2. **Tokens only** — no raw hex in components; map to `ApTheme.Color.*` / `brand-*`. If you introduce a token reference, ensure it's imported IN THAT FILE.
3. **Reuse before create** — extend the shared primitive; don't fork controls.
4. **Skip non-visual files** — context.tsx, model.ts, gql/, service.ts, query.ts, fragment.ts, barrel index.ts.
5. **Don't rename/move/delete files or change exports** (except adding a token import).
6. **Fence off WIP** — never edit files the user is mid-editing.
7. **Keep `rounded-full`** (circles/pills are correct) and semantic status colors (they carry meaning).

## Lessons baked in (do not relearn the hard way)

- **`ApTheme` import regression:** an agent adds `color={ApTheme.Color.muted}` without importing `ApTheme` → TS2304. The verify import-guard catches it; also tell agents explicitly.
- **Shadow audit gap:** `grep shadowColor` misses cards that shadow via `shadowOffset` alone (e.g. bottom sheets). Grep the full set.
- **Prop-based radius APIs:** a shared `ApButton` may take `round="lg"` → normalize the prop mapping so everything except `full` collapses to the uniform base, fixing all callers in one edit.
- **Commits can appear mid-session:** the user (or their IDE) may commit while you work. Verify against HEAD, and report committed-vs-uncommitted honestly. Never commit yourself unless asked.
- **`file:` URLs are blocked in Playwright MCP** — serve previews over `python3 -m http.server`.

## Files
- `references/design-spec-template.md` — the spec every agent follows. Fill in tokens + radius.
- `references/sweep-workflow.template.js` — the parallel fan-out. Fill in GROUPS + WIP + paths.
- `references/verify.template.sh` — audit + post-sweep verification (shadows, radii, import guard).

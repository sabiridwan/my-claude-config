# <PROJECT> — Uniform Design Spec

Single source of truth for a design sweep. Fill in the `<...>` per project, drop into scratchpad, point every agent at it. Goal: uniform radius, **zero shadows**, restrained premium look.

> Tokens for this project: accent=`<ApTheme.Color.primary / brand-accent>` · hairline=`<border-slate-100 / ApTheme.Color.line>` · muted=`<ApTheme.Color.muted>`. Radius value chosen: **16px** (change here if the project wants 12).

## 1. RADIUS — one system, no exceptions

| Element | Class | px |
|---|---|---|
| Cards, surfaces, sheets, modals, stat tiles, list rows, images, inputs, buttons | `rounded-2xl` | 16 |
| Inner chips / nested tiles / icon backgrounds / small badges INSIDE a card | `rounded-xl` | 12 |
| Avatars, status dots, circular icon buttons, status pills | `rounded-full` | — |
| Bottom sheets / drawers — top corners only | `rounded-t-2xl` | 16 |

Normalization: `rounded-3xl` → `rounded-2xl`; `rounded-lg/md/sm/xs`/bare `rounded` on a CARD → `rounded-2xl`; `rounded-lg/md` on a small inner icon chip → `rounded-xl`; inline `borderRadius: <n>` on surfaces → 16 (12 inner). Keep `rounded-full`. Normalize `rounded-t-3xl` → `rounded-t-2xl`.

## 2. SHADOWS — remove ALL. Replace with hairline border.

Delete every `shadow-*` class (incl. colored: `shadow-primary`, `shadow-slate-900/20`, `shadow-emerald-500/20`, `shadow-xl`, `shadow-inner`…) and StyleSheet `shadowColor/shadowOffset/shadowOpacity/shadowRadius/elevation`. Where a card relied on a shadow to separate and has NO border → add `border <hairline>`. Cards on a colored/gradient/dark fill get NO border and NO shadow (the fill separates them).

## 3. CARD RECIPE
Light card: `rounded-2xl border <hairline> bg-white p-4` (drop the shadow, normalize radius). Nested tile: `rounded-xl border <hairline> bg-<slate-50> p-3.5`.

## 4. COLOR — one accent + neutrals + semantic status
- Accent = `<primary>`; ONE primary action per view uses the solid accent, everything else neutral/ghost.
- Neutrals carry structure (`text-slate-900/600/500/400`, `bg-white`, `bg-slate-50`, hairline borders).
- Semantic colors (emerald/rose/amber/blue) ONLY for meaning (status, deltas) — never decoration.
- **Rows of tiles/quick-actions: do NOT give each a different pastel.** Unify to `bg-<primary>/10` + `<primary>` icon (biggest "professional" win).
- Replace raw hex icon colors (`#94a3b8`/`#64748b`) with `<muted>` / `<gray>` tokens when the token module is already/easily imported.

## 5. TYPOGRAPHY — real hierarchy, no extrabold spam
Values `font-bold` (reserve extrabold for one hero number). Section titles `text-base/lg font-bold`. Labels `text-[11px] font-semibold uppercase tracking-wide text-slate-400`. Body `text-sm font-medium text-slate-600`.

## 6. SPACING — 4/8 rhythm
Card padding `p-4` (hero `p-5`, consistent per screen). Between cards `mb-3`/`gap-3`. Between sections `mb-6`. Page gutters `mx-4` mobile.

## HARD CONSTRAINTS
1. **Visual-only.** className / StyleSheet visual props / inline visual styles / icon color tokens ONLY. No data/hooks/context/props/nav/conditionals/logic.
2. No rename/move/delete/export changes (except adding a token import — and if you reference a token, IMPORT it in that file).
3. Preserve every onPress/href/prop/map/conditional.
4. Skip non-visual files (context/model/gql/service/query/fragment/barrel index).
5. Leave `rounded-full` and semantic status colors alone.
6. Never touch WIP files listed by the orchestrator.

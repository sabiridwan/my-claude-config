# zync-design recipes — concrete values

The specifics that separate premium output from template defaults. Copy these; don't invent ad-hoc values.

## Spacing — 4pt base, 8pt rhythm

Use only: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`. Never `7`, `15`, `23`.

- Inside a control (button/input padding): `8–12` vertical, `12–16` horizontal.
- Between related items (label→input, icon→text): `8`.
- Between fields in a form: `16–20`.
- Between cards / sections: `24–32`.
- Page gutters: `16` mobile, `24` tablet, `32+` desktop.
- **Whitespace is the #1 premium signal.** When unsure, add more, not less.

## Type scale — one family, few sizes

Sizes (px): `12, 14, 16, 18, 20, 24, 30, 36, 48`. Body is `14` (admin/dense) or `16` (marketing).

| Role | Size | Weight | Notes |
|---|---|---|---|
| Display / hero | 36–48 | 700 | Tight leading (1.1), slight negative tracking |
| H1 / page title | 24–30 | 600–700 | |
| H2 / section | 18–20 | 600 | |
| Body | 14–16 | 400 | Leading 1.5–1.6 |
| Label / caption | 12–13 | 500 | Muted color, not bold-black |
| Numbers / data | tabular | 500 | `font-variant-numeric: tabular-nums` |

Rules: max **2 font families** (one for headings, one for body — in MSG that's Playfair/Poppins or Mulish). Never bold a whole paragraph. Establish hierarchy with **size + weight + color**, not just size.

## Color — 60/30/10, semantic only

- **60%** neutral surface/bg, **30%** text/structure, **10%** accent. Accent appears on ~1 primary action per view.
- Never use pure black `#000` for text — use near-black (`#1E1E1E`, `#252529`). Never pure-saturated borders — use a low-contrast hairline.
- Every color must map to a semantic token: `accent / bg / surface / text / muted / border / danger / success / warning`. No raw hex in components.
- Greys carry the UI. A premium grey ramp: `#FCFCFC → #F6F6F6 → #E9E9E9 → #DBDBDB → #A0A0A0 → #555 → #1E1E1E`.
- State colors: success green, danger red, warning amber — each with a soft bg tint (`#DCFCE7` bg / `#16A34A` text), never full-saturation fills behind text.

## Radius, borders, shadows — restraint

- Radius scale: `6` (inputs/badges), `8–12` (buttons/cards), `16` (modals/sheets), `full` (avatars/pills). Pick one card radius and keep it everywhere.
- Borders: `1px` hairline in the lightest border token. Borders OR shadow, rarely both heavy.
- Shadows — layered and soft, never one hard drop:
  - Resting card: `0 1px 2px rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.06)`
  - Raised / hover: `0 4px 12px rgba(0,0,0,.08)`
  - Modal / popover: `0 12px 32px rgba(0,0,0,.12)`
- ❌ `0 0 20px rgba(0,0,0,.5)` and other oversized/dark shadows read as amateur.

## Motion — fast, purposeful

- Durations: `120–160ms` micro (hover, press), `200–250ms` enter/exit, `300ms` max for large surfaces.
- Easing: `ease-out` for enters, `ease-in` for exits, `cubic-bezier(.2,.8,.2,1)` for premium "settle."
- Animate `transform` + `opacity` only (GPU). Never animate `width/height/top/left`.
- Every interactive element has a visible hover AND `:active`/pressed state. Respect `prefers-reduced-motion`.

## Premium vs. template-default — the taste table

The difference an agent must internalize. Left = looks AI-generated; right = looks designed.

| Template default | Premium |
|---|---|
| Everything centered | Deliberate left-alignment, intentional asymmetry |
| Uniform 16px everywhere | Spacing rhythm that groups related, separates unrelated |
| 5 competing accent colors | One accent, used sparingly on the primary action |
| Hard `1px solid #ccc` + heavy drop shadow | Hairline border OR one soft layered shadow |
| Bold black labels same size as values | Muted small-caps/medium labels, prominent values |
| Generic Inter at one weight | Type pairing with real size/weight hierarchy |
| Emoji as icons | Consistent icon set, one stroke width, optical sizing |
| Buttons full-width by reflex | Width matches importance; primary stands alone |
| Gradients + glassmorphism for "modern" | Flat, confident surfaces; depth from spacing + subtle shadow |
| No empty/loading/error states | All four states designed, skeletons match real layout |

## State coverage — non-negotiable per view

For every data surface, design and implement: **loading (skeleton matching layout) · empty (illustration + one CTA) · error (cause + retry) · populated · partial/optimistic**. A view missing empty/error states is incomplete, not "done later."

## Accessibility floor (WCAG AA)

- Text contrast ≥ 4.5:1 (≥ 3:1 for ≥18px bold). Test the muted-on-surface pairing specifically.
- Visible focus ring on every interactive element (never `outline:none` without a replacement).
- Touch targets ≥ 44×44px. Semantic HTML / RN roles. Labels tied to inputs. ARIA only when semantics fall short.

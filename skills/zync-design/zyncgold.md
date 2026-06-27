# zync-design × ZyncGold — landing premium output in the real codebase

Premium UI only counts if it ships in the ecosystem's patterns. Map every design decision onto these. **Read the target repo's existing components first** — match what's there before adding anything.

## Pick the standard, then the primitives

| Surface | Standard | Tokens live in | Components |
|---|---|---|---|
| Backend API | zync-nestjs | n/a | n/a |
| Admin / dashboard (Next.js) | zync-nextjs | Tailwind `brand-*` tokens (`tailwind.config`) | `Ap*` under `src/components/*` (button, input, modal, table, typography…) |
| Mobile app (Expo/RN) | zync-expo | `theme.ts` → `ApTheme.Color.*`, `ApFont.*`; NativeWind classes | folder primitives: `components/{button,input,modal,table,typography…}` |
| Full-stack standalone | zync-nextjs-standalone | `brand-*` Tailwind tokens + `selectStyles.ts` | `Ap*` in `src/frontend/components/ap/` |

In MSG repos the gold accent is `#C07D34` / `#DAA520` (`ApTheme.Color.primary`). Success `#076E4B`, danger `#FF5860`. Fonts: Playfair (display) + Poppins/Mulish (body). **Never hardcode these hex values in a component** — always go through the token (`ApTheme.Color.*`, `brand-accent`, etc.).

## Hard rules (from the zync standards — do not violate)

- **Tokens only.** No raw hex in components. Map every recipe color onto an existing token; if a needed token is missing, add it to `theme.ts` / `tailwind.config`, then use it.
- **Reuse before create.** A `button`/`input`/`modal`/`table` primitive almost always already exists. Extend it; never fork a one-off styled control.
- **Context owns state; components are dumb.** Visual components take props and render. Data/state stays in `use<Feature>State()` / context (zync-nextjs/expo) or the page's `load()` (standalone). Don't put fetches or business logic in a presentational component to "make the UI work."
- **Forms = Formik + Yup**, wired through `Ap*` inputs (they use `useField()`/their own field binding). Don't thread `field` props manually or build raw controlled inputs when an `Ap*` input exists.
- **Module-first.** New UI lives inside its feature module (`modules/<feat>/components/…`), not a global dump.
- `schema.gql` is generated — never hand-edit (backend).

## Translating a recipe decision → ecosystem

- "One accent on the primary action" → the single `ApButton` primary variant per view; everything else is secondary/ghost.
- "Soft layered card shadow" → define it once as a `brand` shadow token / a shared `Card` style, not inline per card.
- "Skeleton matching layout" → use/extend the repo's `loader` component; don't drop a generic spinner.
- "44px touch target" → enforce in the shared `button`/pressable primitive so every screen inherits it.
- Status pills → reuse `ApTheme.Status.*` (bg+text+gradient already defined) instead of new color pairs.

## Companion skills (use, don't duplicate)

- **`zync-ux-designer`** — when the task wants a generated visual preview / Playwright screenshot or a consistency audit. zync-design sets the quality bar; that skill produces and reviews the artifact.
- **`frontend-design`** — for aesthetic direction / typography when starting a net-new visual identity.
- **`zync-be-standard`, `zync-expo-standard`, `zync-nextjs-standalone`** — the authoritative scaffolding rules for each surface. zync-design is the *taste* layer on top of them.

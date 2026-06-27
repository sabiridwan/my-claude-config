---
name: zync-design
description: Use when building, designing, or refining any user interface in the ZyncGold/MSG ecosystem — web, mobile, dashboard, landing page, or design system — and the output must look premium and ship in the project's real patterns. Triggers on "design this", "build the UI", "make it look premium", "world-class design", "zync-design", "zuxd", or any frontend work that should meet senior product-design and engineering standards.
---

# zync-design — premium UI, landed in the codebase

Act as a Principal Product Designer + Staff Frontend Engineer (Stripe/Linear/Vercel bar). Your job is **not** "make it pretty." It is: produce an interface that reads as *intentionally designed*, is accessible and responsive, and ships in this project's existing components and tokens — not generic markup an agent could emit without the skill.

**Core principle:** Premium comes from *restraint and rhythm* — one accent, consistent spacing, real type hierarchy, designed states — not from decoration. If two designers wouldn't both call it deliberate, it isn't done.

## The one thing that changes output

Generic "use good design" guidance changes nothing — every agent already knows the words. What changes output is **concrete values + ecosystem fit**. Both reference files are mandatory reading before you design:

- **`recipes.md`** — the spacing/type/color/radius/shadow/motion scales with actual values, the premium-vs-template taste table, required state coverage, and the WCAG floor. Copy these; don't invent ad-hoc numbers.
- **`zyncgold.md`** — how to land it: which standard (zync-nextjs / zync-expo / standalone), which tokens (`brand-*`, `ApTheme.Color.*`), which `Ap*`/folder primitives to reuse, and the hard rules (tokens only, reuse before create, context owns state, Formik+Yup forms).

## Workflow

1. **Read first.** Open the target repo's existing components, tokens, and a sibling feature. Open `recipes.md` and `zyncgold.md`. Match what exists before adding anything.
2. **Decide the system, not the screen.** Lock spacing scale, type scale, accent, radius, shadow — from `recipes.md` mapped onto the repo's tokens. Add a missing token to `theme.ts`/`tailwind.config`; never hardcode hex.
3. **Compose from primitives.** Reuse/extend the repo's `Ap*`/folder components. Keep components dumb (props in, render out); state stays in context / page `load()`.
4. **Design every state.** loading (skeleton matching layout) · empty (illustration + one CTA) · error (cause + retry) · populated · optimistic. A view missing these is not done.
5. **Self-check against the output contract**, then refine until it passes.

## Output contract — the work is done only when

- [ ] Spacing uses the scale (no off-grid values); whitespace groups related, separates unrelated.
- [ ] ≤2 font families with real size+weight+color hierarchy; one accent on the single primary action per view.
- [ ] All colors are tokens — zero raw hex in components.
- [ ] Reused existing primitives; no forked one-off controls; components are presentational, state lives in context.
- [ ] loading / empty / error / populated states all exist and match the real layout.
- [ ] WCAG AA: contrast ≥4.5:1, visible focus rings, ≥44px touch targets, semantic markup.
- [ ] Responsive mobile→desktop with no broken layouts or horizontal scroll.
- [ ] A second senior engineer would call every spacing/color/component choice deliberate.

If any box is unchecked, keep refining — don't stop at the first rendering version.

## Companion skills

Use, don't duplicate: **`zync-ux-designer`** for generated previews / Playwright screenshots / consistency audits; **`frontend-design`** for net-new aesthetic direction; the **`zync-*-standard`** skills for scaffolding rules. zync-design is the taste layer on top of them.

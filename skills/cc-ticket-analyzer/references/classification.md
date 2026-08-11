# Classification — which checklist a ticket gets

Every ticket resolves to **exactly one** type. The type selects the checklist, so getting this wrong
produces a confidently wrong gap list.

| Type | What it means | Downstream skill |
| --- | --- | --- |
| `cc-landing-page` | Build a credit-card LP + checkout, uploaded and configured in the panel | `cc-launch` / `cc-dynamic-lp` |
| `portfolio-page` | Build a marketing / compliance portfolio site, no live checkout | `dmb-replicate-site` / `dmb-add-portfolio` |
| `payment-integration` | Add or fix a payment method on an existing page or product | `cc-payment-integration` |
| `other` | Backend, tracking, product, compliance, research | none |

## Signals

Read the title first, then the body, then the tags. Weight them in that order.

### `cc-landing-page`

- Title contains "landing page", "LP", "cc page", "create page", "new page"
- Body table has columns like `Slug`, `Bank ID`, `Domain`, `payments method`, `One Off`,
  `First Billing Fee`
- Body table has a `Page Name` / `PageName` column — only relevant to a page that's live in the
  Ouisys panel, so this outweighs a "portfolio" title/theme reference if both are present (see
  "Resolving conflicts" below).
- A slug of the shape `cc_<gateway>-<product><price>-<country>`
- Tags include a gateway (`Maxpay`, `Acquired`) or a wallet (`Apple Pay`)

### `portfolio-page`

- Title contains "portfolio"
- Body names a design theme or a reference site to replicate
- Body carries the no-DCB-code rule — a phrase like *"make sure the portfolio is clean, doesn't have
  dcb code (legalVariables, testimonial, file text, js bundle)"*
- Body lists MIDs with a payment model per MID
- Frames the work as *"for generic marketing... just for google compliance"* — i.e. the product does
  not need to function

### `payment-integration`

- Title names a wallet or gateway (`Google Pay`, `Apple Pay`, `Maxpay`, `Acquired`, `Paynetics`)
  **without** asking for a page to be created
- Body is about wiring, restarting, or fixing a submission path on something that already exists

### `other`

Everything else — backend work, tracking standardisation, product definition, compliance reviews,
research. No checklist; summary and comment triage only.

## Resolving conflicts

**Prefer the more specific type, and record the ambiguity in the report** rather than silently
picking. A reader who can see "classified as `cc-landing-page`, but it also reads as
`payment-integration`" can correct you in one line. A silent choice cannot be corrected at all.

Specific collisions seen on this board:

- **"Portfolio Page for PXP Bank (ACI Gateway)"** — names a gateway *and* lists MIDs, which are
  `cc-landing-page` signals. But the title says portfolio and the body says *"for generic marketing
  so we don't need the real product to work"*. → `portfolio-page`. The gateway is context, not a
  build target.

- **A landing-page ticket that also asks to enable a wallet.** → `cc-landing-page`. The LP checklist
  is a superset of the payment one, so nothing is lost.

- **A ticket asking for both a portfolio page and a landing page.** Classify as `cc-landing-page`
  (the stricter checklist), and flag in the report that a portfolio deliverable is also in scope so
  the portfolio-only fields are not forgotten.

## The type is a guess, not a fact

If the signals are weak — a two-line ticket with no table and no tags — classify as `other` and say
why. An honest *"couldn't classify, here's the ask verbatim"* is more useful than a checklist diff
computed against the wrong type, which reads as authoritative and is not.

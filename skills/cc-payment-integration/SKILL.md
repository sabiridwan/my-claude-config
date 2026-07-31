---
name: cc-payment-integration
description: >-
  Generate a self-contained credit-card / Apple Pay / Google Pay subscription payment
  integration directly into a Sam Media / Ouisys landing project — no DynamicCCPay widget
  bundle and no ouisys-engine dependency. Use this whenever someone wants to add card +
  wallet payments to a product page, "wire up payments" for a new product (e.g.
  streamtrainfit, omnilearnhub, xrlab360), replace the cc-pay-widget with per-project code,
  scaffold a cc-dynamic payment page, or build a /xhosp checkout that posts to the Ouisys
  frontend payment API (initiate-payment-generic, ap-validate, ap-payment, gp-payment).
  Trigger even if the user only says "payment page", "checkout", "cc pay", or names a
  product plus a domain — this skill owns the whole payment frontend.
---

# CC Payment Integration (widget-free)

## What this does and why it exists

Sam Media product pages take subscription payments (card + Apple Pay + Google Pay) that post to
the Ouisys **frontend payment API** and then redirect to the gateway (Celeris/Maxpay/Ecardon).
Historically this shipped as the shared `DynamicCCPay` widget bundle mounted at runtime. This skill
does the opposite: it **generates the payment frontend as real source files inside the project**, so
each product owns and can customize its own implementation, with **no widget bundle and no
`ouisys-engine`** at runtime.

What this removes vs. keeps — say this out loud to the user if they think "no widget" means "no
backend":

- **Removed:** the `dynamic-cc-pay.js` bundle, the `DynamicCCPay.mount()` contract, and the
  `ouisys-engine/creditCardFlow` redux dependency.
- **Still required (unchanged):** the same-origin backend endpoints under `/api/v1/frontend/*`, the
  gateway, and the `window.configJson.pageConfigs` injection. The generated code posts to these.

## When to use

Use whenever a task involves adding or replacing subscription payments on a landing/product page:
new product checkout, "wire up payments", "replace the widget", scaffolding a `/xhosp` page, or
anything that posts to `initiate-payment-generic` / `ap-payment` / `gp-payment`. If the user only
gives a product name and a domain, that's enough — proceed.

## The workflow

Follow these steps in order. Read the reference files when the step says to.

### 1. Gather the product inputs

Collect these (ask only for what you can't infer; a `product.json` may already hold them). See
`templates/product.example.json` for the exact shape.

- Identity: `serviceId`, `serviceDisplayName`, `productDomain`, `pagePath` (default `/xhosp`).
- Backend keys: `slug`, `gateway` (`celeris` | `maxpay` | `ecardon`), and `bankId` for each of
  card / applePay / googlePay; Apple `merchantIdentifier`; Google `gatewayMerchantId`.
- Plan: leave prices to runtime `pageConfigs` (preferred). Only put plan values in `product.json`
  for a local-dev fallback config — never as the source of truth on a live page.
- Payment methods + order (subset of `['applePay','googlePay','card']`).
- Consent: `requireConsent`, `walletRequireConsent`, `checkConsentByDefault`.
- Branding: `primaryColor`, `primaryDark`, `font`, `logo`.
- Creative: `none` | `download` | `video`.

### 2. Understand the payment contract

Read `references/payment-architecture.md` before generating the payment core. It is the source of
truth for every endpoint, request body (including the exact `initiate-payment-generic` shape the card
service must build without the engine), the local-currency slug rule, the response/redirect handling,
and the comp/non-comp precedence. Do not guess these — they must match the backend exactly.

Read `references/domain-preservation.md` for the relative-URL and redirect rules (ticket
requirement: the page stays on the product's domain; only the final post-payment gateway redirect
leaves).

### 3. Generate the files

Run the scaffold script — it copies the templates, substitutes `{{TOKENS}}` from the product config,
and writes only the selected payment methods / creative:

```bash
node scripts/scaffold.mjs --config <product.json> --out <project-dir>
```

Generated layout:

```
<project-dir>/src/
  payments/         paymentConfig.ts, types.ts, cardService.ts, applePayService.ts,
                    googlePayService.ts, resolveMode.ts, tracker.ts, index.ts
  components/       CardForm, ApplePayButton, GooglePayButton, ConsentCheckboxes, Loader
  PaymentPage.tsx   the page shell (hero/pricing/order-summary/footer) + loader gate
  bootstrap.tsx     mounts PaymentPage, wires the loader-until-ready gate + fail-open timer
  styles/_variables.scss
config.json
```

If the project is greenfield, also emit `bootstrap.tsx` as the entry. If integrating into an existing
`cc-dynamic-*` project, mount `PaymentPage` where the old `#cc-pay-widget` target was.

### 4. Verify

Run the verify script. It type-checks the generated payment core and runs the guardrail checklist:

```bash
node scripts/verify.mjs --out <project-dir>
```

The checklist (also see `references/domain-preservation.md`) fails the build on any of:

- a hardcoded price / trial-days / cycle in visible copy (must come from the `pageConfigs` snapshot),
- an absolute CDN/gateway domain in an asset or API URL (must be relative, same-origin),
- an early-return loader (the loader must be an overlay over an always-rendered tree),
- a missing fail-open timer,
- a comp/non-comp decision made after first paint instead of synchronously.

Fix any failure before handing off. Then tell the user which backend keys they still must fill
(`slug`, `bankId`s, `merchantIdentifier`, `gatewayMerchantId`) and that Apple Pay needs the domain
registered.

## Non-negotiables (why they matter)

- **Never hardcode prices.** They live in `pageConfigs.plan` and change per campaign; a hardcoded
  value silently ships a wrong price. Always read the snapshot taken at first render.
- **Relative URLs only.** The page must stay on the product domain; an absolute CDN/API URL breaks
  domain preservation and can leak the visitor off-domain mid-flow.
- **Loader is an overlay, never an early return.** Early-returning the loader removes the mount
  target, so the page can deadlock. Always wire the 4000 ms fail-open timer too.
- **Decide comp/non-comp synchronously** before the first paint, then confirm with the wallet probe —
  otherwise the layout flashes.

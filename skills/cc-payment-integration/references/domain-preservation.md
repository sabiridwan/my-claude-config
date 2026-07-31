# Domain preservation & redirect rules

The ticket requirement: the payment page must stay on the product's own domain
(`streamtrainfit.com/xhosp?{tracking}`) and the user must never be redirected to another domain
*during the page experience*. This doc is the checklist the verify script enforces.

## Rules

1. **Relative URLs only.** Every asset, script, and API URL the generated code writes must start with
   `/` (same origin). The only absolute URL allowed anywhere is one returned by the backend at runtime
   (e.g. `gateway_url` in a payment response) — never one typed into the source.

2. **Tracking params are preserved, never stripped.** Read the incoming query once
   (`new URLSearchParams(location.search)`), keep it, and forward the relevant keys (`d_country`,
   `d_currency`, `split`, `preauth`, `utm_*`, `campaign`, …) into the payment calls. Never put
   personal data into query strings yourself.

3. **The page never navigates off-domain on its own.** No `window.location = <other domain>`, no
   meta-refresh, no form action pointing elsewhere. The single exception is the **final gateway
   redirect after a successful payment** (`gateway_url` / `redirect_url` / `product_url` from the API
   response). That is expected — payment completes on the gateway.

4. **3-DS stays inline.** When a card response returns `method: 'html'`, render it in an iframe on the
   same page — do not navigate to it.

## Loader gate (anti-deadlock)

The page is hidden behind a loader until the payment core signals ready. The loader must be an
**overlay over an always-rendered tree**, not an early return — early-returning removes the payment
mount target, so it can never initialize and the loader never lifts (deadlock). Always wire a
**4000 ms fail-open timer** that lifts the loader even if init errors, so a slow/broken core can't
trap the page.

## What verify.mjs checks

- No absolute `http(s)://…` URL in any generated asset/API path (allowlist: none in source).
- No hardcoded price / trial-days / billing-cycle literal in visible copy — must come from the
  `pageConfigs` snapshot.
- Loader is rendered as an overlay (`position: fixed` sibling), not returned early.
- A fail-open timeout constant is present in the bootstrap.
- The comp/non-comp decision is computed before first render (in the initial state), not in an effect.

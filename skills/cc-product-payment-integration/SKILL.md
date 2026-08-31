---
name: cc-product-payment-integration
description: Add or replace widget-free card + Apple Pay + Google Pay subscription payments inside a PRODUCT app (Next.js / React SaaS like docpilotai, pdfswitch, snappdf) — not a cc-dynamic landing page. Use when someone wants to "remove the cc widget from the product", "replace DynamicCCPay on the app", "add checkout to the product", "product payment integration", or names a product domain + its /checkout page. The LP counterpart is cc-payment-integration; this skill owns the same payment contract adapted to an app that serves itself (config fetched at runtime, own analytics, own visitor id, /ous proxy). Also use to E2E-test such a checkout.
---

# CC Product Payment Integration (widget-free, product app)

Replaces the `DynamicCCPay` embed widget inside a **product application** with per-project payment
source files. Same Ouisys frontend payment API as the LP integration — different host environment.

**Read `cc-payment-integration`'s `references/payment-architecture.md` first** — it is the source of
truth for every endpoint, request body, response handling and comp rules. This skill documents only
what CHANGES on a product app, plus the traps found shipping the first one.

**Canonical reference implementation:** `~/SamMedia/products/snappdf-ai` (docpilotai.com), built
2026-08-31, E2E-tested (see `cc-qa-report-docpilotai-widgetfree-2026-08-31.md` in that repo):

```
src/payments/            types.ts, settings.ts, configStore.ts, params.ts, pricing.ts,
                         tracker.ts, cardService.ts, applePayService.ts, googlePayService.ts
src/components/Payment/  PaymentMethods.tsx, ApplePayButton.tsx, GooglePayButton.tsx,
                         CardForm.tsx, payment.module.css
src/components/Analytics/TrackerBootstrap.tsx   (registers the direct tracker)
```

## How a product app differs from a cc-dynamic LP

| Concern | cc-dynamic LP | Product app |
| --- | --- | --- |
| `pageConfigs` source | server-injected `window.configJson` | **fetch the published panel page** `GET ${API_BASE}/<xcid>` and scrape `window.configJson` from its HTML (same scrape the widget did). Snapshot ONCE, deep-clone. See `configStore.ts`. |
| API base | same origin `''` | **`/ous` same-origin proxy** → `c1.mouisys.com`. Dev: Next rewrite (`next.config.ts`); prod: nginx on the product vhost. Reuse env `NEXT_PUBLIC_CC_WIDGET_API_BASE_URL`. |
| rockmanId | widget/pac_analytics | **the app's own localStorage visitor id** (e.g. `lib/visitorId.ts`). Never mint a second id — charges and events must share one key. |
| Tracker | Pacman via engine/widget | direct mstore POST to `${API_BASE}/analytickz/api/v2/mstore` (`tracker.ts`), same wire contract, registered into the app's analytics layer (`setSamMediaTracker`-style — the WidgetTracker interface matches exactly). No hidden widget mount needed. |
| Localization | formatjs / `src/localization` rules | the app's own i18n (or none). The LP skill's FormattedMessage rules do NOT apply. |
| Non-comp creative | yes | **no** — product checkout is comp-only; skip resolveMode/NonComp/Creative. |
| Post-payment return | `?payment-status=&user-status=` result screens | usually **LC2**: gateway redirects back with `?token=&uid=`, app validates via `/api/validate-access` → LC2 (`cc.tallymans.com`). Don't bolt the LP return-trip on top; verify the app's existing flow instead. |
| ip field (card body) | `pac_analytics.visitor.ip` | not available client-side — omit; backend geolocates. |

## THE slug rules — two different rules, both mandatory

The single worst trap. Wallets and card build DIFFERENT slugs:

- **Wallets (ap-validate, ap-payment, gp-payment)** post the widget's
  `resolveProductSlug().final` (widget `RootContext.tsx`):
  - `isLocalCurrency && CURRENCY_MAP[d_country]` → `${base.slice(0,-1)}:${currency}-${country}`
  - else `d_country` present → `${base}${country}`
  - else → base **without** the trailing `-`
  - currency comes from **`CURRENCY_MAP[d_country]`**, NOT `?d_currency`.
- **Card (initiate-payment-generic)** uses the engine rule (LP skill §2.1): `?d_currency` +
  platform allowlist → `:cur-country`, else `slug + d_country`.

The first build posted the raw base slug for wallets — proven wrong by API matrix:
`…_000-se` → 200 (reached Apple), raw `…_000-` also tolerated on ap-validate but **card** rejects
it ("slug format invalid"), and behavior differs per endpoint. Implement `resolveWalletSlug()`
(see `pricing.ts`) and never share the card slug builder with the wallets.

## Implementation notes that earned their place

- **configStore:** cache the load promise; null it on failure so retry works. Parser handles three
  shapes: JSON `{pageConfigs}`, `{page_config_dump:{pageConfigs}}`, HTML scrape (brace-matching
  extractor for `window.configJson = {…};`). Deep-clone the snapshot (`JSON.parse(JSON.stringify())`).
- **Methods are panel-controlled:** map `pageConfigs.paymentMethods` (`applepay|googlepay|ccsubmit`,
  lowercase) → internal names; fall back to a scaffold constant only when the field is absent.
  Generate ALL THREE method components regardless — panel can enable card later without a deploy.
  UI: card enabled → tabs; wallet-only → plain button stack (no tab chrome).
- **Never hardcode prices/copy:** order summary renders from the snapshot and branches on plan
  shape (`one-off` / `subscription` / `trial-then-subscription`; missing `type` + `trialDays>0` →
  trial-then-subscription). Cycle text is "every N days", never "/month". (The widget-era page had
  hardcoded €0.00/month vs config's €0.01 — exactly the bug this rule kills.)
- **Google Pay disable = inert wrapper** (`opacity+pointer-events` on the host div). The official
  `createButton()` can't take disabled, and a click-handler consent guard that calls onError fires
  a FALSE `payment-submission-failed` recede — consent blocking is not a payment failure and must
  emit nothing.
- **One error display owner.** Services/components bubble messages up; only the page-level error
  box renders them. Inline + page box = every decline shown twice (shipped, caught in E2E).
- **Parse error bodies:** on `!res.ok` try `res.json()` and return it (`{...err, success:false}`) —
  422s carry real messages; raw "http-error" strings reached the UI before this.
- **Flow events:** keep card outcome events in `handleCardResult` (choke point), `cc-form-submitted`
  before the request. Wallet success → `payment-submitted` advance; wallet failure →
  `payment-submission-failed` recede — fired from the container's callbacks, not the buttons.
- **TrackerBootstrap replacement:** register the direct tracker once (idle-deferred), warm the
  config fetch. Delete the hidden-widget mount AND its paywall open/close payframe dance — nothing
  needs it once no widget exists.
- **Apple Pay:** load Apple's JS SDK so `ApplePaySession` exists in Chrome (QR flow); protocol
  check first (http → visible message, not silence); `session.oncancel` must reset busy state.

## Backend/panel provisioning — verify BEFORE promising anything live

The frontend being correct proves nothing about money. Dry-run the API directly (curl or page
console, `Content-Type: application/json`) and check:

1. **`gp-payment` exists?** As of 2026-08-31 `POST /api/v1/frontend/gp-payment` **404s on
   c1.mouisys.com, staging.mouisys.com AND production proxies** — Google Pay submissions are
   platform-broken for every page posting the standard path (widget included). Escalate; don't
   debug your own code first.
2. **Wallet slug variants resolve?** `ap-validate` with `…-se` should reach Apple's error;
   the `:sek-se` local-currency form 500s when the variant isn't provisioned backend-side even
   though the panel says `isLocalCurrency: true`.
3. **Card gateway registered for the slug?** `initiate-payment-generic` answering
   `"Gateway name could not be found!"` means the slug has no card billing configured — a
   wallet-only page stays wallet-only no matter what the panel checkbox says.
4. **`merchantIdentifier` belongs to THIS domain?** Cloned pages inherit another product's
   (e.g. `merchant.com.xracademy.online.2` on docpilotai) — Apple validation fails live.
5. **Panel edit really saved?** Credit-card pages edit at
   `/dynamic-pages/update-credit-card/{page_config_id}` (NOT `/dynamic-pages/update/{id}` — that's
   the DCB form). Verify persistence via ouisys-panel MCP (`search_dynamic_pages xcid:<x>` —
   `version`/`updated_at` must bump) AND the served page
   (`curl https://c1.mouisys.com/<xcid> | grep paymentMethods`). The served page is the authority.

## E2E testing (cc-qa adapted)

Run cc-qa's checklist with these deltas:

- Checks N/A on a product app: non-comp (3b), product↔LP parity (4b — the checkout IS the product
  app), LP return-trip (1b — verify the app's LC2 `?token=&uid=` flow instead).
- **Milestone dedup trap:** `checkout_opened`/`paywall_opened` fire once per tab session
  (sessionStorage). `sessionStorage.clear()` before asserting the funnel chain, or a reload
  "loses" events that are correctly deduped.
- Expected fresh chain: `page_viewed → checkout_opened → paywall_opened → begin_checkout`
  (+ `paywall_failed` on errors); mstore POSTs 200 via `/ous/analytickz/api/v2/mstore`.
- Leakage scan: a `SamMedia` hit from the local filesystem path in Next **dev** RSC payloads is a
  dev-only artifact, not a leak. Config values (slug/bankId) in module scope + request bodies are
  by design; FAIL only visible-copy/DOM surfacing.
- API dry-runs: drive the real form for card (stop at the 422/response); wallets on localhost are
  BLOCKED (Apple needs HTTPS+registered domain, GPay needs an account) — prove wiring (SDK loaded,
  `ApplePaySession` defined, `isReadyToPay` true, official button) + direct-POST the endpoints for
  contract evidence.
- Claude Code gotcha: `preview_start` reads `.claude/launch.json` from the SESSION's primary
  working directory, not the project subdir — add the entry there (`sh -c "cd products/<app> && …"`).

## Non-negotiables inherited unchanged from cc-payment-integration

Relative/same-origin URLs only (the `/ous` proxy IS the rule) · never hardcode prices, periods or
billing shape · fail-open loading (no infinite spinner — timer to a retry state) · consent gates
per settings, wallets included when the old widget had `requireConsent: true` · every card-submit
outcome emits exactly one flow event · dry-run only in QA, never complete a charge.

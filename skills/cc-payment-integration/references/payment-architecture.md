# Payment architecture — source of truth

Extracted from `ouisys-widget-cc-pay` and `ouisys-engine/creditCardFlow`. The generated code must
match these exactly; the backend does not change.

## Table of contents

1. Config source (`pageConfigs`)
2. Card flow — direct `initiate-payment-generic` (replaces the engine)
3. Apple Pay
4. Google Pay
5. Consent
6. Comp / non-comp resolution
7. Antifraud (Kount)
8. Tracking
9. Redirect + domain preservation
10. `aci-pxp` gateway (LC2 API) — architecturally different from the rest

---

## 1. Config source (`pageConfigs`)

Everything reads from `window.configJson.pageConfigs`, **snapshotted once** at first render (the old
widget could overwrite `window.configJson`; snapshot defends against that). Shape:

```
pageConfigs {
  slug, gateway,
  service:  { id, displayName },
  plan:     { type, trialPrice, trialDays, fullPrice, billingCycleDays, isLocalCurrency, currency },
            // type: 'subscription' | 'trial-then-subscription' | 'one-off'
            // Billing COPY must branch on `type`, never on trialDays alone:
            //   one-off  -> charged once, never renews. billingCycleDays is 0.
            //              Any "/ N days", "auto-renewal" or "subscription" wording is WRONG.
            //   subscription -> renews every billingCycleDays, no trial. trialDays is 0,
            //              and trialPrice carries the charge amount.
            //   trial-then-subscription -> trialPrice for trialDays, then fullPrice per cycle.
            // Older pages predate `type`; treat a missing value as
            //   trialDays > 0 ? 'trial-then-subscription' : 'subscription'  (never 'one-off').
  payments: {
    card:      { bankId },
    applePay:  { bankId, merchantIdentifier, supportedNetworks, merchantCapabilities,
                 requiredShippingContactFields, requiredBillingContactFields, label },
    googlePay: { bankId, gateway, gatewayMerchantId, merchantInfo,
                 allowedCardNetworks, allowedAuthMethods, totalPriceStatus }
  },
  flags: { forceComp },
  cardMccInformation: { mcc },
  env: { page }
}
```

Card / Apple Pay / Google Pay all share the **product `bankId`**; card has no separate one — fall
back: `payments.card.bankId ?? payments.applePay.bankId ?? payments.googlePay.bankId`.

## 2. Card flow — direct `initiate-payment-generic`

`POST ${host}/api/v1/frontend/initiate-payment-generic`, `Content-Type: application/json`.
`host` is empty on same-origin (defaults to current origin); `window.DEV_BASE_URL_CREDIT_CARD` may
override in dev. Body:

```
{
  rockman_id:        window.pac_analytics.visitor?.rockmanId,
  landing_page_url:  window.location.href,
  service_id:        isMaxPay ? serviceId : '2',
  slug:              currencySlug || `${slug}${d_country}`,   // §2.1
  user_agent:        navigator.userAgent,          // NON-maxpay only
  ip:                window.pac_analytics.visitor.ip,          // NON-maxpay only
  browserFingerprint: {
    timezone: new Date().getTimezoneOffset(),
    browserColorDepth: screen.colorDepth,
    browserLanguage: navigator.language,
    browserScreenHeight: screen.height,
    browserScreenWidth: screen.width,
    userAgent: navigator.userAgent,
    browserJavaEnabled: navigator.javaEnabled?.() ?? false,
    browserJavascriptEnabled: true
  },
  ...userDetails      // card fields + bankId (see §2.2)
}
```

**Gateway detection:** `isMaxPay = 'cc_number' in userDetails`. Maxpay includes `serviceId`, omits
`user_agent`/`ip`. Other gateways use `service_id: '2'` and include them.

### 2.1 Local-currency slug rule (config-driven)

`ouisys-engine` hardcoded a per-product allowlist of slugs here (`cc_celerispay-xracademy…`,
`cc_maxpay-movio…`, etc.). That is product-specific and does **not** belong in a per-project
integration — for a new product it never matches. The generated code instead reads the panel's own
per-page flag, `pageConfigs.plan.isLocalCurrency`:

```
allowedCurrencies = ['sek','nok','gbp','dkk','usd','sar','cad','pln','aed']   // platform-level
currency = ?d_currency ; country = ?d_country
isLocalCurrencyPage = pageConfigs.plan.isLocalCurrency === true               // from the panel
if isLocalCurrencyPage AND currency AND currency ∈ allowedCurrencies:
    slug = `${slug.slice(0,-1)}:${currency.toLowerCase()}-${country.toLowerCase()}`
else:
    slug = `${slug}${country.toLowerCase()}`
```

`d_country` / `d_currency` come from the URL query — preserved tracking params (see domain doc).
The `allowedCurrencies` set is platform-level (which currencies the gateway supports), not
product-specific, so it stays a constant.

### 2.2 Card fields (`userDetails`)

Collected by the card form; merged last into the body. Names seen in the flow: `number`, `month`,
`year`, `cvv`, `email` (+ `bankId`). Maxpay variant uses `cc_number`. Keep field names aligned with
the target gateway.

### 2.3 Response + result handling

Response JSON: `{ success, message, method, gateway_url?, html? }`.

- `success === false` → surface `message`. `'ALREADY SUBSCRIBED'` maps to an "AlreadySubscribed"
  error type; otherwise show the message.
- Success + `method === 'html'` → render `html` in a 3-DS iframe (do not navigate away).
- Success otherwise → redirect to `gateway_url`.
- Fire the host `onSuccess` / `onError` callback **before** the redirect (advisory), then redirect.

## 3. Apple Pay

- `POST /api/v1/frontend/ap-validate` — `{ validationURL, rockmanId, slug, bankId,
  is_preauth?, antifraud_session_id? }` → merchant session.
- `POST /api/v1/frontend/ap-payment` — `{ ...payment, rockmanId, slug, bankId, locale,
  shippingContact, token, split?, is_preauth?, antifraud_session_id? }`.
- Success → `window.location.href = result.redirect_url || result.gateway_url || result.product_url`.
- `is_preauth` set when `?preauth=true` or `?is_preauth=1`. `split` passed through from `?split`.
- Requires HTTPS and a registered Apple Pay domain.

## 4. Google Pay

- `POST /api/v1/frontend/gp-payment` — payment token + `{ rockmanId, slug, bankId, locale, split?,
  is_preauth?, antifraud_session_id? }`. Same redirect resolution as Apple Pay.
- `isReadyToPay` needs `payments.googlePay.allowedAuthMethods` + `allowedCardNetworks`.

## 5. Consent

Card gates on the consent checkbox when `requireConsent` (default true). Wallets can skip it
(`walletRequireConsent: false`). `checkConsentByDefault` (default true) pre-ticks the box.

## 6. Comp / non-comp resolution

Decide **synchronously before first paint**, precedence:

1. `pageConfigs.flags.forceComp` → **comp** (wins).
2. else `?non-comp=true` or `?nonCompEnable=true` → **non-comp**.
3. else auto: **comp unless** `window.ApplePaySession` exists AND UA is iOS AND visitor is outside
   India (`pac_analytics.visitor.ip_range_name`).

Then confirm with a real wallet probe (Apple Pay + Google Pay `isReadyToPay`); ignore the provisional
`pending` result, act only on the settled one. Because the initial decision is already correct, the
confirmation is usually a no-op — that's what prevents the flash.

## 7. Antifraud (Kount)

Optional. When `window.kountAntifraud` is present, load the Kount SDK and add
`antifraud_session_id` to the Apple Pay (and Google Pay) requests.

## 8. Tracking

Push product events keyed by `rockmanId` (→ Tau). Generated `tracker.ts` exposes
`customEvent(category, action, label, meta)` and posts to the same analytics endpoint. Safe no-op if
`rockmanId` is absent.

## 9. Redirect + domain preservation

All asset + API URLs are **relative** (same origin) so the page never leaves the product domain
during the experience. The **only** off-domain navigation is the final gateway redirect
(`gateway_url`) after a successful payment call — expected and correct. See
`domain-preservation.md`.

## 10. `aci-pxp` gateway (LC2 API) — architecturally different from the rest

`aci-pxp` (seen in the wild as slug prefix `cc_acipxp-...`) does not use `initiate-payment-generic` /
`ap-validate` / `ap-payment` / `gp-payment`, and does not dispatch on `bankId`. Branch on
`pageConfigs.gateway === 'aci-pxp'` alongside the existing celeris/maxpay/acquired branches; do not
replace them.

- **Dispatch key:** a numeric `serviceId` per payment method, read at runtime from
  `pageConfigs.payments.<card|applePay|googlePay>.serviceId` — never hardcoded (backend/panel is
  responsible for injecting it; treat a missing value as a coordination dependency, not a bug in
  the generated code).
- **Apple Pay merchant validation:** `POST /api/apple-pay/validate-merchant` —
  `{ serviceId, rockmanId, validationUrl }`.
- **Card and Apple Pay payment submission (same endpoint):** `POST /api/subscriptions` —
  `{ payment, serviceId, rockmanId, locale, email, browserFingerprint }`. `browserFingerprint` is
  the iovation/IGLOO blackbox (`window.fpGetBlackbox ? window.fpGetBlackbox() : { blackbox: '',
  finished: false }`), not the Kount `antifraud_session_id`.
- **Antifraud:** a second vendor, iovation/IGLOO (`https://first.iovation.com/latest/static_wdp.js`),
  additive to and independent of Kount. Load it gated on `pageConfigs.gateway === 'aci-pxp'`, the
  same pattern as the existing Kount hook — not unconditionally (it would fire uselessly on other
  gateways' pages if this project also serves them).
- **Response handling:** reuse the `celeris` branch — `result.html` → `document.write` into the
  page (3-DS style), not a `gateway_url` redirect.
- **Google Pay:** not implemented as of this writing — the one integration seen paused it
  deliberately ("others don't work because of error on ACI-PXP side" — Slack, source ticket). Don't
  assume the Apple Pay shape carries over; confirm with backend first.
- Do not copy specific `serviceId` / `bankId` numeric literals from any one project's dev fallback
  config into new code — they are per-page values injected by the panel/backend at runtime.

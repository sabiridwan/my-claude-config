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

---

## 1. Config source (`pageConfigs`)

Everything reads from `window.configJson.pageConfigs`, **snapshotted once** at first render (the old
widget could overwrite `window.configJson`; snapshot defends against that). Shape:

```
pageConfigs {
  slug, gateway,
  service:  { id, displayName },
  plan:     { trialPrice, trialDays, fullPrice, billingCycleDays, isLocalCurrency, currency },
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

---
name: sabi_cc
description: Use when working on the SamMedia credit card landing page project (cc-dynamic-template, cc-template repos). Triggers for questions about the funnel flow, Apple Pay, Google Pay, Kount antifraud, BIN/MID concepts, pageConfigs, ouisys-engine, gateways (celeris, maxpay, acquired), comp/non-comp logic, localization, tracker events, URL test params, or any component in the src/ tree.
---

# CC Landing Pages — Deep Knowledge Skill

## Project Context

**Repo:** `cc-dynamic-template-demo-nid-gcomp` (and sibling cc-template repos)
**Purpose:** Credit card subscription landing pages for SamMedia brands (xracademy, funbox, entertainu, movio). Users land on the page, see a Hero with Apple Pay / Google Pay buttons, subscribe, and get redirected to the product portal.

**Framework:** Built on the internal `ouisys-engine` + `ouisys-component-library`. These are private packages — never replace them with generic alternatives.

---

## Architecture Overview

```
window.configJson.pageConfigs   ←  server-injected per-page config
        ↓
RootProvider (RootContext.tsx)  ←  single source of truth for all runtime state
        ↓
Root.tsx  →  strategy() / FLOWS.CreditCardFlow  ←  ouisys-engine state machine
        ↓
Components (Hero, UserPaymentStatus, Features, etc.)
```

**State machine:** `ouisys-engine/strategy` drives flow states. `identifyStrategy()` determines which state to render. `strategy({ identifyInitialState, creditCardFlow })(currentState)` maps states to React components.

---

## Key Concepts

### BIN & MID
- **BIN** (Bank Identification Number) — first 6–8 digits of a card, identifies the issuing bank.
- **MID** (Merchant Identification Number) — identifies the merchant account at the payment gateway. Each service/brand may have a different MID.

### Comp vs Non-Comp (showComp)
- **Comp (compliant):** Full landing page with Hero, ContentGrid, Features, HowToSubscribe, HeroPricing, HowToUnsubscribe, Footer shown.
- **Non-comp (non-compliant / creative):** Minimal view (`<Creative />`) shown instead of full landing. Triggered for iPhone/iPad users without Apple Pay session, or via `?non-comp=true`.
- Logic lives in `RootContext.tsx`: `isCompliant` check on `window.ApplePaySession`, user agent, IP range (India forced compliant), and `pageConfigs.flags.forceComp`.

### Kount Antifraud
- Loaded dynamically via `useKountAntifraud.js` hook.
- Server injects `window.kountAntifraud = { sdkUrl, config, sessionId }`.
- The hook loads the SDK at runtime (webpack `webpackIgnore`), initialises it with `config` + `sessionId`, and stores state in `antifraud` (from RootContext).
- `antifraud.sessionId` is passed along in Apple Pay payment calls.

### Gateways
Three supported gateways in `pageConfigs.gateway`:
- **`celeris`** — response contains `html`; page is replaced via `document.open/write/close`.
- **`maxpay`** — response contains `redirect_url`; redirect with `window.location.href`.
- **`acquired`** — response contains `gateway_url` or `redirect_url` or `product_url`; redirect.

### Slug & Currency
- `slug` from `pageConfigs.slug` is the plan identifier (e.g. `cc_celerispay-xracademy50_001-`).
- If `pageConfigs.plan.isLocalCurrency` is true AND a `d_country` URL param is present, slug becomes `{slug_base}:{currency}-{country}` (e.g. `cc_...-001-:sek-se`).
- `currencyMap` in `src/utils/configs.ts` maps country code → currency code.

---

## Payment Flows

### Apple Pay Flow
```
useApplePayHandler (availability + canMakePayment checks)
  → handleApplePayClick(trigger)
    → useApplePay.initApplePay(paymentRequest, trigger)
      → new ApplePaySession(3, paymentRequest)
        → onvalidatemerchant → validateMerchant (POST /api/v1/frontend/ap-validate)
        → onpaymentauthorized → processPayment (POST /api/v1/frontend/ap-payment)
          → gateway-specific redirect
```

**Availability logic:**
1. Check `window.ApplePaySession` on page load.
2. If absent, lazy-load `https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js`.
3. `canMakePaymentsWithActiveCard(merchantId)` used for Safari 18-.
4. `ApplePaySession.applePayCapabilities` (iOS 18+) is commented out — not yet in use.

**paymentRequest** built in `useApplePayHandler.ts`:
- `countryCode` from `d_country` URL param or `pac_analytics.visitor.ip_range_name`.
- `currencyCode` from `currencyMap` or `EUR` fallback.
- `amount` is trial price with special-case minimums for certain GCC/Nordic countries.
- `isZeroTrial` flag handles `0`, `0.0`, `0.00` trial prices.

### Google Pay Flow
```
useGooglePayHandler (availability check)
  → handleGooglePayClick(trigger)
    → useGooglePay.initGooglePay(paymentRequest, trigger)
      → new google.payments.api.PaymentsClient({ environment: 'PRODUCTION' })
        → loadPaymentData(paymentRequest)
        → processPayment (POST /api/v1/frontend/gp-payment)
          → gateway-specific redirect
```

### Credit Card Flow
- Handled by `FLOWS.CreditCardFlow` from `ouisys-engine`.
- `CreditCardStep` component receives `gateway_url` from `SubmitUserDetailsSuccess` type.
- `UserPaymentStatus` reads `?user-status=paymentSuccess|alreadySubscribed|*` and `?product-url=` from URL to handle post-payment redirect or failure display.

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/frontend/ap-validate` | Apple Pay merchant validation |
| POST | `/api/v1/frontend/ap-payment` | Apple Pay payment processing |
| POST | `/api/v1/frontend/gp-payment` | Google Pay payment processing |

All requests include `rockmanId` (from `pac_analytics.visitor.rockmanId`), `slug`, `bankId` (from `pageConfigs.payments.*.bankId`), `locale`.

Apple Pay payment also sends: `split` (from URL param), `is_preauth` (when `?preauth=true`).

---

## pageConfigs Schema (window.configJson.pageConfigs)

```ts
{
  slug: string,                        // plan slug
  service: { id: string, displayName: string },
  cardMccInformation: { mcc: string }, // entityName
  plan: {
    type: 'subscription' | 'trial-then-subscription' | 'one-off',  // billing shape
    trialPrice: string, trialDays: number,
    fullPrice: string, billingCycleDays: number,
    currency: string, isLocalCurrency: boolean
  },
  gateway: 'celeris' | 'maxpay' | 'acquired',
  flags: { forceComp: boolean },
  payments: {
    applePay: { bankId, merchantIdentifier, label, supportedNetworks },
    googlePay: { bankId, ... }
  }
}
```

**`plan.type` decides billing copy.** `one-off` charges once and never renews, so `billingCycleDays`
is `0` and any "/ N days", "auto-renewal" or "subscription" wording is wrong. `subscription` renews
with no trial (`trialDays` 0, `trialPrice` carries the amount). Never infer the shape from
`trialDays` alone — "no trial" and "no renewal" are different things. Pages predating the field have
no `type`; read a missing value as `trialDays > 0 ? 'trial-then-subscription' : 'subscription'`, never
as `one-off`.

---

## URL Test Parameters

| Param | Effect |
|-------|--------|
| `?debug=true` | Shows alert on payment errors |
| `?test-error=true` | Forces error modal without hitting API |
| `?non-comp=true` | Forces non-compliant (creative) view |
| `?d_country=se` | Sets country for currency/slug logic |
| `?locale=fr` | Forces locale |
| `?split=X` | Passed to Apple Pay payment API |
| `?preauth=true` | Sends `is_preauth: 1` to Apple Pay API |
| `?payment-status=true` | Triggers userPaymentStatus display |
| `?user-status=paymentSuccess` | Triggers UserPaymentStatus component |
| `?product-url=<host>` | Redirect target after success |

---

## Component Map

| Component | Role |
|-----------|------|
| `Hero` | Main landing section with Apple Pay + Google Pay buttons and consent checkboxes |
| `Creative` | Non-comp minimal view (full-page clickable) |
| `HeroPricing` | Pricing call-to-action section |
| `Features` | Feature grid section |
| `ContentGrid` | Media content preview grid |
| `HowToSubscribe` | Steps to subscribe |
| `HowToUnsubscribe` | Unsubscribe options (chat, email) |
| `Footer` | Page footer with legal links |
| `Loader` | Shown during initial strategy identification |
| `UserPaymentStatus` | Post-payment success/failure/already-subscribed view |
| `GooglePayButton` | Google Pay button component |
| `ErrorModal` | Payment error overlay (currently commented out in Root) |
| `AnimatedCtaLabel` | Animated CTA text |
| `SwitchLang` | Language switcher |

---

## Localization

- Messages use `FormattedMessage` from `src/localization/index.tsx`.
- Translations in `src/localization/translations/{locale}.json`.
- Default locale: `en`. Auto-detected from `window.navigator.language`.
- Overridden by `?locale=` URL param or `d_locale` param.
- `switchLang(lang)` in RootContext sets locale and updates `window.languageCode` + `<html lang>`.

---

## Tracking

All tracking uses `tracker` from `ouisys-engine/utilities/tracker`:
- `tracker.customEvent(flow, event, label, data?)` — custom event
- `tracker.advancedInFlow(flow, step, data?)` — move forward in funnel
- `tracker.recedeInFlow(flow, step, data?)` — move backward / cancel
- `tracker.advancedInPreFlow(trigger, data?)` — CTA click before payment begins

Key flow names: `'apple-pay-flow'`, `'google-pay-flow'`, `'Lang-Switcher'`
Visitor data lives in `window.pac_analytics.visitor` (includes `rockmanId`, `ip_range_name`).

---

## Cross-Origin / CORS Notes

- Apple Pay merchant validation requires the domain to be registered with Apple.
- `window.location.protocol` must be `https:` for `canMakePaymentsWithActiveCard` to run.
- `document.open/write/close` for gateway HTML responses works cross-origin — this is intentional for celeris gateway redirects.
- `X-CSRF-TOKEN: '{{ csrf_token() }}'` header in service calls is a Laravel Blade template literal — replaced server-side before the JS is served.

---

## Finding Live Pages

Live pages are served by the backend (likely Laravel) which injects `window.configJson` with `pageConfigs` before serving the built JS. To find a live page for a specific service/slug, check the backend routing config or ask the team for the URL pattern (typically `/{locale}/{service}/subscribe` or similar).

---

## Notion & Tickets

**Local ticket tracker:** `/Users/sabiridwan/SamMedia/credit-card/tickets.md`
- Keep this file up to date as tickets are picked up, progressed, or completed.
- When starting work on a ticket, move it to "In Progress" and add notes on what's being done.
- When done, move to "Completed Tickets" with a brief summary of what was done.

### Ticket Analysis & Reference Protocol

When the user pastes a Notion ticket URL (notion.so/...), run this workflow automatically — no need to ask:

1. **Fetch the ticket** — use `mcp__plugin_Notion_notion__notion-fetch` with the URL.
2. **Read comments** — use `mcp__plugin_Notion_notion__notion-get-comments` with the page ID (extract from URL: last 32 hex chars, formatted as UUID with dashes).
3. **Summarize in chat** — output a structured analysis:
   - One-line TL;DR
   - What's being requested (plain English)
   - Repos / domains affected (cross-reference Component Map above)
   - Open questions or blockers from comments
4. **Create tasks** — use `TodoWrite` to add actionable sub-tasks.
5. **Create a reference ticket** — create a sub-page inside **My CC Task** (page ID: `364a5b09-7ae8-805c-aedf-d3890645e6f0`) using `mcp__plugin_Notion_notion__notion-create-pages`. Never edit the original ticket.

**Reference ticket format** (Notion page content):

```
🔗 Original: [original Notion URL]
📅 Created: YYYY-MM-DD  |  🏦 Bank: X  |  🌐 Domain: X

---

TL;DR
One-line summary of what's needed.

---

Repos
• repo-name-1
• repo-name-2

---

My Tasks
☐ Task 1
☐ Task 2
☐ Task 3

---

Open Questions
• Any blockers or missing config values

---

Dev Notes
• Relevant technical context (slug format, gateway, LC currency codes, etc.)
```

Search for new tickets with `Notion:search` / `Notion:find`. Terms: "credit card", "Apple Pay", "Google Pay", "NID GCOMP", "landing page", or service name (xracademy, funbox, entertainu, movio).

---

## Documentation

When writing documentation for this project, cover:
- Funnel flow diagram (non-comp vs comp path)
- Gateway integration guide (celeris/maxpay/acquired response handling)
- Apple Pay setup checklist (domain registration, merchantId, bankId)
- URL parameter reference (test params)
- pageConfigs schema reference
- How to add a new service/brand (new logo asset, new slug, config entry)
- Localization guide (adding a new locale/translation key)

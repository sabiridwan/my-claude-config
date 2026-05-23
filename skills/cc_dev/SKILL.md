---
name: cc_dev
description: Use when developing, modifying, or creating new credit card landing pages in the cc-dynamic-template repo (SamMedia). Triggers for tasks involving components, payment flows, new brand pages, config changes, localization, tracker events, gateway handling, Apple Pay, Google Pay, Kount antifraud, or any src/ file in this project.
---

# CC Dev — Full Development Skill

## Project Root (Base Template)
`/Users/sabiridwan/SamMedia/credit-card/cc-template/cc-dynamic-template-demo`

This is the canonical base template. All new CC page variants should be forked from this repo. The current working directory for development tasks is this repo unless specified otherwise.

## Repository Location

All CC template repos live under:

**Local base directory:** `/Users/sabiridwan/SamMedia/credit-card/cc-template/`

**Remote GitLab:** `https://git.sam-media.com/ouisys/dynamic-templates/cc-dynamic-template`

When forking or cloning a new CC page variant:
```bash
# Clone from GitLab into the local base directory
cd /Users/sabiridwan/SamMedia/credit-card/cc-template/
git clone https://git.sam-media.com/ouisys/dynamic-templates/cc-dynamic-template <new-repo-name>
```

**Naming convention:** `cc-dynamic-template-{descriptor}`

The `{descriptor}` is a short kebab-case label for the vertical/variant, e.g.:
- `cc-dynamic-template-demo` — demo/default
- `cc-dynamic-template-download` — download vertical
- `cc-dynamic-template-video-nophone` — video vertical, no phone step
- `cc-dynamic-template-lc-download` — local currency download

Always prefix with `cc-dynamic-template-`. No suffixes like `-nid-gcomp`. Never use the old `cc-{domain}-{gateway}-...` format.

**Stack:** React 18 + TypeScript, Redux Toolkit, ouisys-engine (state machine), ouisys-component-library, React-Intl (18 langs), Webpack via ouisys-clients.

---

## Directory Structure

```
src/
├── __doNotModify/         # Redux store, flow/component/reducer registries — never edit
├── @types/window.d.ts     # All window.* globals typed here
├── providers/
│   ├── RootContext.tsx    # SINGLE SOURCE OF TRUTH — all runtime state
│   └── ProvidersWrapper.tsx
├── Root.tsx               # Main component — renders Loader or CreditCardFlow + page sections
├── flows/CreditCardFlow/  # Orchestrates CC form steps
├── components/            # 25+ presentational components
├── services/
│   ├── applePayService.ts # AP validate + process API calls
│   └── googlePayService.ts
├── utils/
│   ├── useApplePayHandler.ts   # AP availability + click handler
│   ├── useApplePay.ts          # AP session lifecycle
│   ├── useGooglePayHandler.ts  # GP readiness + click handler
│   ├── useGooglePay.ts         # GP PaymentsClient lifecycle
│   ├── useFormData.ts          # CC form field state
│   ├── configs.ts              # currencyMap, serviceLinks, prices
│   ├── searchToObject.ts       # URL param parser
│   ├── types.ts                # ApplePayMerchantSession type
│   └── isExpiryInvalid.ts      # Expiry date validator
├── hooks/useKountAntifraud.js  # Kount SDK dynamic loader
├── localization/
│   ├── index.tsx               # Exports FormattedMessage, TranslationProvider
│   ├── addLocaleData.ts        # Imports all 18 translation JSONs
│   └── translations/{lang}.json # ar da de el en es et fi fr is it nl no pl pt sk sl sv
├── assets/
│   ├── logos/{serviceId}.svg|png
│   └── imgs/, video/
└── styles/Root.scss
config.json                # Dev/test strategy config (slug, service, flow settings)
```

---

## Architecture Flow

```
window.configJson.pageConfigs  (server-injected)
         ↓
ProvidersWrapper (Redux + RootProvider + TranslationProvider)
         ↓
Root.tsx  →  dispatch(identifyStrategy())  →  Redux strategy state
         ↓
showComp? → true  → Hero + ContentGrid + Features + HowToSubscribe + HeroPricing + HowToUnsubscribe + Footer
          → false → Creative (full-screen, non-compliant)
         ↓
User clicks payment → Apple Pay / Google Pay / CreditCardFlow
```

---

## RootContext — State & Methods

**File:** `src/providers/RootContext.tsx`

**State:**
| Variable | Type | Purpose |
|---|---|---|
| `locale` | string | Active language code |
| `urlParams` | object | Parsed `window.location.search` |
| `showComp` | boolean | Comp (true) vs non-comp (false) layout |
| `isApplePayAvailable` | boolean | AP session can be created |
| `isGooglePayAvailable` | boolean | GP script loaded |
| `userCanMakeGooglePayment` | boolean | GP active wallet exists |
| `isLoading` | boolean | Payment in progress |
| `errorMessage` | string | Error modal content |
| `antifraud` | object | `{ loading, enabled, ready, sessionId, error }` |
| `slug` | string | Computed plan slug (with country/currency) |
| `pageConfigs` | object | Full `window.configJson.pageConfigs` |
| `downloadIsReady` | boolean | Video download animation |
| `switchVideoToImg` | boolean | Video → image fallback |

**Methods:**
- `switchLang(lang)` — set locale, update `<html lang>`, fire tracker event
- `langDetection()` — auto-detect from `window.navigator.language`
- `getLink(key)` — returns service URL (privacy/refund/terms/faq)
- `isSafari()` — Safari browser detection
- `isApplePaySupportedDevice` — computed: Safari || iOS

**Compliance Logic:**
```typescript
showComp =
  pageConfigs?.flags.forceComp ||
  !window.ApplePaySession ||
  !/iPhone|iPad|iPod/.test(navigator.userAgent) ||
  visitor.ip_range_name?.toUpperCase() === 'IN'
```

**Slug Construction:**
```typescript
// Base slug from pageConfigs.slug (e.g. "cc_celerispay-xracademy50_001-")
// With country: "cc_...-001-es"
// With local currency: "cc_...-001:sek-se"  (only if isLocalCurrency + d_country param)
```

---

## Components Reference

| Component | File | Role |
|---|---|---|
| `Hero` | components/Hero/ | Compliant hero: logo, AP button, GP button, consent checkboxes |
| `Creative` | components/Creative/ | Non-comp fullscreen video/image + CTA button |
| `ContentGrid` | components/ContentGrid/ | "What is {service}?" category grid |
| `Features` | components/Features/ | 6 feature cards grid |
| `HowToSubscribe` | components/HowToSubscribe/ | Values, milestones, subscription steps |
| `HowToUnsubscribe` | components/HowToUnsubscribe/ | Chat/email cancellation options |
| `HeroPricing` | components/HeroPricing/ | Pricing CTA card |
| `Footer` | components/Footer/ | Legal address, links, payment method icons |
| `UserDetailsEntryStep` | components/UserDetailsEntryStep/ | Full CC entry form (email, card, CVV, expiry, country) |
| `CreditCardStep` | components/CreditCardStep/ | Gateway form container |
| `HtmlContentIframe` | components/HtmlContentIframe/ | Injects gateway HTML (celeris) |
| `UserPaymentStatus` | components/UserPaymentStatus/ | Post-payment: success / failed / already-subscribed |
| `ErrorModal` | components/ErrorModal/ | Payment error overlay |
| `GooglePayButton` | components/GooglePayButton/ | GP button renderer |
| `Loader` | components/Loader/ | Initial spinner |
| `SwitchLang` | components/SwitchLang/ | Lang dropdown (ES/FR/IT/EN hardcoded) |
| `AnimatedCtaLabel` | components/AnimatedCtaLabel/ | Cycling CTA text |
| `TextWrapper` | components/TextWrapper/ | Hex-obfuscated text via CSS |
| `PriceCopy` | components/PriceCopy/ | Formatted price text |
| `ClearPricing` | components/ClearPricing/ | Pricing copy formatter |
| `Video` | components/Video/ | Play button + progress bar |
| `Menu` | components/Menu/ | Mobile nav drawer |

---

## Payment Flows

### Apple Pay
```
useApplePayHandler (availability check, canMakePayments)
  → handleApplePayClick(trigger)
    → useApplePay.initApplePay(paymentRequest)
      → new ApplePaySession(3, paymentRequest)
        → onvalidatemerchant → POST /api/v1/frontend/ap-validate
        → onpaymentauthorized → POST /api/v1/frontend/ap-payment
          → celeris: document.write(result.html)
          → maxpay/acquired: window.location.href = result.redirect_url
```

**paymentRequest fields:**
- `countryCode` from `d_country` param or `pac_analytics.visitor.ip_range_name`
- `currencyCode` from `currencyMap` or `'EUR'`
- `amount` from `pageConfigs.plan.trialPrice` (special minimums for GCC/Nordic)
- `merchantIdentifier` from `pageConfigs.payments.applePay.merchantIdentifier`

### Google Pay
```
useGooglePayHandler (isReadyToPay check)
  → handleGooglePayClick(trigger)
    → useGooglePay.initGooglePay(paymentRequest)
      → new google.payments.api.PaymentsClient({ environment: 'PRODUCTION' })
        → loadPaymentData(paymentRequest)
        → POST /api/v1/frontend/gp-payment
          → same gateway redirect logic as Apple Pay
```

### Credit Card Form
- `UserDetailsEntryStep` collects email, card number, CVV, expiry, country
- Validation: email regex, `payment.fns.validateCardNumber/CVC()`, `isExpiryInvalid()`
- Submit → `dispatch(submitUserDetailsAction({ window, userDetails }))`
- On success → `CreditCardFlow` transitions to `CreditCardStep` or `HtmlContentIframe`

---

## Gateway Response Handling

| Gateway | Response field | Action |
|---|---|---|
| `celeris` | `result.html` | `document.open(); document.write(html); document.close()` |
| `maxpay` | `result.redirect_url` | `window.location.href = redirect_url` |
| `acquired` | `result.gateway_url` or `result.product_url` | `window.location.href = url` |

---

## API Endpoints

| Method | Path | Payload | Used by |
|---|---|---|---|
| POST | `/api/v1/frontend/ap-validate` | `{ validationURL, rockmanId, slug }` | Apple Pay |
| POST | `/api/v1/frontend/ap-payment` | `{ rockmanId, slug, bankId, locale, payment, split?, is_preauth? }` | Apple Pay |
| POST | `/api/v1/frontend/gp-payment` | `{ rockmanId, slug, bankId, locale, token }` | Google Pay |

**Headers:** `Content-Type: application/json`; GP only adds `X-CSRF-TOKEN: {{ csrf_token() }}` (Blade template)

---

## window.configJson.pageConfigs Schema

```typescript
{
  slug: string                          // e.g. "cc_celerispay-xracademy50_001-"
  service: { id: string, displayName: string }
  cardMccInformation: {
    mcc: string
    address: { line1, city, postalCode, country }
  }
  plan: { trialPrice: string, isLocalCurrency: boolean }
  gateway: 'celeris' | 'maxpay' | 'acquired'
  flags: { forceComp: boolean }
  payments: {
    applePay: { label, merchantIdentifier, bankId, supportedNetworks[] }
    googlePay: { gateway, gatewayMerchantId, allowedAuthMethods[], allowedCardNetworks[], merchantInfo, totalPriceStatus, bankId }
  }
}
```

---

## URL Test Parameters

| Param | Effect |
|---|---|
| `?locale=xx` | Override language (en/es/fr/it/ar…) |
| `?d_country=xx` | Set country for currency + slug |
| `?non-comp=true` | Force Creative (non-compliant) view |
| `?forceComp=true` / `flags.forceComp` | Force compliant layout |
| `?debug=true` | Alert on payment errors |
| `?test-error=true` | Simulate payment error modal |
| `?split=X` | Passed to AP payment API |
| `?preauth=true` | Sends `is_preauth: 1` to AP API |
| `?user-status=paymentSuccess\|alreadySubscribed` | Trigger UserPaymentStatus |
| `?product-url=host` | Redirect target after success |
| `?payment-status=true` | Trigger payment status display |

---

## Localization

**18 languages:** ar, da, de, el, en, es, et, fi, fr, is, it, nl, no, pl, pt, sk, sl, sv

**Usage in components:**
```tsx
import { FormattedMessage } from '../../localization'

<FormattedMessage
  id="hero.heading"
  defaultMessage="Start your {serviceDisplayName} experience"
  values={{ serviceDisplayName }}
/>
```

**Adding a translation key:**
1. Add `defaultMessage` to JSX (en fallback)
2. Run `yarn manage:translations` → extracts to `en.json`, compiles all locales
3. Update other locale JSONs with translated strings

**SwitchLang component** hardcodes 4 languages (ES/FR/IT/EN). Extend its options array to add more.

---

## Tracker Events

```typescript
import tracker from 'ouisys-engine/utilities/tracker'

tracker.customEvent(category, action, label, data?)
tracker.advancedInFlow(flow, step, data?)
tracker.recedeInFlow(flow, step, data?)
tracker.advancedInPreFlow(trigger, data?)
```

**Key flows:** `'apple-pay-flow'`, `'google-pay-flow'`, `'Lang-Switcher'`, `'cc-form-state'`, `'user-details-entry-state'`

---

## Kount Antifraud

- Backend injects `window.kountAntifraud = { sdkUrl, config, sessionId }`
- `useKountAntifraud.js` dynamically imports the SDK, sets `antifraud` state in RootContext
- `antifraud.sessionId` is passed to both AP and GP payment API calls
- Errors are tracked but **do not block** payment flow

---

## Adding a New Page / Brand

1. **Fork** this template repo
2. **config.json** — update `slug`, `service`, `country`, `flowConfig`
3. **Logo** — add `src/assets/logos/{serviceId}.svg` (or `.png` fallback)
4. **Translations** — run `yarn manage:translations`
5. **Test page** — run `yarn manage:configs`
6. **Slug pattern:** `cc_{gateway}-{service}{amount}_{version}-`
   - With country: append `es`
   - With local currency: append `:sek-se`
7. **Naming convention:** `{country}-{service}-{theme}-strategies`
   - Compliant variant: suffix `-cmp`
   - A/B tests: suffix `-test-{copyupdate|buttoncolor|iconreplacement}`

---

## Scripts Reference

```bash
yarn dev                  # Dev server + translations
yarn build                # Production build
yarn build:ssr:all        # Full SSR pipeline
yarn rock                 # Kill ngrok + start ngrok tunnel "ouisys" + dev server
yarn lint                 # ESLint --fix
yarn format               # Prettier
yarn manage:translations  # Extract + compile i18n messages
yarn pull:config          # Pull pageConfigs from dashboard
yarn manage:configs       # Configure test page
yarn update:ouisys        # Update all ouisys packages
yarn use:local-library    # Switch to local ouisys-component-library build
```

---

## currencyMap (configs.ts)

```typescript
{ se:'sek', no:'nok', gb:'gbp', dk:'dkk', us:'usd', sa:'sar', ca:'cad',
  pl:'pln', ae:'aed', qa:'qar', kw:'kwd', om:'omr', bh:'bhd', jo:'jod',
  is:'isk', au:'aud', nz:'nzd' }
```

**Special minimum trial amounts (non-zero):**
SA/QA → 0.05 | AE → 0.04 | NO → 0.11 | SE → 0.10 | DK → 0.07 | NZ → 0.02 | IS → 1.00

---

## Implementation Rules

- **Never edit** `src/__doNotModify/` files
- **Never hand-edit** `schema.gql` (ouisys-engine generated)
- **All translatable text** must use `<FormattedMessage>` — no hardcoded strings
- **All state access** via `useRootContext()` — never reach into Redux for UI state
- **All API calls** only in `services/` — not in components or hooks directly
- **New components** follow existing naming: PascalCase, colocated SCSS
- **Logo assets** must be placed in `src/assets/logos/{serviceId}.{svg|png}`
- **Gateway handling** always check all three: celeris (html), maxpay (redirect_url), acquired (gateway_url/product_url)
- **Tracker events** must fire at: flow start, payment authorized, payment success, payment failure/cancel

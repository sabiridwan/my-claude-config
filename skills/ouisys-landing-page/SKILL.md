---
name: ouisys-landing-page
description: Use when creating a new DCB/carrier-billing landing page that embeds the Ouisys Subscription Widget (OuisysSubscribe). Triggers when user says "create landing page", "build a subscription page", "clone this page", "copy this page", or references a mouisys.com/c1.mouisys.com URL or screenshot to replicate.
---

# Ouisys Landing Page — Creation Skill

## Goal

Produce a standalone HTML page that is **visually indistinguishable from the source** (Mouisys-hosted or screenshot-provided) and correctly wires the `OuisysSubscribe` widget for the flow, locale, and consent pattern of the original.

---

## Phase 0 — Visual Extraction (ALWAYS do this first)

Before writing any code, get a complete visual and config picture of the source.

### 0A — Fetch the raw HTML and extract config

```bash
curl -s "https://c1.mouisys.com/<page-id>" > /tmp/source-page.html

# Full configJson
grep -o 'window\.configJson\s*=\s*[^;]*' /tmp/source-page.html

# Logo URL
grep -o '"logo":{"url":"[^"]*"' /tmp/source-page.html

# Custom CSS the page applies on top of the theme
python3 -c "
import re
with open('/tmp/source-page.html') as f:
    content = f.read()
match = re.search(r'\"customCss\":\"(.*?)\"(?:,\"|\})', content, re.DOTALL)
if match:
    print(match.group(1).replace('\\\\n', '\n'))
"

# All image asset paths
grep -oE '/(os-ui|static)/[^"'\''\\s]+\.(png|svg|jpg|webp|gif)' /tmp/source-page.html | sort -u
```

### 0B — Screenshot with Playwright (REQUIRED — the page is a React SPA)

The HTML source has no rendered markup. Always render and screenshot:

```
Use mcp__plugin_playwright__browser_navigate to load the URL
Use mcp__plugin_playwright__browser_resize to set 390 × 844 (mobile)
Use mcp__plugin_playwright__browser_take_screenshot with fullPage: true
Read the screenshot file to visually inspect
```

From the screenshot, identify and note:
- **Background**: solid color, gradient, or image? What hex?
- **Header**: logo position (left/center), tagline, hamburger icon, bg color
- **Hero zone**: full-width image, card with image, no image?
- **Widget area**: is it inside a card/panel with shadow? What border-radius?
- **Button shape**: pill (50px radius), rounded (10px), square?
- **Button color**: solid or gradient? What start/end hex?
- **Button text**: uppercase? bold? letter-spacing?
- **Input shape**: pill or rounded?
- **Consent**: none / single checkbox / double checkbox / pre-checked?
- **Legal**: inline paragraph / accordion / hidden?
- **Steps section**: numbered circles, icons, or none?
- **Footer**: company info, nav links, accordion policy sections?

### 0C — Check CDN image accessibility

```bash
# For each image found in 0A:
curl -sI "https://c1.mouisys.com<image-path>" | head -3
# HTTP 200 → reference directly. 403/404 → use Playwright to download or find alternate.
```

---

## Phase 1 — Map Mouisys Config → Widget Config

### Strategy mapping

Mouisys uses compound strategy strings. Map them:

| Mouisys `strategy` | Widget `config.strategy` | Widget `strategyConfigs.default.flow` |
|---|---|---|
| `'pin'` | `'pin'` | `'pin'` |
| `'mo'` | `'mo'` | `'mo'` |
| `'mo-redir'` | `'mo-redir'` | `'moRedir'` |
| `'header-enrichment'` / `'one-click'` | `'header-enrichment'` | `'oneClick'` |
| `'click2sms'` | `'click2sms'` | `'click2sms'` |
| `'ussd'` | `'ussd'` | `'ussd'` |
| `'ask-operator'` | `'ask-operator'` | (per-operator) |
| `'pin-click2sms-ask-operator'` | `'ask-operator'` | (per-operator: PIN or click2sms) |
| `'detect-operator-by-ip'` | `'detect-operator-by-ip'` | target flow |

### Operator key format

For `ask-operator` pages, operator keys follow `{COUNTRY_UPPER}_{CARRIER}`:
- Malaysia: `MY_MAXIS`, `MY_UMOBILE`, `MY_CELCOM`, `MY_DIGI`
- Saudi: `SA_STC`, `SA_MOBILY`, `SA_ZAIN`
- Egypt: `EG_ORANGE`, `EG_ETISALAT`, `EG_VODAFONE`
- Morocco: `MA_MAROC`, `MA_ORANGE`, `MA_INWI`
- Iraq: `IQ_ZAIN`, `IQ_ASIACELL`, `IQ_KOREK`

For compound strategies like `pin-click2sms-ask-operator`, determine which carrier uses which flow from the legal text (e.g., "Maxis: RM5/week via PIN" → Maxis=PIN, "UMobile: via SMS" → UMobile=click2sms).

### Slug derivation

Use `env.page` or `env.pinScenario` / `env.moScenario` / `env.click2smsScenario` as the slug. When in doubt, use the most specific scenario string (e.g., `my-maxis-umobile-dmb-vrblast`). Confirm with the backend team.

### Messages extraction

From `pageConfigs.locale.en` (or the target locale), extract ONLY labels that differ from widget defaults. Key IDs:

```
operatorSelectionLabel  — headline above operator buttons (ask-operator flow)
msisdnLabel             — phone input label
msisdnButton            — phone submit button
moButton                — MO send button
moLabel                 — MO instruction text
pinLabel                — PIN input label
pinButton               — PIN submit button
click2smsLabel          — click2sms instruction
click2SmsButton         — click2sms button label
congratsTitle / congratsText / portalButton  — thank-you step
tryAgain / InvalidMSISDN / InvalidPIN        — error messages
```

---

## Phase 2 — Build the HTML Page

### File location

```
examples/<country>-<service>-<flow>.html
# e.g. my-vrblasts-ask-operator.html, vn-kivlo-mo.html, sa-gamezones-pin.html
```

### CSS architecture (always use this order)

```html
<link rel="stylesheet" href="../embed/widget-base.css" />  <!-- 1. widget token defaults -->
<style>
  /* 2. Page-level design tokens */
  :root {
    --c-accent:  <BRAND_HEX>;
    --c-bg:      <BG_HEX>;
    --c-text:    <TEXT_HEX>;
    --c-muted:   <MUTED_HEX>;
    --c-border:  <BORDER_HEX>;
    --c-surface: <CARD_BG_HEX>;
  }

  /* 3. Widget token overrides (scope to #subscribe) */
  #subscribe { ... }

  /* 4. Widget class-hook overrides (scope to #subscribe) */
  #subscribe .btn { ... }
  #subscribe .phone-input { ... }
  /* etc. */

  /* 5. Page layout styles */
  body { ... }
  .header { ... }
  /* etc. */
</style>
```

---

## Phase 3 — Complete Widget CSS Class Hook Reference

**These are the stable class names you can target.** Always scope overrides to `#subscribe` to avoid conflicts.

### Button

```css
/* Primary CTA and operator selection buttons */
#subscribe .btn {
  background: <GRADIENT_OR_SOLID>;
  border-radius: <PILL_50px_OR_ROUNDED_10px>;
  font-weight: 700;
  font-size: 17px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
#subscribe .btn:hover:not(:disabled) { background: <HOVER_COLOR>; }
#subscribe .btn:disabled { background: var(--ow-disabled); opacity: 0.7; }

/* Heartbeat pulse (common in Mouisys pages) */
@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.04); }
}
#subscribe .btn:not(:disabled) { animation: heartbeat 1.6s ease-in-out infinite; }
```

### Phone input

```css
/* Wrapper: flag + country code + input */
#subscribe .phone-input {
  border: 1px solid var(--c-border);
  border-radius: <MATCH_BUTTON_RADIUS>;
}

/* The text input inside */
#subscribe .text-input { font-size: 16px; }

/* Country flag */
#subscribe .flag { font-size: 22px; }

/* Country code (+60, +966, etc.) */
#subscribe .country-code { font-weight: 600; color: var(--c-text); }
```

### PIN input

```css
#subscribe .pin-wrapper { gap: 8px; }
#subscribe .pin-input {
  border: 2px solid var(--c-border);
  border-radius: 8px;
  font-size: 22px;
  font-weight: 700;
  text-align: center;
}
#subscribe .pin-input:focus { border-color: var(--c-accent); }
#subscribe .wrongPinMessage { color: var(--ow-error); font-size: 13px; }
```

### Operator selection

```css
/* Instruction label above operator buttons */
#subscribe .label-operator-selection {
  font-size: 1.2rem;
  font-weight: 700;
  text-align: center;
  color: var(--c-text);
  line-height: 1.35;
  margin: 0 auto 1rem;
}

/* Each operator button — inherits .btn styles above */
/* Target individually by data or order if needed */
#subscribe .btn-operator { width: 100%; margin-bottom: 12px; }
```

### MO flow

```css
#subscribe .mo__instruction { flex-direction: column; text-align: center; }
#subscribe .mo__instruction b { font-size: 26px; color: var(--c-accent); }
#subscribe .mo-link-request-again { color: var(--c-accent); }
/* The "(FREE SMS) for confirmation" text — usually hidden */
#subscribe .mo__additional-text { display: none !important; }
```

### Click-to-SMS

```css
#subscribe .label-click2sms {
  font-size: 1.2rem;
  font-weight: 700;
  text-align: center;
  color: var(--c-text);
}
#subscribe .label-request-again { color: var(--c-accent); text-align: center; }
```

### Thank-you / success step

```css
#subscribe .tq-step { text-align: center; padding: 20px 0; }
#subscribe .tq-countdown { font-size: 13px; color: var(--c-muted); margin-top: 8px; }
```

### Error message

```css
#subscribe .error-msg {
  color: var(--ow-error);
  font-size: 13px;
  margin-top: 6px;
}
```

### Elements to ALWAYS hide (Mouisys shows these; widget renders them empty)

```css
#subscribe .price-point,
#subscribe .dynamic-price-point,
#subscribe .msisdn-secondary-label,
#subscribe .about-to-subscribe-text,
#subscribe .mo__additional-text {
  display: none !important;
}
```

---

## Phase 4 — Page Layout Patterns

### Pattern A — White card on light grey (most common, e.g. VR Blasts MY)

```
bg: #f5f5f5
Header: white bar, logo left, hamburger right
Hero: full-width image (max-height 280px, object-fit: cover)
Widget: white card, no border-radius on top (flush with hero), padding 24px 20px
Consent: directly below widget card, white bg, 12px text, pre-checked
Legal: white bg, 10.5px, #777, centered
Steps: white card with shadow, margin 12px 16px
```

```css
body { background: #f5f5f5; color: #1a1a1a; }
.header { background: #fff; border-bottom: 1px solid #e5e7eb; }
.card { background: #fff; padding: 24px 20px; }
.legals { background: #fff; padding: 14px 20px; font-size: 10.5px; color: #777; text-align: center; }
.steps { background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,.06); margin: 12px 16px; padding: 20px; }
```

### Pattern B — Dark background with glassmorphism card (gaming/entertainment)

```
bg: dark image or gradient (#0d1b2a or similar)
Header: semi-transparent, backdrop-filter blur
Widget: glass card, bg rgba(255,255,255,.08), border rgba(255,255,255,.15)
Buttons: vibrant gradient (orange, purple, green)
Text: white
```

```css
body { background: url('<BG_IMG>') center/cover fixed; color: #fff; }
.header { background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); }
.card {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 16px;
  backdrop-filter: blur(12px);
}
#subscribe {
  --ow-text:   #ffffff;
  --ow-muted:  rgba(255,255,255,0.6);
  --ow-border: rgba(255,255,255,0.22);
  --ow-error:  #ff6b6b;
}
```

### Pattern C — Minimal (no hero, widget top of page)

```
bg: white
No hero image
Widget renders immediately below header
Steps and legals below
```

---

## Phase 5 — Consent Patterns

### None (widget handles flow without consent gate)

```js
OuisysSubscribe.mount('#subscribe', {
  config: window.configJson,
  locale: '<LOCALE>',
  messages: { ... },
  onEvent:   function (n, p) {},
  onSuccess: function (url) { window.location.href = url; }
});
```

### Single checkbox (shake on violation)

```html
<label class="consent" id="consent-row">
  <input type="checkbox" id="consent" />
  <span><CONSENT_TEXT></span>
</label>
```
```css
.consent { display: flex; gap: 10px; align-items: flex-start; font-size: 12px; color: #555; }
.consent.shake { animation: shake 0.4s; }
@keyframes shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
```
```js
var cb = document.getElementById('consent');
var row = document.getElementById('consent-row');
function props() {
  return {
    config: window.configJson, locale: '<LOCALE>',
    consentValid: cb.checked,
    onConsentRequired: function () {
      row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake');
    },
    onEvent:   function (n, p) {},
    onSuccess: function (url) { window.location.href = url; }
  };
}
var handle = OuisysSubscribe.mount('#subscribe', props());
cb.addEventListener('change', function () { handle.update(props()); });
```

### Double checkbox (Mouisys Malaysia / MCMC pattern — pre-checked)

Two checkboxes, pre-checked. Shake the whole consent section if either is unchecked on submit.

```html
<div class="consent-section" id="consent-section">
  <div class="consent-item">
    <input type="checkbox" id="consent1" checked />
    <label for="consent1">
      I agree that after the trial period ends my subscription will automatically renew
      each daily, weekly, monthly at the stated rate for the services unless I cancel.
    </label>
  </div>
  <div class="consent-item">
    <input type="checkbox" id="consent2" checked />
    <label for="consent2">
      I hereby confirm that I am 18 years of age or older and that I accept the
      <a href="#">terms and conditions</a> and the <a href="#">privacy policy</a>.
    </label>
  </div>
</div>
```
```css
.consent-section.shake { animation: shake 0.4s; }
.consent-item { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px; }
.consent-item input[type="checkbox"] { width: 18px; height: 18px; margin-top: 2px; flex-shrink: 0; accent-color: var(--c-accent); }
.consent-item label { font-size: 12px; color: #555; line-height: 1.5; cursor: pointer; }
.consent-item a { color: var(--c-accent); text-decoration: underline; }
```
```js
var cb1     = document.getElementById('consent1');
var cb2     = document.getElementById('consent2');
var section = document.getElementById('consent-section');
function consentValid() { return cb1.checked && cb2.checked; }
function props() {
  return {
    config: window.configJson, locale: '<LOCALE>',
    consentValid: consentValid(),
    onConsentRequired: function () {
      section.classList.remove('shake'); void section.offsetWidth; section.classList.add('shake');
    },
    onEvent:   function (n, p) {},
    onSuccess: function (url) { window.location.href = url; }
  };
}
var handle = OuisysSubscribe.mount('#subscribe', props());
cb1.addEventListener('change', function () { handle.update(props()); });
cb2.addEventListener('change', function () { handle.update(props()); });
```

---

## Phase 6 — Button Gradient Recipes

Match the source page button color exactly. Common patterns:

### Amber/gold (Malaysia, ME downloads)
```css
background: linear-gradient(180deg, #f5b731 0%, #e08c00 100%) !important;
```
```css
/* hover */
background: linear-gradient(180deg, #f0a820 0%, #c87a00 100%) !important;
```

### Orange (Vietnam, fitness)
```css
background: linear-gradient(135deg, #ff7b00 0%, #e05f00 100%) !important;
```

### Blue (generic, gaming)
```css
background: linear-gradient(180deg, #0050AA 0%, #3997FF 100%) !important;
```

### Green (Middle East subscription)
```css
background: linear-gradient(180deg, #1f7a4d 0%, #155e3a 100%) !important;
```

### Purple (entertainment/streaming)
```css
background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%) !important;
```

Always add `!important` when overriding `.btn` — the widget sets background via `--ow-accent` and the specificity may be equal. Scoping to `#subscribe .btn` plus `!important` wins reliably.

---

## Phase 7 — Mouisys Full-Page Section Replication

The Mouisys platform renders many sections below the widget. Replicate only what adds conversion value:

### Sections to ALWAYS include
- Header (logo + hamburger or tagline)
- Hero image (if present)
- Widget card
- Consent (if the source has it)
- Legal text

### Sections to include if they appear prominently
- **"How it works" steps** — numbered 1/2/3 circles matching accent color
- **Features accordion** — use `<details><summary>` for cheap accordion
- **Showcase / content grid** — image grid with captions

### "About" / footer company info (include verbatim from locale strings)
```
Mobimilia B.V. / Sam Media BV
Van Diemenstraat 356, 1013 CR, Amsterdam, The Netherlands
+48 22 244 4022
```

### Policy accordion pattern (lightweight, no JS needed)

```html
<details class="policy">
  <summary class="policy__title">Pricing Policy</summary>
  <div class="policy__body"><PRICING_TEXT></div>
</details>
```
```css
.policy { border-bottom: 1px solid #e5e7eb; padding: 14px 0; }
.policy__title { font-weight: 600; font-size: 15px; cursor: pointer; list-style: none; display: flex; justify-content: space-between; }
.policy__title::after { content: '↓'; color: var(--c-muted); }
.policy[open] .policy__title::after { content: '↑'; }
.policy__body { font-size: 13px; color: #555; line-height: 1.7; margin-top: 10px; }
```

### Content showcase grid

```html
<div class="showcase">
  <img src="..." alt="..." />
  <img src="..." alt="..." />
  <img src="..." alt="..." />
  <img src="..." alt="..." />
</div>
```
```css
.showcase { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 16px; }
.showcase img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; }
```

---

## Phase 8 — Strategy-Specific Complete Config

### PIN flow

```js
window.configJson = {
  strategy: 'pin',
  country: '<COUNTRY_LOWER>',
  strategyConfigs: {
    default: {
      flow: 'pin',
      flowConfig: { host: '', slug: '<SLUG>', device: 'smart', country: '<COUNTRY_UPPER>', service: '<SERVICE>' }
    },
    operators: {},
    isDecryptMsisdnByApi: false,
    isExpectMsisdnInLocalHeaders: false
  },
  pageConfigs: {
    serviceName: '<SERVICE_NAME>',
    isShowConsentCheckBox: false,
    isDisableButtonIfInvalid: true,
    hasMoButton: false,
    pin: { shortCodes: ['<SHORTCODE>'], blockedPin: ['0000', '1234'] },
    plan: { trialPrice: '<PRICE>', isLocalCurrency: false }
  }
};
```

### MO flow

Same as PIN but `strategy: 'mo'`, `flow: 'mo'`, no `pin` key in `pageConfigs`.

### Ask-operator flow (multi-carrier)

```js
window.configJson = {
  strategy: 'ask-operator',
  country: '<COUNTRY_LOWER>',
  strategyConfigs: {
    default: {
      flow: '<DEFAULT_FLOW>',  // fallback if operator not matched
      flowConfig: { host: '', slug: '<SLUG>', device: 'smart', country: '<COUNTRY_UPPER>', service: '<SERVICE>' }
    },
    operators: {
      '<COUNTRY_UPPER>_<CARRIER_A>': {
        flow: 'pin',   // or 'mo', 'click2sms', 'oneClick'
        flowConfig: { host: '', slug: '<SLUG_A>', device: 'smart', country: '<COUNTRY_UPPER>', service: '<SERVICE>' }
      },
      '<COUNTRY_UPPER>_<CARRIER_B>': {
        flow: 'click2sms',
        flowConfig: { host: '', slug: '<SLUG_B>', device: 'smart', country: '<COUNTRY_UPPER>', service: '<SERVICE>' }
      }
    },
    isDecryptMsisdnByApi: false,
    isExpectMsisdnInLocalHeaders: false
  },
  pageConfigs: {
    serviceName: '<SERVICE_NAME>',
    isShowConsentCheckBox: false,
    isDisableButtonIfInvalid: true,
    pin: { shortCodes: ['<SHORTCODE>'], blockedPin: ['0000', '1234'] },
    plan: { trialPrice: '', isLocalCurrency: false }
  }
};
```

### One-click / header enrichment

```js
window.configJson = {
  strategy: 'header-enrichment',
  country: '<COUNTRY_LOWER>',
  strategyConfigs: {
    default: { flow: 'oneClick', flowConfig: { host: '', slug: '<SLUG>', device: 'smart', country: '<COUNTRY_UPPER>', service: '<SERVICE>' } },
    operators: {},
    isDecryptMsisdnByApi: false,
    isExpectMsisdnInLocalHeaders: false
  },
  pageConfigs: { serviceName: '<SERVICE_NAME>', isShowConsentCheckBox: false, isDisableButtonIfInvalid: true }
};
// Dev only — mock HE MSISDN:
window.pac_analytics.visitor.heMsisdnResult = { msisdn: '<E164_NUMBER>' };
```

---

## Phase 9 — RTL / Arabic Support

For Arabic pages (`lang="ar"`, locale `'ar'`):

```html
<html lang="ar" dir="rtl">
```
```css
body { direction: rtl; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
/* Widget mirrors automatically when dir=rtl is on <html> */
/* Flag stays LTR — pin it: */
#subscribe .flag { direction: ltr; }
#subscribe .country-code { direction: ltr; }
```

---

## Phase 10 — Deploy to S3 (DCB)

After building and testing locally:

```bash
# From repo root — uploads embed/ AND examples/ to S3
yarn upload:embed

# Or build the widget bundle first, then upload:
yarn deploy:embed
```

**What gets uploaded:**
- `embed/ouisys-subscription-widget.js` → `https://staging.mouisys.com/os-ui/static/eamobi/dcb/ouisys-subscription-widget.js`
- `embed/widget-base.css` → `…/widget-base.css`
- `embed/*.html` → `…/<name>.html`
- `examples/*.html` → `…/<name>.html` (asset paths `../embed/` → `./` are rewritten automatically)

**Required env vars:** `osui_aws_access_key_id`, `osui_secret_access_key`

**Verify after deploy:**

```
Use mcp__plugin_playwright__browser_navigate to load the S3/CDN URL
Use mcp__plugin_playwright__browser_take_screenshot to confirm it renders correctly
```

---

## Phase 11 — QA Checklist

Run through this on the local serve URL and then again on the deployed CDN URL.

**Visual fidelity**
- [ ] Logo loads, correct size and position
- [ ] Hero image loads, correct crop (object-fit: cover, expected height)
- [ ] Button color and shape match source screenshot exactly
- [ ] Input shape matches (pill vs rounded)
- [ ] Consent checkboxes present/absent/pre-checked as per source
- [ ] Legal text matches source (correct carrier names, amounts, shortcodes)
- [ ] Steps section (if present) uses correct accent color for circles
- [ ] Mobile viewport (390px) looks correct — no horizontal scroll
- [ ] Dark/light token overrides correctly applied (no white text on white bg)

**Widget function**
- [ ] No JS errors in console on load
- [ ] `OuisysSubscribe` is defined (bundle loaded)
- [ ] Widget renders correct first step (phone input or operator buttons or one-click)
- [ ] Operator buttons show correct carrier names (for ask-operator)
- [ ] Consent gate: button blocked and shake fires when unchecked (if applicable)
- [ ] `ouisys.phone.submit` fires in console when number submitted
- [ ] `onSuccess` fires and redirects correctly

**Quick local server**
```bash
npx serve . -p 8091
# http://localhost:8091/examples/<filename>
```

---

## Common Mistakes (don't repeat these)

| Mistake | Fix |
|---|---|
| `strategy: 'moRedir'` | Use `'mo-redir'` (hyphenated) in `config.strategy`; `'moRedir'` only in `flow` |
| `strategy: 'oneClick'` | Use `'header-enrichment'` in `config.strategy` |
| `../embed/` paths in deployed file | The upload script rewrites these to `./` automatically |
| `consentValid: false` then `handle.submit()` without `handle.update()` | Always call `handle.update({ consentValid: true })` before `handle.submit()` |
| Watching `[rds]` not `[rds?.tag]` | Causes double-firing of state-change events |
| Missing `window.OUISYS_COUNTRY` | Phone flag and MSISDN validation break |
| Missing `window.pac_analytics.visitor.offer` | Engine sends undefined offerId; backend rejects calls |
| Globals set after `<script src="...widget.js">` | Engine reads them at load time; must be BEFORE the bundle |
| Operator key wrong (e.g. `MAXIS` not `MY_MAXIS`) | Widget falls back to `default` flow silently; no operator selection |
| Not hiding `.price-point` | Widget renders empty price placeholder visually breaking layout |
| CSS specificity losing to widget | Add `!important` and scope to `#subscribe .btn` |
| Heartbeat animation on disabled button | Add `:not(:disabled)` guard to the animation rule |

---

## Complete Minimal Template

```html
<!DOCTYPE html>
<html lang="<LANG>">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title><TITLE></title>
  <link rel="icon" href="<FAVICON_URL>" />
  <link rel="stylesheet" href="../embed/widget-base.css" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    :root {
      --c-accent:  <BRAND_HEX>;
      --c-bg:      <BG_HEX>;
      --c-text:    <TEXT_HEX>;
      --c-muted:   <MUTED_HEX>;
      --c-surface: <CARD_BG_HEX>;
    }

    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--c-bg);
      color: var(--c-text);
    }

    /* Header */
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 16px;
      background: <HEADER_BG>;
      border-bottom: 1px solid <HEADER_BORDER>;
    }
    .header__logo img { height: <LOGO_HEIGHT>px; object-fit: contain; display: block; }
    .header__menu { display: flex; flex-direction: column; gap: 5px; cursor: pointer; }
    .header__menu span { display: block; width: 22px; height: 2px; background: var(--c-text); border-radius: 2px; }

    /* Hero */
    .hero { width: 100%; line-height: 0; }
    .hero img { width: 100%; max-height: <HERO_HEIGHT>px; object-fit: cover; object-position: center; display: block; }

    /* Page */
    .page { max-width: 460px; margin: 0 auto; padding: 0 0 60px; }

    /* Widget card */
    .card { background: var(--c-surface); padding: 24px 20px 20px; <CARD_EXTRA_STYLES> }

    /* Widget tokens */
    #subscribe {
      --ow-accent:          var(--c-accent);
      --ow-accent-hover:    <ACCENT_DARK>;
      --ow-accent-contrast: #fff;
      --ow-bg:              transparent;
      --ow-text:            var(--c-text);
      --ow-muted:           var(--c-muted);
      --ow-border:          <BORDER_HEX_OR_RGBA>;
      --ow-error:           <ERROR_HEX>;
      --ow-radius:          <RADIUS_PX>;
      --ow-control-height:  50px;
      --ow-font-size:       15px;
    }

    /* Button override */
    #subscribe .btn,
    #subscribe .btn-operator {
      background: <BTN_GRADIENT_OR_COLOR> !important;
      border-radius: <BTN_RADIUS> !important;
      font-weight: 700 !important;
      font-size: 17px !important;
      text-transform: uppercase !important;
      letter-spacing: 0.04em !important;
      border: none !important;
    }
    #subscribe .btn:hover:not(:disabled),
    #subscribe .btn-operator:hover {
      background: <BTN_HOVER> !important;
    }

    /* Input shape */
    #subscribe .phone-input,
    #subscribe .text-input { border-radius: <INPUT_RADIUS> !important; }

    /* Always hide noisy elements */
    #subscribe .price-point,
    #subscribe .dynamic-price-point,
    #subscribe .msisdn-secondary-label,
    #subscribe .about-to-subscribe-text,
    #subscribe .mo__additional-text { display: none !important; }

    /* Operator label */
    #subscribe .label-operator-selection {
      font-size: 1.2rem; font-weight: 700; text-align: center;
      color: var(--c-text); line-height: 1.35; margin: 0 auto 1rem;
    }

    /* Consent */
    .consent-section { background: var(--c-surface); padding: 0 20px 16px; }
    .consent-item { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px; }
    .consent-item input[type="checkbox"] { width: 18px; height: 18px; margin-top: 2px; flex-shrink: 0; accent-color: var(--c-accent); }
    .consent-item label { font-size: 12px; color: <CONSENT_TEXT_COLOR>; line-height: 1.5; cursor: pointer; }
    .consent-item a { color: var(--c-accent); text-decoration: underline; }
    .consent-section.shake { animation: shake .4s; }
    @keyframes shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }

    /* Legal */
    .legals {
      background: var(--c-surface); margin: 8px 0 0; padding: 14px 20px;
      font-size: 10.5px; color: <LEGAL_TEXT_COLOR>; line-height: 1.7; text-align: center;
    }

    /* Steps */
    .steps { margin: 12px 16px 0; background: var(--c-surface); border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,.06); padding: 20px; }
    .steps__title { font-size: 10px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: var(--c-muted); margin: 0 0 16px; }
    .steps__list { display: flex; flex-direction: column; gap: 14px; }
    .step { display: flex; align-items: center; gap: 14px; }
    .step__num { width: 32px; height: 32px; border-radius: 50%; background: var(--c-accent); color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .step__text { font-size: 14px; color: var(--c-text); }
  </style>
</head>
<body>

  <header class="header">
    <div class="header__logo">
      <img src="<LOGO_URL>" alt="<SERVICE_NAME>" />
    </div>
    <div class="header__menu" aria-label="Menu">
      <span></span><span></span><span></span>
    </div>
  </header>

  <div class="hero">
    <img src="<HERO_URL>" alt="<SERVICE_NAME>" />
  </div>

  <div class="page">

    <div class="card">
      <div id="subscribe"></div>
    </div>

    <!-- Double-checkbox consent (remove if source has none) -->
    <div class="consent-section" id="consent-section">
      <div class="consent-item">
        <input type="checkbox" id="consent1" checked />
        <label for="consent1"><CONSENT_TEXT_1></label>
      </div>
      <div class="consent-item">
        <input type="checkbox" id="consent2" checked />
        <label for="consent2">
          I am 18+ and accept the <a href="#">terms and conditions</a> and <a href="#">privacy policy</a>.
        </label>
      </div>
    </div>

    <p class="legals"><LEGAL_TEXT></p>

    <div class="steps">
      <p class="steps__title">How it works</p>
      <div class="steps__list">
        <div class="step"><div class="step__num">1</div><div class="step__text"><STEP_1></div></div>
        <div class="step"><div class="step__num">2</div><div class="step__text"><STEP_2></div></div>
        <div class="step"><div class="step__num">3</div><div class="step__text"><STEP_3></div></div>
      </div>
    </div>

  </div>

  <!-- ① Globals (BEFORE widget bundle) -->
  <script>
    window.DEV_BASE_URL    = 'https://de.tallymans.com';
    window.DEV_BASE_URL_IP = 'c1.ouisys.com';
    window.OUISYS_COUNTRY  = '<COUNTRY_LOWER>';

    window.pac_analytics = {
      visitor: {
        rockmanId: (function () {
          var b = new Uint8Array(16); crypto.getRandomValues(b);
          return Array.from(b, function (x) { return x.toString(16).padStart(2,'0'); }).join('');
        })(),
        ip_range_name: '<COUNTRY_LOWER>',
        legals: [],
        chainRedirectUrl: '',
        offer: <OFFER_ID>,
        xaid: 'SAM',
        cid: <CID>,
        hostname: 'de.tallymans.com'
      }
    };

    window.configJson = { /* see Phase 8 for full config per strategy */ };
  </script>

  <!-- ② Bundle -->
  <script src="../embed/ouisys-subscription-widget.js"></script>

  <!-- ③ Mount -->
  <script>
    var cb1     = document.getElementById('consent1');
    var cb2     = document.getElementById('consent2');
    var section = document.getElementById('consent-section');

    function consentValid() { return cb1.checked && cb2.checked; }

    function props() {
      return {
        config: window.configJson,
        locale: '<LOCALE>',
        messages: {
          operatorSelectionLabel: '<OPERATOR_HEADLINE>',
          msisdnLabel:    '<PHONE_LABEL>',
          msisdnButton:   'CONTINUE',
          pinLabel:       '<PIN_LABEL>',
          pinButton:      'CONFIRM',
          click2smsLabel: '<C2S_LABEL>',
          click2SmsButton:'CONTINUE',
          congratsTitle:  'Congratulations!',
          congratsText:   '<CONGRATS_TEXT>',
          portalButton:   'Go to portal',
          tryAgain:       'Try again',
          InvalidMSISDN:  '<INVALID_MSISDN_MSG>',
          InvalidPIN:     '<INVALID_PIN_MSG>'
        },
        consentValid: consentValid(),
        onConsentRequired: function () {
          section.classList.remove('shake'); void section.offsetWidth; section.classList.add('shake');
        },
        onEvent:   function (name, payload) { /* analytics.track(name, payload) */ },
        onSuccess: function (productUrl)   { window.location.href = productUrl; }
      };
    }

    var handle = OuisysSubscribe.mount('#subscribe', props());
    cb1.addEventListener('change', function () { handle.update(props()); });
    cb2.addEventListener('change', function () { handle.update(props()); });
  </script>

</body>
</html>
```

---

## Reference Files

| File | Country | Flow | Notes |
|---|---|---|---|
| `examples/vrblasts-my.html` | Malaysia | ask-operator (MAXIS PIN + UMOBILE click2sms) | White bg, amber buttons, double consent, hero image |
| `examples/kivlo-vn.html` | Vietnam | MO | Light card bg, orange buttons, Vietnamese locale, steps |
| `embed/widget-embed.html` | Saudi Arabia | PIN / all flows | Dev harness with flow switcher and event log |

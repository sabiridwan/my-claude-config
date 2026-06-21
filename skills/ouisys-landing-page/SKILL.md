---
name: ouisys-landing-page
description: Use when creating a new DCB/carrier-billing landing page that embeds the Ouisys Subscription Widget (OuisysSubscribe). Triggers when user says "create landing page", "build a subscription page", "clone this page", "copy this page", or references a mouisys.com/c1.ouisys.com URL to replicate.
---

# Ouisys Landing Page — Creation Skill

## What This Skill Does

Guides you through building a standalone HTML landing page that embeds `ouisys-subscription-widget.js`. The widget handles the entire carrier-billing subscription flow (PIN, MO, one-click, click-to-SMS, USSD). The host page owns all visual design.

---

## Phase 0 — Gather Requirements

Before writing a single line of HTML, collect:

1. **Source page** — URL to replicate (e.g. `https://c1.mouisys.com/xgjb2`). Fetch its source HTML to extract:
   - `window.configJson` (strategy, country, flowConfig.slug, service)
   - Language / locale
   - Brand colors, logo URL, hero image URL
   - Consent text and legal text
   - Custom labels (messages)

2. **Widget bundle path** — relative path from the new page to `ouisys-subscription-widget.js` (in `embed/`) and `widget-base.css`.

3. **Flow type** — which strategy the page uses:

| Flow | `config.strategy` | `strategyConfigs.default.flow` |
|---|---|---|
| Enter phone → PIN SMS | `'pin'` | `'pin'` |
| Enter phone → send MO SMS | `'mo'` | `'mo'` |
| Enter phone → redirect to payment URL | `'mo-redir'` | `'moRedir'` |
| Carrier header-enriched one-click | `'header-enrichment'` | `'oneClick'` |
| SMS shortcode button | `'click2sms'` | `'click2sms'` |
| USSD dial | `'ussd'` | `'ussd'` |
| Show operator selector first | `'ask-operator'` | (per-operator configs) |

4. **Consent handling** — does the page have an explicit consent checkbox? Most DCB pages handle consent inline; only add a checkbox if the operator or legal team requires it.

---

## Phase 1 — Scrape the Source Page (if replicating)

```bash
# Fetch the source page HTML
curl -s "https://c1.mouisys.com/<page-id>" > /tmp/source-page.html

# Extract configJson
grep -o 'window\.configJson\s*=\s*{[^;]*' /tmp/source-page.html

# Extract image URLs
grep -oE '/(os-ui|static)/[^"'\''\\s]+\.(png|svg|jpg|webp)' /tmp/source-page.html

# Extract the logo URL from pageConfigs.logo.url
grep -o '"logo":{"url":"[^"]*"' /tmp/source-page.html

# Extract custom CSS
grep -oP '(?<=customCss":")[^"]*' /tmp/source-page.html
```

For assets on Mouisys CDN (`c1.mouisys.com`), check accessibility before referencing:
```bash
curl -sI "https://c1.mouisys.com<image-path>" | head -3
```
If HTTP 200 → reference directly. If 403/404 → download and host locally.

---

## Phase 2 — Map Mouisys Config → Widget Config

The Mouisys platform has its own complex config format. Map it to the widget's simpler format:

**Mouisys `pageConfigs.env` → widget `flowConfig`:**

| Mouisys field | Widget field |
|---|---|
| `env.country` | `flowConfig.country` (UPPERCASE) |
| `env.strategy` | `config.strategy` |
| `env.moService` / `env.moScenario` | informs `flowConfig.slug` (ask the team for the exact slug) |
| `env.page` | `flowConfig.slug` (often matches the backend slug) |

**Mouisys `pageConfigs.locale.<lang>` → widget `messages` prop:**

Extract only the labels that differ from English defaults (see `src/messages.ts` for default IDs):

Key message IDs to check:
- `msisdnLabel`, `msisdnButton` — phone step
- `moButton`, `moLabel`, `moAdditionalText` — MO step
- `pinLabel`, `pinButton` — PIN step
- `congratsTitle`, `congratsText`, `portalButton` — thank-you step
- `InvalidMSISDN`, `InvalidPIN`, `tryAgain` — errors

---

## Phase 3 — Build the HTML Page

### File location convention

```
examples/
└── <country>-<service>-<flow>.html   # e.g. vn-kivlo-mo.html, sa-gamezones-pin.html
```

Or for production deploys, match the operator's naming scheme.

### Template structure

```html
<!DOCTYPE html>
<html lang="<LANG>">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title><PAGE_TITLE></title>

  <!-- Widget base CSS (token-based defaults) -->
  <link rel="stylesheet" href="../embed/widget-base.css" />

  <style>
    /* ── 1. CSS tokens — override the brand colors ────── */
    :root {
      --c-accent: <BRAND_COLOR>;      /* e.g. #ff7b00 */
      --c-bg:     <BG_COLOR>;         /* e.g. #0f1623 or #ffffff */
      --c-text:   <TEXT_COLOR>;       /* e.g. #ffffff or #1a1a1a */
      --c-muted:  <MUTED_COLOR>;
    }

    /* ── 2. Widget token overrides ───────────────────── */
    #subscribe {
      --ow-accent:       var(--c-accent);
      --ow-accent-hover: <ACCENT_DARK>;
      --ow-bg:           transparent;
      --ow-text:         var(--c-text);
      --ow-muted:        var(--c-muted);
      --ow-border:       rgba(0,0,0,0.18);  /* or rgba(255,255,255,0.22) for dark bg */
      --ow-radius:       10px;
      --ow-control-height: 50px;
    }

    /* ── 3. Page layout ──────────────────────────────── */
    body { margin: 0; font-family: system-ui, sans-serif; background: var(--c-bg); color: var(--c-text); }
    .page { max-width: 460px; margin: 0 auto; padding-bottom: 60px; }

    /* Add consent shake animation if using checkbox: */
    .consent.shake { animation: shake 0.4s; }
    @keyframes shake {
      25% { transform: translateX(-6px); }
      75% { transform: translateX(6px); }
    }
  </style>
</head>
<body>

  <!-- Header: logo + tagline -->
  <header class="header">
    <img src="<LOGO_URL>" alt="<SERVICE_NAME>" />
    <span><TAGLINE></span>
  </header>

  <!-- Hero image / persuasive area -->
  <div class="hero">
    <img src="<HERO_IMAGE_URL>" alt="<SERVICE_NAME>" />
  </div>

  <div class="page">

    <!-- Headline above widget -->
    <p class="headline"><HEADLINE></p>

    <!-- Widget mount point -->
    <div id="subscribe"></div>

    <!-- Optional: page-owned consent checkbox -->
    <!-- 
    <label class="consent" id="consent-row">
      <input type="checkbox" id="consent" />
      <span><CONSENT_TEXT></span>
    </label>
    -->

    <!-- Steps (if applicable to the flow) -->
    <div class="steps">
      <p class="steps-title">HOW IT WORKS</p>
      <div class="step"><span class="step-num">1</span><span><STEP_1></span></div>
      <div class="step"><span class="step-num">2</span><span><STEP_2></span></div>
      <div class="step"><span class="step-num">3</span><span><STEP_3></span></div>
    </div>

    <!-- Legals -->
    <p class="legals"><LEGAL_TEXT></p>

  </div>

  <!-- ① Globals — MUST be set before the widget bundle loads -->
  <script>
    window.DEV_BASE_URL   = 'https://de.tallymans.com';  // DCB backend host
    window.OUISYS_COUNTRY = '<COUNTRY_LOWERCASE>';        // e.g. 'vn', 'sa', 'ma'

    window.pac_analytics = {
      visitor: {
        rockmanId: (function () {
          var b = new Uint8Array(16); crypto.getRandomValues(b);
          return Array.from(b, function (x) { return x.toString(16).padStart(2, '0'); }).join('');
        })(),
        ip_range_name: '<COUNTRY_LOWERCASE>',
        legals: [],
        chainRedirectUrl: ''
      }
    };

    window.configJson = {
      strategy: '<STRATEGY>',          // e.g. 'mo', 'pin', 'header-enrichment'
      country:  '<COUNTRY_LOWERCASE>',
      strategyConfigs: {
        default: {
          flow: '<FLOW>',              // camelCase: 'mo', 'pin', 'oneClick', 'moRedir'
          flowConfig: {
            host:    '',               // '' = use window.DEV_BASE_URL
            slug:    '<BACKEND_SLUG>', // e.g. 'vn-mobzones-th1'  — get from backend team
            device:  'smart',
            country: '<COUNTRY_UPPER>',// e.g. 'VN', 'SA', 'MA'
            service: '<SERVICE>'       // e.g. 'mobzones', 'gamezones'
          }
        },
        operators: {},
        isDecryptMsisdnByApi: false,
        isExpectMsisdnInLocalHeaders: false
      },
      pageConfigs: {
        serviceName:            '<SERVICE_NAME>',
        isShowConsentCheckBox:  false,
        isDisableButtonIfInvalid: true,
        plan: { trialPrice: '<TRIAL_PRICE>', isLocalCurrency: false }
        // PIN-specific:
        // pin: { shortCodes: ['<SHORTCODE>'], blockedPin: ['0000', '1234'] }
      }
    };
  </script>

  <!-- ② Widget bundle -->
  <script src="../embed/ouisys-subscription-widget.js"></script>

  <!-- ③ Mount -->
  <script>
    /* Without consent checkbox: */
    var handle = OuisysSubscribe.mount('#subscribe', {
      config: window.configJson,
      locale: '<LOCALE>',        // e.g. 'vi', 'ar', 'en', 'fr'
      messages: {
        /* Override only the labels that differ from English defaults.
           Full list of IDs: see src/messages.ts */
        msisdnLabel:  '<PHONE_LABEL>',
        msisdnButton: '<PHONE_BUTTON>',
        /* moButton, moLabel, pinLabel, pinButton, congratsTitle, etc. */
      },
      onEvent:   function (name, payload) { /* analytics.track(name, payload) */ },
      onSuccess: function (productUrl)   { window.location.href = productUrl; }
    });

    /* With consent checkbox (uncomment if using the #consent element above):
    var cb  = document.getElementById('consent');
    var row = document.getElementById('consent-row');
    function props() {
      return {
        config: window.configJson, locale: '<LOCALE>',
        consentValid: cb.checked,
        onConsentRequired: function () {
          row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake');
        },
        onEvent:   function (name, payload) { },
        onSuccess: function (url)          { window.location.href = url; }
      };
    }
    var handle = OuisysSubscribe.mount('#subscribe', props());
    cb.addEventListener('change', function () { handle.update(props()); });
    */
  </script>

</body>
</html>
```

---

## Phase 4 — Dark vs Light Background Checklist

Choosing the right widget token values based on background:

### Dark background (dark navy, black gradient)
```css
#subscribe {
  --ow-bg:    transparent;
  --ow-text:  #ffffff;
  --ow-muted: rgba(255, 255, 255, 0.65);
  --ow-border: rgba(255, 255, 255, 0.22);
  --ow-error: #ff6b6b;
}
```

### Light background (white, light grey)
```css
#subscribe {
  --ow-bg:    transparent;
  --ow-text:  #1a1a1a;
  --ow-muted: #667085;
  --ow-border: #cfd8e0;
  --ow-error: #c0392b;
}
```

---

## Phase 5 — Strategy-Specific Notes

### MO flow (`strategy: 'mo'`)
- Widget shows phone input → "Send SMS" button → waiting screen → success
- Add a step list (1. tap continue, 2. send SMS, 3. access content) — the MO step doesn't show them automatically
- `moAdditionalText` label shows "(FREE SMS) for confirmation" by default — override per locale

### PIN flow (`strategy: 'pin'`)
- Widget shows phone input → step 2 PIN entry
- Add `pageConfigs.pin.shortCodes: ['<SHORTCODE>']` for instruction text
- Add `pageConfigs.pin.blockedPin` to prevent common PINs (e.g. `['0000', '1234']`)

### One-click / Header enrichment (`strategy: 'header-enrichment'`)
- Button only renders when `window.pac_analytics.visitor.heMsisdnResult.msisdn` is set (injected by carrier network)
- In dev, mock it: `window.pac_analytics.visitor.heMsisdnResult = { msisdn: '<E164_NUMBER>' }`
- Shows `ouisys.oneclick.view` event when button renders; `ouisys.oneclick.submit` on click

### Click-to-SMS (`strategy: 'click2sms'`)
- No phone input — shows keyword + shortcode and a "send SMS" button
- Add `pageConfigs.pin.shortCodes` for the shortcode display

### Operator select (`strategy: 'ask-operator'`)
- Add `strategyConfigs.operators` map — one entry per operator
- Each entry has its own `flow` + `flowConfig.slug`

---

## Phase 6 — QA Checklist

Before marking a page ready:

- [ ] Open the HTML in browser — no JS errors in console
- [ ] `OuisysSubscribe` is defined (bundle loaded correctly)
- [ ] Widget renders the correct flow step (phone input or operator select)
- [ ] Button click triggers `ouisys.phone.submit` or `ouisys.oneclick.submit` in console
- [ ] `consentValid` gate works: button blocked until consent (if applicable)
- [ ] Logo and hero image load correctly (check for 404s in network tab)
- [ ] Text renders in the correct locale (not garbled Unicode)
- [ ] `onSuccess` fires and redirects to `productUrl` on success
- [ ] Mobile viewport looks correct (max-width ~460px)

### Quick local test
```bash
# From repo root
npx serve .    # or: python3 -m http.server 8080
# Then open: http://localhost:8080/examples/kivlo-vn.html
```

---

## Common Mistakes to Avoid

- **Don't pass `strategy: 'moRedir'` (camelCase)** to `config.strategy` — the engine expects `'mo-redir'` (hyphenated). Only `strategyConfigs.default.flow` uses `'moRedir'`.
- **Don't set `consentValid: false` then call `handle.submit()` without `handle.update({ consentValid: true })`** first — it will buffer again immediately.
- **Don't watch `[rds]` in custom event effects** — watch `[rds?.tag]` to avoid double-firing.
- **Don't forget `window.OUISYS_COUNTRY`** — the phone input flag depends on it.
- **Don't omit `window.pac_analytics.visitor.rockmanId`** — the engine requires it (any string works in dev).
- **Always set globals BEFORE `<script src="...ouisys-subscription-widget.js">`** — the bundle reads them at load time.
- **`widget-base.css` is optional** — include it to get `--ow-*` token defaults; omit it if you're writing all widget styles yourself via class hooks.

---

## Reference: Key Widget Events for Analytics

Wire these in `onEvent` for your analytics platform:

| Event | When |
|---|---|
| `ouisys.widget.ready` | Flow loaded, first step visible |
| `ouisys.phone.submit` | User tapped phone submit |
| `ouisys.phone.success` | Phone accepted by backend |
| `ouisys.phone.error` | Phone rejected |
| `ouisys.mo.submit` | MO SMS triggered |
| `ouisys.mo.success` | MO verified |
| `ouisys.pin.submit` | User submitted PIN |
| `ouisys.pin.success` | PIN verified |
| `ouisys.oneclick.view` | One-click button rendered |
| `ouisys.oneclick.submit` | One-click button pressed |
| `ouisys.subscription.success` | Final success on any flow |
| `ouisys.consent.required` | Submit attempted while `consentValid: false` |

---

## Example Pages

| File | Country | Flow | Notes |
|---|---|---|---|
| `examples/kivlo-vn.html` | Vietnam | MO | Dark theme, Vietnamese text, fitness brand |
| `embed/widget-embed.html` | Saudi Arabia | PIN / all flows | Dev harness with flow switcher and event log |

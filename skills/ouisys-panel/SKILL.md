---
name: ouisys-panel
description: Use when creating a new credit card page, updating an existing page config, or pulling config from the Ouisys panel (panel.ouisys.com). Triggers when user says "create page", "update page config", "sync panel", "publish page", or references the Ouisys dashboard.
---

# Ouisys Panel — MCP Automation Skill

## Overview

Automates interaction with `panel.ouisys.com` using the Playwright MCP browser. Two modes:

- **Create** — fill the create-credit-card form from the current repo's `config.json` + `brand.config.json`, then capture the page ID from the API response
- **Update / Pull** — use `yarn pull:config` (calls `c1.ouisys.com`) or re-submit via panel browser

The Playwright browser maintains its session across invocations. Google OAuth only needs to be completed once.

---

## Phase 0 — Ensure Template + Version Exist

Before creating a page, the panel requires a **template** entry (linked to the repo) and at least one **template version** (S3 URL of the built HTML). Check first — don't create if already present.

```
1. browser_navigate → https://panel.ouisys.com/dynamic-pages/templates/list
2. Search for template name matching the repo (e.g. cc-dynamic-template-demo)
   - Found → click it → check "Template Versions" tab has at least one version → proceed to Phase 1
   - Not found → create template (see below)
```

### Create Template (if missing)

```
browser_navigate → https://panel.ouisys.com/dynamic-pages/templates/list
Click "Create" button
Fill:
  - Country: from config.json → country (e.g. XX)
  - Template Name: repo name (e.g. cc-dynamic-template-demo)
Submit → note the new template ID
```

### Add Template Version (if no versions)

On the template details page → "Template Versions" tab → Create:
```
  - Version label: v1 (increment for each new build)
  - Version URL: https://s3.eu-central-1.amazonaws.com/mobirun/os-ui/static/{repo-name}/html/v1_index.html
  - Reason: init
```

S3 URL pattern: `https://s3.eu-central-1.amazonaws.com/mobirun/os-ui/static/{repo-name}/html/{version}_index.html`

### Known Templates

| Template name | ID | Version ID | Version | URL |
|---|---|---|---|---|
| `cc-dynamic-template-demo` | 132 | 1360 | v1 | `…/static/cc-dynamic-template-demo/html/v1_index.html` |
| `cc-dynamic-template-demo-nid-gcomp` | 127 | 1335 | v3 | `…/static/cc-dynamic-template-demo-nid-gcomp/html/v3_index.html` |

---

## Phase 1 — Ensure Login

```
1. browser_navigate → https://panel.ouisys.com/dynamic-pages/create-credit-card
2. browser_snapshot → check page title / URL
   - If redirected to /login → proceed to step 3
   - If already on the create form → skip to Phase 2
3. browser_click → "Continue with Google" button
4. STOP — tell user: "Please complete Google sign-in in the Playwright browser, then say 'continue'."
5. After user confirms → browser_snapshot to verify login succeeded
```

---

## Phase 2A — Create New Page

Read these files from the current repo first:
- `config.json` → `strategy`, `country`, `strategyConfigs.default.flowConfig` (slug, service, host)
- `src/config/brand.config.json` → `brand.defaultServiceId`, `languages`, `links`, `pricing`
- `.env` → `page`, `client`, `title`

Navigate and fill the form:

```
1. browser_navigate → https://panel.ouisys.com/dynamic-pages/create-credit-card
2. browser_snapshot → identify all form fields
3. Fill fields from config (map below)
4. Click "Next" / submit
5. browser_network_requests (filter: "panel.ouisys.com/api") → find POST /api/v2/create-page-config
6. browser_network_request(index) part="response-body" → extract page_config_id
7. Store in .env as ouisys_page_config_id=<page_config_id>
```

### Field Mapping (config.json → panel form)

| Panel field | Source |
|---|---|
| Country | `config.json → country` |
| Template | Select template by name matching `cc-dynamic-template-*` |
| Template Version | Latest version available |
| Page Name | `.env → page` (append `-dyn` suffix for draft pages) |
| Title | `.env → title` |
| Slug | `strategyConfigs.default.flowConfig.slug` |
| Service ID | `brand.config.json → brand.defaultServiceId` |
| Service Display Name | Derived from service ID |
| Gateway | `config.json → strategyConfigs.default.flowConfig.service` |
| Apple Pay Merchant Identifier | From `pageConfigs.payments.applePay.merchantIdentifier` |
| Google Pay Gateway Merchant ID | From `pageConfigs.payments.googlePay.gatewayMerchantId` |
| Trial Price | `brand.config.json → pricing.trialPrice` |
| Full Price | `brand.config.json → pricing.subscriptionPrice` |

**Payment fields with no source yet:** Use placeholder values if creating a test page:
- Gateway Merchant ID → `AGDS030924001`
- Google Merchant ID → `BCR2DN4T6O6NPIB5`
- Merchant Name → `Prizeflix B.V.`
- Apple Pay Merchant Identifier → `merchant.com.xracademy.online.2`

---

## Phase 2B — Update / Pull Existing Page

Once `ouisys_page_config_id` is in `.env`:

```bash
# Pull latest pageConfigs from panel into config.json
yarn pull:config   # calls GET c1.ouisys.com/api/v2/get-single-page-config?id={ouisys_page_config_id}
```

To update the page config in the panel, navigate to the unpublished pages list and edit from there (no direct API write outside of browser session yet — auth is session-cookie based, not Bearer token).

---

## Phase 3 — Capture API Call Details

After form submit, always run:

```
browser_network_requests(filter: "panel.ouisys.com/api") → find POST /api/v2/create-page-config
browser_network_request(index)                            → full request + response
browser_network_request(index, part="request-body")      → payload shape
browser_network_request(index, part="response-body")     → { page_config_id, version_id }
```

### Confirmed API (from live test 2026-05-22)

**Endpoint:** `POST https://panel.ouisys.com/api/v2/create-page-config`

**Auth:** Session cookie (no Bearer token — the Playwright browser session handles auth automatically)

**Request body shape:**
```json
{
  "country": "XX",
  "pageName": "xx-cc-dynamic-template-demo-dyn",
  "pageConfigs": {
    "slug": "cc_celerispay-xracademy50_001-",
    "service": { "id": "xracademy", "displayName": "XR Academy" },
    "gateway": "celeris",
    "flags": { "forceComp": false },
    "cardMccInformation": null,
    "payments": {
      "googlePay": {
        "allowedAuthMethods": ["PAN_ONLY", "CRYPTOGRAM_3DS"],
        "allowedCardNetworks": ["MASTERCARD", "VISA"],
        "gateway": "celerispay",
        "gatewayMerchantId": "AGDS030924001",
        "merchantInfo": { "merchantId": "BCR2DN4T6O6NPIB5", "merchantName": "Prizeflix B.V." },
        "bankId": 4,
        "totalPriceStatus": "FINAL"
      },
      "applePay": {
        "supportedNetworks": ["visa", "masterCard", "maestro"],
        "label": "",
        "merchantIdentifier": "merchant.com.xracademy.online.2",
        "bankId": 4
      }
    },
    "plan": {
      "fullPrice": "49.99",
      "trialPrice": "0.01",
      "currency": "EUR",
      "trialDays": 1,
      "billingCycleDays": 28,
      "isLocalCurrency": true
    },
    "env": {
      "page": "xx-cc-dynamic-template-demo-dyn",
      "country": "XX",
      "title": "Demo",
      "strategy": "credit-card"
    },
    "vertical": "credit-card"
  },
  "template_id": 132,
  "template_version_id": 1360,
  "template_version_url": "https://s3.eu-central-1.amazonaws.com/mobirun/os-ui/static/cc-dynamic-template-demo/html/v1_index.html",
  "template_name": "cc-dynamic-template-demo",
  "template_version": "v1",
  "username": "Sabi Ridwan",
  "strategy": "credit-card"
}
```

**Response:**
```json
{ "page_config_id": 753, "version_id": 6490 }
```

---

## Phase 4 — Verify & Store IDs

```
browser_navigate → https://panel.ouisys.com/dynamic-pages/unpublished/list
browser_snapshot → confirm new page appears in list
```

Store IDs from Phase 3 response into `.ouisys` (not `.env`):
```
ouisys_page_config_id=753   # page_config_id from create response
ouisys_version_id=6490      # version_id from create response
```

---

## Config Files

**`.env`** — dev/runtime config (never put panel IDs here)

| Key | Purpose |
|---|---|
| `page` | Repo/page identifier (e.g. `cc-dynamic-template-demo`) |
| `client` | Client identifier |
| `country` | Country code |
| `strategy` | Strategy type (e.g. `credit-card`) |

**`.ouisys`** — Ouisys panel IDs only (separate from `.env`)

| Key | Purpose |
|---|---|
| `ouisys_page_config_id` | Panel `page_config_id` — from create response, used for pull/update |
| `ouisys_version_id` | Panel `version_id` — from create response |

---

## Implementation Rules

- **Always run Phase 0 first** — verify template + version exist before trying to create a page
- **Always read `config.json` + `brand.config.json` before filling the form** — never guess field values
- **Select template BEFORE clicking template version** — the version dropdown only loads after template is chosen; opening it too early shows wrong versions
- **Verify template selection in the review payload** before saving — confirm `template_id` and `template_version_url` match the intended template, not the old one
- **Page name is globally unique including hidden pages** — `{country}-{input}-dyn` must not exist anywhere in the DB. If it conflicts, restore and edit the existing page instead of creating new
- **Auth is session-cookie based** — no Bearer token; Playwright browser handles auth automatically
- **If login fails or session expired** → restart from Phase 1; never retry the form without a valid session
- **Always capture `page_config_id` from response body** — store immediately in `.ouisys`
- **Never hardcode credentials** — all IDs go in `.ouisys` only
- **Template ID 132 / version ID 1361** is `cc-dynamic-template-demo v2` — the canonical base template latest version
- **S3 URL pattern** for new versions: `…/static/{repo-name}/html/{version}_index.html`

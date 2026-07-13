---
name: sam-panel-cc-page-creator
description: Use whenever the user wants to create a new credit card page in the Ouisys panel (panel.ouisys.com/dynamic-pages/create-credit-card), update an existing page config, or pull config from the panel. Make sure to use this skill whenever the user says "create page", "create a cc page", "new dynamic page", "update page config", "sync panel", "publish page", or references the Ouisys/panel.ouisys.com dashboard — even if they don't spell out every field. The single most important job of this skill is to ASK the user which template to use and what to name the page before touching the browser, rather than silently guessing.
---

# Sam Panel CC Page Creator — MCP Automation Skill

## Overview

Automates interaction with `panel.ouisys.com` using the Playwright MCP browser. Two modes:

- **Create** — interview the user for **template** + **page name** (Phase 0), then fill the create-credit-card form using those answers plus the rest of the fields from the current repo's `config.json` + `brand.config.json`, then capture the page ID from the API response
- **Update / Pull** — use `yarn pull:config` (calls `c1.ouisys.com`) or re-submit via panel browser

The Playwright browser maintains its session across invocations. Google OAuth only needs to be completed once.

Every other field in the create form (country, slug, service, gateway, pricing, payment IDs) can reasonably be derived from repo config files — the user won't notice if those are wrong until much later. Template and page name are different: picking the wrong template produces a page with the wrong design, and page names are globally unique so a wrong guess either collides or silently shadows an existing page. Always get these two directly from the user first.

---

## Phase 0 — Interview: Template + Page Name

Do this before any browser automation, even if the current repo's `config.json`/`.env` already suggests obvious values. Ask the user directly:

1. **Which template should this page use?**
   - Show the Known Templates table below as quick options.
   - If the user names something not in that table, don't guess the ID — `browser_navigate` to `/dynamic-pages/templates/list`, search for it, and confirm the template ID + latest version with the user before moving on.
   - If the user says "use the one for this repo" / "the default", it's fine to match `cc-dynamic-template-*` against the repo name — but read back the resolved template name + version and get a explicit confirmation before submitting the form.
2. **What should the page be named?**
   - Explain the constraint up front: the stored name will be `{country}-{input}-dyn` and must be globally unique across the panel, including hidden/restored pages.
   - Never silently default this to `.env → page` — confirm the exact string with the user, since a page created under the wrong name is awkward to fix after the fact (see Implementation Rules).

Only once both answers are confirmed, proceed to Phase 1 and pull the remaining field values from config files.

---

## Phase 1 — Ensure Template + Version Exist

Before creating a page, the panel requires a **template** entry (linked to the repo) and at least one **template version** (S3 URL of the built HTML). Check first — don't create if already present.

```
1. browser_navigate → https://panel.ouisys.com/dynamic-pages/templates/list
2. Search for template name matching the repo (e.g. cc-dynamic-template-demo)
   - Found → click it → check "Template Versions" tab has at least one version → proceed to Phase 2
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

## Phase 2 — Ensure Login

```
1. browser_navigate → https://panel.ouisys.com/dynamic-pages/create-credit-card
2. browser_snapshot → check page title / URL
   - If redirected to /login → proceed to step 3
   - If already on the create form → skip to Phase 3
3. browser_click → "Continue with Google" button
4. STOP — tell user: "Please complete Google sign-in in the Playwright browser, then say 'continue'."
5. After user confirms → browser_snapshot to verify login succeeded
```

---

## Phase 3A — Create New Page

Template and page name come from the Phase 0 interview — do not re-derive them here.

Read these files from the current repo for everything else:
- `config.json` → `strategy`, `country`, `strategyConfigs.default.flowConfig` (slug, service, host)
- `src/config/brand.config.json` → `brand.defaultServiceId`, `languages`, `links`, `pricing`
- `.env` → `client`, `title`

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
| Template | **Phase 0 interview answer** (confirmed template name/ID) |
| Template Version | **Phase 0 interview answer** (confirmed version, defaults to latest) |
| Page Name | **Phase 0 interview answer** (`{country}-{input}-dyn`) |
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

## Phase 3B — Update / Pull Existing Page

Once `ouisys_page_config_id` is in `.env`:

```bash
# Pull latest pageConfigs from panel into config.json
yarn pull:config   # calls GET c1.ouisys.com/api/v2/get-single-page-config?id={ouisys_page_config_id}
```

To update the page config in the panel, navigate to the unpublished pages list and edit from there (no direct API write outside of browser session yet — auth is session-cookie based, not Bearer token).

---

## Phase 4 — Capture API Call Details

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

## Phase 5 — Verify & Store IDs

```
browser_navigate → https://panel.ouisys.com/dynamic-pages/unpublished/list
browser_snapshot → confirm new page appears in list
```

Store IDs from Phase 4 response into `.ouisys` (not `.env`):
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

- **Always run Phase 0 first, and never skip it** — ask for template + page name directly, even when `config.json`/`.env` already imply an obvious answer. That implied answer may not be what the user wants for this specific page.
- **Then run Phase 1** — verify the confirmed template + version actually exist in the panel before trying to create a page
- **Always read `config.json` + `brand.config.json` before filling the rest of the form** — never guess field values other than template/page name
- **Select template BEFORE clicking template version** — the version dropdown only loads after template is chosen; opening it too early shows wrong versions
- **Verify template selection in the review payload** before saving — confirm `template_id` and `template_version_url` match what the user confirmed in Phase 0, not a stale default
- **Page name is globally unique including hidden pages** — `{country}-{input}-dyn` must not exist anywhere in the DB. If it conflicts, tell the user and either ask for a different name or offer to restore/edit the existing page instead of creating new
- **Auth is session-cookie based** — no Bearer token; Playwright browser handles auth automatically
- **If login fails or session expired** → restart from Phase 2; never retry the form without a valid session
- **Always capture `page_config_id` from response body** — store immediately in `.ouisys`
- **Never hardcode credentials** — all IDs go in `.ouisys` only
- **Template ID 132 / version ID 1361** is `cc-dynamic-template-demo v2` — the canonical base template latest version
- **S3 URL pattern** for new versions: `…/static/{repo-name}/html/{version}_index.html`

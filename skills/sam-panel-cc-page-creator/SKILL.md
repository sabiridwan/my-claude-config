---
name: sam-panel-cc-page-creator
description: Use whenever the user wants to create a new credit card page in the Ouisys panel (panel.ouisys.com/dynamic-pages/create-credit-card), update an existing page config, or pull config from the panel. Make sure to use this skill whenever the user says "create page", "create a cc page", "new dynamic page", "update page config", "sync panel", "publish page", or references the Ouisys/panel.ouisys.com dashboard — even if they don't spell out every field. The single most important job of this skill is to ASK the user which template to use and what to name the page before touching the browser, rather than silently guessing.
---

# Sam Panel CC Page Creator — MCP Automation Skill

> **Overlaps with `cc-ouisys-panel`.** Both skills drive `panel.ouisys.com` for credit-card pages and
> trigger on similar phrasing. Difference in practice:
> - **`cc-ouisys-panel`** — general panel operation (create / clone / edit / publish), with a
>   field-by-field Card Create walkthrough in `cc-ouisys-panel/references/create-page.md`. Prefer it when the config
>   values come from a ticket or a sibling page.
> - **this skill** — repo-driven: interviews for template + page name, then fills the rest from the
>   current repo's `config.json` / `brand.config.json` / `.env`, and captures the API ids.
>
> Prefer `cc-ouisys-panel` unless you specifically want the repo-config-driven fill. Don't run both.

## Overview

Automates interaction with `panel.ouisys.com` using the Playwright MCP browser. Three modes:

- **Create fresh** — interview the user for **template** + **page name** (Phase 0), then fill the create-credit-card form using those answers plus the rest of the fields from the current repo's `config.json` + `brand.config.json`, then capture the page ID from the API response
- **Clone** — interview the user for **which existing published page to clone** + **new page name** (Phase 0), find it via `/dynamic-pages/published/list`, duplicate it, and rename — inherits the source page's template, slug, gateway, pricing, and payment fields instead of rebuilding them from repo config files
- **Update / Pull** — use `yarn pull:config` (calls `c1.ouisys.com`) or re-submit via panel browser

The Playwright browser maintains its session across invocations. Google OAuth only needs to be completed once.

Every other field in the create form (country, slug, service, gateway, pricing, payment IDs) can reasonably be derived from repo config files — the user won't notice if those are wrong until much later. Template and page name are different: picking the wrong template produces a page with the wrong design, and page names are globally unique so a wrong guess either collides or silently shadows an existing page. Always get these two directly from the user first.

---

## Phase 0 — Interview: Mode, Template/Source, Page Name

Do this before any browser automation, even if the current repo's `config.json`/`.env` already suggests obvious values. Ask the user directly:

0. **Fresh create or clone?**
   - "Should this page be built from a template, or cloned from an existing published page?"
   - **Fresh** → ask Q1 below, then follow Phase 1 → Phase 2 → Phase 3A.
   - **Clone** → ask which existing page to clone (name, brand, or any distinguishing detail — you'll search for it in the published list in Phase 3B). No template question needed, the clone inherits the source page's template. Skip Phase 1 entirely (the source page's template registration already exists) and go straight to Phase 2 → Phase 3B.
1. **Which template should this page use?** *(fresh create only — skip for clone)*
   - Show the Known Templates table below as quick options.
   - If the user names something not in that table, don't guess the ID — `browser_navigate` to `/dynamic-pages/templates/list`, search for it, and confirm the template ID + latest version with the user before moving on.
   - If the user says "use the one for this repo" / "the default", it's fine to match `cc-dynamic-template-*` against the repo name — but read back the resolved template name + version and get an explicit confirmation before submitting the form.
2. **What should the page be named?** *(both modes)*
   - Explain the constraint up front: the Page Name field only takes the part **after** the country code — the panel auto-prefills the country prefix from the Country field, so never type a country code yourself. What you type must **start with `cc`** (e.g. `cc-brandname`), and the full stored name (`{country}-cc-...-dyn`) must be globally unique across the panel, including hidden/restored pages.
   - Never silently default this to `.env → page` — confirm the exact string with the user, since a page created under the wrong name is awkward to fix after the fact (see Implementation Rules).

Only once the relevant answers are confirmed, proceed down the branch chosen in Q0.

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

> **Before you touch the form — two traps that cost you the whole thing:**
>
> 1. **NEVER type into the MCC combobox.** Its search filter throws
>    `m.toLowerCase is not a function`, crashing the panel to a blank "Something went wrong" screen and
>    **discarding every field you already filled**. Click it open and pick from the list. Select the MCC
>    **early**, since it survives while you refill the rest.
> 2. **The wizard has NO Card section** — only Google Pay and Apple Pay, so the saved `payments` has no
>    `card` key. That is normal. Which payment tabs render is decided in the **page code**, not the
>    panel, so don't stall asking whether to enable card here.
>
> Also: `Template Version` is required and lists only builds already uploaded to that template — so the
> page must be created **after** the build+upload, not before.

Navigate and fill the form:

```
1. browser_navigate → https://panel.ouisys.com/dynamic-pages/create-credit-card
2. browser_snapshot → identify all form fields
3. Fill fields from config (map below). Click-select the MCC; never type in it.
4. Click "Next" → step 2 renders the JSON payload. EXPAND the collapsed nodes
   (service / flags / payments / plan) and read them back to the user, then Save.
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
| Page Name | **Phase 0 interview answer** — input starts with `cc`, country prefix auto-filled by the panel (`{country}-{input}-dyn`) |
| Title | `.env → title` |
| Slug | `strategyConfigs.default.flowConfig.slug` |
| Service ID | `brand.config.json → brand.defaultServiceId` |
| Service Display Name | Derived from service ID |
| Gateway | `config.json → strategyConfigs.default.flowConfig.service` |
| Apple Pay Merchant Identifier | From `pageConfigs.payments.applePay.merchantIdentifier` |
| Google Pay Gateway Merchant ID | From `pageConfigs.payments.googlePay.gatewayMerchantId` |
| Plan Type | **ASK** — `subscription` / `trial-then-subscription` / `one-off`. A ticket's `One Off` column states it per slug. Controls which of the fields below the wizard shows. |
| Trial Price | `brand.config.json → pricing.trialPrice` (only for `trial-then-subscription`) |
| Full Price | `brand.config.json → pricing.subscriptionPrice` |
| Billing Cycle (days) | `brand.config.json → pricing.billingCycle` (hidden for `one-off`) |

**Payment fields with no source yet — ASK, do not copy the wizard's placeholders.**

These are gateway/merchant identities. A wrong value either breaks the charge or shows the **wrong
company to the customer**, and it won't surface until QA (or production). Get them from the ticket or a
live sibling page's config (`Actions → Preview` → `window.configJson.pageConfigs`).

The greyed text in the wizard is placeholder text harvested from *other* pages — some of it belongs to
a **different legal entity**. In particular:

- **`Merchant Name` must NOT be `Prizeflix B.V.`** unless that is genuinely this page's merchant. It is
  shown to the user inside the Google Pay sheet as who they are paying. Use the **MCC legal entity you
  selected** on this same form (e.g. `PEPPEROSE LIMITED`).
- `Gateway Merchant ID` (`AGDS030924001`) / `Google Merchant ID` (`BCR2DN4T6O6NPIB5`) /
  `Apple Pay Merchant Identifier` (`merchant.com.xracademy.online.2`) are the *acquired*-gateway values
  for the PDFBrain/xracademy family. Reuse them only when this page really is on that acquirer+MCC.
- `Google Pay Gateway` and `Bank ID` come **prefilled with real values** (`celerispay`, `4`) that save
  as-is — overwrite them to match the actual gateway (e.g. `acquired`, `8`).

---

## Phase 3B — Clone from Existing Published Page

Use this instead of Phase 3A when the user chose **clone** in Phase 0. This flow hasn't been confirmed against the live panel UI yet — treat the steps below as the starting approach; once you've actually run it, update this section with the confirmed clicks/selectors/API the same way Phase 4 documents the confirmed create-page API.

```
1. browser_navigate → https://panel.ouisys.com/dynamic-pages/published/list?pageNumber=1&pageSize=10
2. browser_snapshot → look for a search/filter field; filter by the page name or brand the user gave in Phase 0
   - If pagination hides the match, increase pageSize in the URL query (e.g. pageSize=100) or page through pageNumber
3. Locate the source page's row → browser_snapshot to find a per-row action (kebab menu, "Clone"/"Duplicate" button, or similar)
   - If no clone action is visible anywhere, STOP and tell the user — don't fall back to manually re-typing the source page's config from what's visible on screen; ask how they'd like to proceed
4. Click the clone/duplicate action
   - This likely opens a prefilled version of the create-credit-card form (same shape as Phase 3A) with the source page's template, slug, service, gateway, pricing, and payment fields already filled in
5. browser_snapshot the opened form → confirm Template and other fields match the source page (sanity check the clone actually worked before touching anything)
6. Update only the **Page Name** field to the value confirmed in Phase 0 (starts with `cc`; country prefix is auto-filled) — leave every other field as inherited from the source unless the user explicitly asked for other changes
7. Submit → continue at Phase 4 to capture the API response the same way as a fresh create
```

Cloning is the faster path when the new page should be near-identical to an existing brand/offer (same gateway, pricing, payment IDs) and only needs a new name/slug — it skips re-deriving all the payment and pricing fields from repo config files, since the source page already has them correct in the panel.

---

## Phase 3C — Update / Pull Existing Page

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
      "type": "trial-then-subscription",
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

Also record the row's **Xcid** (e.g. `xhfjm`) — it's the page's public id and you need it for the URL.

Note the Unpublished row's **Configuration** column shows `Strategy: —` / `Name: —` / `Service:` blank
for credit-card pages. That's a list-rendering quirk, **not** an empty config.

---

## Phase 6 — QA on staging, then publish

**The page is testable before it is public.** `Actions → Preview` opens
**`https://staging.mouisys.com/<xcid>`**, serving the real build with the real panel config while the
page is still Unpublished. Confirm `window.configJson.pageConfigs` matches what you saved, and run the
`cc-qa` skill against that URL — **before** publishing.

Then publish: row `Actions` → **`Publish`**. This exposes the page to real traffic, so confirm with the
user explicitly first, and verify it moved to the Published list afterwards.

> **Do NOT use the repo's `yarn publish:page`.** It is DCB-flow boilerplate: it looks for
> `{country}-{slugify(scenario || strategy_scenariosConfig)}-staging.html`, but a cc-dynamic `.env` has
> no `scenario` and the build uploads `html/staging.html` / `html/index.html` / `html/vN_index.html`.
> The names never match, so it 404s instead of publishing anything.

**Panel UI quirks:** the `Actions` dropdown renders in a portal (a screenshot may show no menu — find
the item and click by ref); clicking a page name or `Quick Preview` often doesn't navigate, and
`View Details` can silently do nothing. Go through `Actions`.

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

- **Always run Phase 0 first, and never skip it** — ask mode (fresh vs clone) + template (fresh only) + page name directly, even when `config.json`/`.env` already imply an obvious answer. That implied answer may not be what the user wants for this specific page.
- **Page Name input always starts with `cc`, never a country code** — the panel auto-prefills the country from the Country field; typing a country code into the Page Name box yourself would double it up. Confirm the exact `cc-...` string with the user in Phase 0.
- **Duplicate `xx-xx-` prefix** — the create-credit-card form now strips any leading country prefix and trailing `-dyn` from whatever is typed/pasted/clone-prefilled into Page Name (`stripPageNameAffixes` in `src/features/dynamic-pages/create-credit-card/index.tsx`), so `xx-cc-foo-dyn` collapses back to `cc-foo`. Still read the orange full-name tag next to the Page Name label before submitting — it shows the exact `{country}-...-dyn` that gets stored. Pages already created with a doubled prefix are not auto-fixed; they need a rename or recreate.
- **Clone mode skips Phase 1** — the source page's template registration already exists in the panel, so go straight from Phase 0 to Phase 2 (login) then Phase 3B (clone). Only fresh-create mode needs Phase 1's template/version check.
- **Fresh create: always read `config.json` + `brand.config.json` before filling the rest of the form** — never guess field values other than template/page name. **Clone: don't re-derive these from repo files** — they're inherited from the source page; only the Page Name changes.
- **Select template BEFORE clicking template version** (fresh create) — the version dropdown only loads after template is chosen; opening it too early shows wrong versions
- **Verify template selection in the review payload** before saving — confirm `template_id` and `template_version_url` match what the user confirmed in Phase 0 (fresh) or the source page (clone), not a stale default
- **Page name is globally unique including hidden pages** — `{country}-cc-...-dyn` must not exist anywhere in the DB. If it conflicts, tell the user and either ask for a different name or offer to restore/edit the existing page instead of creating new
- **Phase 3B (clone) is unconfirmed against the live UI** — verify each step with `browser_snapshot` as you go rather than trusting the described selectors, and update that section with what you actually find on the first live run
- **Auth is session-cookie based** — no Bearer token; Playwright browser handles auth automatically
- **If login fails or session expired** → restart from Phase 2; never retry the form without a valid session
- **Always capture `page_config_id` from response body** — store immediately in `.ouisys`
- **Never hardcode credentials** — all IDs go in `.ouisys` only
- **Template ID 132 / version ID 1361** is `cc-dynamic-template-demo v2` — the canonical base template latest version
- **S3 URL pattern** for new versions: `…/static/{repo-name}/html/{version}_index.html`

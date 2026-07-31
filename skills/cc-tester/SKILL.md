---
name: "cc-tester"
description: "QA a Sam Media / Ouisys cc-dynamic credit-card landing page end to end: dry-run card, Apple Pay and Google Pay checkout in the browser up to API submission (no real charge), exercise BOTH the comp checkout and the non-comp creative (?non-comp=true), verify page content and pricing against the pageConfigs data, scan for leaked company/internal details, walk the linked Notion ticket and post the pass/fail report back to it. Use for \"test this LP\", \"cc tester\", \"QA the checkout\", \"check card/apple pay/google pay\", \"test non-comp\", \"verify pricing matches config\", \"check for company/brand leakage\", or when a Notion ticket asks to test a credit-card page."
---

# cc-tester — QA a cc-dynamic credit-card landing page

Run the full QA checklist on a Sam Media / Ouisys cc-dynamic credit-card landing page and
produce a **pass/fail report**. Each payment method is exercised in a real browser **as a
dry-run up to the point of API submission** — the tester confirms the correct
`/api/v1/frontend/*` endpoint fires with a valid payload and **must not complete a real
charge**. It also checks that rendered content and every visible price come from the page's
config data, scans the page for any leaked company/internal detail, walks the linked Notion
ticket, and posts the report back to that ticket.

This is the QA counterpart to `cc-dynamic-lp` (builds the page) and `cc-payment-integration`
(builds the checkout). It only reads and drives the page; it never edits the project.

## Safety rules (non-negotiable)

- **Dry-run only. Never complete a real payment.** Stop at the API submission response.
  A successful card call returns `gateway_url` or a 3-DS `html` payload — that response *is*
  the "API submission" evidence. Do **not** follow the `gateway_url` redirect, do not submit
  the 3-DS challenge, do not enter real card data.
- **Prefer a staging / preview URL** and gateway **test cards**. If the user gives a
  production URL, confirm with them before driving any payment flow.
- Never submit real customer PII. Use test values only.
- **Posting to Notion is a comment, not a state change** — post the report as a comment. Only
  mark a ticket "done" / change its status if the user explicitly asked, and never when there
  is an open FAIL or an unverified item.

## Inputs

Ask only for what you can't infer:

- **Notion ticket** — page URL or ID. If given, fetch it **first**: it usually contains the
  target URL and the acceptance criteria to verify, and it's where the report gets posted.
- **Target URL** — the `/xhosp` checkout (or preview URL). Pull it from the ticket if present.
  **Prefer the pre-publish staging URL: `https://staging.mouisys.com/<xcid>`.** A page created in the
  panel serves the real build with the real config there *while still Unpublished* — so the normal,
  correct time to run this skill is **before** publishing, not after. Get the `xcid` from the
  Unpublished row (or `Actions` → `Preview`, which opens exactly that URL).
- **Test card / wallet values** — gateway test card (number, month, year, cvv, email). If the
  user hasn't supplied these, ask once; do not invent live-looking numbers.

## Tools

- **Claude in Chrome** — `navigate`, `read_page` / `get_page_text`, `computer`, `form_input`,
  `read_network_requests`, `read_console_messages`, `javascript_tool`. Load them first via
  ToolSearch if deferred (batch into one `select:` call). `read_network_requests` is how you
  capture the outgoing `/api/v1/frontend/*` POST and its payload/response — the core evidence
  for every payment check. If Chrome isn't connected, tell the user to open the Claude side
  panel in Chrome and sign in; a static `web_fetch` only returns the pre-JS shell and cannot
  substitute for the real checks.
- **Notion** — `notion-fetch` the ticket + its acceptance criteria; `notion-create-comment` to
  post the report back; `notion-search` to locate the ticket if given a name not an ID.
- **File tools** — write the report to the workspace folder.

## The config is the source of truth

Everything the page shows should trace to the config snapshot. In the browser console read it:

```js
JSON.stringify(window.configJson.pageConfigs)
```

Shape (fields you'll check against): `slug`, `gateway`, `service.{id,displayName}`,
`plan.{trialPrice,trialDays,fullPrice,billingCycleDays,isLocalCurrency,currency}`,
`payments.card.bankId`, `payments.applePay.{bankId,merchantIdentifier,supportedNetworks,...}`,
`payments.googlePay.{bankId,gateway,gatewayMerchantId,allowedCardNetworks,allowedAuthMethods,...}`,
`flags.forceComp`, `env.page`. Snapshot it once at the start and compare everything against it.

**`payments` will normally have NO `card` key** — the panel's Card Create wizard only writes
`googlePay` + `applePay`, so a card-less config is the standard shape, not a defect. **Which tabs
render is decided in the page code, not the config.** So determine the card check from the *rendered
page*, not from `payments`:

- Card form renders → run check 1 normally (a missing `payments.card.bankId` is expected; `bankId`
  falls back `card ?? applePay ?? googlePay`).
- No card form renders → check 1 is **N/A**, not a FAIL.

Never report "config has no `payments.card`" as a FAIL on its own.

## The checklist

Run each check, record PASS / FAIL / BLOCKED (environment-limited) / N/A with evidence. Take a
screenshot on any FAIL.

### 0. Pull the ticket first (if given)

`notion-fetch` the ticket. Extract the target URL and the acceptance criteria — you'll map
every one to a result in check 7 and post back in the report.

### 1. Card submission (dry-run to API)

1. Navigate to the URL; wait for the loader overlay to clear (fail-open ≤ 4 s). If `payments`
   has no `card`, mark **N/A** and skip.
2. Fill the card form with the test card; tick consent if `requireConsent`.
3. Click Pay and immediately watch `read_network_requests` for
   `POST /api/v1/frontend/initiate-payment-generic`.
4. **PASS** when the POST fires with a valid body: `rockman_id`, `landing_page_url`,
   `slug`, `browserFingerprint`, and card `userDetails` + `bankId`. Verify:
   - `slug` matches the config slug + country/currency rule (local-currency slugs become
     `...:<currency>-<country>`; otherwise `<slug><country>`).
   - Gateway shape: Maxpay uses `cc_number` and includes `service_id`, omits `user_agent`/`ip`;
     others send `service_id: '2'` with `user_agent` + `ip`. `bankId` falls back
     `card ?? applePay ?? googlePay`.
5. Read the response `{ success, message, method, gateway_url?, html? }`. Record it and
   **STOP** — do not follow `gateway_url`; do not submit the 3-DS `html`. `success:false` with a
   surfaced `message` (e.g. `ALREADY SUBSCRIBED`) still counts as a reached-API PASS.

### 2. Apple Pay (dry-run to API)

1. The Apple Pay button is **always visible** (store-standard black "Subscribe with  Pay"), on
   **Chrome too** — NOT gated on `window.ApplePaySession`. An empty/hidden Apple Pay tab is a **FAIL**.
2. Confirm the Apple Pay **JS SDK** is loaded: a `<script src="https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js">`
   is present and, after it loads, `window.ApplePaySession` is defined **even in Chrome** (this is what
   enables the desktop **QR** flow). If it's missing, that's a FAIL — Chrome would get no QR.
3. Trigger it and watch for `POST /api/v1/frontend/ap-validate` then `ap-payment` carrying
   `rockmanId`, `slug`, `bankId`. Verify the request's `countryCode` / `currencyCode` / `total.amount`
   follow the **per-country pricing** (see check 6): `d_country` → `ip_range_name` → fallback;
   `currencyMap[country]` when `plan.isLocalCurrency`; per-country amount overrides; zero-trial → 0.
4. Completing Apple Pay needs HTTPS + a registered merchant domain, and desktop needs a phone to scan
   the QR. In automated Chrome you can verify the button is present, the SDK loads, `ApplePaySession`
   becomes defined, and (on the https page) the QR/sheet opens — mark **BLOCKED (environment-limited)**
   for the actual completion, noting how far wiring was verified. On `http://localhost` the click shows
   an HTTPS notice, not a charge — that's expected, not a FAIL.

### 3. Google Pay (dry-run to API)

1. Confirm `isReadyToPay` succeeds (needs `allowedAuthMethods` + `allowedCardNetworks`) and the
   **official** Google Pay button (`client.createButton()`, "Subscribe with G Pay") renders. A custom
   text button instead of the official one is an observation to flag.
2. Open the sheet, pick the test instrument, watch for `POST /api/v1/frontend/gp-payment`
   carrying the token + `rockmanId`, `slug`, `bankId`, and `transactionInfo` (`totalPrice` /
   `currencyCode` / `countryCode`) following the same per-country pricing as check 6. STOP at the
   response. Without a signed-in Google account holding a card no token is produced — mark **BLOCKED**
   and record how far the wiring was verified.

### 3b. Comp vs non-comp flow

The checkout renders one of two layouts and the tester must exercise both:

1. **Comp** (default desktop / most traffic): the full checkout (Card + wallet tabs + trust sections +
   order summary). Confirm it renders on the plain URL.
2. **Non-comp**: append `?non-comp=true` and reload. Confirm the **download-animation creative**
   renders (video/animation → status messages → a brand CTA like "Get access now"), and that tapping
   the creative/CTA triggers the wallet flow (Apple Pay → Google Pay), i.e. the same `ap-validate` /
   `gp-payment` POST as checks 2–3. An unstyled/blank non-comp page, or a tap that fires nothing, is a **FAIL**.
3. **Decision rules** (from `resolveMode`, mirroring the reference): non-comp only when
   `!flags.forceComp` AND `ApplePaySession` AND iOS AND outside India AND (`d_country` present); `IN`
   and `INDIA` `ip_range_name` force comp; `?non-comp=true` forces non-comp; `flags.forceComp` always
   wins. Spot-check that these hold (e.g. `forceComp` config → comp even with `?non-comp=true`).

### 4. Page content mismatch

`get_page_text`; compare against the config snapshot: `service.displayName`, plan/trial copy,
consent text, button labels, currency symbol. Flag anything on the page with no config source,
and anything in config that should appear but doesn't.

### 5. Pricing matches config data

Extract every visible price / trial-day / billing-cycle string; assert each equals the matching
`pageConfigs.plan` field. **FAIL** on any mismatch, and **FAIL** on any hardcoded price in the
DOM/source that doesn't come from the snapshot — the primary risk this check exists for. Note
cosmetic decimal-separator inconsistencies (e.g. `49,99` vs `49.99`) as observations, not fails.

**Wallet amounts differ by country by design** — don't FAIL them for not equalling `plan.trialPrice`.
When `plan.isLocalCurrency`, the Apple/Google Pay request `total.amount` uses the per-country override
(SA 0.05, QA 0.05, AE 0.04, NO 0.11, SE 0.1, DK 0.07, NZ 0.02, IS 1) or `plan.trialPrice`, with a
zero-trial (`0`/`0.0`/`0.00`) forced to 0, and `currencyCode` from `currencyMap[d_country]`. Verify
the wallet request amount/currency/country match this rule for the tested `?d_country`, not the
displayed page price.

### 6. Company / internal-detail leakage (white-label integrity)

Scan **the full HTML source, not just visible text** — rendered text, `<title>`/`<meta>`, HTML
comments, `alt` attributes, link `href`s, script/asset `src`s, DOM JSON, `read_console_messages`,
and every host in `read_network_requests`. **FAIL** on:

- Company names: `Sam Media`, `SamMedia`, `Ouisys` (any casing) in copy/title/meta/comments/footer.
- Internal domains/infra: `sam-media.com`, `git.sam-media.com`, `panel.ouisys.com`,
  `c1.ouisys.com`, any `*.ouisys.com`, raw S3 paths like `os-ui/static/...`, or any internal host.
- Internal terms surfaced to the user: gateway names in visible copy
  (`celeris`/`maxpay`/`ecardon`/`acquired`), `bankId`, `serviceId`, `slug`, `rockman`,
  `pac_analytics`, `Tau`, `Kount`, panel/scenario ids shown in the UI.
- Absolute internal URLs in source — all asset/API URLs must be relative/same-origin. The only
  allowed absolute URL is the runtime `gateway_url`/`redirect_url` in a payment response.
- Any in-page request to an internal host before the final gateway redirect.

**Avoid false positives:** the preview/CDN host may itself contain a flagged substring — e.g.
`c1.mouisys.com` and `staging.mouisys.com` both contain "ouisys" inside **"mouisys"**. That is the
page's own serving host, **not** a leak — never FAIL it. Match on a word boundary (bare `ouisys.com`,
`panel.ouisys.com`, `c1.ouisys.com`), not a bare substring. Confirm each hit's real context (is it the
page's own same-origin host?) before calling it a FAIL. Record each true hit with
its exact string + source location so it can be scrubbed. Config fields embedded in page JS
(`slug`, `bankId`, `gateway`) are source-visible by design of the payment core — note them as
observations unless they surface in visible copy.

### 7. Walk the Notion ticket

Map each ticket acceptance item to a check above (or run the extra step it asks for). Every item
must resolve to PASS/FAIL/BLOCKED/N/A — if one isn't covered by 1–6, test it explicitly. Report
any requirement left unverified as an open item.

## Output — pass/fail report

Write a Markdown report to the workspace folder named
`cc-tester-report-<page>-<YYYY-MM-DD>.md` and present it. Structure:

- **Header:** page/slug, URL, gateway, environment (staging vs prod), payment methods present,
  run timestamp, ticket link.
- **Summary line:** e.g. `2 PASS · 1 FAIL · 2 BLOCKED · 1 N/A`.
- **Results table:** one row per check (1–7) with Status, expected vs observed, and evidence
  (payload snippet, response, config-vs-rendered diff, leaked-string location, screenshot name).
- **Observations:** non-fatal items worth review (source-visible config, cosmetic nits,
  cross-brand ids, third-party hosts).
- **Ticket coverage:** each acceptance item → mapped result.
- **Open items / recommendations:** every FAIL and BLOCKED with the fix or the reason it
  couldn't be verified. For leakage hits, list the exact string + location.

**Then post it to Notion.** When a ticket was given, `notion-create-comment` on that ticket with
the summary line + the results table + open items (link to the full report file). This is the
default — it's the "make sure everything is taken care of" step. Ask before changing the
ticket's status; only mark it done when there are zero FAILs and no unverified items, and only
if the user asked. If no ticket was given, just deliver the report file.

## Reminders

- Re-read payloads and screenshots before declaring PASS.
- **FAIL** = the page is wrong; **BLOCKED** = the environment can't exercise it (e.g. wallets in
  automated Chrome); **N/A** = the method isn't enabled on this page. Never report BLOCKED or
  N/A as PASS.
- Leakage of the parent company is a hard FAIL — but rule out same-origin-host false positives
  first.
- Keep the run non-destructive: no project edits, no completed charges, no real PII, no ticket
  status change without explicit ask.

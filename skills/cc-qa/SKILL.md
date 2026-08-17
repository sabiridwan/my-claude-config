---
name: "cc-qa"
description: "QA a Sam Media / Ouisys cc-dynamic credit-card landing page end to end: dry-run card, Apple Pay and Google Pay checkout in the browser up to API submission (no real charge), exercise BOTH the comp checkout and the non-comp creative (?non-comp=true), verify page content and pricing against the pageConfigs data, cross-check the LP against the PRODUCT site for design/font/theme/content parity, scan for leaked company/internal details, walk the linked Notion ticket and post the pass/fail report back to it. Use for \"test this LP\", \"cc qa\", \"QA the checkout\", \"check card/apple pay/google pay\", \"test non-comp\", \"verify pricing matches config\", \"check for company/brand leakage\", \"does the LP match the product site\", or when a Notion ticket asks to test a credit-card page. Accepts a PRODUCT url (e.g. streamtrainfit.com) as the target, not just an Ouisys/staging url."
---

# cc-qa — QA a cc-dynamic credit-card landing page

Run the full QA checklist on a Sam Media / Ouisys cc-dynamic credit-card landing page and
produce a **pass/fail report**. Each payment method is exercised in a real browser **as a
dry-run up to the point of API submission** — the tester confirms the correct
`/api/v1/frontend/*` endpoint fires with a valid payload and **must not complete a real
charge**. It also checks that rendered content and every visible price come from the page's
config data, **cross-checks the page against the product's own site** (theme, fonts, accent colour,
header/footer, copy — the page is proxied onto the product domain, so it must read as that site),
scans the page for any leaked company/internal detail, walks the linked Notion ticket, and posts the
report back to that ticket.

You can point it at the **product URL** (`streamtrainfit.com`) rather than an Ouisys/staging URL — it
resolves the LP at `/xhosp` and uses the product root as the design reference. See Inputs.

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
- **Product URL** — the product's own marketing site (`https://streamtrainfit.com`). **Always needed**,
  because check 4b compares the LP against it. Infer it from `pageConfigs.service.id` /
  `checkoutMeta.siteLabel` if not given; confirm with the user if that guess is ambiguous.

  **If the user passes a PRODUCT link instead of an Ouisys/staging URL, that is not a mistake —
  it is the normal way to ask for this test.** Treat it as *both* inputs:
  - the **LP under test** is that domain + the page path, i.e. `https://<product>/xhosp`
    (carry through any query the user included, e.g. `?d_country=nl`);
  - the **design reference** is the product root, `https://<product>/`.

  Confirm the `/xhosp` path actually serves the checkout before testing it. If it 404s (common
  before the page is published, or when the proxy isn't wired yet), fall back to the staging URL
  `https://staging.mouisys.com/<xcid>` for the *functional* checks and keep the product site as the
  reference for check 4b — and say clearly in the report which URL each result came from, because a
  staging render can differ from the proxied one.

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
`plan.{type,trialPrice,trialDays,fullPrice,billingCycleDays,isLocalCurrency,currency}`,
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
   - Gateway shape: Maxpay uses `cc_number` and **omits `service_id` entirely** (not a value — the
     key itself should be absent from the request body), and omits `user_agent`/`ip`;
     others send `service_id: '2'` with `user_agent` + `ip`. `bankId` falls back
     `card ?? applePay ?? googlePay`.
5. Read the response `{ success, message, method, gateway_url?, html? }`. Record it and
   **STOP** — do not follow `gateway_url`; do not submit the 3-DS `html`. `success:false` with a
   surfaced `message` (e.g. `ALREADY SUBSCRIBED`) still counts as a reached-API PASS.

### 1b. Post-gateway return trip (`payment-status`)

The gateway returns the visitor with `?payment-status=…&user-status=…`. The result screen is often
present in `src/components/` but never imported by `Root.tsx`, in which case EVERY returning
visitor — paid and declined alike — silently lands back on the funnel. These four loads catch that.

`user-status` is matched as an exact string, so it must be `paymentSuccess` / `alreadySubscribed`,
**not** `true`. And `payment-status` must be present on every status load — it is the gate; without
it the page renders the funnel no matter what `user-status` says.

1. `?payment-status=true&user-status=paymentSuccess&no-redirect=true` — **PASS** if a success
   screen renders (not the funnel/creative).
2. `?payment-status=false` — **PASS** if a decline/failure screen renders, not the funnel. A decline
   silently falling through to the funnel is a **FAIL**: the result-screen component exists but was
   never wired into the entry component, or the gate wrongly tests `payment-status === 'true'`.
3. `?payment-status=true&user-status=alreadySubscribed&product-url=<host>&no-redirect=true` —
   **PASS** if the already-subscribed screen renders with a portal link pointing at `<host>`. A link
   reading `https://null` is a **FAIL** (missing `product-url` guard). Pass a real `product-url`
   here — omit it and the CTA is correctly hidden, so there is nothing to check.
4. `?payment-status=true&user-status=paymentSuccess&product-url=<host>` — note **no**
   `no-redirect`. **PASS** if the browser lands on `https://<host>`, proving the portal redirect
   fires. This is the one step that must NOT be run with `no-redirect=true`.
5. Load with no params — **PASS** only if the normal funnel/creative renders (confirms the gate is
   additive, not a regression on the common case).

If the page is localised, append `&locale=<code>` and confirm the result copy is translated —
the success strings are newer than the rest and are commonly missing from every locale but `en`.

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

**Footer completeness + product continuity.** The page is proxied onto the product's own domain, so
its footer must read as that site's footer. Check 6 catches *banned* content; this catches *missing*
and *mismatched* content, which is just as visible to a buyer:

- **Company block present and correct** — company name, address, registration number. It must be the
  **merchant of record** shown on the product's own site (for this family, `Pepperose LTD`,
  Hemel Hempstead, reg `06112811`) — **not** the parent company and not blank. A blank company block
  is a FAIL: the scaffold defaults these to empty on purpose so an unharvested footer is loud.
- **Support contact matches the product**, not the reference page's (`+31 970 1020 8696` is
  xracademy's — its presence on another product's page is a FAIL).
- **Legal links resolve and are site-relative** (`/faq`, `/legal/<uuid>`). An `href="#"` stub is a
  FAIL. An absolute product URL is an observation unless it points at a *different subdomain*
  (e.g. `portal.<product>.com`), which is legitimate.
- **Visual continuity** — accent rule + accent display-font headings + card marks, themed to the same
  brand tokens as the rest of the page. A footer in the generic checkout style on a product-branded
  page is the "different app" red flag this whole page is meant to avoid.

Open the product's real site alongside the page and compare the two footers directly.

**The company block is often injected via CSS, so `get_page_text` shows it BLANK even when it renders
correctly.** These templates emit the merchant details as empty spans with obfuscated class names and
fill them from a stylesheet:

```html
© 2026 All rights reserved | <span class="cls-q7x9z9"></span><br><span class="cls-pvuyl2"></span>, …
```

`innerText` / `get_page_text` / the a11y-tree text return `"© 2026 All rights reserved | , , ,"`.
Reporting that as "blank company block — FAIL" is wrong. Read the generated content instead:

```js
[...document.querySelectorAll('footer span[class^="cls-"], .footer-wrapper span[class^="cls-"]')]
  .map(s => ({ cls: s.className, text: s.textContent,
               after: getComputedStyle(s, '::after').content }))
// -> after: '"Mobimilia B.V."', '"Van Diemenstraat 356"', '"1013 CR"', '"Amsterdam"', …
```

Only call the block blank when the `::after` content is also empty. A full-page screenshot is the
other quick confirmation — the text is visible there even though it is absent from the DOM.

### 4b. Product ↔ LP parity (design, font, theme, content) — ALWAYS run this

The LP is **proxied onto the product's own domain**: to a buyer, `product.com/xhosp` is a page *of
that site*. Chrome that doesn't match is a trust/scam signal and the single most common complaint on
these pages. So this check is not optional and not cosmetic — run it on **every** page, every time.

Load the **product root** and the **LP** side by side and diff them mechanically, not by eye. Sweep
computed styles on both (product sites are usually JS-rendered SPAs, so `web_fetch` returns an empty
shell — you must render them):

```js
// run on BOTH pages, then compare the two objects
const c = document.createElement('canvas').getContext('2d');
const hex = v => { try { c.fillStyle = '#000'; c.fillStyle = v; return c.fillStyle } catch { return v } };
const el = document.querySelector('h1,h2') || document.body;
({
  bodyBg:    hex(getComputedStyle(document.body).backgroundColor),
  bodyFont:  getComputedStyle(document.body).fontFamily,
  headFont:  getComputedStyle(el).fontFamily,
  accents:   [...document.querySelectorAll('a,button')]
               .map(e => hex(getComputedStyle(e).backgroundColor))
               .filter(x => x !== '#000000'),
  footerBg:  hex(getComputedStyle(document.querySelector('footer') || document.body).backgroundColor),
})
```

Compare and record each row:

| Dimension | PASS when |
| --- | --- |
| **Theme** | Both light or both dark; page background in the same family. A light checkout under a dark product site is a **FAIL**. |
| **Fonts** | The LP's display and body families are the product's. Tailwind-v4 sites report `oklch()` colours and real font stacks — read them from computed style, not source. |
| **Accent / CTA colour** | The LP's primary CTA and accents are the product's brand colour, not a template default. |
| **Header** | Same logo treatment and scale, same background. (Nav links are deliberately omitted from checkout — that's expected, not a FAIL.) |
| **Footer** | Same structure and content as check 4: company block, support contact, legal list, card marks. |
| **Copy/tone** | Product name, tagline and benefits describe the *same* product. A leftover benefit or blurb from another product is a **FAIL** — these are copy-pasted between repos and it happens. |
| **Legal entity** | The merchant named on the LP matches the one on the product's own footer. |

**FAIL** on any theme, font, accent or entity mismatch. Log smaller spacing/scale differences as
observations. Screenshot both footers and both headers for the report — a reviewer should be able to
see the two side by side without re-running anything.

Also confirm the LP is genuinely reachable on the product domain (`product.com/xhosp`) rather than
only on staging; if it isn't yet, mark that **BLOCKED** and note which URL every other result used.

### 5. Pricing matches config data

Extract every visible price / trial-day / billing-cycle string; assert each equals the matching
`pageConfigs.plan` field. **FAIL** on any mismatch, and **FAIL** on any hardcoded price in the
DOM/source that doesn't come from the snapshot — the primary risk this check exists for. Note
cosmetic decimal-separator inconsistencies (e.g. `49,99` vs `49.99`) as observations, not fails.

#### 5b. Billing wording matches `plan.type` — FAIL, not an observation

`plan.type` is `subscription` | `trial-then-subscription` | `one-off`. The page must describe the
billing shape it is actually configured for. Getting this wrong misstates what the customer is
charged, so it is a hard FAIL even when every number on the page is correct.

| `plan.type` | Page MUST say | Page MUST NOT say |
| --- | --- | --- |
| `one-off` | a single charge of `fullPrice` | "auto-renewal", "/ N days", "subscription", "trial", any renewal period |
| `subscription` | `trialPrice` every `billingCycleDays`, renewing | anything implying a trial |
| `trial-then-subscription` | `trialPrice` for `trialDays`, then `fullPrice` every `billingCycleDays` | a bare price with no trial |

Three specific traps, each seen in the wild:

- **Hardcoded billing period.** Grep the built output for a literal `28` (and the localized forms —
  `28 Tage`, `28 días`, `28 jours`). It must come from `plan.billingCycleDays`. A page cloned to a
  different cycle otherwise keeps advertising 28 days.
- **Hardcoded prices in non-`en` locales.** English often interpolates `{fullPrice}` while the other
  locale files carry a literal `49,99` — so changing the price in the panel updates one language and
  silently leaves the rest wrong. **Check every locale the page ships, not just `en`.**
- **Missing no-trial strings falling back to English.** If the `*NoTrial` keys exist only in `en`, a
  no-trial page renders English pricing copy on a non-English page. Load each locale and confirm the
  billing sentence is actually in that language.

Also check the consent/registration checkbox text, not just the hero — it usually restates the
billing terms and is the copy most often left describing a subscription.

A config with no `plan.type` predates the field: read it as
`trialDays > 0 ? 'trial-then-subscription' : 'subscription'`, never as `one-off`. If the ticket says
the product is One Off but the config has no `type` or says otherwise, that is a **config** finding
to report, not a page defect to fix.

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

### 6b. Shipped assets: everything emitted must belong to THIS page

Every file the build emits is uploaded to S3 and served under this page's asset path. Assets from a
different product, or assets nothing references, are dead weight on the CDN and a white-label smell —
and nobody notices, because they are never rendered, so no visual check can catch them. This is a
**build-output** check, not a browser check.

Run it against `dist/` after a build (or against the served page when you have no repo):

```bash
# 1. What is actually emitted, and how big is it?
du -sh dist/static/<template>/files/ && ls dist/static/<template>/files/ | wc -l

# 2. Does any emitted file come from a directory named after ANOTHER product?
#    Compare source assets to emitted ones by content hash — emitted names are hashed.
python3 - <<'EOF'
import os, hashlib
src = 'src/assets'
srcmap = {}
for dp, _, fns in os.walk(src):
    for fn in fns:
        p = os.path.join(dp, fn)
        srcmap[hashlib.md5(open(p,'rb').read()).hexdigest()] = os.path.relpath(p, src)
d = 'dist/static/<template>/files'
for fn in os.listdir(d):
    p = os.path.join(d, fn)
    if os.path.isfile(p):
        h = hashlib.md5(open(p,'rb').read()).hexdigest()
        print(f'{os.path.getsize(p)//1024:6d}K  {fn}  <-  {srcmap.get(h, "?")}')
EOF
```

Then read the bundle for the asset manifest — a webpack context module lists every file it will
emit, by original path:

```bash
grep -oE '"\./[a-zA-Z0-9_-]+/[^"]+\.(png|jpg|jpeg|svg|webp|webm|mp4)"' dist/static/<template>/js/main.*.js \
  | sort -u | sed 's|"\./||;s|/.*||' | sort | uniq -c | sort -rn
```

**FAIL** on any emitted asset whose source path is named after a different product or brand
(`pdfbrain-ai/`, another service id, another campaign). Record the directory, the file count and the
megabytes.

**The usual cause is a template-literal `require`.** Something like:

```tsx
<img src={require(`../../assets/imgs/${item.icon}`)} />
```

makes webpack build a context module over the **entire** `assets/imgs` tree **recursively**, so every
file underneath is emitted whether or not any code path can reach it. One such call is enough to ship
a whole sibling directory. Seen in the wild: 17 PNGs / 10 MB of another product's images — **10 of
16 MB of the payload** — pulled in by a six-icon `Features` component whose icons all live at the
directory root.

So when you find orphaned assets, grep for the cause before proposing a fix:

```bash
grep -rn 'require(`' src --include="*.tsx" --include="*.ts"
```

Two sibling templates can differ here: the one WITHOUT such a component emits nothing extra even
though the same directory sits in its repo. Check the bundle, not the repo — presence on disk is not
evidence of shipping, and absence from the page is not evidence of not shipping.

Also flag, as observations rather than FAILs:
- emitted assets whose source is `?` (in `dist` but not traceable to `src/assets`) — usually the
  component library, worth a note;
- a `files/` payload much larger than the page's visible content suggests.

### 7. Walk the Notion ticket

Map each ticket acceptance item to a check above (or run the extra step it asks for). Every item
must resolve to PASS/FAIL/BLOCKED/N/A — if one isn't covered by 1–6 (incl. 4b and 6b), test it explicitly. Report
any requirement left unverified as an open item.

## Output — pass/fail report

Write a Markdown report to the workspace folder named
`cc-qa-report-<page>-<YYYY-MM-DD>.md` and present it. Structure:

- **Header:** page/slug, **LP URL and product URL** (say which host each check ran against),
  gateway, environment (staging vs proxied-on-product-domain), payment methods present,
  run timestamp, ticket link.
- **Summary line:** e.g. `2 PASS · 1 FAIL · 2 BLOCKED · 1 N/A`.
- **Results table:** one row per check (1, 1b, 2, 3, 3b, 4, 4b, 5, 5b, 6, 6b, 7) with Status, expected vs observed, and evidence
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
- **Never skip check 4b.** It needs no test card, no wallet account and no gateway — so it is the one
  check that always runs, even when everything payment-related is BLOCKED. "The page looks fine" is
  not evidence; compare computed styles against the product site and put both screenshots in the
  report.
- A **synthetic `.click()` is not a valid wallet test.** Wallet SDKs require real user activation, and
  a JS click can latch a component's `busy` flag so the *next*, real click silently no-ops. Drive
  wallet buttons with real input events, and reload between attempts.
- Wallet SDKs load **lazily on tab select**. Probing `window.ApplePaySession` on the default Card tab
  reports `undefined` — that is not a FAIL. Select the tab first, then probe.
- **Text extraction is not the DOM, and the DOM is not the bundle.** Three separate layers, and a
  finding is only real at the layer it claims: footer company details are injected by CSS `::after`
  so text extraction reads blank (check 4); unused cross-brand assets exist only in the build output
  and never appear on the page at all (check 6b); a library can be present in the bundle, registered
  at runtime, and still never execute. Say which layer you checked.
- **Verify removals in the built bundle, not the version number.** A page can register a new version
  in the panel whose assets 404, and a panel edit form can silently pre-select a STALE version — so
  a blind Update downgrades the page. After any deploy, grep the *served* JS for the marker that
  should be gone and diff it against the sibling template that is already correct.
- Keep the run non-destructive: no project edits, no completed charges, no real PII, no ticket
  status change without explicit ask.

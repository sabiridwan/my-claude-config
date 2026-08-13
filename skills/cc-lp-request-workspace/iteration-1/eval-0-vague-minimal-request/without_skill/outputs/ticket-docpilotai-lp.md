# CC — DocPilot AI — Create Landing Page (29.99 / Apple Pay only)

**Vertical:** credit-card
**Product domain:** docpilotai.com
**Requested by:** Sabi
**Status:** Blocked — needs the answers in §5 before the page can be created
**Panel:** `panel.ouisys.com/dynamic-pages/create-credit-card`
(edit later at `/dynamic-pages/update-credit-card/<id>` — **not** `/dynamic-pages/update/<id>`, that is the DCB form and will overwrite the cc config)

---

## 1. Ask, as given

> "Landing page for docpilotai — 29.99 a month, Apple Pay only. Domain is docpilotai.com."

Everything below is either (a) confirmed from the panel / the repo / the live site, or
(b) **proposed** and marked `⚠ CONFIRM`. Nothing marked `⚠ CONFIRM` should be typed into the
panel until someone signs it off.

---

## 2. What already exists (do not rebuild this from scratch)

The product already has a template, a repo, and two live-ish pages. This is a **variant**, not a
new product.

| Thing | Value |
| --- | --- |
| Template name | `cc-dynamic-docpilotai-template-gcomp` |
| Template id | **154** |
| Last version seen on a page | `v15` (`.../cc-dynamic-docpilotai-template-gcomp/html/v15_index.html`) |
| Git repo | `git@git.sam-media.com:ouisys/dynamic-templates/xx/cc-dynamic-docpilotai-template-gcomp.git` |
| Local checkout | `~/SamMedia/credit-card/cc-template/cc-dynamic-docpilotai-template-gcomp` (branch `master`) |
| Live product site | https://docpilotai.com — up, footer reads **Pepperose LTD**, Hemel Hempstead, reg. 06112811 |
| Legal pages on domain | Privacy Policy / Terms of Service / Refund Policy / Unsubscribe — all present |

Existing DocPilot-AI-branded panel pages, both on template 154:

| id | xcid | page name | plan | payments | live link |
| --- | --- | --- | --- | --- | --- |
| 830 | `x8hhi` | `xx-cc-docpilotai-applepay-googlepay-lc-download-gcomp-dyn` | 0.01 / 1d → **49.99** / 28d | Apple Pay + Google Pay | https://docpilotai.com/lp/x8hhi · [edit](https://panel.ouisys.com/dynamic-pages/update-credit-card/830) |
| 840 | `xh5nq` | `xx-cc-docpilotai-zerotrial-applepay-googlepay-lc-download-gcomp-dyn` | 0.00 / 1d → **49.99** / 28d | Apple Pay + Google Pay | https://docpilotai.com/lp/xh5nq · [edit](https://panel.ouisys.com/dynamic-pages/update-credit-card/840) |

So the new page is the existing page with three deltas: **49.99 → 29.99**, **Google Pay off**, and a
**new slug**.

> Note: a panel search for "docpilot" also returns ~11 pages named `…-docpilotai…` that belong to
> *other* services (intellectvr, vrlearnlab, pdfbrain, pdfswitch, xperiencevr). On those,
> "docpilotai" is only a token inside the billing slug — they are not this product and must not be
> cloned by mistake.

---

## 3. Block A — settings shared by the page

| # | Field | Value | Source |
| --- | --- | --- | --- |
| A1 | Product domain | `docpilotai.com` | given |
| A2 | Country (template) | `XX` (generic) | template 154 is XX |
| A3 | `d_country` default | `de` ⚠ CONFIRM | sibling docpilotai pages run DE; not stated in the request |
| A4 | Gateway | ⚠ **CONFIRM — see §5.1** | pages 830/840 say `celeris`; near-neighbour pages say `acquired` |
| A5 | Bank name | ⚠ CONFIRM (follows A4) | — |
| A6 | Bank ID | ⚠ **CONFIRM — see §5.1** | 830/840 carry `bankId: 8`, which does not match the `173` used for celeris on CC-377 |
| A7 | MCC / legal entity | **PEPPEROSE LIMITED — MCC id 11** | matches docpilotai.com's own footer; also what 830/840 use. Pick from the combobox, never type it |
| A8 | Service ID | `docpilot-ai` | as on 830/840 |
| A9 | Service display name | `DocPilot AI` ⚠ | 830/840 have `DocpilotAi`; the repo's own copy says **DocPilot AI**. Recommend fixing to `DocPilot AI` |
| A10 | Page title | `DocPilot AI` | ditto |
| A11 | Apple Pay merchant identifier | ⚠ **BLOCKER — see §5.2** | 830/840 carry `merchant.com.xracademy.online.2`, which is another domain's identifier |
| A12 | Apple Pay label | `docpilotai.com` | house convention is the serving domain. 830/840 have `"for  Docpilot AI"` — note the double space |
| A13 | Supported card networks | `visa, masterCard, maestro` | as on 830/840 |
| A14 | Google Pay | **no** | given ("Apple Pay only") |
| A15 | Card Submit | **no** ⚠ CONFIRM | "Apple Pay only" read literally = no raw card form either. Worth a second's confirmation — it materially caps conversion |
| A16 | Template / git repo | `cc-dynamic-docpilotai-template-gcomp` (id 154) | exists |
| A17 | New build expected? | ⚠ likely **yes** — see §5.3 | current pages were built with Google Pay on and a 49.99 / trial plan |
| A18 | Creative | `download` (gcomp) | repo shape |
| A19 | Publish after creating? | **no — leave unpublished** until QA passes ⚠ CONFIRM | default |
| A20 | Existing pages to reuse or retire | ⚠ decide: clone 830 → edit, or new page. And decide what happens to 830/840, which have a wrong slug (§5.4) | — |

---

## 4. Block B — the slug row

One page requested.

| Column | Value | Config path |
| --- | --- | --- |
| Page name | `xx-cc-<bank>-docpilotai-applepay-<gateway>-download-gcomp-dyn` ⚠ fill A4/A5 | `env.page` |
| Slug (**no country suffix**) | ⚠ **needs to be issued — see §5.5.** Expected shape: `cc_<gateway>-docpilotai2999_001-` | `slug` |
| Plan type | ⚠ `trial-then-subscription` **assumed** — see §5.6 | `plan.type` |
| Price | `29.99` | `plan.fullPrice` |
| Trial price | ⚠ `0.01` assumed | `plan.trialPrice` |
| Trial days | ⚠ `1` assumed | `plan.trialDays` |
| Billing cycle (days) | ⚠ `28` assumed — see §5.7 | `plan.billingCycleDays` |
| Currency | `EUR` ⚠ CONFIRM | `plan.currency` |
| Local currency? | `true` ⚠ CONFIRM | `plan.isLocalCurrency` |
| Force comp | `false` | `flags.forceComp` |

---

## 5. Blockers and open questions

Ordered by how much they cost if guessed wrong.

### 5.1 Which gateway, and which bank ID? — BLOCKER
Pages 830 and 840 have `gateway: "celeris"` at the top level but `payments.googlePay.gateway:
"celerispay"` and `bankId: 8` underneath, while the slug on those same pages is
`cc_acquired-…` — i.e. **three different gateway names inside one config**. CC-377 used celeris
with `bankId: 173`. Nothing here is trustworthy by copy. Need the gateway name and the bank ID
stated explicitly by whoever owns the MID.

### 5.2 Apple Pay merchant identifier for docpilotai.com — BLOCKER
`A11` on the existing pages is `merchant.com.xracademy.online.2`. Apple validates the merchant
identifier against the domain actually serving the page, so an inherited identifier fails merchant
validation on docpilotai.com. This page is **Apple Pay only**, so this is not a degradation — it is
a page that cannot take a single payment.

This is a known outstanding item: the Apple/Google wallet merchant IDs for **Pepperose** were still
missing as of 2026-08-12 on the smartpdfdesk/PXP work, and Pepperose is the same MCC here. Needs
either an existing `merchant.com.docpilotai…` identifier or a new one registered against the domain.

### 5.3 Does the template need a new build?
Two reasons to think yes:
- **Copy is not fully plan-aware.** The vreducationlab pages shipped advertising "/ 28 days with
  auto-renewal" on a one-off charge because the Hero hardcoded the renewal string. Whatever plan
  shape lands here, the rendered copy needs to be checked against it, not assumed.
- **Google Pay off is a payload trap, not a config trap.** Unchecking Google Pay in the panel
  removes the form block but the saved payload still contains `payments.googlePay` with a
  `bankId` and an empty `gatewayMerchantId`. The page code must gate on `paymentMethods[]`, not on
  the presence of the block, or a Google Pay button can still render on an Apple-Pay-only page.

Action: confirm the current template version renders correctly at 29.99, Apple-Pay-only, before
pointing a page at it. If not, build and upload a new version and pin the page to it.

### 5.4 Pages 830 / 840 carry the wrong billing slug
Both DocPilot-AI pages have `slug: "cc_acquired-xrlab360portal5999_000-"` — an **xrlab360** slug,
at a 59.99 price token, on a 49.99 page. That is a pre-existing defect independent of this request,
but it means neither page can be cloned as-is without carrying the fault forward. Someone should
decide whether they get fixed, retired, or left.

### 5.5 The slug has to be issued, not invented
Slugs come from the billing side. `cc_<gateway>-docpilotai2999_001-` is the shape the convention
implies (`_001` = 0.01 trial, `_000` = 0.00 trial, per every neighbouring page), but the actual
string needs to be issued.
**Trap:** write it with **no country suffix**. A slug saved as `…-de` gets the country appended
again at runtime from `d_country`; four live pages shipped broken this way on CC-377.

### 5.6 Is there a trial, and what is it?
The request says only "29.99 a month". Every sibling docpilotai page is a 1-day trial into a
28-day subscription (0.01 or 0.00 for the trial). A straight no-trial 29.99 subscription is also a
valid shape. This changes the slug, the plan type, the order-summary copy, and the legal price line
— it is not a detail that can be filled in later.
**Trap if it turns out to be a one-off / no-trial:** selecting Plan Type "one off" hides the Trial
Price field but still saves whatever was in it (default `0.01`), and the landing page reads
`plan.trialPrice` for the amount actually charged. Set trial price to the real price *before*
switching plan type.

### 5.7 "A month" = 28 days or 30 days?
House standard on every neighbouring page is `billingCycleDays: 28`, and the on-page copy renders
literally as "per 28 days". If marketing means a calendar month, both the config and the copy need
to say 30. Assuming 28 silently is how you get a legal line that does not match the ask.

### 5.8 Smaller ones
- **Card Submit off?** (A15) — "Apple Pay only" taken literally means no card form at all.
- **Currency / local currency** — EUR assumed; `isLocalCurrency: true` on siblings.
- **`d_country`** — `de` assumed from siblings.
- **Display name casing** — `DocPilot AI` (repo copy, live site) vs `DocpilotAi` (existing pages).
- **Page name uniqueness** — names are global; check Published, Unpublished *and* Hidden before
  committing to one.
- **XCID** — assigned at creation and never changes on edit or re-publish. A new page always means
  a new xcid, so anything already trafficking `x8hhi` / `xh5nq` will not follow automatically.

---

## 6. Suggested sequence once §5.1 / §5.2 are answered

1. Confirm or cut a template version that renders 29.99, Apple-Pay-only, with plan-correct copy.
2. Create the page in the panel from template 154 (Card Create), Block A + Block B above.
3. Leave it unpublished; QA on staging — Apple Pay up to merchant validation, comp and
   `?non-comp=true`, price and legal line against `pageConfigs`, no leaked internal/brand details.
4. Publish, then report back **both** links: `https://docpilotai.com/lp/<xcid>` and
   `https://panel.ouisys.com/dynamic-pages/update-credit-card/<id>`.

---

## Appendix — evidence behind the above

Read-only research. Nothing was created, edited or published in the panel, and nothing was posted
to Notion.

**Sources:** Ouisys panel `search_dynamic_pages` (broad_search `docpilot`, 13 hits) and
`list_mccs` (type `card`, 8 hits); the local repo at
`~/SamMedia/credit-card/cc-template/cc-dynamic-docpilotai-template-gcomp`; a fetch of
https://docpilotai.com; and the CC-377 / smartpdfdesk notes that supply the slug-suffix,
inherited-Apple-Pay and missing-Pepperose-wallet-ID warnings.

**The shared config block on pages 830 and 840**, identical on both:

```
gateway                              "celeris"
slug                                 "cc_acquired-xrlab360portal5999_000-"   ← wrong product
payments.googlePay.gateway           "celerispay"
payments.googlePay.gatewayMerchantId "AGDS030924001"
payments.googlePay.merchantInfo      merchantId BCR2DN4T6O6NPIB5, merchantName "docpilot-ai.com"
payments.applePay.merchantIdentifier "merchant.com.xracademy.online.2"       ← wrong domain
payments.applePay.label              "for  Docpilot AI"                      ← double space
payments.*.bankId                    8
```

That block is what rules out the obvious path of "clone 830 and change the price".

**MCC confirmation:** card MCC id 11 is PEPPEROSE LIMITED, The Maylands Building, Hemel Hempstead
HP2 7TG — the same entity and town named in docpilotai.com's own footer. That is why A7 is not
marked `⚠ CONFIRM`.

**Search noise:** 11 of the 13 `docpilot` hits belong to other services (intellectvr, vrlearnlab,
pdfbrain, pdfswitch, xperiencevr) where `docpilotai` is only a token inside the billing slug — e.g.
id 822 `xx-cc-pdfbrain-docpilotai-applepay-googlepay-acquired-lc-download-gcomp-dyn`, service
`pdfbrain-ai`. Cloning one of those on a name match would produce a DocPilot page billing as
PDFBrain.

**Repo state:** branch `master`, clean through `6a145ee`, and genuinely DocPilot-branded —
`src/localization/translations/en.json` carries "Why DocPilot AI:", "AI-powered PDF tools for modern
workflows" and a real support address `help@docpilotai.com`. Copy renders prices as `€{trialPrice}`
/ `€{fullPrice}` and the cycle literally as "Per {billingCycleDays} days after {trialDays}-day
trial" — which is why §5.6 and §5.7 are blocking rather than cosmetic: the trial and the cycle
length are load-bearing in visible copy, not just in config.

Stale local-dev defaults in the repo, harmless at runtime but misleading to anyone dev-running it:
`config.json` still has `slug: "cc_celerispay-xracademy50_001-"` and `service: "pdfbrain-ai"`, and
`.env` has `defaultService=pdfbrain-ai`, `scenariosConfig=xx-creditcard-xracademy`.

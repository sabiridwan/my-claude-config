# Checklists — what "complete" means per ticket type

Checklists are **fixed**. The same ticket produces the same gaps on every run. Do not improvise
extra fields into a diff; if a ticket needs something these lists don't cover, that belongs in the
comment-triage section of the report, not here.

Every field resolves to one of three states:

| State | Meaning |
| --- | --- |
| **Present** | Found. Record the value **and its source** — ticket table, linked page, repo, or panel. |
| **Missing** | Not found anywhere, including after the repo scan and panel lookup. |
| **Unclear** | Found but contradictory, ambiguous, or malformed. |

The source matters as much as the value. *"gateway: celeris (from slug `cc_celerispay-...`)"* is a
weaker Present than *"gateway: celeris (from panel config)"*, and the reader needs to know which one
they're getting.

---

## `cc-landing-page`

Sourced from `cc-launch` §1 — the union of what `cc-dynamic-lp`, `cc-payment-integration`, and the
panel's Card Create wizard need.

### Identity

| Field | Notes |
| --- | --- |
| `serviceId` | Derives the project name |
| `serviceDisplayName` | User-visible |
| `country` | Defaults to `xx` if genuinely generic — note the assumption, don't silently apply it |
| `creative` | `none` / `download` / `video` |
| `nid` | |

### Checkout backend

| Field | Notes |
| --- | --- |
| `slug` | Shape `cc_<gateway>-<product><price>-<country>` |
| `gateway` | `celeris` / `maxpay` / `ecardon` / `acquired` |
| `bankId` | **Per method** — card, Apple Pay, Google Pay may differ. One shared id is common but must be stated, not assumed |
| `merchantIdentifier` | Apple Pay only |
| `gatewayMerchantId` | Google Pay only |
| payment methods + order | Which tabs render, in what order |
| consent flags | Whether a consent tick is required |

### Presentation

| Field | Notes |
| --- | --- |
| `domain` | The marketing domain the LP is proxied onto. Usually the MID's `Descriptor` |
| `MCC` | User-visible in the panel, and the Google Pay Merchant Name. Usually the MID's `MCC Code` |
| branding | Colors, font, logo — or a product site to extract them from |

**Resolve `gateway`, `MCC`, and `domain` from the MID registry before flagging them Missing** — see
the MID registry section of `references/notion-queries.md`. A ticket that links MIDs has already
supplied these, one hop away. Read each MID's `Status` too: `In Approval` or `Proposed` blocks the
ticket on approval regardless of field completeness.

### Pricing is deliberately NOT on this list

Prices come from the panel config **at runtime** and are never hardcoded in the page
(`devFallbackPlan` is dev-only). An absent price in a ticket is therefore **not a gap** — do not
report it as one.

Flag pricing in exactly one case: the ticket **asserts** a price that contradicts what the panel
holds. That is a real conflict and belongs in the report as **Unclear**, naming both values.

### Fields the panel does not have

There is **no Card section** in the Card Create wizard — only Google Pay and Apple Pay. Which tabs
render is decided in the page code. So a config with no `payments.card` key is the standard shape,
not a defect, and "card not configured in the panel" is never a gap.

---

## `portfolio-page`

| Field | Notes |
| --- | --- |
| reference / theme site | The site to replicate, e.g. a PDF-tool theme |
| MCC name | Usually resolvable from the MID's `MCC Code` relation |
| target domain | The marketing domain to launch under. Usually the MID's `Descriptor` |
| target repo | Which of the portfolio repos it lands in |
| MID list + payment model | Subscription vs one-off, per MID. Usually on linked pages, not in the ticket |
| no-DCB-code rule | The portfolio must be clean of `legalVariables`, testimonial, file text, js bundle |

**Check the MID registry before flagging any of these Missing.** MCC, domain, and gateway are
carried on the linked MID rows — see the MID registry section of `references/notion-queries.md`.
Also read each MID's `Status`: anything short of live means the ticket is blocked on approval.

The no-DCB-code rule is a **standing requirement**, not a per-ticket one. If a portfolio ticket does
not restate it, that is not a gap — apply it anyway and note that it was applied by default.

Portfolio pages are generic marketing for compliance purposes; the product does not need to
function. So "the product doesn't work yet" is never a blocker on this type.

---

## `payment-integration`

| Field | Notes |
| --- | --- |
| `gateway` | |
| method | Card / Apple Pay / Google Pay |
| `bankId` | |
| merchant IDs | `merchantIdentifier` (Apple) / `gatewayMerchantId` (Google) as applicable |
| target repo | Which existing project is being changed |
| endpoints | Which `/api/v1/frontend/*` path is in play, if the ticket names one |

---

## `other`

No checklist. Produce a one-line summary of the ask plus comment triage, and rank it by whether a
reply is outstanding.

Do not invent a checklist for these. A made-up gap list on a backend or tracking ticket reads as
authoritative and is not.

---

## Worked examples from the live board

These double as the skill's regression tests. If a change to this file breaks one of them, the
change is wrong.

### Ecommpay — Create Landing Page → `cc-landing-page`

The body table gives slug, bank ID (`173`), one-off vs subscription, first billing fee, and domain
across five rows. The payment-method column reads only `appplepay` (sic).

Expected diff:

- **Present**: `slug`, `bankId`, `domain`, `gateway` (from the slug — mark the weak source)
- **Missing**: `serviceId`, `serviceDisplayName`, `nid`, `creative`, `merchantIdentifier`,
  `gatewayMerchantId`, consent flags, branding
- **Unclear**: payment methods — only Apple Pay named, card unstated
- **NOT reported**: pricing. The fees are in the table, but pricing is panel-runtime either way.

A comment on this ticket resolves part of it: *"when you create the page follow the naming
convention. Don't use google pay in the naming convention. when we don't have Google Pay. MCC will
pe prizeflix"* — which supplies `MCC = prizeflix` and confirms Google Pay is out of scope. Comment
triage must surface it, and the diff should reflect it.

### Portfolio Page for PXP Bank (ACI Gateway) → `portfolio-page`

Body gives the theme reference (a PDF-tool site), the no-DCB-code rule, and a table of five MIDs as
`mention-page` links with a payment model each.

Expected diff:

- **Present**: reference/theme site, MID list + payment model (**from the linked pages** — this is
  the test that step 4 link-following actually ran), no-DCB-code rule
- **Present via the MID registry**: target domain (`Descriptor`, e.g. `resumetuneai.com`), MCC
  (`MCC Code` → `7399 - Business Services (Not Elsewhere Classified)`), gateway (`Gateway` → `ACI`)
- **Missing**: target repo
- **Gating fact**: the MIDs are `Approved but Not Live`. Rank the ticket **blocked on others** and
  say so, however complete the fields look.

If the MIDs come back **Missing**, link-following did not run. If the domain or MCC come back
Missing, the relation resolve did not run. Both are bugs in the run, not gaps in the ticket.

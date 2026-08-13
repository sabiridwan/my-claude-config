# Field reference

Every value a credit-card landing-page request needs, what it maps to in the Ouisys Card Create
wizard (`panel.ouisys.com/dynamic-pages/create-credit-card`), and the `pageConfigs` key it lands in.

Use this while interviewing so you can tell a requester exactly where their answer ends up and what
breaks without it.

## Contents

- [Block A — once per request](#block-a--once-per-request)
- [Block B — once per billing slug](#block-b--once-per-billing-slug)
- [Why each trap exists](#why-each-trap-exists)

---

## Block A — once per request

| # | Field | Example | Panel control | Config key |
| --- | --- | --- | --- | --- |
| A1 | Product domain | `vreducationlab.com` | — (page serves at `/lp/<xcid>`) | — |
| A2 | Target country | `DE` | Country (locked by template) | `env.country` |
| A3 | `d_country` default | `de` | — (runtime URL param) | — |
| A4 | Gateway | `celeris` | Gateway | `gateway` |
| A5 | Bank name | — | — (token in the page name) | — |
| A6 | Bank ID | `173` | Bank ID | `payments.applePay.bankId` |
| A7 | MCC / legal entity | `Prizeflix B.V.` | MCC combobox | `cardMccInformation` |
| A8 | Service ID | `vreducationlab` | Service ID | `service.id` |
| A9 | Service display name | `VR Education Lab` | Service Display Name | `service.displayName` |
| A10 | Page title | `VR Education Lab` | Title | `env.title` |
| A11 | Apple Pay merchant identifier | `merchant.com.<domain>.N` | Merchant Identifier | `payments.applePay.merchantIdentifier` |
| A12 | Apple Pay label | the domain | Label | `payments.applePay.label` |
| A13 | Supported card networks | `masterCard, maestro` (+ `visa`?) | Supported Networks | `payments.applePay.supportedNetworks` |
| A14 | Google Pay enabled? | `no` | Payment Methods checkbox | `paymentMethods[]` |
| A15 | Card Submit enabled? | `no` | Payment Methods checkbox | `paymentMethods[]` |
| A16 | Template / git repo | `cc-dynamic-<service>-template-gcomp` | Template | — |
| A17 | New build expected? | `yes / no` | Template Version | — |
| A18 | Creative | `download` / `video` / comp-only | — (build time) | — |
| A19 | Publish after creating? | `yes` / `leave unpublished` | Actions → Publish | — |
| A20 | Existing pages to reuse or retire | page id + intent | — | — |

## Block B — once per billing slug

| Column | Example | Panel control | Config key |
| --- | --- | --- | --- |
| Page name | `xx-cc-<bank>-<domain>-<product>-applepay-<gateway>-download-oneoff-gcomp-dyn` | Page Name | `env.page` |
| Slug (no country) | `cc_celerispay-docxhelp2999_001-` | Slug | `slug` |
| Plan type | `one-off` / `trial-then-subscription` / `subscription` | Plan Type | `plan.type` |
| Price | `19.99` | Price / Full Price | `plan.fullPrice` |
| Trial price | one-off → same as Price; else `0.01` | Trial Price | `plan.trialPrice` |
| Trial days | `0` one-off, else `1` | Trial Days | `plan.trialDays` |
| Billing cycle (days) | `0` one-off, else `28` | Billing Cycle | `plan.billingCycleDays` |
| Currency | `EUR` | Currency | `plan.currency` |
| Local currency? | `no` | Is Local Currency | `plan.isLocalCurrency` |
| Force comp | `no` | Force Comp | `flags.forceComp` |

---

## Why each trap exists

Each of these comes from a page that shipped wrong. Useful when a requester asks why you're being
pedantic about a field they consider obvious.

**Slug with a country suffix.** A request listed slugs as `cc_celerispay-cvassistant1999-de`. Those
saved verbatim, and the country is appended again at runtime from `d_country` — four pages went live
with a doubled country before anyone noticed. Billing systems display the country as part of the
reference, which is why requesters copy it in good faith. The slug ends at the hyphen.

**Ambiguous gateway.** A ticket titled "Ecommpay — Create Landing Page" carried five slugs all
prefixed `cc_celerispay`. The builder could not tell whether the title or the slugs were
authoritative and had to stop and ask. One explicit field removes the whole class of problem.

**Inherited Apple Pay merchant identifier.** With no identifier in the ticket, a builder copied
`merchant.com.xracademy.online.2` from a sibling page onto a different domain's pages. Apple
validates the merchant identifier against the serving domain during merchant validation, so this
can fail live Apple Pay sessions — and it was only caught on review, after the pages were published.

**One-off priced at one cent.** Selecting plan type "one off" in the panel hides the Trial Price
input but still saves whatever value it held — `0.01` by default. The landing page reads
`plan.trialPrice` for a no-trial charge amount. State the one-off price in both fields and it can't
happen.

**One-off advertised as a subscription.** The landing-page copy is driven by plan type. A one-off
described loosely as "no, it's not a subscription" once produced live pages reading
"€19.99 / 28 days with auto-renewal" for a single charge — a compliance problem, not a typo.

**Google Pay unstated.** Clearing the Google Pay checkbox removes the form section but the saved
config still contains a `payments.googlePay` block with placeholder values. Page code that gates on
"does the block exist" will render a Google Pay button anyway. An explicit "Google Pay: no" in the
ticket makes the intent checkable.

**Missing bank name.** The bank ID is a number in the config; the bank name is a token in the page
name. A ticket with only the ID produces a page that has to be renamed after review.

**Forgotten existing page.** A product already had a page nobody mentioned. A second one was created
alongside it, leaving a dormant page on an older template with a stale slug — harmless until someone
publishes it. Ask up front what already exists.

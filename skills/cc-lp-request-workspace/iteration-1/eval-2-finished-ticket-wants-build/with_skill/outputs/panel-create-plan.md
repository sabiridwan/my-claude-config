# Panel prep — XR Lab 360 one-off, Card Create

I did not create anything. No page was created, cloned, edited or published, and no panel write tool
was called. This is the field-by-field plan to run once the blockers in
[`ticket-xrlab360-oneoff.md`](./ticket-xrlab360-oneoff.md) clear, plus the read-only evidence behind
those blockers.

Two reasons it didn't run:

1. No working browser session against `panel.ouisys.com` in this run — Card Create is a browser
   wizard, and the panel MCP is deliberately read-only for pages (no page create, no publish).
2. More importantly, it **shouldn't** run yet. Gateway and bank ID both contradict what is live, and
   the Apple Pay identity is absent on a page where Apple Pay is the only payment method. Creating
   it now means guessing on all three.

---

## Card Create wizard — values in panel order

`panel.ouisys.com/dynamic-pages/create-credit-card`

| Wizard control | Value to enter | Ready? |
| --- | --- | --- |
| Template | `cc-dynamic-xrlab360-template-download-nid-gcomp` (assumed — ticket names a template that doesn't exist) | ❌ B4 |
| Template Version | `v5` is current; ticket says `v3` | ❌ B4 |
| Country | ticket silent; live xrlab360 pages are `XX` | ❌ B5 |
| Page Name | `xx-cc-<bank>-xrlab360-applepay-<gateway>-download-oneoff-gcomp-dyn` | ❌ B1, B2 |
| Slug | `cc_acquired-xrlab360portal5999_000-` | ✅ |
| Gateway | ticket says `celeris`; slug and all live pages say `acquired` | ❌ B1 |
| Bank ID | ticket says `42`; live pages use `8` | ❌ B2 |
| MCC | `PEPPEROSE LIMITED` (id 11) or `Prizeflix B.V.` (id 4) | ❌ B6 |
| Service ID | `xrlab360` | ✅ |
| Service Display Name | `XR Lab 360` | ✅ |
| Title | ticket silent | ❌ B5 |
| Plan Type | `one-off` | ✅ |
| Price / Full Price | `59.99` | ✅ |
| **Trial Price** | **`59.99`** — type it *before* switching Plan Type to one-off, or verify after saving | ✅ |
| Trial Days | `0` | ✅ |
| Billing Cycle | `0` | ✅ |
| Currency | `EUR` | ✅ |
| Is Local Currency | `no` (assumed) | ⚠️ confirm |
| Force Comp | `no` (assumed) | ⚠️ confirm |
| Payment Methods → Apple Pay | ✅ checked | ✅ |
| Payment Methods → Google Pay | ☐ cleared (explicit in the ticket) | ✅ |
| Payment Methods → Card Submit | ticket silent; presumed cleared | ⚠️ confirm |
| Apple Pay → Merchant Identifier | none exists for this domain | ❌ B3 |
| Apple Pay → Label | serving domain | ❌ B3 |
| Apple Pay → Supported Networks | `visa, masterCard, maestro` | ⚠️ confirm |
| Publish after create? | ticket silent | ⚠️ confirm |

### Two post-save checks that are easy to skip

- **Trial Price.** Selecting `one-off` hides the Trial Price input but keeps its stored value —
  `0.01` by default — and the landing page reads `plan.trialPrice` as the charge amount. After
  saving, re-open the config and confirm `plan.trialPrice` is `"59.99"`, not `"0.01"`. This is the
  single most likely way this page ships wrong.
- **googlePay block.** Clearing the checkbox removes the form section but the saved config still
  carries a `payments.googlePay` object. Confirmed live below. On an Apple-Pay-only page, check the
  rendered LP shows no Google Pay button.

---

## Read-only evidence from the panel

Gathered via the Ouisys panel MCP (`search_dynamic_pages`, `list_mccs`, `whoami` — all read-only).
Twelve live credit-card pages match `xrlab360`; zero in staging.

### Gateway and bank ID (B1, B2)

Every live xrlab360 CC page:

| | Value |
| --- | --- |
| `pageConfigs.gateway` | `acquired` (12 of 12) |
| `payments.applePay.bankId` | `8` (12 of 12) |
| Bank IDs anywhere in the result set | only `7` and `8` — never `42` |

The one page carrying `"gateway": "celeris"` is
`xx-cc-xr-vreducationlab-xrlab360-applepay-acquired-tst-gcomp-dyn` (id 483, bankId 7), whose slug is
`cc_acquired-Acquired_test_service-` — a test page, not a precedent.

### Apple Pay identifiers currently in production (B3)

| Value | Pages | Problem |
| --- | --- | --- |
| `merchant.com.xracademy.online.2` | 1010, 817, 812, 483 | belongs to a different product's domain |
| `merchant.com.xrlab360.portal..acquired` | 724, 727, 666, 680, 562, 565, 563, 503 | malformed — double dot |

Labels in production are `""` and `"now"` — neither is a domain. There is nothing here worth
copying; this needs a real value from the Apple developer account.

### Pages already on this slug (B7)

Nine live pages share `cc_acquired-xrlab360portal5999_000-`, all
**trial-then-subscription, €49.99, trialPrice 0.01 or 0.00, trialDays 1, billingCycleDays 28**:

`xx-cc-xrlab360-applepay-googlepay-acquired-lc-download-gcomp-dyn` (id 1010) ·
`xx-cc-pdfbrain-xrlab360-applepay-googlepay-acquired-lc-download-gcomp-dyn` (817) ·
`xx-cc-pdfbrain-xrlab360-zerotrial-…` (812) ·
`xx-cc-xr-intellectvr-xrlab360-zerotrial-…` (727) ·
`xx-cc-xr-vrlearnlab-xrlab360-zerotrial-…` (666) ·
`xx-cc-xr-xperiencevr-xrlab360-…` (562, 565, 563, 503)

Two more sit on `…5999_001-`: ids 724 and 680.

So this request would put a **€59.99 one-off** on a slug that currently drives **€49.99 recurring**
across nine pages. That may well be intended — but it's worth one line of confirmation from billing
rather than discovering it in a reconciliation.

### Template (B4)

Only `cc-dynamic-xrlab360-template-download-nid-gcomp` exists in use, at **v5**
(`…/static/cc-dynamic-xrlab360-template-download-nid-gcomp/html/v5_index.html`). No template named
`cc-dynamic-xrlab360-template-gcomp` appears anywhere. The panel's Template dropdown needs an exact
match, and the version has to exist in S3.

### MCC (B6)

Card MCCs available: `PEPPEROSE LIMITED` (11), `Astra Peak Solutions LLC` (10), `Rathúla Limited`
(9), `DSP` (8), `Sam Media B.V` (7), `Mobimilia B.V.` (6), `AMB Global Digital Solutions LTD` (5),
`Prizeflix B.V.` (4). The newest xrlab360 page uses 11; older ones use 4.

---

## Handoff once unblocked

| Step | Skill |
| --- | --- |
| Build / upload the LP repo + template version | `cc-dynamic-lp` |
| Create the page in the panel (Card Create), publish | `cc-ouisys-panel` |
| QA card / Apple Pay / comp + non-comp | `cc-qa` |
| All three end to end | `cc-launch` |

Requesting and specifying the page is where this skill stops.

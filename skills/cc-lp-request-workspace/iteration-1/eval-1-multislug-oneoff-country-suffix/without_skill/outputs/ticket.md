# CC — smartpdfdesk.com: 3 new one-off CC pages (Acquired, DE)

**Vertical:** credit-card · **Domain:** smartpdfdesk.com · **Country:** DE · **Gateway:** Acquired
**Requested by:** Sabi · **Status:** ready to build once the 5 blockers in §5 are answered

Create three new credit-card dynamic pages on `smartpdfdesk.com`, all one-off charges, Germany,
Acquired gateway, with Apple Pay **and** Google Pay enabled.

---

## 1. Block A — shared by all three slugs

| # | Field | Value | Panel field | Config path | Source |
|---|---|---|---|---|---|
| A1 | Product domain | `smartpdfdesk.com` | — (page serves at `/lp/<xcid>`) | — | given |
| A2 | Page Country | `XX` | Country | `env.country` | matches the 5 live smartpdfdesk pages; the real country comes from `d_country` at runtime |
| A3 | `d_country` default | `de` | — (URL param) | — | given ("DE") |
| A4 | Gateway | `acquired` | Gateway | `gateway` | inferred from the `cc_acquired-` slug prefix |
| A5 | Bank name | Acquired | — (page name) | — | inferred |
| A6 | **Bank ID** | **`88` as requested — see §5.1, every existing Acquired page uses `8`** | Bank ID (Apple Pay + Google Pay blocks) | `payments.applePay.bankId`, `payments.googlePay.bankId` | given, **disputed** |
| A7 | MCC / legal entity | ❓ **not supplied** | MCC combobox (click, never type) | `cardMccInformation` | — |
| A8 | Service ID | ❓ **not supplied** — proposed `smartpdfdesk` | Service ID | `service.id` | — |
| A9 | Service display name | ❓ **not supplied** — proposed `Smart PDF Desk` | Service Display Name | `service.displayName` | — |
| A10 | Page title | ❓ — proposed same as A9 | Title | `env.title` | — |
| A11 | Apple Pay merchant identifier | ❓ **not supplied** — see §5.2 | Merchant Identifier | `payments.applePay.merchantIdentifier` | — |
| A12 | Apple Pay label | ❓ — proposed `smartpdfdesk.com` | Label | `payments.applePay.label` | — |
| A13 | Supported card networks | proposed `masterCard, maestro, visa` | Supported Networks | `payments.applePay.supportedNetworks` | matches every live Acquired page |
| A14 | Google Pay | **on** | Payment Methods checkbox | `paymentMethods[]` | given |
| A15 | Apple Pay | **on** | Payment Methods checkbox | `paymentMethods[]` | given |
| A16 | Card Submit | ❓ **not stated** — see §5.4 | Payment Methods checkbox | `paymentMethods[]` | — |
| A17 | Google Pay gatewayMerchantId | ❓ **not supplied** — see §5.2 | Gateway Merchant ID | `payments.googlePay.gatewayMerchantId` | — |
| A18 | Google Pay merchantId / merchantName | ❓ **not supplied** | Merchant ID / Name | `payments.googlePay.merchantInfo` | — |
| A19 | Template / git repo | ❓ **not supplied** — see §5.3 | Template | — | — |
| A20 | Creative | proposed `download` | — (build-time) | — | matches the existing smartpdfdesk pages |
| A21 | Currency | proposed `EUR`, `isLocalCurrency: false` | Currency / Is Local Currency | `plan.currency`, `plan.isLocalCurrency` | DE |
| A22 | Force comp | proposed `no` | Force Comp | `flags.forceComp` | matches existing |
| A23 | Publish after creating? | ❓ **not stated** — proposed leave in staging until QA passes | Actions → Publish | — | — |

---

## 2. Block B — one row per slug

Prices given: 29.99 / 19.99 / 9.99, all **one-off**. The digit block in each slug matches
its price (2999 / 1999 / 999), so the three slugs are internally consistent.

| Page name (proposed) | Slug **to enter in the panel** | Slug at runtime | Plan type | Price | Trial price | Trial days | Billing cycle |
|---|---|---|---|---|---|---|---|
| `xx-cc-smartpdfdesk-acquired-oneoff2999-download-gcomp-dyn` | `cc_acquired-smartpdfdesk2999_001-` | `cc_acquired-smartpdfdesk2999_001-de` | one-off | `29.99` | **`29.99`** | `0` | `0` |
| `xx-cc-smartpdfdesk-acquired-oneoff1999-download-gcomp-dyn` | `cc_acquired-smartpdfdesk1999_002-` | `cc_acquired-smartpdfdesk1999_002-de` | one-off | `19.99` | **`19.99`** | `0` | `0` |
| `xx-cc-smartpdfdesk-acquired-oneoff999-download-gcomp-dyn` | `cc_acquired-smartpdfdesk999_003-` | `cc_acquired-smartpdfdesk999_003-de` | one-off | `9.99` | **`9.99`** | `0` | `0` |

Page names are a proposal — names are globally unique, so check Published, Unpublished **and**
Hidden before committing. The three pages differ only by price, so the price has to be in the name.

---

## 3. ⚠️ Do NOT paste the `-de` into the Slug field

The slugs as written in the request (`…_001-de`) will produce a **double country suffix** in
production. The country is appended at runtime from `d_country`:

`src/providers/RootContext.tsx:58`
```
slug = currencySlug || `${slug}${country.toLowerCase()}`;
```

So a panel slug of `cc_acquired-smartpdfdesk2999_001-de` becomes
`cc_acquired-smartpdfdesk2999_001-dede` on every request and the billing lookup fails.

Enter the slug **ending in a bare hyphen**, exactly as the table in §2 shows. Every one of the
41 live Acquired pages in the panel is stored this way (`cc_acquired-omnilearnhub5999_000-`,
`cc_acquired-docpilotai4999_001-`, …), and all five existing smartpdfdesk pages too
(`cc_acipxp-resumetuneai-`).

The trailing hyphen is load-bearing, not cosmetic — the local-currency branch one line above
strips it with `slug.slice(0, -1)` before inserting the currency.

This is the same defect that shipped four wrong live pages on CC-377.

---

## 4. ⚠️ One-off trial price — set it *before* switching Plan Type

Choosing Plan Type "one off" **hides** the Trial Price field but still saves whatever value was
in it, and the default is `0.01`. Both existing smartpdfdesk one-off pages carry this leftover
right now:

- page **1057** `cc_acipxp-pdfdoccraft-` — `type: one-off`, `fullPrice: 24.99`, `trialPrice: "0.01"`
- page **1060** `cc_acipxp-talentyai-` — `type: one-off`, `fullPrice: 24.99`, `trialPrice: "0.01"`

Those two survive it because the smartpdfdesk template routes one-off through
`src/utils/planShape.ts`, which reads due-today off `fullPrice` and never claims a renewal without
a real billing cycle. **A template without `planShape.ts` will charge `trialPrice`** — i.e. bill
€0.01 on a €29.99 page. Whichever template is chosen in §5.3, either confirm it has `planShape.ts`
or set Trial Price = Price on all three pages (recommended regardless — it costs nothing and
removes the dependency).

---

## 5. Blockers — needed before the pages can be created

### 5.1 Bank ID 88 vs 8

The request says bank ID **88**. Every Acquired page in the panel — all 41 of them, across
`cc-dynamic-template-download-nid-gcomp`, `…-pdfbrain-…`, `…-omnilearnhub-…`,
`…-streamtrainfit-…`, `…-xrlab360-…`, `…-pdfswitch-…` — uses **`bankId: 8`** on both the Apple Pay
and Google Pay blocks. `88` does not appear on any page in the panel, for any gateway.

**Please confirm 88 is a genuinely new bank ID and not a typo for 8.** A wrong bank ID routes the
transaction to the wrong acquirer and fails at authorisation, and it is invisible in the panel UI
after saving. Proceeding with `8` on assumption would be equally wrong if 88 is real, so this needs
an explicit answer rather than a guess.

### 5.2 Wallet credentials for smartpdfdesk.com are missing

Both wallets need domain-specific identity that has not been supplied:

| Field | Needed | Note |
|---|---|---|
| `payments.applePay.merchantIdentifier` | ❓ | Apple validates the identifier against the **serving domain**. It must be smartpdfdesk.com's own — the live Acquired pages use `merchant.com.<product>..acquired` (e.g. `merchant.com.omnilearnhub..acquired`) or the inherited `merchant.com.xracademy.online.2`. **Do not copy either onto smartpdfdesk.com**; that exact reuse is what Rangana flagged on CC-377. |
| `payments.googlePay.gatewayMerchantId` | ❓ | Acquired's merchant id. Live values in use: `019aa163-914d-72db-8b66-9b335f662159` (Prizeflix B.V.) and `AGDS030924001` (Pepperose). Which applies depends on the MCC answer in A7. |
| `payments.googlePay.merchantInfo.merchantId` | ❓ | Google merchant id — `BCR2DN7TZDOZPMZP` (Prizeflix) / `BCR2DN4T6O6NPIB5` (Pepperose) in the live set. |

Note the panel **pre-fills the wallet blocks with another merchant's values** and saves them as-is;
unchecking a wallet hides the fields but the stale defaults still persist into the saved config.
Every field above must be overwritten explicitly, not left as found. The five existing smartpdfdesk
pages currently ship with `merchantIdentifier: ""` and an inherited `bankId: 4` for exactly this
reason — wallet buttons render and then fail at tap. Don't repeat that here.

### 5.3 Which template? The current smartpdfdesk template cannot serve Acquired as-is

`cc-dynamic-smartpdfdesk-template-download-gcomp` (panel template **251**) is the repo behind all
five live smartpdfdesk pages, but it is an **ACI-PXP** template. Two hard problems if it is reused
for gateway `acquired`:

1. **The page renders nothing on Android.** `src/Root.tsx:110` gates the entire tree:
   ```
   (window.ApplePaySession || isAciPxp) && ( … )
   ```
   With `gateway: 'acquired'`, `isAciPxp` is false, so anything without `window.ApplePaySession` —
   i.e. every Android/Chrome visitor — gets a blank page. **Google Pay would be unreachable**, which
   defeats the point of the request.
2. **No card form on the non-ACI-PXP branch.** `<AciPxpCardSection>` (the whole checkout: card
   form, wallet row, order summary) is rendered only when `isAciPxp`. The `acquired` branch falls
   through to `<Hero>` + comp content, which carries the two wallet buttons and nothing else.
   `renderStrategy()` at `Root.tsx:98` — the legacy engine credit-card flow — is defined and never
   called.

Three ways forward, pick one:

- **(a) Fork an Acquired-native template and rebrand it** to smartpdfdesk. `cc-dynamic-template-download-nid-gcomp`
  (v25) is the proven Acquired base; `cc-dynamic-omnilearnhub-template-download-nid-gcomp` (v7) and
  `cc-dynamic-streamtrainfit-template-download-nid-gcomp` (v5) are working forks of it. Lowest risk
  on payments, needs the smartpdfdesk design applied.
- **(b) Patch template 251** — drop the `ApplePaySession` gate for `acquired` and add an
  Acquired card section. Keeps design parity, but is real work in the payment layer and needs a
  fresh template version + full QA.
- **(c) Wallet-only pages.** If Card Submit is genuinely off (see 5.4), (b) shrinks to just the
  render-gate fix. Still needs a new template version.

Whichever is chosen: **create the panel Template first, then upload** — `upload-template` only
attaches a version to an existing template and otherwise returns an empty 200.

### 5.4 Card Submit on or off?

The request names Apple Pay and Google Pay but is silent on card. `paymentMethods` governs what
renders, so this has to be explicit. Assumption if no answer: **card on** (`["ccsubmit","applepay","googlepay"]`),
since a wallet-only page loses every non-wallet visitor. This choice also changes the template
decision in §5.3.

### 5.5 MCC / legal entity

Not supplied. The five live smartpdfdesk pages use **id 11, PEPPEROSE LIMITED**; most live Acquired
pages use **id 4, Prizeflix B.V.** These are different legal entities on the customer's statement
and they determine which Acquired merchant id applies (§5.2). Needs an answer, not a default.

---

## 6. Minor notes

- **Slug index numbering.** The house convention starts at `_000` (`…_000-`, `…_001-`). The request
  uses `_001` / `_002` / `_003`. Harmless — the index only has to be unique per product — but worth
  a nod in case `_000` was intended as the first.
- **Country field stays `XX`.** All five existing smartpdfdesk pages are `XX` with the country
  supplied by `d_country`. Setting the page country to `DE` would diverge from that and change the
  runtime slug composition.
- **XCID is assigned at creation** and never changes on edit or re-publish. Three new pages = three
  new xcids.
- **MCC combobox: click, never type.** Typing into it crashes the panel filter and wipes the form.

---

## 7. Acceptance criteria

- [ ] Three pages exist, one per slug, with the slug stored **without** the `-de` suffix and ending
      in a bare hyphen.
- [ ] `plan.type = one-off`, `trialDays = 0`, `billingCycleDays = 0`, and `trialPrice == fullPrice`
      on all three.
- [ ] `paymentMethods` contains `applepay` and `googlepay` (plus `ccsubmit` per §5.4).
- [ ] `payments.applePay.bankId` and `payments.googlePay.bankId` both equal the value confirmed in §5.1.
- [ ] Apple Pay merchant identifier is smartpdfdesk.com's own, and Google Pay `gatewayMerchantId`
      is non-empty.
- [ ] On `?d_country=de`, the network call carries slug `cc_acquired-smartpdfdesk<price>_00N-de`
      — checked in devtools, once per page.
- [ ] Page renders and Google Pay is reachable **on Android/Chrome**, not just Safari (§5.3).
- [ ] Displayed price matches the plan on each page (29.99 / 19.99 / 9.99) and no page claims a
      renewal or a trial.
- [ ] Apple Pay verified in Safari/iOS specifically — it does not render in Chrome, and that is
      correct, not a bug.

---

## 8. Reference — existing smartpdfdesk pages (all ACI-PXP, unrelated to this request)

Template 251 · MCC 11 PEPPEROSE LIMITED · all `staging`, none published.

| id | Page | Slug | Plan | xcid | Edit |
|---|---|---|---|---|---|
| 1056 | `xx-cc-smartpdfdesk-resumetuneai-acipxp-download-gcomp-dyn` | `cc_acipxp-resumetuneai-` | trial 0.01/1d → 49.99/28d | `xd6b0` | [panel](https://panel.ouisys.com/dynamic-pages/update-credit-card/1056) |
| 1057 | `xx-cc-smartpdfdesk-pdfdoccraft-acipxp-download-gcomp-dyn` | `cc_acipxp-pdfdoccraft-` | one-off 24.99 | `xhifi` | [panel](https://panel.ouisys.com/dynamic-pages/update-credit-card/1057) |
| 1058 | `xx-cc-smartpdfdesk-nestifyskills-acipxp-download-gcomp-dyn` | `cc_acipxp-nestifyskills-` | trial 0.01/1d → 29.99/28d | `xd6cc` | [panel](https://panel.ouisys.com/dynamic-pages/update-credit-card/1058) |
| 1059 | `xx-cc-smartpdfdesk-fitloom-acipxp-download-gcomp-dyn` | `cc_acipxp-fitloom-` | trial 0.01/1d → 29.99/28d | `xm0lp` | [panel](https://panel.ouisys.com/dynamic-pages/update-credit-card/1059) |
| 1060 | `xx-cc-smartpdfdesk-talentyai-acipxp-download-gcomp-dyn` | `cc_acipxp-talentyai-` | one-off 24.99 | `xd6do` | [panel](https://panel.ouisys.com/dynamic-pages/update-credit-card/1060) |

Staging preview: `https://staging.mouisys.com/<xcid>` · once published: `https://smartpdfdesk.com/lp/<xcid>`

Edit URL must be `/dynamic-pages/update-credit-card/<id>` — **not** `/dynamic-pages/update/<id>`,
which loads the DCB form for the same id and overwrites the cc config on submit.

# Gold & jewellery finance — the domain

How a multi-branch gold business is actually accounted for. Every process below gives the
event, the treatment, and the journal. Account names use the ZyncGold `ACCOUNT_NAME`
vocabulary where one exists; where it does not, the name is marked **(must seed)**.

Grams columns are shown as `Dr g` / `Cr g` — the metal leg of the same event. A system
without a metal ledger simply omits them, and loses the ability to answer the questions in
§14.

---

## 0. The two-currency principle

> "In the jewellery trade gold is both the product you sell and the currency you trade in."

Books run in **money** and in **fine grams**, in parallel, for the same events. Every
counterparty ledger — customer, supplier, karigar, refinery, branch — carries both
balances, and settling one against the other happens at a stated rate on a stated date.

Reconciliation is always at **fine weight**, never gross. `fine = net × purity/1000`.
Gross-weight reconciliation silently absorbs purity fraud.

This is not optional colour. It is the reason a general-purpose ERP cannot run a jeweller:
a single-currency ledger cannot express "we owe the factory 4.2 kg of 999".

---

## 1. Chart of accounts — the gold-specific rows

A general chart plus these. Anything missing here is a reporting blind spot, not a
cosmetic omission.

| Section | Account | Why it must be its own account |
|---|---|---|
| Current asset | Inventory — New Goods | Bought at market, sold with making charge |
| Current asset | Inventory — Old Gold (resale) | Bought at buy rate, sold as-is; different margin |
| Current asset | Gold in Melting (WIP) | Metal in a furnace is neither stock nor sold |
| Current asset | Metal with Karigar | Issued for job work; still owned, not on the floor |
| Current asset | Metal with Refinery | In transit/at refiner; insured value differs from cost |
| Current asset | Consignment/Memo Stock Out | Held by another party, still owned |
| Current asset | Gold Loan Receivable — principal | Pawn/loan against pledged metal |
| Current liability | Customer Scheme Advances | Collections, NOT income (§9) |
| Current liability | Consignment/Memo Stock In | Held on floor, not owned |
| Current liability | Metal Payable — unfixed | Metal owed where price is not yet fixed |
| Income | Sales — New Goods (metal) | Metal margin |
| Income | Making Charge Income | Labour margin — completely different driver |
| Income | Sales — Old Gold Jewellery | Resale of second-hand metal |
| Income | Scheme Bonus/Discount Given (contra) | The cost of running the scheme |
| Income | Gold Loan Interest Income | |
| COGS | Purchase — New Goods | |
| COGS | Purchase — Old Gold Jewellery | The buy-rate leg of the old-gold trade |
| Expense | Gold Melting Charges | Refinery/assay fees, per-lot |
| Expense | Gold Melting Wastage / Refining Loss | The theft signal (§4) |
| Expense/Income | Metal Revaluation Gain/Loss | Mark-to-market on unfixed position (§7) |
| Expense | Hallmarking & Certification Fees | Per-piece statutory cost |
| Equity/other | Exchange Balancing, Suspense | System accounts; must be hidden from users and must net to zero |

**Rule:** a gold-specific account that is *seeded but never posted to* is worse than a
missing one — it implies coverage that does not exist. Check both directions.

---

## 2. New goods purchase and sale

Straightforward, except the making-charge split.

Sale of a 10 g 916 piece, metal RM 6,000, making RM 900, tax 6% additive:

| Account | Dr | Cr | Dr g | Cr g |
|---|---|---|---|---|
| Accounts Receivable / Cash | 7,314 | | | |
| Sales — New Goods (metal) | | 6,000 | | 9.160 |
| Making Charge Income | | 900 | | |
| Tax Payable | | 414 | | |

Then COGS at the costed rate, Cr Inventory. **The making charge must not land on
Inventory or on the metal revenue account** — it is labour income with no gram leg, and
folding it into metal revenue makes the metal margin unreadable and overstates grams sold.

---

## 3. Old gold purchase (buying off the counter)

The customer walks in with second-hand jewellery. It is weighed gross, stones deducted,
purity tested, and paid at the **buy** rate — a spread below the sell rate.

| Account | Dr | Cr | Dr g | Cr g |
|---|---|---|---|---|
| Purchase — Old Gold Jewellery | 5,400 | | 9.160 | |
| Cash / Bank | | 5,400 | | |

Two things must be recorded on the row, not reconstructed later:
- the **rate used and which side** (buy) and its timestamp — rates move intraday
- the **purity test method and tester** — every later yield argument traces to it

Disposition then splits the trade: **resale as-is** (§3a) or **melt** (§4). They earn very
different margins, so they need different accounts from the moment of purchase, or the
graders' disposition calls can never be reviewed.

### 3a. Trade-in against a sale
A trade-in is not a discount. Materialise it as its own purchase document of the scrap
items, then settle the two documents against each other. Netting it into the sale hides
both the purchase weight and the real sale value, and breaks AML cash reporting.

---

## 4. Melting and refining — the WIP process

The single most under-modelled area in jewellery ERPs, and the one where money disappears.

**Issue to furnace** — metal leaves saleable stock; the document freezes:

| Account | Dr | Cr | Dr g | Cr g |
|---|---|---|---|---|
| Gold in Melting (WIP) | 5,400 | | 9.160 | |
| Inventory — Old Gold | | 5,400 | | 9.160 |

**Return from melt** — recovered fine weight is less than issued fine weight:

| Account | Dr | Cr | Dr g | Cr g |
|---|---|---|---|---|
| Inventory — Fine Metal | 5,290 | | 8.973 | |
| Gold Melting Wastage / Refining Loss | 110 | | 0.187 | |
| Gold in Melting (WIP) | | 5,400 | | 9.160 |

**Refining charges** are a separate expense, never netted into the loss:

| Account | Dr | Cr |
|---|---|---|
| Gold Melting Charges | 85 | |
| Cash / Refinery Payable | | 85 |

**Controls that make this trustworthy**
- Loss is expressed as **yield %** against a per-method tolerance band, not as an absolute.
  Typical furnace loss is well under 2%; anything above the band is an exception requiring
  named approval, not a silently posted expense.
- Loss must post **per lot**, not as a period-end plug. A period plug is exactly how
  systematic shrinkage hides.
- WIP must be reconcilable at any instant: `issued fine − returned fine − loss = in-furnace fine`.
- The melt document, its weighings and its purity results freeze at issue.

---

## 5. Karigar / goldsmith job work — the metal account

The classic metal account. Metal is **issued** to a karigar and finished pieces come back;
the karigar is paid a labour rate and is separately **long or short metal**.

**Issue:**

| Account | Dr | Cr | Dr g | Cr g |
|---|---|---|---|---|
| Metal with Karigar | 58,000 | | 100.000 | |
| Inventory — Fine Metal | | 58,000 | | 100.000 |

**Receipt of finished goods** — 97.4 g fine returned, agreed wastage allowance 2%:

| Account | Dr | Cr | Dr g | Cr g |
|---|---|---|---|---|
| Inventory — New Goods | 56,492 | | 97.400 | |
| Karigar Wastage Allowance (COGS) | 1,160 | | 2.000 | |
| Karigar Metal Shortage (recoverable) | 348 | | 0.600 | |
| Metal with Karigar | | 58,000 | | 100.000 |

**Labour:**

| Account | Dr | Cr |
|---|---|---|
| Making Charge Cost (COGS) | 1,400 | |
| Karigar Payable (cash) | | 1,400 |

The karigar therefore carries **two balances**: cash payable RM 1,400 and metal
receivable 0.600 g. Settling shortage against labour requires a stated rate and a stated
date, posted as an explicit contra — never an implicit offset.

---

## 6. Rate management

- Store **buy and sell separately, per purity, with an effective timestamp.** A single
  `rate` field cannot express a spread, and the spread is the metal margin.
- **Stamp the rate on every row it priced.** Reconstructing "the rate at the time" from a
  rate table that has since moved is the most common source of unreproducible margins.
- Rate overrides (a manager granting a better rate) are a **financial authorisation
  event**: record who approved, what the market rate was, and what it cost — in grams
  given away, not only in currency.
- Rate is company-wide, but a branch may be authorised to a different board rate. If
  branches can differ, rates need branch scope; if they cannot, the system must say so.

---

## 7. Unfixed metal and revaluation

**Fixed** metal has an agreed price. **Unfixed** metal is owed or owned at a price to be
determined later — the business carries the price risk in the meantime.

Net metal position:
```
position_fine = owned_fine + receivable_fine − payable_fine
```
Split fixed vs unfixed. The **unfixed** portion is the live exposure.

At each reporting date, revalue the unfixed position at the closing rate:

| Account | Dr | Cr |
|---|---|---|
| Metal Revaluation Loss | 12,400 | |
| Metal Payable — unfixed | | 12,400 |

A business that hedges (futures/forwards) posts the hedge leg against the same exposure,
and gains on one side offset losses on the other. If the system cannot state the unfixed
position, hedging cannot be reconciled at all and the P&L swings with the gold price for
no explicable reason.

---

## 8. Multi-branch

- **Every** control, ledger view and statement scopes by branch: trial balance, P&L,
  balance sheet, cash flow, ageing, metal position. A branch-filter field that exists on
  the input type but is never used by the report service is a *reporting lie*, not a
  missing feature.
- **Inter-branch metal transfer** is a custody transfer with an in-transit stage. It posts
  Dr Branch B / Cr Branch A, and the inter-branch accounts must **net to zero on
  consolidation** — a standing check, run every close.
- Transfers must post **instantly**, not on a nightly job. Two branches disagreeing about
  where a 2 kg lot is, for eight hours, is how lots disappear.
- Fiscal periods: decide explicitly whether a period locks per company or per branch. A
  company-wide lock stops a branch closing early; a per-branch lock lets one branch's
  numbers move after group reporting. State the choice; do not leave it implicit.

---

## 9. Gold savings schemes — customer advances

Collections are a **liability**, not revenue:

| Account | Dr | Cr |
|---|---|---|
| Cash / Bank | 500 | |
| Customer Scheme Advances | | 500 |

Revenue is recognised only on delivery of goods, when the advance is applied against a
sale. The scheme bonus (a free instalment, a discount, or grams gifted) is a **cost of the
scheme**, recognised as the liability accrues — not netted invisibly into the final sale.

Where a scheme is denominated in **grams** rather than money, the liability is a metal
payable and belongs in the metal position (§7); the business is short every gram it has
sold forward.

**Regulatory** *(verify per jurisdiction and date; India commentary as at 2025 — re-verify)*:
advances must generally be appropriated against supply within **365 days**, which is why
schemes are structured at 11 months. Additional contributions such as maturity bonuses may
be re-characterised as **deposits**, which carries a materially heavier regime. The system
must be able to prove instalment count, dates and appropriation per member.

---

## 10. Gold loan / pawn

Pledged metal is **not** the lender's inventory — it is collateral. Principal is a
receivable, interest accrues over time, and the pledged weight is tracked off-balance-sheet
in grams. On default, the metal moves onto the books at the lower of loan value and market,
and only then enters inventory or melting.

---

## 11. Tax

- Compute at the **line**, not the document, so mixed-rate baskets (metal vs making charge
  vs certification) are right.
- Support **additive and deductive** (withholding-style) directions and multiple taxes per
  line; store the resolved breakdown on the line rather than recomputing it at report time.
- **Inclusive pricing** must divide out the additive rate to reach base before applying any
  deductive tax — order matters and a wrong order produces small, plausible, permanent errors.
- Old-gold purchase from an unregistered walk-in seller has different treatment from a
  supplier purchase in most regimes; the system must be able to distinguish them.
- Tax reporting must tie to the ledger, and every tax posting must carry the account it
  landed on.

---

## 12. Cash, AML and the counter

Old-gold buying is a cash-out business with anonymous counterparties — a recognised
high-risk money-laundering channel. Scheme collections are cash-in. Both are finance
controls and both must be enforced **before the write**, not flagged after:

- Cash threshold per transaction and cumulative per customer per period, with identity
  verification required above the threshold.
- **Structuring detection**: several sub-threshold transactions from the same party in a
  window is the signal that matters; a per-transaction check alone is trivially evaded.
- Till/cash-drawer reconciliation per shift per branch, with a named counter and a variance
  account. Variance must post, not be silently absorbed.
- Thresholds change. Store them as configuration with an effective date, never as a
  constant in code.

---

## 13. Controls and segregation of duties

| Control | Why |
|---|---|
| Period lock, with a named bypass permission | Back-dating into a reported period is the most common quiet restatement |
| Locked entry immutability after POSTED | An editable posted entry is not a ledger |
| Every mutation carries actor + before/after | Audits become fast and impersonal |
| Rate override requires a second party | Rate is the margin; one person must not set it alone |
| Melt approval separate from melt preparation | Custody + valuation in one pair of hands is the classic fraud |
| Write-off/adjustment requires reason + approval | Adjustments are where shrinkage is buried |
| One person cannot both create and post a payment | Standard SoD |

A period lock that can be bypassed on *one* posting path is not a period lock.

---

## 14. The reports the owner actually asks for

Name each report for the decision it drives.

| Report | Decision |
|---|---|
| **Metal position** (fine g, per branch, fixed vs unfixed) | Are we long or short, and how exposed to the rate? |
| **Metal account statement** per party | What does this karigar/supplier/customer owe us in grams? |
| Margin decomposition (metal / making / old-gold, resale vs melt) | Which part of the business earns? |
| Melt yield & loss vs tolerance, per lot & per branch | Is anyone stealing? |
| Branch P&L and branch balance sheet | Which branch works? |
| Inter-branch reconciliation (must net zero) | Is anything in transit forever? |
| Aged receivable/payable, in money **and** grams | Who is slow, and in which currency? |
| Scheme liability ageing + appropriation | Are we within the 365-day window? |
| Cash & AML exception report | What must be reported, and who is structuring? |
| Trial balance, P&L, BS, cash flow | Statutory |
| Rate-override cost report (grams given away) | What do discretionary rates cost us? |
| Stock take variance, at fine weight | Does the floor match the ledger? |

Missing reports are **BLIND-SPOT** findings, not feature requests: the numbers exist and
the owner cannot see them.

---

## Sources consulted (2026-08-21 — re-verify before quoting numbers)

- [Karat-wise stock accounting for jewellers](https://www.appitsoftware.com/blog/karat-wise-stock-accounting-jewellery-erp-india) — dual ledger, fine-weight reconciliation, metal position
- [ERPNext customisation for gold trading](https://clefincode.com/blog/global-digital-vibes/en/erpnext-customization-for-gold-trading-and-jewelry-business) — metal accounts, karat segregation
- [Gold management for jewellery retailers](https://medium.com/@simpo.ai/gold-management-for-jewelry-retailers-track-weight-purity-price-profit-bd1c4345d915) — gross/net/stone weights, workshop metal balance
- [Jewellery internal audit SOP — inventory & AML](https://www.templateregistry.com/templates/internal-audit-checklist-for-jewellery-industry) — audit trail, RBAC, approval workflow
- [ERP + accounting integration for jewellery](https://www.synergicssolutions.com/integrating-erp-with-accounting-software-for-jewellery-businesses-a-complete-guide) — multi-branch authorisation, daily reconciliation
- [Gold fixing](https://en.wikipedia.org/wiki/Gold_fixing) and [dealer hedging](https://www.jmbullion.com/gold-and-silver-dealer-hedging-infographic/) — fixed vs unfixed, net house position
- [Laws governing gold savings schemes](https://www.mondaq.com/india/corporate-and-company-law/1570654/laws-governing-gold-savings-schemes-by-jewellery-brands) — 365-day appropriation, deposit re-characterisation
- [Cash-for-gold AML risk](https://rapidaml.com/aml-index/cash-for-gold-services/) and [AML for high-end jewellery](https://financialcrimeacademy.org/aml-regulations-for-high-end-jewelry/) — risk assessment, identity, independent audit

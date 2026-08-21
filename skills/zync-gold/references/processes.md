# The trade's processes

Locate the request before answering it. Each process has its own **custody shape** (who
holds the metal and when it changes hands), **pricing shape** (what determines the number
on the invoice) and **ledger shape** (what the journal looks like). Getting the process
wrong means getting all three wrong.

## Contents

1. New gold sale
2. Old gold outright buy
3. Trade-in / exchange
4. Disposition — resell vs melt
5. Melting
6. Refining / refinery consignment
7. Scrap consolidation and transfer
8. Gold savings scheme
9. Gold loan / pawn
10. Metal (gram) account with a supplier
11. Unfixed metal and rate fixing
12. Karigar / goldsmith job work
13. Consignment / memo stock
14. Repair of a customer's own item
15. Custom / bespoke order
16. Physical stock take
17. Hallmarking

---

## 1. New gold sale
**Custody** — piece leaves on payment. **Pricing** — `goldValue + making + stone + tax`, at
the rate ruling *when*? That is the whole question: quote time, invoice time or payment
time. Pick one, store the rate snapshot on the document, and never recompute historically.
**Ledger** — Dr Cash/AR, Cr Sales (split gold value vs making charge — they have different
margins and often different tax treatment), Cr Tax; Dr COGS, Cr Inventory.

## 2. Old gold outright buy
Customer sells for cash. **Custody** — piece arrives, cash leaves. **Pricing** — buy rate
per purity × pure weight; the buy-back spread covers assay risk. **Ledger** — Dr Inventory
(old gold), Cr Cash. **Risk** — purity misjudged at the counter, and AML exposure on cash
payouts. Identity capture belongs here, at acquisition, not later.

## 3. Trade-in / exchange
Old gold set against a new purchase in one customer interaction but **two ledger events**.
Model it as a sale plus a purchase, linked — not as a discount. Treating the trade-in as a
discount destroys the old gold cost basis and makes melting yield unattributable later.
**Pricing** — new piece at sell rate, old at buy rate; the customer sees only the
difference. **Ledger** — full sale entry, full purchase entry, net settlement.

## 4. Disposition — resell vs melt
Not a transaction; a **decision**, and the highest-leverage one in old gold. Melting
permanently destroys the making-charge value embedded in a saleable piece. A hallmarked,
current-design, single-karat piece in good condition should be resold; broken, soldered,
unmarked, mixed-karat or stone-set junk should be melted. Record the decision, the grader
and the timestamp; an ungraded pile is a pile nobody is accountable for. Feeds 1 or 5.

## 5. Melting
**Custody** — the critical one. Scrap becomes anonymous the moment it is mixed, so this is
the highest-shrinkage-risk process in the business. Lot-based, one karat class per lot,
dual-witnessed weighings at every hand-off, immutable from issue. **Pricing** — none; this
is a conversion. **Ledger** — Dr WIP (gold in melting), Cr Inventory at carrying cost on
issue; on receipt Dr Inventory (output) + Dr melting loss + Dr melting charges, Cr WIP.
**Reconciliation** — see `metal-math.md`.

## 6. Refining / refinery consignment
Melting done by a third party, which adds days of exposure and a counterparty. Industry
practice worth mirroring: material weighed to **0.01 g** on intake, assigned a **lot
reference**, and the seller issued an **intake certificate** stating gross weight.
Settlement arrives as an **assay report + weight certificate + itemised fee schedule**;
model all three, because a refiner who supplies only a net figure cannot be audited.
Record the **date of assay finalisation** separately from the date of arrival — the gap is
the refiner's turnaround, and it is negotiable. Where a settlement is disputed, an
independent assay is the normal tie-breaker, so store which lab produced each figure.

## 7. Scrap consolidation and transfer
Small branches cannot melt economically — furnace loss per event is roughly fixed, so tiny
lots bleed. Scrap moves up to a consolidation branch. **Custody** — the transfer itself is
the risk; two-sided confirmation (sent by / received by, with weights at both ends) is
mandatory, and a weight difference between the two ends is an incident, not a rounding.

## 8. Gold savings scheme
Customer pays instalments, takes gold later. **This is a liability, not revenue** — money
received is a customer advance until the metal is delivered. **Pricing** — the hard part:
is the customer buying grams at each instalment's rate, or rupees/ringgit toward a future
purchase? Grams-at-each-rate makes the business short metal and needs hedging; currency
makes the customer bear the price risk. The two are completely different products and the
scheme terms must say which. **Legal** — see `compliance.md`; scheme duration is
regulated. **Ledger** — Dr Cash, Cr Scheme Liability (and a gram liability if grams-based).

## 9. Gold loan / pawn
Customer pledges gold for cash. **Custody** — you hold someone else's metal; it is
emphatically **not inventory** and must never appear in sellable stock. Purity and weight
at pledge are the collateral basis, so they are assessed and photographed. **Pricing** —
loan-to-value against pure weight at a conservative rate. **Ledger** — Dr Loan Receivable,
Cr Cash; pledged metal off-balance-sheet or in a custody account. **Lifecycle** — interest
accrual, redemption, default, auction, surplus refund to the customer.

## 10. Metal (gram) account with a supplier
Balances denominated in **grams, not currency**. You send scrap, you receive credit in pure
grams; you draw fine gold against it later. Common with refiners and bullion suppliers in
Malaysia and the Gulf. A currency-only payables ledger cannot represent this at all — the
account needs its own gram balance, gram statements and gram reconciliation.

## 11. Unfixed metal and rate fixing
Metal acquired without the price being set — typically a **gold metal loan** from a bullion
bank, priced only when the finished goods sell, which can be months later. Until fixed, the
business carries an open metal position. **Model** — every unfixed lot needs quantity in
grams, an acquisition date, and a fixing event that stamps the rate. **Exposure** — the sum
of unfixed grams is the position; it is long or short and it should be on a dashboard, not
buried. Interest accrues on the metal loan. Hedging (futures) offsets it. Any design that
stores only a fixed cost per purchase cannot represent an unfixed position and will
silently misstate both inventory and margin.

## 12. Karigar / goldsmith job work
Metal issued to a craftsman by weight, finished pieces returned by weight. **Custody** —
issue and return are both weighings; the difference is the karigar's wastage and it is
tracked per worker, because a craftsman consistently above his peers is the single clearest
signal in the workshop. **Pricing** — labour per gram, per piece, or daily. **Ledger** — WIP
by karigar. **Note** — the wastage here is *physical loss*, distinct from the making-wastage
charged to customers.

## 13. Consignment / memo stock
Goods on your premises that you do not own (or yours sitting with another jeweller). Must
not be counted as inventory or valued as an asset, but must appear in a stock take and be
sellable. A single `isOwned` flag is not enough — the counterparty, the memo reference and
the return-by date all matter.

## 14. Repair of a customer's own item
Customer-owned metal on your premises. Same rule as pawn: never inventory. Weight in and
weight out are recorded because a repair that returns less gold than it received is a
dispute waiting to happen. **Pricing** — labour, plus any gold added, at the rate on the day.

## 15. Custom / bespoke order
Design agreed, advance taken, delivery promised. **Pricing** — the risk is a rate quoted at
order and honoured at delivery weeks later; either fix the rate at order (and carry the
exposure) or state that the final price follows the delivery-day rate. Store which.

## 16. Physical stock take
Count **by piece and by weight, and reconcile both** — piece counts catch missing items,
weight catches shaving and substitution. Practice that separates the competent from the
negligent: **cycle counting** beats an annual count, because errors surface while they are
still traceable; **separation of duties**, so whoever counts is not whoever adjusts;
section sign-off by counter *and* manager; and every variance logged against a user and a
timestamp rather than quietly absorbed. With integrated digital scales and disciplined daily
verification, variance under 0.1% is achievable — which means anything materially above
that is a finding, not noise. Filings, dust and polishing sweeps are weighed and recorded
too; the workshop floor is a classic leak.

## 17. Hallmarking
Pieces leave for an assaying centre and come back marked, so it is a custody process like
any other. Where hallmarking is mandatory the system must block the sale of an unmarked
piece rather than rely on staff noticing. See `compliance.md` for the India HUID regime,
including its API integration requirement.

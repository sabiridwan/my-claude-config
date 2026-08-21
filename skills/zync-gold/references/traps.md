# Traps that break gold ERPs

Each of these has sunk a real system. Check every design against the list; when reviewing
existing code, this is the review checklist.

## 1. Currency-only thinking
A jeweller is long or short **metal**. Every stock, payable and receivable needs a gram
column beside the money column. Systems built by generalist ERP teams almost always miss
this, and the symptom is that nobody can answer "how many grams do we owe?" without a
spreadsheet.

## 2. One weight field
Gross-only or net-only makes stone disputes unanswerable. Store gross, stone and net —
and derive pure. See `metal-math.md`.

## 3. Purity stored on a guessed scale
0.916, 91.6 and 916 are the same purity. Code that infers the scale from magnitude will be
wrong by 10× or 1000× somewhere. Pick per-mille, normalise once at the service boundary,
and never guess again.

## 4. Declared purity treated as fact
It is one person with a touchstone. Store the test method (`HALLMARK | XRF | TOUCHSTONE |
ACID | DECLARED`) and the tester. Every yield dispute traces back to this number, and
"the system says 916" is not a defence when the bar assays 902.

## 5. The two wastages conflated
Making wastage is a pricing convention charged to the customer (6–12% typical, 18–30% for
heavy handwork). Melting loss is physical metal that did not survive the furnace (under 2%).
One field for both means a 10% melting loss looks normal and theft is invisible.

## 6. Editable records after custody transfer
The moment metal leaves the counter the document freezes. Editable shrinkage is unauditable
shrinkage — someone can always make the numbers reconcile after the fact.

## 7. No tolerance band
Without an expected loss per karat class there is no variance, and without variance there is
no signal. "It came back a bit light" is not a finding; "1.9% against a 1.5% band on the
fourth lot this month from the same operator" is.

## 8. Loss treated as always-positive
Negative loss (yield above declared) means the counter *underpaid the customer*. It is a
real finding with commercial and reputational consequences. Track it; don't clamp it to zero.

## 9. Mixed-karat melting by default
A mixed lot yields a bar of unknown karat and destroys per-piece yield attribution. Allow it
only behind an explicit override with a widened band.

## 10. Metal in transit invisible on the balance sheet
Gold at a refinery, in a furnace, with a karigar or in inter-branch transit needs its own
asset account. Without one it vanishes from the balance sheet for the days it is out, and
nobody notices when it fails to come back.

## 11. Single-person weighing
Every weighing is a two-person event with a stored reading, a witness and a timestamp.
A single-person weighing is not evidence of anything.

## 12. Missing rate snapshots
Store the rate at every state change, not just at invoice. Reconstructing "what was gold
worth when we issued this lot" from a rate table three months later is guesswork.

## 13. Customer-owned metal counted as inventory
Pawn collateral, repair items and memo stock are on your premises and are not yours.
Counting them inflates assets and, worse, makes them sellable.

## 14. Scale calibration ignored
A drifting scale is mathematically indistinguishable from steady theft. Record the scale
used for each weighing and its calibration date; block weighings on an out-of-calibration
scale.

## 15. Old gold sold as new
Second-hand pieces need their own revenue and cost lines, or margin analysis silently
blends two businesses with completely different economics.

## 16. Compliance treated as a report instead of a gate
Identity capture on cash buys, hallmark checks before billing, scheme duration limits —
these have to block the transaction at the point of sale. A month-end exception report tells
you about the breach after it is a breach.

---

## Review heuristics

When reviewing an existing gold module, these questions surface most problems fast:

- Can it answer a question in **grams**? Try "how much pure gold do we hold at branch X?"
- What happens to a piece **between** purchase and stock creation — does anything see it?
- Which fields are still writable after custody transfer?
- Is there any number in the system that is a **variance against an expectation**, or only
  raw totals?
- Where does purity enter from a client, and how many places normalise it?
- If the same person did every step, what would stop them?

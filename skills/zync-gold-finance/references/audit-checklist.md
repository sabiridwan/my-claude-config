# Finance audit checklist — 12 dimensions

Every check states **what it proves**, the **command**, and **what a pass looks like**.
Run `scripts/audit_finance.sh` first; it executes most of these and prints the evidence
pack. Use this file to interpret the pack and to run the checks the script cannot
automate.

Paths assume the zync-nestjs layout (`src/modules/finance/...`). Adjust the root for other
repos; the checks themselves are portable.

---

## 1. Double-entry integrity

**1.1 Every posting path pairs its legs.** A path that calls the transaction service an
odd number of times, or inside a conditional that can produce one leg without the other,
can write a one-sided entry.

```bash
grep -rn "transacSvc.create\|transSvc.create\|transactionSvc.create" src --include="*.ts" | grep -v spec
```
Pass: every call site sits in a block that unconditionally produces its counter-leg, and
both legs share a `relationId`.

**1.2 Entry-level balance is enforced before write.**
```bash
grep -rn "totalDebit - totalCredit\|Math.abs(totalDebit" src --include="*.ts" | grep -v spec
```
Pass: each entry type (journal, cashbook, contra, note, payment, trade) validates
`|Dr − Cr| <= tolerance` before persisting. Tolerance must be a named constant, sub-cent,
and applied to a rounded comparison — not a magic literal per module.

**1.3 Ledger-level balance check is not a full-collection scan.**
```bash
grep -rn "validateBalanced" src --include="*.ts" | grep -v spec
```
Pass: the check is scoped (company + period, or the entry just written), runs off the
write path or on a schedule, and has **no** environment kill-switch reachable in
production. A `console.log` inside it is a finding on its own.

**1.4 Deletes and updates re-balance.** Every `delete`/`update` on an entry must remove or
adjust *all* its legs, including tax legs, inside one transaction.

---

## 2. Posting-path coverage

**2.1 Every value event reaches the GL.** Enumerate the business events that move value,
then prove each one posts. In a jewellery ERP the list is at least:

sales invoice · sales return · purchase invoice · purchase return · old-gold purchase ·
trade-in · **melt issue** · **melt return (yield + loss)** · **refining charge** ·
stock adjustment · stock transfer (inter-branch) · **karigar metal issue** ·
**karigar receipt + wastage + shortage** · job-order invoice · scheme collection ·
scheme redemption · membership · payment/receipt · knock-off · contra · asset purchase ·
asset depreciation · asset disposal · payroll · staff loan/advance · **rate revaluation** ·
cash-drawer variance

```bash
# What kinds exist vs which are ever constructed
grep -n "= \"" src/modules/finance/transaction/transaction.schema.ts | sed -n '/AccountTransactionKind/,$p'
for k in $(grep -oE "^\s+[A-Za-z0-9]+ = " src/modules/finance/transaction/transaction.schema.ts | tr -d ' ='); do
  n=$(grep -rl "AccountTransactionKind.$k" src --include="*.ts" | grep -v spec | grep -vc transaction.schema.ts)
  echo "$n  $k"
done | sort -n
```
Pass: no kind has zero non-schema references. A declared-but-never-constructed kind means
the event exists in the business and posts nothing → **BOOKS-WRONG**.

**2.2 Modules that should post but import no finance service.**
```bash
for m in melting job-order scheme inventory/transfer inventory/adjustment cash-drawer; do
  echo "$m: $(grep -rl "AccountTransactionService" src/modules/$m --include='*.ts' 2>/dev/null | grep -vc spec)"
done
```
Pass: every module handling value has at least one non-spec importer.

**2.3 Conditional posting.** A posting guarded by `if (someAccount)` silently skips the GL
when the chart is unseeded.
```bash
grep -rn -B3 "transacSvc.create\|transSvc.create" src --include="*.ts" | grep -n "if (" | head -40
```
Pass: an unresolvable account **throws**, or degrades to a named suspense account that a
report surfaces. Never a silent skip.

---

## 3. Period lock & immutability

**3.1 Guard coverage vs mutation count.**
```bash
for f in src/modules/finance/*/*.resolver.ts; do
  printf "%-58s mut=%-3s lock=%-3s posted=%-3s audit=%s\n" "$f" \
    "$(grep -c '@Mutation' $f)" "$(grep -c 'GuardLockedPeriod' $f)" \
    "$(grep -c 'GuardPostedEntry' $f)" "$(grep -c '@AuditMeta' $f)"
done
```
Pass: every mutation that creates or moves a dated financial row is covered by a lock check
— at the resolver via the guard, or in the service via `validateTransactionDate`. Prove
which; a resolver with `lock=0` is only fine if its service validates.

**3.2 The lock has no hole for undated periods.**
```bash
grep -n "No fiscal period found" -B4 -A4 src/modules/finance/fiscal/fiscal.service.ts
```
Pass: a date with **no** fiscal period is **rejected**, not treated as unlocked. Returning
`locked: false` when no period exists means any date outside the seeded range — a prior
year, a far-future date — is freely postable. This is the most commonly missed hole.

**3.3 POSTED is immutable.** Prove update/delete on a POSTED entry is refused on every
path, not only where `GuardPostedEntry` is applied.

**3.4 Closing a period is gated.** Prove `closePeriod` refuses while draft/unposted entries
or an unbalanced ledger exist in that period, and that CLOSED cannot be reopened silently.

---

## 4. Chart of accounts fitness

**4.1 The gold-specific accounts exist.** Compare the seeded chart against
`gold-finance-domain.md` §1.
```bash
grep -rnE "Gold|Old Gold|Melt|Making|Scrap|Bullion|Karigar|Scheme|Wastage|Revaluation" \
  src/modules/finance/finance.seed.ts src/modules/finance/finance.model.ts | grep -v spec
```

**4.2 Seeded-but-never-posted accounts.** For each gold account name/code constant, prove
at least one posting path references it.
```bash
for c in GOLD_IN_MELTING GOLD_MELTING_WASTAGE GOLD_MELTING_CHARGES WORK_IN_PROGRESS \
         PURCHASE_OLD_GOLD_JEWELLERY SALES_OLD_GOLD_JEWELLERY EXCHANGE_BALANCING SUSPENSE; do
  echo "$(grep -rl "$c" src --include='*.ts' | grep -v spec | grep -vc 'finance.model.ts')  $c"
done | sort -n
```
Pass: count > 0 for every one. A zero here is a **BOOKS-WRONG** finding — the chart claims
a capability the code does not have.

**4.3 Account codes are not duplicated across constant files**, and every hard-coded code
resolves against the seed.

**4.4 System accounts are hidden and net to zero.** Exchange Balancing and Suspense must be
excluded from user-facing pickers and must carry a zero balance at close; a non-zero
suspense balance is an open finding, not a rounding artefact.

---

## 5. Metal ledger

**5.1 Grams live beside money on the ledger row.**
```bash
grep -n "purity\|weight\|grams\|fine" src/modules/finance/transaction/transaction.schema.ts
```
Pass: the row carries **net weight, purity, and derived fine weight** — not merely a
purity factor applied to a currency amount. `purityValue = amount × purity/1000` is a
*value* split, not a metal ledger: it cannot answer "how many grams do we owe this
karigar" because it has no weight input.

**5.2 Purity has one scale, converted once at the boundary.**
```bash
grep -rn "toPurityFactor\|normalizeInboundPurity\|calculatePureWeight" src --include="*.ts" | grep -v spec
grep -rnE "purity ?[/*] ?(100|1000)|purity ?> ?1 ?\?" src --include="*.ts" | grep -v purity.util
```
Pass: all arithmetic goes through the shared util; **zero** hits on the second grep
(magnitude-guessing a scale is banned — see `zync-gold`).

**5.3 Party metal balances are queryable.** Prove a query exists returning fine-gram balance
per customer/supplier/karigar/branch. Absent → **BLIND-SPOT**.

**5.4 Dead metal fields.** A declared-but-unreferenced field (`amount2`, `weight2`) is
either an abandoned metal ledger or a trap for the next developer. Report it.

---

## 6. Rate & valuation

**6.1 Rate has buy/sell, purity and an effective time.**
```bash
sed -n 1,40p src/modules/rate/rate.schema.ts
```
Pass: separate buy and sell, purity reference, explicit effective timestamp (not
`createdAt` doing double duty), and branch scope if branches may differ.

**6.2 The rate is stamped on the priced row.** Prove the row stores the rate, the side, and
the timestamp used. Reconstruction from the rate table is a finding.

**6.3 Overrides are authorised and costed.**
```bash
grep -rn "rateOverride\|marketRate\|gramsGivenAway" src --include="*.ts" | grep -v spec | head
```
Pass: approver, market rate at the time, and the cost in grams recorded on the row.

**6.4 Unfixed position is revaluable.** Prove there is a way to identify unfixed metal and
post a revaluation. Absent → **BLIND-SPOT** (or BOOKS-WRONG if the business genuinely
carries unfixed exposure).

---

## 7. Multi-branch & inter-branch

**7.1 Reports scope by branch.**
```bash
grep -c "branchId" src/modules/finance/report/report.service.ts
grep -n "branchId" src/modules/finance/report/report.interface.ts src/modules/finance/report/report.dto.ts
```
Pass: if the input type accepts `branchId`, the service must use it. Accepting a filter and
ignoring it is a **BOOKS-WRONG** reporting lie — the user believes they are looking at one
branch.

**7.2 Transactions carry branch and it is set consistently.**
```bash
grep -rn "branchId" src/modules/finance --include="*.ts" | grep -v spec | grep -v "index("
```
Pass: one mechanism (base repository injection **or** explicit assignment), not a mix.

**7.3 Inter-branch transfers net to zero.** Prove a reconciliation query exists and a close
step runs it.

**7.4 Fiscal period scope is deliberate.**
```bash
grep -n "companyId\|branchId" src/modules/finance/fiscal/fiscal.schema.ts
```
Pass: whichever scope is chosen is documented. Company-only is acceptable; company-only
*by accident* is not.

---

## 8. Tax

**8.1 Line-level, multi-tax, both directions.**
```bash
grep -n "computeLineTaxes\|LineTaxDirection\|taxInclusive" -r src/modules/finance --include="*.ts" | grep -v spec
```
Pass: additive and deductive supported; inclusive pricing divides out the additive rate
before applying deductive tax; resolved breakdown persisted on the line.

**8.2 Tax legs are excluded from entry totals exactly once.**
```bash
grep -rn "AccountTransactionKind.TaxEntry" src --include="*.ts" | grep -v spec | wc -l
```
Pass: every aggregation that should exclude tax legs does, and none double-excludes.

**8.3 Tax report ties to the ledger.** Prove the tax report sums the same rows the GL holds.

---

## 9. Receivables/payables & settlement

**9.1 Knock-off cannot over-apply.** Prove an allocation greater than the open balance is
refused, and that a reversal releases the allocation.

**9.2 Contra between a debtor and creditor for the same party** is an explicit posting with
both legs and a stated rate where metal is involved.

**9.3 Ageing buckets derive from document date, not created date.**
```bash
grep -n "documentDate\|createdAt" src/modules/finance/report/report.aged.utils.ts
```

**9.4 Ageing exists in grams as well as money** where metal accounts are in use.

---

## 10. Cash & AML

**10.1 Gates run before the write.**
```bash
grep -rn "assertCashDepositAllowed\|cashThreshold\|amlThreshold\|kyc" src --include="*.ts" | grep -v spec
```
Pass: refusal happens before any ledger row exists. Flagging after the write is not a control.

**10.2 Thresholds are configuration with an effective date**, not constants in code.

**10.3 Structuring detection exists** — cumulative per party per window, not only
per-transaction.

**10.4 Cash drawer reconciles per shift per branch**, and variance posts to a named account.
```bash
ls src/modules/cash-drawer 2>/dev/null && grep -rn "AccountTransactionService" src/modules/cash-drawer --include="*.ts" | grep -vc spec
```

---

## 11. Audit trail & segregation of duties

**11.1 Every finance mutation is audited.** Use the table from 3.1; `audit` must equal
`mut` for every finance resolver. Under-count → **CONTROL-GAP**, listed per resolver.

**11.2 Before/after values are captured**, not merely the action name.

**11.3 SoD is enforced where value moves.** Prove at least: rate override approver ≠
requester; melt approver ≠ preparer; payment poster ≠ creator; adjustment approver ≠ maker.
```bash
grep -rn "approvedBy\|submittedBy\|preparedBy\|requestedBy" src --include="*.ts" | grep -v spec | head -30
```
Pass: each pair is compared, not merely stored. Storing both names without comparing them
is theatre.

**11.4 Deletes are soft and reversals are explicit.** A hard delete of a posted row is a
restatement with no trace.

---

## 12. Reporting truth

**12.1 Each statement ties to the ledger.** Trial balance totals = sum of posted legs; BS
assets = liabilities + equity + current-year earnings; cash-flow closing = bank/cash
balances.

**12.2 Current-year earnings roll into retained earnings at year end.**
```bash
grep -rn "RETAINED_EARNINGS\|CURRENT_YEAR_EARNINGS" src --include="*.ts" | grep -v spec
```
Pass: a real year-end close routine exists — not only a report-time synthetic line.

**12.3 The decision-driving reports from `gold-finance-domain.md` §14 exist.** List each
missing one as a **BLIND-SPOT** finding naming the decision it blocks.

**12.4 Reports read POSTED only**, or state their status filter explicitly. A report that
silently includes DRAFT rows is a **BOOKS-WRONG** finding.
```bash
grep -n "AccountTransactionStatus.POSTED\|status" src/modules/finance/report/report.service.ts | head -30
```

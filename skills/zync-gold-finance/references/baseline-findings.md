# Baseline findings — zyncg-be

**Repo** `/Users/sabiridwan/Projects/zyncgold/zyncg-be` (same lineage as prior `zyncg-server` —
sha `7ada1e7` confirmed present in `git log`)
**Branch** `dev-v1` · **Last run** 2026-08-23 · **Scope this run** diff `7ada1e7..HEAD`,
dimensions 1, 2, 3, 4, 9 (purchase/sales/returns finance process). Dimensions 5-8, 10-12
NOT re-verified this cycle — items below tagged with those dimensions carry forward
unverified, as claims about the past per the skill's own rule.

> A recurring run must **re-verify** each finding before repeating it, and report **deltas
> only**. Rewrite this file with the new sha and state at the end of every run.

## State of the tree — end of 2026-08-23 session

HEAD `e695a07`. 726 commits since repo start; 45 files changed in
`finance`/`inventory`/`scheme`/`job-order`/`rate` since baseline sha `7ada1e7`
(3384 insertions, 270 deletions) — none of it touching the return/reversal or
old-gold/making-charge split paths, which were examined byte-for-byte against
`7ada1e7` and found unchanged.

This run's headline result: **two prior findings (N2, #21) were misdiagnoses at the time
they were written**, not regressions since fixed — the underlying code was already correct
at sha `7ada1e7`. One new BOOKS-WRONG finding and one new CONTROL-GAP were found by reading
the return-reversal path end-to-end and by tracing `withRetryTransaction` into
`zync-nest-data-module` to close out last cycle's open atomicity question.

---

## Open findings — this cycle (verified against e695a07)

| # | Sev | Dim | Finding | Evidence |
|---|-----|-----|---------|----------|
| N14 | BOOKS-WRONG | 1, 4 | Return reversal collapses the old-gold/making-charge split back into a single Inventory leg. Forward posting (`addGoodsBilling`) splits goods value across up to 3 accounts (Inventory / Old-Gold / Making-Charge); the reversal (`returnInvoice`) reverses the whole `goods` amount as ONE leg against Inventory only. Old-Gold and Making-Charge accounts never get touched on return — permanently overstated. Entry still balances via the settlement leg, so `validateBalanced()` can't catch it | `invoice.return.ts:99-121` vs `invoice.transaction.ts` (`addGoodsBilling`, ~217-356) |
| N15 | CONTROL-GAP | 3 | Whole-app transaction atomicity (`withRetryTransaction`, used by 20+ finance/inventory call sites incl. `purchase.service.ts:update()` / `sales.service.ts:update()`'s delete-then-recreate ledger pattern) is a no-op — no session, no rollback — unless `process.env.mongodb_transaction_enable` is the exact string `"true"`. Nothing asserts this at bootstrap; only a `.env` comment protects against silent degradation | `zync-nest-data-module/libs/src/service/service.ts:80`; `.env:19-26` |

## Open findings — carried forward, NOT re-verified this cycle

Scope this run excluded dimensions 5-8, 10-12 and did not touch payment/knock-off,
audit-trail, reporting, cash/AML, or metal-ledger code. These are unchanged claims from
the 2026-08-21 baseline — re-verify before acting on any of them.

| # | Sev | Dim | Finding | Evidence |
|---|-----|-----|---------|----------|
| N1 | BOOKS-WRONG | 8, 1 | A line tax on a note/cashbook/contra entry posts two offsetting tax legs and grosses up both principal legs. Tax account nets to zero; entry balances, nothing fails | `transaction.service.ts:92,138-140,171-185`; `note.service.ts:672-688`; `cashbook.service.ts:252-258`; `contra.service.ts:152,172` — baseline says this was FIXED via `resolveLineTaxSplit`/`stripLineTax`, see Fixed section below; re-verify before assuming still open |
| 4 | BOOKS-WRONG | 7 | Reports accept `branchId` and ignore it — every branch report is a group report | `report.interface.ts:107` vs 0 hits in `report.service.ts` |
| N4 | CONTROL-GAP | 9 | Knock-off can over-apply — guard compares to `invoice.totalAmount`, not the open balance; payment path only `console.log`s | `payment.service.ts:450-455`; `note.service.ts:1057` |
| 6 | CONTROL-GAP | 2 | Cash-drawer variance computed and authorised, never posted — zero references to `AccountTransactionService` in `cash-drawer.service.ts` | `cash-drawer.dto.ts:79-95` |
| N11 | CONTROL-GAP | 11 | No true before-snapshot anywhere — `snapshotBefore` assigned the post-mutation result. Snapshots only populated for CREATE/DELETE | `interceptors/audit.interceptor.ts:83-84` |
| N3 | CONTROL-GAP | 8 | A line tax on a payment entry unbalances the entry outright | `payment.service.ts:243-259,196` — baseline says FIXED, re-verify |
| N12 | BOOKS-WRONG | 3, 12 | Historical data corruption from a removed boot hook; original dates not recoverable except from backup. Cause removed, damage is historical | `inventory/invoice/payment/payment.module.ts` (removed) |
| N6 | CONTROL-GAP | 3 | Fiscal check gated on `documentDate != null` — undated contra/cashbook/note lines post into locked periods unchecked | `transaction.service.ts:84`; `contra.service.ts:152,172` — baseline says FIXED, re-verify |
| N9 | CONTROL-GAP | 11 | `AuditInterceptor` derives action from method name, discards `meta.action` — no before/after snapshot for disposal/depreciation | `interceptors/audit.interceptor.ts:50,59` — baseline says FIXED, re-verify |
| 10 | CONTROL-GAP | 11 | 54 maker/checker fields stored, no comparison enforcing approver ≠ submitter outside scheme rate-override | audit script §11.3 |
| N7 | BLIND-SPOT | 9, 12 | Aged reports age invoices, not the AR ledger; no as-at cutoff, no branch scope | `report.service.ts:1832-1842,1876`; `report.constants.ts:8-16` |
| N8 | BLIND-SPOT | 7 | Inter-branch transfer posts Dr Inventory / Cr Inventory on the same account, no branch dimension — GL no-op | `transfer/item/item.service.ts:58-60,196-215` |
| 12 | BLIND-SPOT | 5 | No metal ledger — row has `purity`/`purityValue`, no weight, no gram balance per party/branch | `transaction.schema.ts:118-124` |
| 13 | BLIND-SPOT | 6 | `Rate` has no effective-date field, no branch scope, no rate type/source | `rate/rate.schema.ts` |
| 14 | BLIND-SPOT | 6 | No unfixed-metal position or revaluation in finance | audit script §6.4 |
| 15 | BLIND-SPOT | 12 | No metal position, margin decomposition, melt-yield, branch P&L, inter-branch reconciliation, or scheme-liability ageing report | 13 reports exposed, none of these |
| 16 | BLIND-SPOT | 12 | No year-end close — retained earnings synthesised at report time, never posted | `report.service.ts:1002-1060` |
| 17 | DEBT | 1 | `validateBalanced` scans the whole company POSTED ledger on every write, from 65+ production call sites | `account.service.ts:634-640` |
| 18 | DEBT | 1 | `journal.service.ts:84` (0.001) and `payroll.service.ts:1428` (0.01) diverge from `LEDGER_BALANCE_TOLERANCE = 0.005` | `finance.model.ts:20` |
| N13 | DEBT | — | Pre-existing upstream DI breakage in `StockService`/`transfer.service.spec.ts`, unrelated to finance work | `inventory/stock/stock.service.ts` |
| 5 | DEBT | 2 | Job-order `if (customerAccount)` skip is dead defensive code | `job-order.service.ts:213` |
| 19 | DEBT | 5 | `amount2` declared on the ledger row, referenced nowhere | `transaction.schema.ts:120` |
| 20 | DEBT | 3 | `AccountTransactionStatus` carries overlapping vocabularies (`SAVED`/`DRAFT`, `POSTED`/`CONFIRMED`) | `transaction.schema.ts` status enum |

---

## Retractions — do not repeat these

- **N2 ("`inventory/returns` posts nothing to the GL / scaffolding only, inert") — WRONG,
  even at the time it was written.** `return.service.ts` calls
  `this.invoiceSvc.returnInvoice(...)` (line 114), which delegates to
  `InvoiceReturnService.returnInvoice()` (`invoice.return.ts`), which posts a full balanced
  journal entry via `JournalEntryService.addEntry()` — reversing the inventory leg, unwinding
  each tax leg to its own account, and routing the balance to a settlement account. This is
  not a fix since baseline: `git diff --stat 7ada1e7..HEAD` on both files touches only
  `return.service.spec.ts`. The claim "`AccountService` is an unused import" was also false
  at baseline time — `return.service.ts` uses it to resolve the settlement control account
  (`getUserAccount`) and to gate `validateBalanced()`. Root cause of the original miss: the
  evidence pack's grep tracks only `AccountTransactionService` usage; this path posts via
  `JournalEntryService` instead. Same false-negative class as the payroll retraction below —
  confirm every "0 importers" by reading the module, every time.
- **#21 ("six gold accounts named in `ACCOUNT_NAME`, referenced by no posting path") —
  mostly wrong.** `PURCHASE_OLD_GOLD`, `SALES_OLD_GOLD`, `WIP`, `WASTAGE`, `CHARGES` are all
  posted to by CODE (`MELT_ACCOUNT_CODES.*`, via `requireAccount`/`getAccountByCode`) in
  `melting.transaction.ts` and `invoice.transaction.ts` — confirmed present, unchanged, at
  baseline sha `7ada1e7` too. Only the `ACCOUNT_NAME.*` string-constant identifiers in
  `finance.model.ts` are genuinely dead as literal references — a cosmetic DEBT note, not a
  missing-posting-path finding. Not carried forward as previously worded.
- **`transfer.service.ts:102,155` commented-out `validateBalanced` calls are harmless.**
  Stock transfer is not unbalanced — the real defect is N8 (wash pair on the same account).
- **`hr/payroll` showing 0 importers of `AccountTransactionService` is a false negative.**
  Payroll posts via `JournalEntryService.addEntry` at `payroll.service.ts:1454`.
- **"Tax engine confirmed strong" was half wrong.** `computeLineTaxes` is correct; the wiring
  was BOOKS-WRONG (N1). Never carry that line forward unqualified.

---

## Positively confirmed correct

- **Old-gold / making-charge split on invoices** — `invoice.transaction.ts` (`addGoodsBilling`,
  ~217-356). Correctly splits goods value across Inventory / Old-Gold / Making-Charge by
  code-resolved account, degrading to plain Inventory only when a target account is unseeded.
  **Caveat added this cycle: its own reversal does not mirror it — see N14.** Do not repeat
  "reference pattern for every other posting path" without that caveat.
- **Return delegation architecture** — `return.service.ts` → `invoice.return.ts` is a real,
  working, balanced reversal path (this cycle's finding, correcting N2).
- **Melting WIP/Wastage/Charges posting** — `melting.transaction.ts`, fail-closed via
  `requireAccount` (throws on unseeded chart, unlike `getAccountByCode`'s fail-open used in
  `invoice.transaction.ts`). Confirmed present at baseline sha too.
- **Trade-in-as-purchase sequencing** — `sales.service.ts` `checkout()` books the trade-in
  purchase invoice before settling the sale, so `fixPaymentAmount` reads the actually-booked
  total rather than a client-supplied figure that could legitimately differ.
- **Old-gold pricing precedence** — `resolveTradeInBuyRate`: supplied rate > published buy
  rate > hard error, never a silent zero. Buy rate only, never sell rate, for trade-ins.
- Not re-verified this cycle, carried from 2026-08-21: balance sheet ties
  (`CUMULATIVE_SECTIONS`), trial balance ties to the ledger, purity handling
  (`purity.util.ts`), scheme AML + rate-override authorisation.

---

## Fixed as of 2026-08-21 (not re-verified this cycle — carried forward as claims)

| # | Was | Fix |
|---|-----|-----|
| 2 | Period lock permitted any date with no fiscal period | Fails closed, `DateLockReason` enum |
| 3 | Shortcut could write a single-sided ledger row | Both accounts required, shared `relationId` |
| 5 | Job-order posted nothing when customer account unresolvable | Explicit throw |
| 8 | `validateBalanced` kill-switch reachable in production | Fail-closed `app_env` allowlist |
| 9 | 20 finance mutations with no `@AuditMeta` | 100% coverage on 14 finance resolvers |
| N1 | Line tax resolved on both legs | `resolveLineTaxSplit` + `stripLineTax` |
| N3 | Payment entries unbalanced outright with line tax | Carrier/counter split |
| N6 | Fiscal check gated on `documentDate != null` | `create` refuses undated transaction |
| N5 | Boot-time rewrite of every invoice payment | Hook removed, converted to migration |
| N9 | `AuditInterceptor` discarded `meta.action` | `meta.action ?? resolveAction(...)` |
| N10 | `accountBalanced()` string-equality on rounded values | `LEDGER_BALANCE_TOLERANCE` |

---

## Blockers to check before shipping (from 2026-08-21, not re-verified)

**#2 period lock.** Companies with no fiscal year configured have zero periods, every
posting path 403s on deploy. Run before release:

```js
db.companies.aggregate([
  { $lookup: { from: "fiscal_periods", localField: "_id", foreignField: "companyId", as: "p" } },
  { $match: { "p.0": { $exists: false }, deleted: { $ne: true } } },
  { $project: { name: 1, fiscalYearStartDate: 1 } }
])
```

**#3 shortcut.** Past one-sided executions left orphan `AccountTransaction` rows with no
`relationId` — still in the ledger, plausibly unbalancing the trial balance today.

**N1 tax wiring.** Historical taxed note/cashbook/contra entries need a backfill.

**N15 (new this cycle).** Verify `mongodb_transaction_enable=true` (exact spelling) is set
in every deployed environment, not just local `.env`, before trusting any multi-write
finance operation to roll back on partial failure.

## Known pre-existing spec failures — not regressions (2026-08-21, not re-verified)

- `finance/account/account.service.spec.ts › returns existing cash account found via regex`
- `finance/report/report.service.spec.ts › cashflowReport › reports cash at end of year…`
- `job-order/job-order.service.spec.ts › create › …NEW status`

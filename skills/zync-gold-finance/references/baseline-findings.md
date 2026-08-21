# Baseline findings — zyncg-server

**Repo** `/Users/sabiridwan/Projects/zyncgold/zyncg-server`
**Branch** `dev-v1` · **Last full audit** 2026-08-21 · **Scope** full (12 dimensions), twice —
an initial pass and an independent adversarial re-verification.

> A recurring run must **re-verify** each finding before repeating it, and report **deltas
> only**. Rewrite this file with the new sha and state at the end of every run.

## State of the tree at time of writing

Fixes for #2, #3, #5, #8, #9 are applied. Part landed in commit `24240fc` (a commit made by
a concurrent session, which also swept up unrelated work and captured `fiscal.service.ts`
mid-edit); the rest is uncommitted working tree. `tsc --noEmit` exits 0. Two pre-existing
spec failures are unrelated to any of this work and are listed at the bottom.

---

## Open findings

| # | Sev | Dim | Finding | Evidence |
|---|-----|-----|---------|----------|
| N1 | BOOKS-WRONG | 8, 1 | A line tax on a note/cashbook/contra entry posts **two offsetting tax legs** and grosses up **both** principal legs. Tax account nets to zero; the entry balances, so nothing fails | `transaction.service.ts:92,138-140,171-185`; `note.service.ts:672-688`; `cashbook.service.ts:252-258`; `contra.service.ts:152,172` |
| N2 | BOOKS-WRONG | 2 | `inventory/returns` posts **nothing** to the GL. `createReturnInvoice` is an exposed mutation; `AccountService` is an unused import. A correct parallel path exists at `invoice.return.ts:60-119` | `returns/return.service.ts`; `returns/return.resolver.ts:50` |
| 1 | BOOKS-WRONG | 2, 4 | Melting posts nothing to the GL — WIP, furnace loss and refining charges never reach the ledger | `inventory/melting/melting.service.ts`; `melting.constants.ts:194` |
| 4 | BOOKS-WRONG | 7 | Reports accept `branchId` and ignore it — every branch report is a group report | `report.interface.ts:107` vs 0 hits in `report.service.ts` |
| N3 | CONTROL-GAP | 8 | A line tax on a **payment** entry unbalances the entry outright — AR leg grossed up and given a tax leg, cash leg written straight to the repo | `payment.service.ts:243-259`, throws at `:196` |
| N4 | CONTROL-GAP | 9 | Knock-off can **over-apply** — guard compares to `invoice.totalAmount`, not the open balance; on the payment path it only `console.log`s | `payment.service.ts:450-455`; `note.service.ts:1057` |
| N12 | BOOKS-WRONG | 3, 12 | **Historical data corruption, cause removed, damage not recoverable.** The invoice-payment `onModuleInit` hook posted a payload of `{ invoiceId }` only; `AbstractBaseRepository._mapData` fills defaults from the *payload*, so **every application boot re-stamped every invoice payment's `documentDate` to the restart timestamp** and burned a fresh `documentNo`. Every deploy silently re-dated historical payments to deploy time, corrupting ageing, period close and every date-ranged payment report. The `catch` swallowed the `validateBalanced` failures that would have exposed it. Hook removed; migration `2026-08-21-invoice-payment-link-normalisation.ts` sizes the damage by counting legs where `documentDate > createdAt`, but **the original dates are not recoverable from that collection** — only a pre-deploy backup can restore them | `inventory/invoice/payment/payment.module.ts` (removed); `zync-nest-data-module/dist/database/database.repository.js:135-136` |
| N11 | CONTROL-GAP | 11 | **There is no true before-snapshot anywhere in the system.** `snapshotBefore` is assigned the *post*-mutation `resultObj` — the interceptor never fetches pre-state. Every "before" value in the audit log is actually an after value. Separately, snapshots are only populated for `CREATE`/`DELETE`, so disposal and depreciation capture nothing even with a correct action | `interceptors/audit.interceptor.ts:83-84` |
| N6 | CONTROL-GAP | 3 | Fiscal check is gated on `documentDate != null`, so contra/cashbook/note lines without a per-line date post into a locked period unchecked | `transaction.service.ts:84`; `contra.service.ts:152,172` |
| N9 | CONTROL-GAP | 11 | `AuditInterceptor` derives the action from the **method name** and discards `meta.action`. Since `snapshots` is tested against the resolved action, **no before/after snapshot is captured for asset disposal or depreciation** | `interceptors/audit.interceptor.ts:50,59` |
| 6 | CONTROL-GAP | 2 | Cash-drawer variance computed and authorised, never posted | `cash-drawer.dto.ts:79-95` |
| 7 | CONTROL-GAP | 3 | **Narrowed.** Only `contra` and `trade` have neither a lock guard nor a fiscal call. Resolver `lock=0` is fine where the service validates. The real gap is N6 | `contra.service.ts`, `trade.service.ts` |
| 10 | CONTROL-GAP | 11 | 54 maker/checker fields stored, no comparison enforcing approver ≠ submitter outside the scheme rate-override path | audit script §11.3 |
| 11 | CONTROL-GAP | 2 | 6 `AccountTransactionKind` values declared, never constructed: `JobOrderPayment`, `KnockoffEntry`, `OrderPayment`, `OrderPayment2`, `PurchaseReturnOrder`, `SalesReturnOrder`. The last two corroborate N2 | audit script §2.1 |
| N7 | BLIND-SPOT | 9, 12 | Aged reports age **invoices, not the AR ledger**; no as-at cutoff, no branch scope; `dueDate` is really `invoiceDate` falling back to `createdAt` | `report.service.ts:1832-1842,1876`; `report.constants.ts:8-16` |
| N8 | BLIND-SPOT | 7 | Inter-branch transfer posts Dr Inventory / Cr Inventory on the **same account** with no branch dimension — a GL no-op | `transfer/item/item.service.ts:58-60,196-215` |
| 12 | BLIND-SPOT | 5 | No metal ledger — the row has `purity`/`purityValue` but no weight, so no gram balance per party or branch | `transaction.schema.ts:118-124` |
| 13 | BLIND-SPOT | 6 | `Rate` has no effective-date field (uses `createdAt`), no branch scope, no rate type/source | `rate/rate.schema.ts` |
| 14 | BLIND-SPOT | 6 | No unfixed-metal position or revaluation in finance; the concept exists only on stock | audit script §6.4 |
| 15 | BLIND-SPOT | 12 | No metal position, metal account statement, margin decomposition, melt-yield, branch P&L, inter-branch reconciliation or scheme-liability ageing report | 13 reports exposed, none of these |
| 16 | BLIND-SPOT | 12 | No year-end close — retained earnings synthesised at report time, never posted | `report.service.ts:1002-1060` |
| 17 | DEBT | 1 | `validateBalanced` scans the whole company POSTED ledger on every write, from **65 production call sites** | `account.service.ts:634-640` |
| 18 | DEBT | 1 | **Downgraded.** `LEDGER_BALANCE_TOLERANCE = 0.005` now exists and is used at the ledger level. `journal.service.ts:84` (0.001) and `payroll.service.ts:1428` (0.01) still diverge | `finance.model.ts:20` |
| N10 | DEBT | 1 | `accountBalanced()` still uses `formatAmt(a) === formatAmt(b)`, two lines above the method already migrated to the tolerance constant | `account.service.ts:588` |
| 5 | DEBT | 2 | **Downgraded from BOOKS-WRONG.** The job-order `if (customerAccount)` skip was dead defensive code — `getUserAccount` auto-creates or throws, never returns null. Still worth the explicit throw, since a symmetric skip is invisible to `validateBalanced` | `job-order.service.ts:213` |
| 19 | DEBT | 5 | `amount2` declared on the ledger row, referenced nowhere | `transaction.schema.ts:120` |
| 20 | DEBT | 3 | `AccountTransactionStatus` carries overlapping vocabularies (`SAVED`/`DRAFT`, `POSTED`/`CONFIRMED`) on one field | `transaction.schema.ts` status enum |
| 21 | DEBT | 4 | Six gold accounts named in `ACCOUNT_NAME` and referenced by no posting path | `finance.model.ts:202-203,267-271` |

---

## Fixed this cycle

| # | Was | Fix |
|---|-----|-----|
| 2 | Period lock permitted any date with no fiscal period | Fails closed with a `DateLockReason` enum; distinct messages for locked-period vs no-period. **Also closed a latent cross-tenant read** — `toObjectId(undefined)` returned undefined, Mongoose stripped the key, and `findByDate` matched any company's period |
| 3 | Shortcut could write a single-sided ledger row | Both accounts required, shared `relationId`, DTO tightened with `@IsNotEmpty` |
| 5 | Job-order posted nothing when the customer account was unresolvable | Explicit throw; also fixed `documentDate` from `Date.now()` to the invoice's own date |
| 8 | `validateBalanced` kill-switch reachable in production, `console.log` on every call | Fail-**closed** `app_env` allowlist (unrecognised env keeps validation on), `logger.debug`, `LEDGER_BALANCE_TOLERANCE = 0.005` |
| 9 | 20 finance mutations with no `@AuditMeta` | 100% coverage on all 14 finance resolvers. Exposed N9 |
| N1 | Line tax resolved on **both** legs — two opposing tax legs netting the tax account to zero, both principal legs grossed up | `resolveLineTaxSplit` + `stripLineTax`: exactly one carrier leg holds the net base and the tax legs, the counter leg holds the line total. Applied to note (×2), cashbook, contra, payment. Invariant `carrier + additive == counter + deductive` holds inclusive and exclusive. 16 specs in `transaction/line-tax-split.spec.ts` |
| N3 | Payment entries unbalanced outright when a line tax was present | Same carrier/counter split; both legs now go through the service path |
| N6 | Fiscal check gated on `documentDate != null`, so undated lines skipped the locked-period check | Entry date resolved onto each line; `create` now **refuses** an undated transaction outright |
| N5 | Boot-time rewrite of every invoice payment | Hook removed, converted to a one-off migration that reports rather than swallows. See N12 for the damage it did |
| N9 | `AuditInterceptor` discarded `meta.action` | `meta.action ?? resolveAction(...)`. 21 mutations now log a corrected action; 4 decorators were corrected instead of honoured (posting flows declared `UPDATE`, which would have downgraded "who posted to the ledger" to a plain update) |
| N10 | `accountBalanced()` string-equality on rounded values | Migrated to `LEDGER_BALANCE_TOLERANCE` |

---

## Retractions — do not repeat these

- **`transfer.service.ts:102,155` commented-out `validateBalanced` calls are harmless.** Stock
  transfer is not unbalanced: `transfer/item/item.service.ts:58-60` posts both an OUT and an
  IN leg per item. The real defect is that both hit the same account (N8) — a wash pair, not
  an imbalance.
- **`hr/payroll` showing 0 importers of `AccountTransactionService` is a false negative.**
  Payroll posts via `JournalEntryService.addEntry` at `payroll.service.ts:1454`. The script's
  §2.2 signal only detects one of several posting mechanisms.
- **"Tax engine confirmed strong" was half wrong.** The pure function `computeLineTaxes`
  (`taxation.model.ts:27-54`) is correct, including deductive-on-ex-additive-base when both
  directions coexist. The **wiring** is BOOKS-WRONG (N1). Never carry that line forward
  unqualified.

---

## Positively confirmed correct

- **Balance sheet ties.** `CUMULATIVE_SECTIONS` (`report.service.ts:88-95`) forces all six BS
  sections to ignore `fromDate`, matching the forced-cumulative P&L at `:968`, so
  assets = liabilities + equity + cumulative earnings holds by construction.
- **Trial balance ties to the ledger** — a straight sum of per-account POSTED debits/credits
  (`report.service.ts:373-374`), subject to every posted `accountId` resolving under the
  current `parentCompanyId`.
- **Purity handling** — `inventory/shared/purity.util.ts`, per-mille throughout, no magnitude
  guessing, migration applied. Reference quality.
- **Old-gold / making-charge split on invoices** — `invoice.transaction.ts:255-330`. The
  reference pattern for every other posting path.
- **Scheme AML + rate-override authorisation** — gates before the write, structuring measured
  over a window, override cost recorded in grams given away.

---

## Blockers to check before shipping

**#2 period lock.** Companies with no fiscal year configured have zero periods, and every
posting path 403s on deploy. `fiscalYearStartDate`/`fiscalYearEndDate` are nullable
(`company.dto.ts:41,160`) and seeding is gated on both (`company.service.ts:137,225`).
Run before release:

```js
db.companies.aggregate([
  { $lookup: { from: "fiscal_periods", localField: "_id", foreignField: "companyId", as: "p" } },
  { $match: { "p.0": { $exists: false }, deleted: { $ne: true } } },
  { $project: { name: 1, fiscalYearStartDate: 1 } }
])
```

Related: fiscal-year rollover is manual — no cron calls `createNextFiscalYear`, so posting
hard-stops past the configured year end. And `validateTransactionDate` has **no bypass** at
its 20 service call sites; any path reaching them without `@GuardLockedPeriod()` above is
unconditionally blocked.

**#3 shortcut.** Non-nullable DTO fields regenerate `schema.gql` — breaking change for
zyncg-admin's `createTransactionShortcut`. Past one-sided executions left orphan
`AccountTransaction` rows with no `relationId`; those are still in the ledger and are
plausibly what unbalances the trial balance today. Reversal needs finance sign-off, not a
code migration.

**N1 tax wiring.** Historical taxed note/cashbook/contra entries need a backfill.

## Known pre-existing spec failures — not regressions

- `finance/account/account.service.spec.ts › returns existing cash account found via regex`
  — spec mocks `AccountCategoryService` as `{}`.
- `finance/report/report.service.spec.ts › cashflowReport › reports cash at end of year…`
- `job-order/job-order.service.spec.ts › create › …NEW status` — asserts `NEW` while
  `create` defaults to `IN_PROGRESS`. Someone must decide which is the intended truth.

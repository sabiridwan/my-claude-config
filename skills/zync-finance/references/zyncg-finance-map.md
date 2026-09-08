# zyncg-server — finance map

What exists and where, as at **2026-08-21, sha `e93b6ce`, branch `dev-v1`**.

> This records what was true when written. **Re-verify every line before relying on it.**
> Run `scripts/audit_finance.sh` and diff against this.

Repo: `/Users/sabiridwan/Projects/zyncgold/zyncg-server`

---

## Module inventory — `src/modules/finance/`

| Module | Role | Posting path | Notes |
|---|---|---|---|
| `account` | Chart of accounts, account resolution, ledger balance check | — | `validateBalanced()` at `account.service.ts:589` |
| `transaction` | The ledger row (`finance_account_transactions`), discriminated by `kind` | core | tax legs auto-created; fiscal check at `:85` |
| `journal` | General/bank/cash/purchase/sales/fixing journals | Dr/Cr set | only path enforcing entry-level balance (`journal.service.ts:84`) |
| `cashbook` | Cash receipts/payments | Dr/Cr | best-guarded module (lock + posted + audit) |
| `contra` | Account-to-account transfers | Dr/Cr | no fiscal validation in the service |
| `note` | Credit/debit notes | Dr/Cr | has `assertCashOutControls` — cash-out AML gate |
| `payment` | Payment/receipt entries, knock-off | Dr/Cr | |
| `trade` | Trade entries (PURCHASE/SALES) | via transactions | `trade.schema.ts` has **no weight/purity** — money only |
| `assets` | Fixed assets, depreciation, disposal | Dr/Cr | 12 mutations, **0** `@AuditMeta` |
| `taxation` | Tax masters + `computeLineTaxes` | — | additive/deductive, inclusive handling, multi-tax per line |
| `fiscal` | Fiscal periods, lock/close | — | company-scoped only |
| `category` | Account categories | — | hides Balancing/Suspense system categories |
| `shortcut` | One-click preset postings | Dr and/or Cr | **can write one-sided rows** (`shortcut.service.ts:49-63`) |
| `report` | 13 GraphQL report queries | — | `report.service.ts` (1,916 lines) |
| `guards` | `GuardLockedPeriod`, `GuardPostedEntry` | — | applied on 4 of 14 resolvers |

## Ledger row — `transaction.schema.ts`

- Collection `finance_account_transactions`, `discriminatorKey: "kind"`, 25 kinds.
- Money: `amount`, `exchangeRate`, `bankCharges`, `taxes[]`, `taxInclusive`.
- Metal: `purity` (per-mille), `purityValue` (= `amount × purity/1000`, a **value** split —
  there is no weight field on the ledger row).
- `amount2` declared at `:120`, referenced nowhere.
- Dimensions: `costCenterId`, `classId`, `analysisCodeId`, `departmentId`, `payeeId`,
  `invoiceId`, `relationId` (pairs the legs), `refId`/`ref2Id`.
- Status enum carries nine values including both `SAVED` and `DRAFT`, both `POSTED` and
  `CONFIRMED` — overlapping vocabularies on one field.

## Purity — solid, do not re-derive

`src/modules/inventory/shared/purity.util.ts` is the single authority. Per-mille only
(916, never 0.916 or 91.6), `normalizeInboundPurity` at the service boundary,
`toPurityFactor` returns 0 for off-scale input so bad data is visibly zero. Karat, silver
and platinum fineness tables live here. Migration
`src/migrations/2026-08-19-normalize-purity-to-per-mille.ts` normalised existing rows.

## Metal position — exists on stock, not on the ledger

`src/migrations/2026-08-19-gold-pricing-and-metal-position.ts` stamps fine weight onto
stock; `stock.schema.ts:97` comments the intent. **Nothing equivalent exists on
`finance_account_transactions`**, so metal position is a stock report, not a ledger
balance, and there is no per-party gram ledger.

## Old gold & making charge — well handled on the invoice path

`src/modules/inventory/invoice/invoice.transaction.ts:255-330` splits the goods value into
new-gold metal / old-gold metal / making charge across three accounts, with a documented
degradation rule when the chart is unseeded. `MELT_ACCOUNT_CODES` (`602-0003`, `500-1003`)
and `MAKING_CHARGE_ACCOUNT_CODES` are used here. This is the strongest gold-finance code in
the repo — treat it as the reference pattern for other paths.

## Melting — posts nothing

`src/modules/inventory/melting/` (652-line service) models lots, weighings, stones, purity
tests, approval and preparation, with a 0.05 g reconciliation tolerance
(`melting.constants.ts:183`). `MELT_ACCOUNT_CODES` names `WIP 150-1000`, `WASTAGE 609-0000`,
`CHARGES 610-0000` and says "Account codes the melting process posts to" — but
`melting.service.ts` imports no finance service and posts nothing.

## Scheme — the strongest control code in the repo

`src/modules/scheme/transaction/`:
- `assertCashDepositAllowed` — AML gate **before** the write (`scheme-transaction.service.ts:70`)
- `STRUCTURING_WINDOW_MS` — 24h cumulative structuring detection (`:27`)
- `rate-override.schema.ts` / `rate-override.service.ts` — approval trail with
  `marketRate`, `gramsGivenAway`, `canSelfApprove` thresholds
- posts a Dr/Cr pair via `super.create` on the transaction discriminator, so it does **not**
  import `AccountTransactionService` — the audit script's "0 importers" line for `scheme`
  is a known false positive.

## Cash drawer — computes variance, posts nothing

`src/modules/cash-drawer/` has `variance`, `varianceThresholdApplied`,
`varianceOverThreshold`, `varianceReason`, `varianceAuthorisedBy/At`
(`cash-drawer.dto.ts:79-95`) — a complete operational control that never reaches the GL.

## Old-gold AML reporting — exists, in inventory

`src/modules/inventory/report/performance/` carries `kycVerified`, `structuringSuspected`,
`unverifiedBreaches` and a structuring window (`performance.constants.ts:138`). It is a
report, not a gate: unlike the scheme path, it detects after the fact.

## Reports exposed (13)

`financeCashflowReport` · `financePNLReport` · `financePNLMonthlyReport` ·
`financeBalanceSheetReport` · `financeAccountsReport` · `financeAccountDetailedReport` ·
`financeTrialBalance` · `financeGlAccountReport` · `financeInternalReport` ·
`financeTaxReport` · `financeGeneralLedgerReport` · `financeAgedReceivableReport` ·
`financeAgedPayableReport`

All filter on `AccountTransactionStatus.POSTED`. None accepts an effective `branchId`.

## Related modules that touch the ledger

`inventory/invoice` (5 importers, richest path) · `inventory/purchase` (2) ·
`inventory/adjustment` · `inventory/transfer` · `job-order` · `membership` ·
`hr/advance` · `hr/payroll` (has its own balance check at `payroll.service.ts:1428`,
tolerance 0.01 — journal uses 0.001).

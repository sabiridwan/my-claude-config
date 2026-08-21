# Baseline findings — zyncg-server

**Repo** `/Users/sabiridwan/Projects/zyncgold/zyncg-server`
**Sha** `e93b6ce` · **Branch** `dev-v1` · **Date** 2026-08-21 · **Scope** full (12 dimensions)

> A recurring run must **re-verify** each finding before repeating it, and report **deltas
> only**. Rewrite this file with the new sha and state at the end of every run.

---

## Findings

| # | Sev | Dim | Finding | Evidence |
|---|-----|-----|---------|----------|
| 1 | BOOKS-WRONG | 2, 4 | Melting posts nothing to the GL — WIP, furnace loss and refining charges never reach the ledger | `inventory/melting/melting.service.ts` (652 lines, no finance import); `melting.constants.ts:194` |
| 2 | BOOKS-WRONG | 3 | Period lock has a hole: a date with **no** fiscal period returns `locked: false` | `finance/fiscal/fiscal.service.ts:159-164` |
| 3 | BOOKS-WRONG | 1 | Shortcut postings can write a **single-sided** ledger row | `finance/shortcut/shortcut.service.ts:42-63` |
| 4 | BOOKS-WRONG | 7 | Reports accept `branchId` and ignore it — every branch report is a group report | `report.interface.ts:107` vs 0 hits in `report.service.ts` |
| 5 | BOOKS-WRONG | 2 | Job-order invoice posts **no journal at all** when the customer account cannot be resolved | `job-order/job-order.service.ts:213` |
| 6 | CONTROL-GAP | 2 | Cash-drawer variance is computed and authorised but never posted | `cash-drawer/cash-drawer.dto.ts:79-95`; no finance import |
| 7 | CONTROL-GAP | 3 | 6 finance resolvers carry dated mutations with no `GuardLockedPeriod`; `contra` and `trade` services have no fiscal check either | resolver table; `contra.service.ts`, `trade.service.ts` |
| 8 | CONTROL-GAP | 1 | `validateBalanced` has a production-reachable env kill-switch, and logs to `console.log` on every call | `account.service.ts:595-600`, `:612` |
| 9 | CONTROL-GAP | 11 | `assets` 12 mutations / 0 `@AuditMeta`; `trade` 3/0; `account` 6/2; `shortcut` 4/3 | resolver table |
| 10 | CONTROL-GAP | 11 | 54 maker/checker fields stored, **no** comparison enforcing approver ≠ submitter outside the scheme rate-override path | script §11.3 |
| 11 | CONTROL-GAP | 2 | 6 `AccountTransactionKind` values are declared but never constructed: `JobOrderPayment`, `KnockoffEntry`, `OrderPayment`, `OrderPayment2`, `PurchaseReturnOrder`, `SalesReturnOrder` | script §2.1 |
| 12 | BLIND-SPOT | 5 | No metal ledger: the ledger row has `purity`/`purityValue` but no weight, so no gram balance per customer/supplier/karigar/branch | `transaction.schema.ts:118-124` |
| 13 | BLIND-SPOT | 6 | `Rate` has no effective-date field (uses `createdAt`), no branch scope, no rate-type/source | `rate/rate.schema.ts` |
| 14 | BLIND-SPOT | 6 | No unfixed-metal position or revaluation anywhere in finance; the concept exists only on stock | script §6.4 |
| 15 | BLIND-SPOT | 12 | No metal position, metal account statement, margin decomposition, melt-yield, branch P&L, inter-branch reconciliation or scheme-liability ageing report | 13 reports exposed, none of these |
| 16 | BLIND-SPOT | 12 | No year-end close: retained earnings is synthesised at report time, never posted | `report.service.ts:1002-1060` |
| 17 | DEBT | 1 | `validateBalanced` scans the whole company POSTED ledger on **every** write across ~60 call sites | `account.service.ts:602-608` |
| 18 | DEBT | 1 | Balance tolerance differs by module: journal `0.001`, payroll `0.01`, invoice return untoleranced | `journal.service.ts:84`; `payroll.service.ts:1428` |
| 19 | DEBT | 5 | `amount2` declared on the ledger row, referenced nowhere | `transaction.schema.ts:120` |
| 20 | DEBT | 3 | `AccountTransactionStatus` carries overlapping vocabularies (`SAVED`/`DRAFT`, `POSTED`/`CONFIRMED`) on one field | `transaction.schema.ts` status enum |
| 21 | DEBT | 4 | `GOLD_IN_MELTING`, `GOLD_MELTING_WASTAGE`, `GOLD_MELTING_CHARGES`, `WORK_IN_PROGRESS`, `PURCHASE_OLD_GOLD_JEWELLERY`, `SALES_OLD_GOLD_JEWELLERY` are named in `ACCOUNT_NAME` but referenced by no posting path | `finance.model.ts:202-203, 267-271` |

---

## Detail on the five BOOKS-WRONG findings

### 1 — Melting posts nothing

**Shop floor:** a 3 kg old-gold lot is issued to the furnace, comes back 2.94 kg fine, and
the balance sheet never moves. The 60 g that did not survive is not an expense, not a
variance, not anything — inventory simply stays at its pre-melt value until someone
notices. Furnace loss is the primary theft signal in a jewellery business and it is
currently invisible to the accounts.

**Treatment:** three postings per lot — issue to `150-1000` Gold in Melting; return
splitting recovered value to inventory and the shortfall to `609-0000` Wastage; refining
fees to `610-0000` Charges. Loss posts **per lot**, against the per-method tolerance band,
never as a period plug. See `gold-finance-domain.md` §4.

**Cost:** M. New posting service in the melting module, no migration; historical lots would
need a backfill decision.

### 2 — Period lock hole on undated periods

**Shop floor:** the prior fiscal year's periods were never seeded, so any user can post
into last year — into a period that has been reported and filed — and no guard fires.
`isDateLocked` returns `locked: false` with the message "No fiscal period found for this
date", and every caller reads only the boolean.

**Treatment:** an absent period must **reject**, not permit. Add an explicit
`allowUnseededPeriods` company setting if the current behaviour is deliberate for
onboarding, and make it a one-way switch that is off by default.

**Cost:** S. One method, plus a check that no seeding flow depends on the permissive path.

### 3 — Single-sided shortcut postings

**Shop floor:** a shortcut configured with only a `toAccountId` writes one credit row with
no debit. The trial balance stops balancing, and because `validateBalanced` runs on other
writes, the *next* unrelated save is the one that fails — with an error naming the wrong
document.

**Evidence:** `shortcut.service.ts:42` rejects only when **both** accounts are missing;
`:49` and `:57` are independent `if`s.

**Treatment:** require both accounts, or resolve the missing side to a named suspense
account that a report surfaces. Never a silent single leg.

**Cost:** S.

### 4 — Branch filter accepted and ignored

**Shop floor:** a branch manager opens their P&L, sees group numbers, and manages against
them. `report.interface.ts:107` declares `branchId`; `report.service.ts` never reads it.
This is worse than having no branch reporting — the user believes the filter worked.

**Treatment:** thread branch scope through the report aggregations (transactions carry
branch via `account.branchId` at `transaction.repository.ts:496`, so a join path exists),
or remove the field. Ignoring it is not an option.

**Cost:** M. Touches 13 report queries.

### 5 — Job-order invoice silently unposted

**Shop floor:** a job order is invoiced, the customer has no ledger account, and the whole
invoice posts nothing. Revenue and receivable both vanish. The `if (customerAccount)` at
`job-order.service.ts:213` wraps both legs, so the failure is symmetric and
`validateBalanced` never catches it.

**Treatment:** an unresolvable customer account throws. Account creation on demand already
exists (`account.service.ts:626` `getUserAccount`), so this is a missing throw, not missing
capability.

**Cost:** S.

---

## Confirmed strong — do not "fix"

- **Purity handling** — `inventory/shared/purity.util.ts`, per-mille everywhere, no
  magnitude guessing, migration applied. Best-in-class; treat as the reference.
- **Old-gold / making-charge split on invoices** — `invoice.transaction.ts:255-330`.
  Reference pattern for every other posting path.
- **Scheme AML + rate-override authorisation** — gates run before the write, structuring
  measured over a window, override cost recorded in grams given away.
- **Tax engine** — `taxation.model.ts` `computeLineTaxes`: line-level, multi-tax,
  additive/deductive, correct inclusive base derivation.
- **Journal balance enforcement** — `journal.service.ts:84`, with a documented tolerance.

---

## Suggested remediation order

1. #3 shortcut single-leg (S, BOOKS-WRONG)
2. #5 job-order silent skip (S, BOOKS-WRONG)
3. #2 period-lock hole (S, BOOKS-WRONG)
4. #8 balance kill-switch + `console.log` (S, CONTROL-GAP)
5. #9 missing `@AuditMeta` on assets/trade/account/shortcut (S, CONTROL-GAP)
6. #1 melting GL postings (M, BOOKS-WRONG)
7. #4 branch scoping in reports (M, BOOKS-WRONG)
8. #6 cash-drawer variance posting (M, CONTROL-GAP)
9. #12 + #13 + #14 metal ledger, rate effective-dating, unfixed position (L, the platform work)
10. #15 the missing gold reports, which #12–#14 unlock

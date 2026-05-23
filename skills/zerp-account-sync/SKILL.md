---
name: zerp-account-sync
description: Use when implementing, replicating, or syncing the Finance/Accounts module from zerp (zyncount-be) into another NestJS project. Triggers when user asks to "add finance module", "add accounts module", "copy finance from zerp", "sync accounts module", or implement any finance sub-module (account, journal, transaction, payment, cashbook, note, trade, contra, category, taxation, shortcut, report, P&L, balance sheet, trial balance, aged receivable, aged payable).
---

# Zerp Finance/Accounts Module — Replication & Sync Skill

## Core Principle

**Always read live source code from zerp. Never rely on memory summaries for business logic.**

Source of truth: `/Users/sabiridwan/Projects/zyncount/zyncount-be/src/modules/finance/`

---

## Sub-modules Reference

| Sub-module | Source path |
|---|---|
| Account + Category | `finance/account/` |
| Journal | `finance/journal/` |
| Transaction | `finance/transaction/` |
| Payment | `finance/payment/` |
| Cashbook | `finance/cashbook/` |
| Note | `finance/note/` |
| Trade | `finance/trade/` |
| Contra | `finance/contra/` |
| Taxation | `finance/taxation/` |
| Shortcut | `finance/shortcut/` |
| Report | `finance/report/` |
| Root files | `finance/finance.module.ts`, `finance.service.ts`, `finance.resolver.ts`, `finance.dto.ts`, `finance.model.ts` |

---

## Process — Full Finance Module (all 12 sub-modules)

### Step 1 — Read root files first

Read these before anything else — they define the enums and base classes everything else depends on:

1. `finance/finance.model.ts` — `AccountType`, `ReportSection`, `ACCOUNT_TYPES[]`, `ACCOUNT_GROUPS`, `ACCOUNT_NAME`, `CashFlowCategory`
2. `finance/finance.module.ts` — full imports list + forwardRef wiring
3. `finance/finance.resolver.ts` — base resolver mixin (canPost, canUpdate, canDelete, account resolveField)
4. `finance/finance.dto.ts` — FinanceEntryDto base type
5. `finance/finance.service.ts` — root orchestration service

Also identify which external modules are referenced (Master for currency/tax types, User for payee accounts, FiscalPeriod for date validation, Config for default accounts) and confirm they exist in the target project.

### Step 2 — Dispatch parallel agents per batch

**Batch A — Foundation (must complete first)**
- Account (all files: schema, dto, service, resolver, repository, interface, cache, migration, controller)
- Category (within account folder)

**Batch B — Core Ledger (run after A)**
- Transaction (schema, dto, service, resolver, repository, interface, logs)
- Journal (schema, dto, service, resolver, repository, interface, index.service, controller)

**Batch C — Entry Types (parallel with B after A)**
- Payment (schema, dto, service, resolver, repository, interface)
- Cashbook (schema, dto, service, resolver, repository, interface)
- Note (schema, dto, service, resolver, repository, interface)
- Trade (schema, dto, service, resolver, repository, interface)
- Contra (schema, dto, service, resolver, repository, interface)

**Batch D — Config & Templates (parallel)**
- Taxation (schema, dto, service, resolver, repository, interface)
- Shortcut (schema, dto, service, resolver, repository, interface)

**Batch E — Reports (after all above)**
- Report (service, resolver, dto, interface, aged.utils, constants, controller)

### Step 3 — Agent instructions for each batch

Each agent must:
1. Read ALL source files for its assigned sub-modules from the zerp source path
2. Read every `.service.ts` completely — especially balance calculation, posting logic, import flows
3. Write files to target project's `src/modules/finance/<sub-module>/` path
4. Keep business logic byte-for-byte identical
5. Only change: import paths, auth decorator names if different
6. Report which files were written

### Step 4 — Wire finance.module.ts

After all batches complete, copy `finance.module.ts`, update all import paths, keep all `forwardRef()` wrappers intact, and register `FinanceModule` in the target `AppModule`.

---

## Process — Partial (specific sub-modules)

When user requests specific sub-modules, resolve dependencies first:

| Requested | Must also include |
|---|---|
| Journal | Account, Transaction |
| Payment | Account, Transaction |
| Cashbook | Account, Transaction |
| Note | Account, Transaction |
| Trade | Account, Transaction |
| Contra | Account, Transaction |
| Report | Account, Transaction, Category |
| Any entry type | Account (always) |

---

## Per-sub-module file checklist

For every sub-module, read ALL of these from zerp source:

```
<sub-module>.schema.ts      ← Mongoose schema + enums
<sub-module>.dto.ts         ← GraphQL DTOs + InputTypes
<sub-module>.repository.ts  ← All data access / query logic
<sub-module>.service.ts     ← ALL BUSINESS LOGIC — read completely, never skim
<sub-module>.resolver.ts    ← GraphQL operations + auth decorators
<sub-module>.module.ts      ← Module wiring + forwardRef declarations
<sub-module>.interface.ts   ← TypeScript contracts (if present)
```

For account also read: `account.cache.ts`, `account.migration.ts`, `account.controller.ts`
For journal also read: `journal.index.service.ts`, `journal.controller.ts`
For report also read: `report.aged.utils.ts`, `report.constants.ts`, `report.controller.ts`

---

## Critical business logic — DO NOT simplify or rewrite

### account.service.ts
- `balanceWithDrAnCr()` — opening balance + period balance using ACCOUNT_TYPES debit/credit matrix
- `balanceWithDrAnCrPosted()` — same but POSTED transactions only
- `importAccount()` + `confirmImportAccount()` — preview-then-confirm with AAD/AAA shadow account creation
- AAD account auto-creation on new account — critical for asset depreciation

### journal.service.ts
- `validateEntry()` — sum(debits) == sum(credits) with 0.001 tolerance
- `addEntry()` — creates JournalEntry + all child AccountTransaction in one operation, validates fiscal period
- `postJournalEntry()` — unidirectional SAVED→POSTED, no revert

### transaction.service.ts
- `createTaxEntries()` — inclusive/withholding/normal modes, reversed debit/credit for withholding, links via relationId
- `totalDrAnCr()` — aggregation pipeline for balance summaries

### payment.service.ts
- `distributePayments()` — greedy allocation across invoices with invoiceId references per transaction

### report.service.ts
- P&L: PNL_* section grouping + account type rules → net profit
- Balance Sheet: BS_* section grouping + Assets = Liabilities + Equity validation
- Trial Balance: per-account period balance + balanced check
- Aged AR/AP: 0-30, 31-60, 61-90, 90+ day buckets by payee
- Tax Report: TaxEntry kind filter + taxation grouping

---

## What to adapt vs copy exactly

| Adapt | Copy exactly |
|---|---|
| Import paths | All service method implementations |
| Auth decorator names (if target differs) | All enum values (AccountType, ReportSection, Kind, Status) |
| Module registration in AppModule | All schema field names |
| | ACCOUNT_TYPES debit/credit matrix |
| | ACCOUNT_NAME constants |
| | All forwardRef() wiring in module |
| | All report aggregation pipelines |

---

## Common mistakes to avoid

| Mistake | Correct approach |
|---|---|
| Removing forwardRef() wrappers | Keep all — Account/Transaction/Journal are mutually circular |
| Simplifying balance calculation | Copy balanceWithDrAnCr exactly — ACCOUNT_TYPES matrix is non-trivial |
| Skipping base FinanceResolver | All entry resolvers must extend it for canPost/canUpdate/canDelete |
| Hardcoding company/branch IDs | Always `contextSvc.companyId` / `contextSvc.branchId` |
| Skipping TaxEntry creation | createTaxEntries must be called from all applicable entry services |
| Rewriting report aggregations | Copy report.constants.ts pipelines exactly |
| Skipping AAD account creation | account.service confirmImport must auto-create shadow accounts |

---

## Sync Workflow (updating an existing port)

1. Read the changed file(s) from zerp finance source
2. Read the corresponding file(s) in the target project
3. Apply only the changed logic — do not re-copy unchanged sections
4. Pay special attention to enum additions (new JournalEntryTypes, new Kind values)
5. Run the target project's build after sync to catch import path issues

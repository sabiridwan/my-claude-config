---
name: finance-module-zerp
description: Complete technical reference for the Finance/Accounts module in zerp (zyncount-be). Use when building, replicating, or updating the finance module in any Zyncount-family project.
metadata:
  type: reference
---

# Finance Module — Zerp (zyncount-be) Reference

**Source repo:** `/Users/sabiridwan/Projects/zyncount/zyncount-be/src/modules/finance/`
**Stack:** NestJS 9, Apollo GraphQL code-first, MongoDB/Mongoose 6, `zync-nest-data-module`
**Last audited:** 2026-05-17

> To replicate this module in another project use the `zerp-account-sync` skill — it reads live source files.

---

## Sub-modules (12 total)

| Sub-module | Folder | Purpose |
|---|---|---|
| Account | `account/` | GL account master; balances, hierarchy, category, AAD/AAA accounts |
| Journal | `journal/` | Double-entry journal entries; validates debit=credit; SAVED/POSTED lifecycle |
| Transaction | `transaction/` | Individual ledger lines; links to all entry types via `kind` discriminator |
| Payment | `payment/` | Payments allocated against invoices; AR/AP reconciliation |
| Cashbook | `cashbook/` | Cash/bank receipts and payments |
| Note | `note/` | Debit/credit notes for adjustments and returns |
| Trade | `trade/` | Purchase/sales trade entries at GL level |
| Contra | `contra/` | Contra/offset entries between accounts |
| Category | `category/` | Account category tree; maps to Balance Sheet / P&L report sections |
| Taxation | `taxation/` | Tax rates, GL account mappings, withholding flags |
| Shortcut | `shortcut/` | Transaction templates for recurring entries |
| Report | `report/` | P&L, Balance Sheet, Trial Balance, GL, Aged AR/AP, Tax reports |

---

## Module composition (finance.module.ts)

All 12 sub-modules imported and re-exported. Uses `forwardRef()` extensively due to circular deps between Account ↔ Transaction ↔ Journal.
Root `FinanceService` exported for consumption by HR (payroll journal posting), Inventory, Manufacturing.

---

## Root-level files

### finance.model.ts — enums and constants (critical)

**AccountType:** `ASSET | LIABILITY | EQUITY | INCOME | EXPENSE | INVENTORY | NONE`

**ACCOUNT_TYPES[]** — debit/credit behaviour matrix:
```
ASSET:     debit=INCREASE, credit=DECREASE
LIABILITY: debit=DECREASE, credit=INCREASE
EQUITY:    debit=DECREASE, credit=INCREASE
INCOME:    debit=DECREASE, credit=INCREASE
EXPENSE:   debit=INCREASE, credit=DECREASE
INVENTORY: debit=INCREASE, credit=DECREASE
```

**ReportSection** — maps accounts to financial statements:
- Balance Sheet: `BS_CURRENT_ASSET`, `BS_FIXED_ASSET`, `BS_CURRENT_LIABILITY`, `BS_NON_CURRENT_LIABILITY`, `BS_EQUITY`
- P&L: `PNL_REVENUE`, `PNL_SALES_ADJUSTMENTS`, `PNL_OTHER_INCOME`, `PNL_COST_OF_SALES`, `PNL_OPERATING_EXPENSE`, `PNL_INTEREST_EXPENSE`, `PNL_TAX_EXPENSE`
- Special: `BANK_AND_CASH`, `NONE`

**CashFlowCategory:** `INVESTING | FINANCING | OPERATING | UNCLASSIFIED`

**ACCOUNT_NAME** — standard COA constants (bank, AR, AP, inventory, retained earnings, salaries, depreciation, etc.)

**ACCOUNT_GROUPS** — `ASSETS | LIABILITIES | EQUITY | REVENUE | EXPENSES | INVENTORY | FIXED_ASSETS | PETTY_CASH | DISCOUNTS | DEBTORS | CREDITORS | INTEREST | TAX | STAFF | GAINS_AND_LOSSES`

### finance.resolver.ts — base resolver mixin

All finance entry resolvers extend this. Provides:
- `canPost(entry)` — true if status !== POSTED
- `canDelete(entry)` — true if admin OR not posted
- `canUpdate(entry)` — true if admin OR not posted
- `account(entry)` — resolves accountId → Account

### finance.service.ts

- `validateSalesAccount()` — checks config for default cash/bank accounts
- `validateAndGetPaymentAccount()` — returns default payment accounts for sales

---

## Key enums

**AccountTransactionKind:** `OrderPayment | OrderPayment2 | SalesInvoice | PurchaseInvoice | CashBookEntry | StockAdjustment | StockTransfer | NoteEntry | PaymentEntry | JournalEntry | AssetEntry | ContraEntry | TradeEntry | KnockoffEntry | SalesReturnOrder | PurchaseReturnOrder | TaxEntry`

**AccountTransactionTypes:** `DEBIT | CREDIT | OPENING`

**AccountTransactionStatus:** `SAVED | POSTED`

**JournalEntryTypes:** `BANK | CASH | GENERAL | PURCHASE | SALES | ORDER_FIXING | ASSET_DISPOSAL | ASSET_DEPRECIATION | ORDER_RETURN | MFG_WIP | MFG_COMPLETION | MFG_VARIANCE | MFG_SCRAP`

**CashBookEntryTypes:** `PAYMENT | RECEIPT`

**NoteEntryTypes:** `CREDIT | DEBIT`

**TradeEntryTypes:** `PURCHASE | SALES`

**PaymentEntryKindTypes:** `PurchaseInvoice | SalesInvoice`

---

## Key schema fields

### Account
```
ref, accountName, accountNumber, categoryId, currencyId, userId, parentId(self-ref),
isAad, isContra, isNonCash, groups[], balance(cached)
```

### JournalEntry
```
ref, type(JournalEntryTypes), currencyId, documentDate, valueDate, description,
totalDebit, totalCredit, status(SAVED|POSTED), transactions[]
```

### AccountTransaction (core ledger)
```
accountId(req), refId(source entry), ref2Id, relationId(paired tx),
amount, type(DEBIT|CREDIT|OPENING), kind(AccountTransactionKind),
status(SAVED|POSTED), documentDate, valueDate, taxId,
costCenterId, classId, analysisCodeId, departmentId,
purity, purityValue, exchangeRate, payeeId, invoiceId
```

### AccountCategory
```
name, type(AccountType), parentId(self-ref hierarchy),
reportSection(ReportSection), canView, canUpdate, canDelete,
isContra, isAccount, isNonCash, balance(aggregated)
```

### Taxation
```
ref, name, typeId, accountId(GL for tax), percentage
```

### TransactionShortcut
```
name, fromAccountId, fromTransactionType, toAccountId, toTransactionType,
transactionKind, cashbookType, remark
```

---

## Key relationships

```
Account → AccountCategory (type/hierarchy)
Account → Master (currency)
Account → User (for AR/AP payee accounts)
Account → Account (parentId, COA hierarchy)

JournalEntry → AccountTransaction[] (refId = JournalEntry._id)

AccountTransaction (central ledger line)
  → Account (accountId)
  → Any entry type (refId via kind discriminator)
  → AccountTransaction (relationId, paired entries)
  → Taxation (taxId)
  → User (payeeId)
  → Order/Invoice (invoiceId)

CashBookEntry / NoteEntry / TradeEntry / ContraEntry / PaymentEntry
  → All generate AccountTransaction records with matching kind
  → All follow SAVED → POSTED lifecycle

Report → reads Account + AccountTransaction
       → filtered by AccountCategory.reportSection
```

---

## Critical business logic (must copy exactly)

### account.service.ts — balanceWithDrAnCr()
1. Queries debits/credits from opening date to (fromDate - 1ms) → opening balance
2. Queries debits/credits for current period → period change
3. Applies ACCOUNT_TYPES matrix to determine +/- direction
4. Returns: opening, current, closing balances

### account.service.ts — import + confirmImport
Preview-then-confirm pattern: validate without committing, then bulk create. Auto-creates AAD/AAA shadow accounts for asset entries.

### journal.service.ts — addEntry() + validateEntry()
- Validates sum(debits) == sum(credits) with 0.001 tolerance
- Creates JournalEntry + all child AccountTransaction records in one operation
- Validates fiscal period before accepting

### journal.service.ts — postJournalEntry()
- Sets all AccountTransaction.status = POSTED
- Sets JournalEntry.status = POSTED
- Unidirectional — cannot revert

### transaction.service.ts — createTaxEntries()
- Reads Tax record, resolves GL account
- Handles inclusive/withholding/normal tax modes (reverses debit/credit for withholding)
- Creates separate TaxEntry AccountTransaction linked via relationId

### payment.service.ts — distributePayments()
- Greedy allocation across invoices
- Creates per-invoice AccountTransaction with invoiceId reference
- Tracks excess payment

### report.service.ts
- **P&L**: Groups by PNL_* reportSection, applies account type rules, computes net profit
- **Balance Sheet**: Groups by BS_* reportSection, validates Assets = Liabilities + Equity
- **Trial Balance**: Per-account period balance; validates sum(debits) = sum(credits)
- **Aged AR/AP**: Buckets invoices into 0-30, 31-60, 61-90, 90+ days by payee
- **Tax Report**: Filters TaxEntry kind transactions, groups by taxation

---

## Patterns

1. **SAVED → POSTED lifecycle** — all entry types; SAVED = editable, POSTED = read-only
2. **Kind discriminator** — AccountTransactionKind tells what generated a transaction
3. **Preview-then-confirm imports** — all bulk imports have two-step pattern
4. **forwardRef() everywhere** — Account ↔ Transaction ↔ Journal are mutually dependent
5. **base FinanceResolver** — all entry resolvers extend it for canPost/canUpdate/canDelete/account
6. **Dimensions on transactions** — costCenter, class, analysisCode, department for reporting drill-down
7. **Purity fields** — precious metals tracking (purity %, purityValue)
8. **Balance caching** — account.cache.ts reduces repeated aggregation hits
9. **Multi-currency** — exchangeRate on every transaction
10. **Fiscal period gate** — FiscalPeriodService blocks stale-dated entries

---

## GraphQL operations summary

### Account: `findAccounts`, `findOneAccount`, `bankAccountPage`, `bankAccountsSummary`, `bankAccountCategorySummary`, `findAccountCategories`, `findOneAccountCategory`, `bankAccountCategoryNodes` | `createAccount`, `updateAccount`, `deleteAccount`, `deleteManyAccounts`, `importAccount`, `confirmImportAccount`, `createAccountCategory`, `updateAccountCategory`, `deleteAccountCategory`

### Journal: `findOneJournalEntry`, `journalEntryPage`, `journalEntrySummary` | `createJournalEntry`, `updateJournalEntry`, `deleteJournalEntry`, `deleteManyJournalEntry`, `postJournalEntry`, `postManyJournalEntry`, `saveManyJournalEntry`, `importJournal`, `confirmJournalImport`

### Transaction: `findAccountTransactions`, `findOneAccountTransaction`, `bankAccountTransactionPage` | `updateAccountTransaction`, `deleteAccountTransaction`, `postAccountTransaction`, `importAccountTransaction`, `confirmImportAccountTransaction`

### Payment: `findOnePaymentEntry`, `paymentEntryPage` | `createPaymentEntry`, `updatePaymentEntry`, `deletePaymentEntry`, `deleteManyPaymentEntry`, `postPaymentEntry`, `postManyPaymentEntry`, `saveManyPaymentEntry`

### Cashbook: `findOneCashBookEntry`, `cashBookEntryPage`, `cashbookEntrySummary` | `createCashBookEntry`, `updateCashBookEntry`, `deleteCashBookEntry`, `deleteManyCashbookEntry`, `postCashbookEntry`, `postManyCashbookEntry`, `saveManyCashbookEntry`, `importCashbook`, `confirmCashbookImport`

### Note: `findOneNoteEntry`, `noteEntryPage`, `noteEntrySummary` | `createNoteEntry`, `updateNoteEntry`, `deleteNoteEntry`, `deleteManyNoteEntry`, `postNoteEntry`, `postManyNoteEntry`, `saveManyNoteEntry`, `importNote`, `confirmNoteImport`

### Trade: `findOneTradeEntry`, `tradeEntryPage`, `tradeEntrySummary` | `createTradeEntry`, `updateTradeEntry`, `deleteTradeEntry`

### Contra: `findOneContraEntry`, `contraEntryPage`, `contraEntrySummary` | `createContraEntry`, `updateContraEntry`, `deleteContraEntry`

### Taxation: `findOneTaxation`, `taxationPage` | `createTaxation`, `updateTaxation`, `deleteTaxation`

### Shortcut: `findOneTransactionShortcut`, `transactionShortcutPage` | `createTransactionShortcut`, `updateTransactionShortcut`, `deleteTransactionShortcut`, `submitShortcutTransaction`

### Report: `financeCashflowReport`, `financePNLReport`, `financeBalanceSheetReport`, `financeAccountsReport`, `financeAccountDetailedReport`, `financeTrialBalance`, `financeGlAccountReport`, `financeTaxReport`, `financeGeneralLedgerReport`, `financeAgedReceivableReport`, `financeAgedPayableReport`

# zyncg-server / zyncg-admin map

What previous passes found. **Re-verify anything here before relying on it** — this records
what was true when written, and the tree moves. The `grep` commands in SKILL.md are the
check; this file just saves you the discovery.

Last verified: **August 2026**, branch `dev-v1`.

## Where old gold lives

| Concern | Location |
|---|---|
| Trade-in line detail | `src/modules/inventory/invoice/tradein/tradein-item.schema.ts` |
| Trade-in → purchase invoice | `sales.service.ts` → `createTradeInPurchaseInvoice()` |
| Purchase pieces | `src/modules/inventory/purchase/item/item.schema.ts` (`PurchaseInvoiceItem`) |
| Stock movements | `src/modules/inventory/stock/stock.schema.ts` |
| Melting | `src/modules/inventory/melting/` |
| Purity helpers | `src/modules/inventory/shared/purity.util.ts` |
| Item grades (incl. scrap) | `src/modules/inventory/item/type/type.constants.ts` |
| Chart of accounts | `src/modules/finance/finance.seed.ts` |
| Admin old gold UI | `zyncg-admin/src/modules/inventory/old-gold/` |

## Conventions that bite

**Purity is per-mille everywhere.** `shared/purity.util.ts` is the single karat table;
`toPurityFactor()` and `calculatePureWeight()` are the only sanctioned conversions. Anything
computing `netWeight × purity` without dividing by 1000 is wrong by 1000×.

**A piece exists before its stock row.** Stock is no longer created as a side effect of
adding a purchase item — it is raised explicitly (Create Stock UI → `createStock` /
`confirmPurchaseStocks`). Any report or guard driven off `stocks` will therefore miss
freshly-bought metal entirely. Drive off `PurchaseInvoiceItem`.

**`PurchaseInvoiceItem` is a discriminator** on the `invoice_items` collection. `.find()`
applies the discriminator filter automatically; **`.aggregate()` does not** — match
`kind: "PurchaseInvoiceItem"` explicitly or you will silently include sales items.

**Two `AbstractBaseRepository` classes exist.** The published one from
`zync-nest-data-module` and a local `src/base/abstract-base.repository.ts` that adds
`companyScope()`. Multi-tenant repositories must extend the **local** one.

**Scrap grades are matched on `"SCRAP"`, not a `_SCRAP` suffix** — one enum key is misspelled
(`GOLD_SEVEN_ZERO_EIGH_TSCRAP`) and must still be treated as scrap. Use
`isScrapItemTypeKey()`.

**Account-name lookups are first-match within a category.** `findOne({ category:
ACCOUNT_NAME.INVENTORY })` returns whichever account sorts first under Inventory, so adding
an account to an existing category can silently reroute unrelated postings. Give new
accounts their own category.

## Account codes

Seeded in `finance.seed.ts`:

| Code | Account |
|---|---|
| 150-1000 | Gold in Melting (WIP, under a Work In Progress category) |
| 500-1003 | Sales — Old Gold Jewellery |
| 601-0003 / 690-0003 | Opening / Closing Stock — Old Gold |
| 602-0003 | Purchase — Old Gold Jewellery |
| 609-0000 | Gold Melting Wastage |
| 610-0000 | Gold Melting Charges |

An account existing in the seed does **not** mean anything posts to it. 609/610 sat unused
for a long time — seeded accounts are a statement of intent by whoever designed the chart,
and matching that intent is better than inventing a parallel scheme.

## Not built yet

Refinery metal (gram) accounts · unfixed metal and fixing · melt lot issue/receive and its
accounting · yield and wastage analysis reporting · any melting UI in zyncg-admin.

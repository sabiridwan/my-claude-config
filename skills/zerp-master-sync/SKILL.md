---
name: zerp-master-sync
description: Use when implementing, replicating, or syncing the Master Data module from zerp (zerp-be) into another NestJS project. Triggers when user asks to "add master module", "copy master data from zerp", "sync master module", "add industry data", "add UOM", "add currencies", "add tax types", "add cost centers", or implement hierarchical lookup/reference data seeded at boot.
---

# Zerp Master Data Module — Replication & Sync Skill

## Core Principle

**Always read live source code from zerp-be. Never rely on memory summaries for business logic.**

Source of truth: `/Users/sabiridwan/Projects/zerp/zerp-be/src/modules/master/`

---

## Module Structure

The master module is a single-module design (no sub-folders). All files are at the root level:

| File | Purpose |
|---|---|
| `master.schema.ts` | Mongoose schema — hierarchical, parent-child, image support |
| `master.dto.ts` | GraphQL DTOs + InputTypes |
| `master.repository.ts` | Aggregation-based queries with $lookup for categories |
| `master.service.ts` | Business logic — normalization, duplicate key check, seeding |
| `master.resolver.ts` | GraphQL operations |
| `master.module.ts` | Module wiring |

---

## Process

### Step 1 — Read all master files

Read all 6 files completely before writing anything. Pay particular attention to:
- `master.service.ts` `seed()` method — the 11 top-level categories and their children must be copied verbatim
- `master.schema.ts` — the `MasterImage` sub-document and `parentId` field
- `master.repository.ts` — aggregation pipeline with `$lookup` for categories

### Step 2 — Identify external dependencies

The master module has minimal external deps:
- `AuthModule` (for `@ApGqlAuthorize()` on mutations)
- `ApUploadModule` (for image upload on master items)

Confirm these exist in the target project before writing.

### Step 3 — Write files to target project

Write all 6 files to `src/modules/master/` in the target project. Adapt import paths only.

### Step 4 — Wire into AppModule

Register `MasterModule` in the target `AppModule`. `onModuleInit` will auto-seed on first boot.

---

## Per-file checklist

```
master.schema.ts      ← Master + MasterImage schemas, parentId for hierarchy
master.dto.ts         ← Master ObjectType, MasterImage, all Input types, PageResult
master.repository.ts  ← buildQuery(), page(), aggregation with $lookup for categories
master.service.ts     ← normalization, dedup, seed() with 11 categories
master.resolver.ts    ← masterDetail, masterPage, createMaster, updateMaster, deleteMaster
master.module.ts      ← module wiring, MongooseModule.forFeature
```

---

## Critical Business Logic — DO NOT Simplify or Rewrite

### master.service.ts
- `create()` / `update()` — `name` is normalized to UPPERCASE, `key` to lowercase before save. Copy this normalization exactly.
- `create()` — checks for existing `key` uniqueness within company scope before insert.
- `companyId` — masters are global (not tenant-scoped): the service sets `companyId: undefined` on create. Do not add tenant scoping to the Master schema.
- `seed()` — called from `onModuleInit`. Seeds 11 top-level categories with their children using `insertMany`. Must be idempotent (checks `count()` before seeding). Copy the full category + children data verbatim — these keys are referenced by string from other modules (e.g. `'currency'`, `'uom'`, `'tax-type'`, `'industry'`, `'cost-center'`).

### master.repository.ts
- `buildQuery()` — supports `keyword` (regex on name), `parentId`, `categories` filter.
- Aggregation pipeline uses `$lookup` to populate category documents from master collection (self-join).
- `page()` uses `$facet` for totalRecords + data in one query.

---

## Schema Details

### Master
```
key: string (lowercase, unique within parent)
name: string (UPPERCASE)
parentId?: ObjectId  ← reference to another Master (for child items)
categories?: ObjectId[]  ← category tags from master collection
image?: MasterImage
companyId: undefined  ← global, not tenant-scoped
Soft delete via mongoose-delete
```

### MasterImage (sub-document)
```
uri: string
type: string
name?: string
_id?: string
```

---

## Seeded Data Categories

The `seed()` method inserts these 11 top-level categories (copy keys verbatim — other modules reference them by string):

| Key | Name | Examples of children |
|---|---|---|
| `industry` | INDUSTRY | Manufacturing, Retail, Services, ... |
| `currency` | CURRENCY | MYR, USD, SGD, ... |
| `uom` | UOM | KG, PCS, L, M, ... |
| `tax-type` | TAX TYPE | SST 6%, SST 10%, ... |
| `cost-center` | COST CENTER | Operations, Admin, HR, ... |
| `department` | DEPARTMENT | Finance, IT, Marketing, ... |
| `payment-method` | PAYMENT METHOD | Cash, Bank Transfer, Cheque, ... |
| `payment-term` | PAYMENT TERM | NET 30, NET 60, COD, ... |
| `bank` | BANK | Maybank, CIMB, RHB, ... |
| `product-category` | PRODUCT CATEGORY | Raw Material, Finished Goods, ... |
| `asset-category` | ASSET CATEGORY | Computer, Vehicle, Machinery, ... |

---

## GraphQL Operations

| Operation | Type | Purpose |
|---|---|---|
| `masterDetail(master: MasterQueryInput)` | Query | Fetch single master by `_id` or `key` |
| `masterPage(page: MasterPageInput)` | Query | Paginated list with keyword search |
| `createMaster(master: CreateMasterInput)` | Mutation | Create with auto-normalize |
| `updateMaster(id: String, master: UpdateMasterInput)` | Mutation | Update with auto-normalize |
| `deleteMaster(id: String)` | Mutation | Soft delete |

---

## DTO Shape

```ts
// Query filter
class MasterQueryInput {
  _id?: string;
  key?: string;
}

// Pagination
class MasterPageInput {
  skip: number;
  take: number;
  keyword?: string;
  sortBy?: string;
  sortOrder?: string;
  parentId?: string;
  categories?: string[];
}

// Create
class CreateMasterInput {
  name: string;
  key?: string;      // auto-derived from name if omitted
  parentId?: string;
  categories?: string[];
  file?: any;        // for image upload
}

// Update (all optional)
class UpdateMasterInput extends PartialType(CreateMasterInput) {}
```

---

## What to adapt vs copy exactly

| Adapt | Copy exactly |
|---|---|
| Import paths | Full seed data (keys referenced by string) |
| Auth decorator names (if target differs) | name normalization (UPPERCASE/lowercase) |
| Module registration in AppModule | Self-join aggregation pipeline in repository |
| | `companyId: undefined` on global masters |

---

## Common Mistakes to Avoid

| Mistake | Correct approach |
|---|---|
| Adding tenant scoping to masters | Masters are global — `companyId: undefined` intentionally |
| Generating key from name differently | key = name.toLowerCase().trim() — copy exact transform |
| Simplifying seed data | Copy verbatim — keys referenced by string from other modules |
| Skipping self-join $lookup | Category population requires aggregation, not populate() |
| Skipping `mongoose-delete` plugin | Schema needs soft-delete registered |
| Making seed non-idempotent | Seed must check count() before inserting |

---

## Sync Workflow (updating an existing port)

1. Read the changed file(s) from zerp-be master source
2. Read the corresponding file(s) in the target project
3. For seed data changes: only add new categories/children — do not remove existing ones
4. For schema changes: add fields to schema + dto; add migration if field is required
5. Run target project build after sync to catch import path issues

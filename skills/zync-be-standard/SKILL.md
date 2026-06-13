---
name: zync-be-standard
description: Use when creating, scaffolding, or extending a module in ANY ZyncGold zync-nestjs backend (zerp-be, zyncount-be, zyncg-server, msgld-be, and other NestJS + code-first GraphQL + Mongoose services), or when the user says "follow zerp be standard", "be standard", "zync be standard", "zbs", "add a module", or "new NestJS module" in this ecosystem. Generates a self-contained module mirroring the target project's canonical module (Resolver → Service → Repository → Schema), detecting that project's exact import paths and conventions first.
---

# Zync BE Standard (zbs)

## Overview

Every ZyncGold **zync-nestjs** backend (zerp-be, zyncount-be, zyncg-server, msgld-be, and any new API service) shares ONE canonical module shape. When asked to "follow be standard" / "zbs", generate a self-contained module that mirrors **that project's own canonical module**, file-for-file.

**The shape is universal; the import paths are per-project.** Some repos import base classes from the published lib `zync-nest-data-module`; others (like zerp-be) re-export them under local `src/*` aliases. **Never assume — detect (Step 0 below).**

**Layering is non-negotiable (all projects):**

```
Resolver → Service → Repository → Schema
```

- No business logic in resolvers (they delegate to the service).
- No raw Mongoose queries outside the repository.
- Repositories never import services (one-way dependency).
- Read tenant scope from `this.contextSvc.companyId` / `branchId` — never hardcode.

## When to Use

- "Create a `<feat>` module following be standard / zbs" — in any zync-nestjs backend
- Adding a new CRUD domain entity to a NestJS + GraphQL + Mongoose service in this ecosystem
- Extending an existing module (match its existing patterns)

When NOT to use: frontend (zync-nextjs), mobile (zync-expo), standalone Next.js (zync-nextjs-standalone), or control planes. This is backend-only.

## Step 0 — Match the target project FIRST (do this every time)

Before writing any file, open the target repo's canonical module and read its imports. Do not paste zerp's paths into another project.

1. **Find the canonical module.** Prefer `src/modules/branch/` if it exists; else any small CRUD module (`company`, `customer`, `supplier`). For brand-new projects, the canonical reference is `zyncg-server/src/modules/branch/`.
2. **Detect the base-class import source.** Grep the canonical module's `.service.ts` / `.repository.ts`:
   ```bash
   grep -rhE "AbstractBaseService|AbstractBaseRepository|BaseSchema|ApBaseResolver" src/modules/<canonical>/
   ```
   You'll see ONE of two conventions:
   - **Lib convention** — imports from `zync-nest-data-module` (and `zync-nest-library`). Used by zyncg-server and most services.
   - **Local-alias convention** — imports from `src/core`, `src/services`, `src/app.base`, `src/base.dto`. Used by zerp-be (see table below).
3. **Detect optional conventions** that vary per repo: `@ApSchema` vs plain `@Schema`; presence of `@AuditMeta` / `AuditAction`; `@ApGqlAuthorize` options; whether a `.controller.ts` exists; `index.ts` re-exports.
4. **Mirror what you find.** The worked example below is structurally correct for every project — only swap the import lines to match the convention you detected.

## Import Paths — the two conventions

**Lib convention (zyncg-server, default for most services):**

| Symbol | Import from |
|--------|-------------|
| `AbstractBaseService`, `AbstractBaseRepository`, `BaseSchema`, `TransactionManager` | `zync-nest-data-module` |
| `ApBaseResolver`, base utilities | `zync-nest-data-module` / `zync-nest-library` |
| pagination helpers (`handlePageFacet`, `handlePageResult`) | `zync-nest-data-module` |

**Local-alias convention (zerp-be / zyncount-be):**

| Symbol | Import from |
|--------|-------------|
| `AbstractBaseService` | `src/services` |
| `AbstractBaseRepository`, `TransactionManager`, `handlePageFacet`, `handlePageResult`, `IPageResult` | `src/core` |
| `BaseSchema`, `IPageParams`, `ApSchema` | `src/core/database` |
| `ApBaseResolver`, `ApBaseController` | `src/app.base` |
| `BaseDto`, `SortOrder` | `src/base.dto` |
| `ApGqlAuthorize`, `GqlCurrentUser` | `../auth` (relative to module) |
| `AuditMeta` | `src/decorators/audit-meta.decorator` |
| `AuditAction` | `src/modules/audit-trail/audit-trail.interface` |
| `SoftDelete` (mongoose-delete plugin), `SoftDeleteModel` | `mongoose-delete` |

> If grep shows a third variation, follow the canonical module — it always wins over this table.

## File Layout (per module)

```
src/modules/<feat>/
  <feat>.module.ts       ← wiring (imports, providers, exports)
  <feat>.resolver.ts     ← GraphQL resolver, extends ApBaseResolver<T>
  <feat>.service.ts      ← business logic, extends AbstractBaseService<T>
  <feat>.repository.ts   ← data access, extends AbstractBaseRepository<Doc>
  <feat>.schema.ts       ← Mongoose schema (@ApSchema) + Query/PageParams types
  <feat>.dto.ts          ← GraphQL ObjectType + Input types
  <feat>.controller.ts   ← REST (optional; only for downloads/exports)
  index.ts               ← re-exports for decorators/guards (optional)
```

## Base-Class Cheat Sheet (already provided — do NOT re-implement)

`AbstractBaseService<T>` gives you: `create`, `createMany`, `update`, `updateMany`, `findById`, `findOne`, `find`, `findLast`, `delete`, `deleteMany`, `page`, `count`, plus `this.contextSvc` (companyId/branchId/userId), session/transaction helpers. Subclass only adds domain methods.

`AbstractBaseRepository<Doc>`: provides `aggregate()`, `page()`, `schemaKeysQuery(schema, {query, searchKeys}, push)`, `cleanupQuery(andConditions)`, plus auto tenant scoping via `companyId`/`branchId` getters. You override `buildQuery()` and usually add `page()`.

## Worked Example — full `supplier` module

Copy this shape, swap `Supplier`/`supplier`, adjust fields. **Import lines below use the local-alias (zerp-be) convention** — if Step 0 found the lib convention, swap the imports to `zync-nest-data-module` / `zync-nest-library` accordingly; everything else stays identical.

### supplier.schema.ts
```ts
import { Prop, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import SoftDelete from "mongoose-delete";
import { BaseSchema, IPageParams, ApSchema } from "src/core/database";

export type SupplierDocument = Supplier & Document;

@ApSchema({ timestamps: true })
export class Supplier extends BaseSchema {
  @Prop({})
  name: string;
  @Prop({})
  email: string;
  @Prop({ set: (v: string) => BaseSchema.toObjectId(v) })
  categoryId: Types.ObjectId;
}

export const SupplierSchema = SchemaFactory.createForClass(Supplier);
SupplierSchema.plugin(SoftDelete, { deletedAt: true });

export class SupplierQuery extends Supplier {
  keyword?: string;
}

export class PageParams extends SupplierQuery implements IPageParams {
  skip: number;
  take: number;
  keyword?: string;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}
```

### supplier.dto.ts
```ts
import { Field, ID, InputType, ObjectType, PartialType } from "@nestjs/graphql";
import { BaseDto, SortOrder } from "src/base.dto";

@ObjectType()
export class Supplier extends BaseDto {
  @Field((type) => ID)
  _id: string;
  @Field((type) => ID, { nullable: false })
  companyId: string;
  @Field((type) => String, { nullable: false })
  name: string;
  @Field((type) => String, { nullable: true })
  email: string;
  @Field((type) => ID, { nullable: true })
  categoryId: string;
  @Field((type) => ID, { nullable: true })
  createdBy: string;
  @Field({ nullable: true })
  createdAt: number;
  @Field((type) => ID, { nullable: true })
  updatedBy: string;
  @Field({ nullable: true })
  updatedAt: number;
}

@InputType()
export class CommonSupplierInput {
  @Field((type) => String)
  name: string;
  @Field((type) => String, { nullable: true })
  email?: string;
  @Field((type) => ID, { nullable: true })
  categoryId?: string;
}

@InputType()
export class CreateSupplierInput extends CommonSupplierInput {}

@InputType()
export class QuerySupplierInput extends PartialType(CommonSupplierInput) {}

@InputType()
export class SupplierPageInput {
  @Field((type) => Number, { nullable: false })
  skip: number;
  @Field((type) => Number, { nullable: false })
  take: number;
  @Field((type) => String, { nullable: true })
  keyword: String;
  @Field({ nullable: true })
  sortBy?: string;
  @Field(() => SortOrder, { nullable: true })
  sortOrder?: SortOrder;
}

@ObjectType()
export class SupplierPageResult {
  @Field((type) => Number, { nullable: true })
  totalRecords: number;
  @Field((type) => [Supplier])
  data: [Supplier];
}
```

### supplier.repository.ts
```ts
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { PageParams, Supplier, SupplierDocument, SupplierSchema } from "./supplier.schema";
import { AbstractBaseRepository, handlePageFacet, handlePageResult, IPageResult } from "src/core";
import { SoftDeleteModel } from "mongoose-delete";

@Injectable()
export class SupplierRepository extends AbstractBaseRepository<SupplierDocument> {
  constructor(@InjectModel(Supplier.name) private supplierModel: SoftDeleteModel<SupplierDocument>) {
    super(supplierModel);
  }

  public async page(page: PageParams): Promise<IPageResult<SupplierDocument>> {
    return this.aggregate([this.buildQuery(page), { ...handlePageFacet(page) }]).then(handlePageResult<SupplierDocument>);
  }

  protected buildQuery(query: Partial<PageParams>): any {
    const andConditions: any[] = [];
    this.schemaKeysQuery(SupplierSchema, { query, searchKeys: ["name", "email"] }, (c) => andConditions.push(c));
    return this.cleanupQuery(andConditions);
  }
}
```

### supplier.service.ts
```ts
import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { TransactionManager } from "src/core";
import { AbstractBaseService } from "src/services";
import { SupplierRepository } from "./supplier.repository";
import { Supplier } from "./supplier.schema";

@Injectable()
export class SupplierService extends AbstractBaseService<Supplier> {
  constructor(
    @Inject(forwardRef(() => SupplierRepository))
    private readonly supplierRepo: SupplierRepository,
    @Inject(forwardRef(() => TransactionManager))
    public readonly transactionManager: TransactionManager
  ) {
    super(supplierRepo, transactionManager);
  }

  protected setSession(session: any): void {}
}
```

### supplier.resolver.ts
```ts
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { ApGqlAuthorize, GqlCurrentUser } from "../auth";
import { CreateSupplierInput, QuerySupplierInput, Supplier, SupplierPageInput, SupplierPageResult } from "./supplier.dto";
import { SupplierService } from "./supplier.service";
import { ApBaseResolver } from "src/app.base";
import { AuditMeta } from "src/decorators/audit-meta.decorator";
import { AuditAction } from "src/modules/audit-trail/audit-trail.interface";

@ApGqlAuthorize({ ignoreCompanyQuery: false })
@Resolver((of) => Supplier)
export class SupplierResolver extends ApBaseResolver<Supplier> {
  constructor(private readonly supplierSvc: SupplierService) {
    super();
  }

  @AuditMeta({ module: "supplier", collection: "suppliers", snapshots: [AuditAction.CREATE] })
  @Mutation((returns) => Supplier, { name: "createSupplier" })
  public async create(@Args("supplier") supplier: CreateSupplierInput) {
    return this.supplierSvc.create({ ...supplier } as any);
  }

  @AuditMeta({ module: "supplier", collection: "suppliers", snapshots: [AuditAction.UPDATE] })
  @Mutation((returns) => Supplier, { name: "updateSupplier" })
  public async update(@GqlCurrentUser() user: any, @Args("id") id: string, @Args("supplier") supplier: QuerySupplierInput) {
    return this.supplierSvc.update(id, { ...supplier } as any);
  }

  @AuditMeta({ module: "supplier", collection: "suppliers", snapshots: [AuditAction.DELETE] })
  @Mutation((returns) => Boolean, { name: "deleteSupplier" })
  public async delete(@GqlCurrentUser() user: any, @Args("id") id: string) {
    await this.supplierSvc.delete(id);
    return true;
  }

  @Query((returns) => [Supplier], { name: "findSupplier" })
  public async find(@Args("supplier") supplier: QuerySupplierInput) {
    return this.supplierSvc.find(supplier as any);
  }

  @Query((returns) => Supplier, { name: "findOneSupplier" })
  public async findOne(@GqlCurrentUser() user: any, @Args("supplier") supplier: QuerySupplierInput) {
    return this.supplierSvc.findOne(supplier as any);
  }

  @ApGqlAuthorize({ ignoreCompanyQuery: false })
  @Query((returns) => SupplierPageResult, { name: "supplierPage" })
  public async page(@Args("page") page: SupplierPageInput) {
    return this.supplierSvc.page(page as any);
  }
}
```

**`@ResolveField` for sub-entities:** when the ObjectType exposes a related entity (like branch's `company`/`manager`), add a `@ResolveField` that calls the related service's `findById`. **Declare explicit return types** to avoid TS2742 cross-module errors.

### supplier.module.ts
```ts
import { forwardRef, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "src/modules/auth/auth.module";
import { SupplierRepository } from "./supplier.repository";
import { SupplierResolver } from "./supplier.resolver";
import { Supplier, SupplierSchema } from "./supplier.schema";
import { SupplierService } from "./supplier.service";

@Module({
  imports: [
    forwardRef(() => ConfigModule),
    forwardRef(() => AuthModule),
    MongooseModule.forFeature([{ name: Supplier.name, schema: SupplierSchema }])
  ],
  providers: [SupplierRepository, SupplierService, SupplierResolver],
  exports: [SupplierRepository, SupplierService]
})
export class SupplierModule {}
```

Add `forwardRef(() => OtherModule)` to `imports` for every other module whose service this resolver/service injects.

## Final Wiring Step (always do this)

Register the module in `src/app.module.ts`: add the import line and put `<Feat>Module` in the `imports` array (alongside `BranchModule`, `CompanyModule`, …). The module won't load otherwise.

## Decorator Reference

- `@ApGqlAuthorize({ ignoreCompanyQuery: false })` — class-level on resolver (and re-applied on `page`/report queries). Internally applies `GqlRolesGuard` + `GqlClientGuard`. `ignoreCompanyQuery: true` disables tenant company filtering for that query.
- `@AuditMeta({ module, collection, snapshots: [AuditAction.X] })` — on every audited mutation. `AuditAction` values: `CREATE`, `UPDATE`, `DELETE`, `STATUS_CHANGE`.
- `@ApSchema({ timestamps: true })` — drop-in for `@nestjs/mongoose`'s `@Schema`; adds tenant collection-prefix support.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Pasting one project's import paths into another | Run Step 0 first — detect lib vs local-alias per repo |
| Business logic in the resolver | Move it to the service; resolver only delegates |
| Raw `model.find(...)` in service | All queries live in the repository's `buildQuery`/methods |
| Repository importing a service | Forbidden — one-way dependency only |
| Forgetting `app.module.ts` registration | Module silently never loads |
| Missing `forwardRef()` on cross-module injects | Causes circular-dep boot crash |
| Hardcoding companyId/branchId | Read `this.contextSvc.companyId` |
| Hand-editing `schema.gql` | It's generated at boot — never edit |
| Re-applying `.startOf('day')` to frontend `fromDate`/`toDate` | Frontend already aligned to TZ; don't shift |
| Skipping `@AuditMeta()` on mutations | Audited mutations must have it |
| New `moment()` usage | Use `dayjs` or `src/core/utils/date.ts` |

## Canonical Reference

Always mirror the **target project's own** canonical module — read it before generating:

- **zerp-be / zyncount-be** (local-alias convention): `src/modules/branch/`
- **zyncg-server and new services** (lib convention): `zyncg-server/src/modules/branch/`
- Otherwise: the smallest CRUD module in the repo (`company`, `customer`, `supplier`).

The canonical module in the repo you're editing always overrides this skill's example when they differ.

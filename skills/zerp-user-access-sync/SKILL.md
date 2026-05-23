---
name: zerp-user-access-sync
description: Use when implementing, replicating, or syncing the User Access / Permission module from zerp (zerp-be) into another NestJS project. Triggers when user asks to "add user access module", "copy permissions from zerp", "sync access groups", "add RBAC", "add permission module", or implement any sub-module (permission, access groups, permission modules, permission actions, client modules, CASL guards, master-access).
---

# Zerp User Access / Permission Module — Replication & Sync Skill

## Core Principle

**Always read live source code from zerp-be. Never rely on memory summaries for business logic.**

Source of truth: `/Users/sabiridwan/Projects/zerp/zerp-be/src/modules/permission/`

---

## Sub-modules Reference

| Sub-module | Source path |
|---|---|
| Permission (root — roles, save, bulk) | `permission/` |
| Access Group | `permission/group/` |
| Permission Module | `permission/module/` |
| Permission Action | `permission/action/` |
| Client Module | `permission/client-module/` |
| Permission Factory (CASL) | `permission/factory/` |
| Guards | `permission/guards/` |
| Master Access (key validation) | `master-access/` |

---

## Process — Full Permission Module

### Step 1 — Read root files and identify external deps

Read these before anything else:

1. `permission/permission.module.ts` — full imports, forwardRef wiring
2. `permission/permission.service.ts` — `save()`, `updateAll()`, `findUserAccessAggregated()`, `haveAccess()`, `seed()`
3. `permission/permission.resolver.ts` — GraphQL operations
4. `permission/permission.dto.ts` — all DTOs, InputTypes, enums (`CheckActionTypes`, `HaveAccessInput`)
5. `permission/permission.schema.ts` — Permission schema (collection: `permission_roles`)
6. `permission/permission.repository.ts` — `findGrantedActionIds()`, `bulkInsertPermissions()`

External modules required in target project: `AuthModule`, `UserModule` (for group-based access), `EmployeeModule` (Staff users have groupId on employee, not user).

### Step 2 — Dispatch parallel agents per batch

**Batch A — Foundation (must complete first)**
- AccessGroup (schema, dto, service, resolver, repository, module)
- PermissionModule (schema, dto, service, resolver, repository, module)
- PermissionAction (schema, dto, service, resolver, repository, module)

**Batch B — Core (after A)**
- Permission root (schema, dto, service, resolver, repository, module)
- ClientModule (schema, dto, service, resolver, repository, module)

**Batch C — Guards & Factory (after B)**
- PermissionFactory (CASL-based, reads user + employee for groupId resolution)
- GqlPermissionGuard + ApiPermissionGuard + BasePermissionGuard
- `ApGqlPermission` decorator

**Batch D — Master Access**
- MasterAccess (dto, service, resolver, module) — simple key validation, no DB schema

### Step 3 — Agent instructions for each batch

Each agent must:
1. Read ALL source files for its assigned sub-modules from zerp-be source path
2. Read every `.service.ts` completely — especially seed data in action.service.ts
3. Write files to target project's `src/modules/permission/<sub-module>/` path
4. Keep business logic byte-for-byte identical
5. Only change: import paths, auth decorator names if different
6. Report which files were written

### Step 4 — Wire permission.module.ts

After all batches complete, copy `permission.module.ts`, update all import paths, keep all `forwardRef()` wrappers, and register `PermissionModule` in the target `AppModule`.

---

## Process — Partial (specific sub-modules)

When user requests specific parts, resolve dependencies first:

| Requested | Must also include |
|---|---|
| Permission (roles) | AccessGroup, PermissionAction, PermissionModule |
| haveAccess / guards | Permission root, PermissionFactory, AccessGroup |
| ClientModule | PermissionModule |
| Any mutation-level auth | GqlPermissionGuard + ApGqlPermission decorator |

---

## Per-sub-module file checklist

For every sub-module, read ALL of these from zerp-be source:

```
<sub-module>.schema.ts      ← Mongoose schema + indexes
<sub-module>.dto.ts         ← GraphQL DTOs + InputTypes + enums
<sub-module>.repository.ts  ← All data access — never skim aggregations
<sub-module>.service.ts     ← ALL BUSINESS LOGIC — read completely
<sub-module>.resolver.ts    ← GraphQL operations + auth decorators
<sub-module>.module.ts      ← Module wiring + forwardRef declarations
```

For permission root, also read: `permission.schema.ts` compound index declarations.
For action, also read the full `seed()` method — it contains 50+ modules and 300+ actions.
For factory, also read: `permission.factory.ts` completely — CASL ability builder.

---

## Critical Business Logic — DO NOT Simplify or Rewrite

### permission.service.ts
- `save()` — toggle pattern: if permission exists, delete it; if not, create it. NOT a simple create.
- `updateAll()` — `CHECK_ALL` bulk inserts all actionIds for a group; `UNCHECK_ALL` deletes all; uses `findGrantedActionIds()` to avoid duplicates.
- `findUserAccessAggregated()` — 3-collection join (modules + actions + permissions) done **in-memory** (not aggregation pipeline) to avoid 16MB BSON limit. Must be copied exactly.
- `haveAccess()` — Staff users (kind = Staff): resolves groupId from Employee table, not User. All other kinds: use `user.groupId` directly.
- `seed()` — seeds Admin group with all permissions after seeding actions and modules.

### action.service.ts
- `seed()` — massive bulk insert of 50+ modules with 300+ named actions. Copy the entire seed data array verbatim — action names are referenced by string in business logic and frontend.

### module.service.ts (PermissionModule)
- `findUserPermissions()` — returns modules + all their actions with a `hasPermission` boolean per action for the calling user.
- `findModulesForGroup()` — same structure but for a specified groupId, used by admin permission editor.
- `seed()` — creates PermissionModule records for all ApModules enum values.

### group.service.ts (AccessGroup)
- `create()` — prevents duplicate group names within company scope.
- `seed()` — creates 5 default groups: Admin, Salesman, Marketing, Customer, Supplier.

### permission.factory.ts (CASL)
- `definePermission()` — builds CASL `PureAbility` from user's group permissions.
- Staff groupId lookup: queries Employee collection to get `groupId`, then looks up permissions for that group.
- Returns ability usable in guards and `this.ability.can(action, module)` checks.

---

## Schema Details

### Permission (collection: `permission_roles`)
```
groupId: ObjectId (indexed)
moduleId: ObjectId (indexed)
actionId: ObjectId (indexed)
branchId?: ObjectId
companyId (from BaseSchema)
Compound indexes: [groupId, actionId, companyId], [groupId, companyId, actionId]
```

### AccessGroup (collection: `permission_groups`)
```
group: string (required)
branchId?: ObjectId
companyId (from BaseSchema)
```

### PermissionAction (collection: `permission_actions`)
```
moduleId: ObjectId (required, indexed)
action: string (required)   ← matches RoleActions enum values
name?: string
companyId (from BaseSchema)
```

### PermissionModule (collection: `permission_modules`)
```
module: string (required)   ← matches ApModules enum values
name?: string
companyId (from BaseSchema)
```

### ClientModule (collection: `permission_client_modules`)
```
module: string (required)
client: string (required)
hasAccess: boolean (required)
companyId (from BaseSchema)
```

---

## Enums (copy verbatim — names referenced by string in frontend)

| Enum | Values |
|---|---|
| `CheckActionTypes` | `CHECK_ALL`, `UNCHECK_ALL` |
| `RoleActions` | `CREATE`, `UPDATE`, `READ`, `MANAGE`, `DELETE` |
| `ApModules` | 75 values — Dashboard, Sales, Purchasing, Inventory, Accounting, HR, Manufacturing, Projects, Recruitment, Admin, Reports, etc. |

---

## What to adapt vs copy exactly

| Adapt | Copy exactly |
|---|---|
| Import paths | All service method implementations |
| Auth decorator names (if target differs) | All enum values and names in `ApModules`, `RoleActions` |
| Module registration in AppModule | Full seed data arrays in action.service.ts |
| | CASL factory logic |
| | All compound index declarations |
| | In-memory join in `findUserAccessAggregated()` |
| | Staff vs non-Staff groupId resolution in `haveAccess()` |

---

## Common Mistakes to Avoid

| Mistake | Correct approach |
|---|---|
| Simplifying `save()` to just a create | It's a toggle — must check existence and delete if found |
| Using aggregation pipeline for user access | In-memory join is intentional (avoids 16MB BSON limit) |
| Assuming all users have groupId on User document | Staff users: groupId is on Employee, not User |
| Rewriting seed data to be "cleaner" | Copy verbatim — action names are keyed by string from frontend |
| Removing compound indexes | Permission checks are hot path; indexes are critical |
| Skipping `haveAccess()` Staff branch | Staff access breaks without Employee lookup |
| Hardcoding company/branch IDs | Always `contextSvc.companyId` / `contextSvc.branchId` |
| Skipping `mongoose-delete` plugin | All schemas need soft-delete registered |

---

## Sync Workflow (updating an existing port)

1. Read the changed file(s) from zerp-be permission source
2. Read the corresponding file(s) in the target project
3. Apply only the changed logic — do not re-copy unchanged sections
4. Pay special attention to new ApModules enum values (new modules require new action seeds)
5. After any seed data change, verify the seed method is idempotent (uses upsert, not insert)
6. Run target project build after sync to catch import path issues

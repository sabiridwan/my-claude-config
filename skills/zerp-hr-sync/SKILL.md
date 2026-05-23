---
name: zerp-hr-sync
description: Use when implementing, replicating, or syncing the HR module from zerp (zyncount-be) into another NestJS project. Triggers when user asks to "add HR module", "copy HR from zerp", "sync HR module", or implement any HR sub-module (payroll, leave, attendance, timesheet, claim, loan, advance, employee, department, training, ESS, approvals, calendar, dashboard, org-chart).
---

# Zerp HR Module — Replication & Sync Skill

## Core Principle

**Always read live source code from zyncount-be. Never rely on memory summaries for business logic.**

Source of truth: `/Users/sabiridwan/Projects/zyncount/zyncount-be/src/modules/hr/`

---

## When You Use This Skill

- Implementing the HR module (full or partial) in a new project
- Syncing changes from zyncount-be HR into another project
- Adding a specific HR sub-module to an existing project

---

## Sub-modules Reference

| Sub-module | Source path |
|---|---|
| Employee | `hr/employee/` |
| Department | `hr/department/` |
| Leave + Group | `hr/leave/`, `hr/leave/group/` |
| Attendance + Shift + Group + Timetable | `hr/attendance/` |
| Timesheet | `hr/timesheet/` |
| Payroll (+ 7 sub-components) | `hr/payroll/` |
| Claim + Group + Type | `hr/claim/` |
| Advance + Transaction | `hr/advance/` |
| Loan + Repayment | `hr/loan/` |
| Approval | `hr/approval/` |
| Calendar | `hr/calendar/` |
| Training + Group + Assignment + Progress | `hr/training/` |
| Dashboard | `hr/dashboard/` |
| Org Chart | `hr/org-chart/` |
| ESS | `hr/ess/` |

---

## Process — Full HR Module (all 16 sub-modules)

Use this when the user asks for the complete HR module.

### Step 1 — Read hr.module.ts and cross-module deps first

Read `/Users/sabiridwan/Projects/zyncount/zyncount-be/src/modules/hr/hr.module.ts` to get the full imports list. Identify which external modules are referenced (Finance, Master, User, Auth) and confirm they exist in the target project before proceeding.

### Step 2 — Dispatch parallel agents per sub-module group

Split the work into these 5 parallel agent batches. Each agent reads source files and writes the corresponding files in the target project.

**Batch A — Foundation (must complete before others)**
- Employee (all 5 files)
- Department (all 5 files)
- Calendar (all 5 files)

**Batch B — Attendance & Time (run in parallel with C, D, E after A)**
- Attendance + Shift + AttendanceGroup + Timetable sub-folders
- Timesheet

**Batch C — Leave & Approvals**
- LeaveGroup
- Leave
- Approval

**Batch D — Claims, Advance, Loan**
- ClaimType + ClaimGroup + Claim
- Advance + AdvanceTransaction
- Loan + LoanRepayment

**Batch E — Payroll (largest — give dedicated agent)**
- All 8 payroll sub-folders: root, employee/, contribution/, contribution/group/, employee-item/, item-group/, salary/, settings/item/, settings/tax-bracket/
- payroll.constants.ts

**Batch F — Analytics & Self-Service (after all above)**
- Dashboard
- OrgChart
- Training + TrainingGroup + TrainingAssignment + TrainingProgress
- ESS

### Step 3 — Agent instructions for each batch

Each agent must:
1. Read ALL source files for its assigned sub-modules from the zyncount-be source path
2. Read every `.service.ts` completely — no skimming
3. Write files to target project's `src/modules/hr/<sub-module>/` path
4. Keep business logic byte-for-byte identical
5. Only change: import paths, auth decorator names if different, module registration paths
6. Report which files were written

### Step 4 — Wire hr.module.ts

After all batches complete, copy `hr.module.ts`, update all import paths, and register `HrModule` in the target `AppModule`.

---

## Process — Partial (specific sub-modules only)

When user requests specific sub-modules:

1. Read `hr.module.ts` to understand which other sub-modules the requested ones depend on
2. Include all dependencies even if not explicitly requested (e.g. requesting Leave requires LeaveGroup + Approval)
3. For each sub-module, read all 5 layer files from zyncount-be source
4. Write to target project, adapt imports only
5. Wire into target module

### Per-sub-module file checklist

For every sub-module, read **all layer files** from zyncount-be:

```
<sub-module>.schema.ts      ← Mongoose schema + enums
<sub-module>.dto.ts         ← GraphQL DTOs + InputTypes
<sub-module>.repository.ts  ← All data access / query logic
<sub-module>.service.ts     ← ALL BUSINESS LOGIC — read completely, never skim
<sub-module>.resolver.ts    ← GraphQL operations + auth decorators
<sub-module>.module.ts      ← Module wiring
```

For payroll, additionally read `payroll.constants.ts` and all 7 sub-component folders.

### What to adapt vs what to copy exactly

| Adapt | Copy exactly |
|---|---|
| Import paths | All service method implementations |
| Auth decorator names (if target differs) | All enum values and names |
| Module registration in AppModule | All schema field names |
| | All repository query logic |
| | All DTO field definitions |
| | All GraphQL operation names |

### Cross-module dependency map

| Sub-module | Depends on |
|---|---|
| Leave | LeaveGroup, Approval |
| Claim | ClaimGroup, ClaimType, Approval |
| Advance | Approval |
| Loan | Approval, LoanRepayment |
| Payroll | Employee, Attendance, Leave, Claim, Finance (external) |
| ESS | Employee, Attendance |
| OrgChart | Employee, Department |
| Dashboard | Employee, Payroll, Attendance, Timesheet, Leave, Approval |
| Approval | Calls back into Leave / Claim / Advance / Loan services |

---

## Critical Business Logic Areas (Do NOT Simplify)

These service methods contain non-trivial logic that must be copied exactly:

### Payroll (`payroll.service.ts`)
- `runPayroll()` — gross salary calculation, deduction/allowance application, tax bracket computation, YTD tracking, absence/overtime/leave deductions, employer cost aggregation
- `buildJournalLines()` — constructs journal entries per employee with account mappings from contribution groups and item settings
- `postPayrollJournal()` — posts to finance module, stamps `journalEntryId` on payroll
- `markPayrollAsPaid()` — validates status transition, records payment account

### Leave (`leave.service.ts`)
- `createLeave()` — validates against leave group balance, creates approval record, checks half-day logic
- Balance calculation — reads leave group types and computes remaining days from approved leaves in period

### Attendance (`attendance.service.ts`)
- `clockIn()` — resolves CLOCK_IN vs CLOCK_OUT from last record, stamps `date` as start-of-day, records `submitType`
- `importAttendance()` — bulk import with duplicate detection

### Timesheet (`timesheet.service.ts`)
- `approveTimesheets()` — batch approval, status machine: DRAFT→SUBMITTED→APPROVED/REJECTED
- `submitTimesheets()` — validates DRAFT status before transition

### Approval (`approval.service.ts`)
- `actionApproval()` — routes back to originating module (leave/claim/advance/loan) to trigger status update on the source record after approval/rejection

### Claim / Advance / Loan
- All three follow same pattern: create → pending → approval triggers → approved/rejected → transaction recording
- Advance tracks `remainingBalance` via transactions
- Loan auto-generates repayment installments on approval

---

## Common Mistakes to Avoid

| Mistake | Correct approach |
|---|---|
| Rewriting service logic to be "cleaner" | Copy exactly — business rules are intentional |
| Skipping approval callback wiring | `actionApproval` must call back into leave/claim/advance/loan service |
| Hardcoding company/branch IDs | Always use `contextSvc.companyId` / `contextSvc.branchId` |
| Re-applying `startOf('day')` on timestamps | Frontend already aligned timestamps; server TZ env handles it |
| New `moment()` usage | Use `dayjs` or `src/core/utils/date.ts` |
| Skipping `mongoose-delete` plugin | All schemas need soft-delete registered |
| Raw Mongoose queries in services | All queries go through repository methods only |

---

## Sync Workflow (updating an existing port)

When zyncount-be HR is updated and you need to sync changes to another project:

1. Read the changed file(s) from zyncount-be
2. Read the corresponding file(s) in the target project
3. Apply only the changed logic — do not re-copy unchanged sections
4. Verify enum values and field names match after sync
5. Run the target project's tests

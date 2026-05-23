---
name: tester-zerp
description: Use when asked to test any feature in the ZERP ecosystem (zerp-be, zerp-admin, zerp-master, zerp-pos). Triggers on requests like "test payroll in ZERP", "test inventory flow", "verify supplier invoice", "run E2E test for [feature] in zerp".
---

# ZERP E2E Tester

## What This Skill Does

Guides Claude through full-stack on-demand E2E testing of the ZERP ecosystem:
- **Backend:** GraphQL API via HTTP against `zerp-be`
- **Frontend:** Admin UI via Playwright against `zerp-admin`

Always follow the 5-step execution process below — do not skip steps.

---

## App Map

| Service | Root Path | Port | Start Command |
|---|---|---|---|
| Backend API | `/Users/sabiridwan/Projects/zerp/zerp-be` | **3650** | `npm run start:dev` |
| Admin UI | `/Users/sabiridwan/Projects/zerp/zerp-admin` | **3651** | `npm run dev` |
| Master panel | `/Users/sabiridwan/Projects/zerp/zerp-master` | **3660** | `npm run dev` |
| POS | `/Users/sabiridwan/Projects/zerp/zerp-pos` | (check package.json) | `npm run dev` |

GraphQL endpoint: `http://localhost:3650/graphql`

---

## Auth

### Credentials

Read live credentials from the backend `.env` file:
```bash
grep -E "super_admin|admin_email|admin_password|test_email|test_password|user_super" /Users/sabiridwan/Projects/zerp/zerp-be/.env
```

The `.env` contains `user_super_admin_email=super@mabiz.com`. Use this account for admin-level tests. Ask the user for the password if not in the `.env`.

### signIn Mutation

```graphql
mutation {
  signIn(
    email: "<admin-email>"
    password: "<admin-password>"
    client: "zerp_admin"
    company: "<company-slug-or-id>"
  ) {
    accessToken
    userId
    companyId
    branchId
    name
  }
}
```

The `company` argument is optional. If the admin user belongs to one company, omit it. If multi-company, pass the company slug.

### Token Usage

All subsequent GraphQL requests must include:
```
Authorization: Bearer <accessToken>
```

The `companyId` and `branchId` are returned directly in the `Auth` response — use these values to understand which tenant the session belongs to. They are embedded in the JWT for automatic scoping.

---

## Module Index

Map user requests to the correct module path and GraphQL operation prefix:

| Feature area | Module path | GQL operation prefix |
|---|---|---|
| Authentication | `src/modules/auth/` | `signIn`, `refreshToken` |
| Company | `src/modules/company/` | `companyPage`, `createCompany`, `updateCompany` |
| Branch | `src/modules/branch/` | `branchPage`, `createBranch`, `updateBranch` |
| Employee | `src/modules/hr/employee/` | `employeePage`, `createEmployee`, `updateEmployee` |
| HR — Leave | `src/modules/hr/leave/` | `leavePage`, `createLeave`, `cancelLeave` |
| HR — Leave Groups | `src/modules/hr/leave/group/` | `leaveGroupPage`, `createLeaveGroup` |
| HR — Attendance | `src/modules/hr/attendance/` | `attendancePage`, `createAttendance` |
| HR — Shifts | `src/modules/hr/attendance/shift/` | `shiftPage`, `createShift` |
| HR — Timetable | `src/modules/hr/attendance/timetable/` | `timetablePage` |
| HR — Payroll | `src/modules/hr/payroll/` | `payrollPage`, `createPayroll`, `runPayroll`, `approvePayroll`, `cancelPayroll` |
| HR — Advance | `src/modules/hr/advance/` | `advancePage`, `createAdvance` |
| HR — Loan | `src/modules/hr/loan/` | `loanPage`, `createLoan` |
| HR — Claim | `src/modules/hr/claim/` | `claimPage`, `createClaim` |
| HR — Calendar | `src/modules/hr/calendar/` | `calendarPage`, `createCalendar` |
| HR — Approval | `src/modules/hr/approval/` | `approvalPage`, `actionApproval` |
| HR — Recruitment | `src/modules/recruitment/` | `recruitmentPage`, `createJobPost`, `createApplicant` |
| Inventory | `src/modules/inventory/` | `inventoryPage`, `createInventory`, `adjustStock` |
| Product | `src/modules/product/` | `productPage`, `createProduct`, `updateProduct` |
| Supplier | `src/modules/supplier/` | `supplierPage`, `createSupplier` |
| Customer | `src/modules/customer/` | `customerPage`, `createCustomer` |
| Finance | `src/modules/finance/` | `financePage`, `createTransaction` |
| Budget | `src/modules/budget/` | `budgetPage`, `createBudget` |
| Fiscal Period | `src/modules/fiscal/` | `fiscalPage`, `createFiscalPeriod` |
| Manufacturing | `src/modules/manufacturing/` | `manufacturingPage`, `createWorkOrder` |
| Project | `src/modules/project/` | `projectPage`, `createProject` |
| Exchange | `src/modules/exchange/` | `exchangePage` |
| Assets | `src/modules/assets/` | `assetPage`, `createAsset` |
| Audit Trail | `src/modules/audit-trail/` | `auditTrailPage` |
| Master / Access | `src/modules/master/`, `src/modules/master-access/` | `masterPage`, `masterAccessPage` |
| Permission | `src/modules/permission/` | `permissionPage`, `assignPermission` |
| Subscription | `src/modules/subscription/` | `subscriptionPage`, `updateSubscription` |
| Config | `src/modules/config/` | `configPage`, `updateConfig` |
| KYC | `src/modules/kyc/` | `kycPage`, `createKyc` |
| Notification | `src/modules/notification/` | `notificationPage` |

> If you need the exact resolver name, grep the resolver file:
> `grep "@Query\|@Mutation" src/modules/<feature>/<feature>.resolver.ts`

---

## Test Data

Before running any test, identify these values:

1. **Admin credentials** — read from `.env` (see Auth section above)
2. **Company ID** — returned as `companyId` in the `signIn` Auth response
3. **Branch ID** — returned as `branchId` in the `signIn` Auth response
4. **Test employee** — query `employeePage(page: 1, limit: 1)` after auth to get a real employee ID for HR tests

For tests that create records, prefer creating then deleting in the same test session to keep the database clean. If deletion is not available, flag the created record ID in the report.

---

## 5-Step Test Execution Process

Follow these steps in order for every test request.

### Step 1 — Confirm backend is running

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3650/graphql -X POST -H "Content-Type: application/json" -d '{"query":"{ __typename }"}'
```

Expected: `200`. If not, instruct the user:
```
cd /Users/sabiridwan/Projects/zerp/zerp-be && npm run start:dev
```

### Step 2 — Authenticate

```bash
curl -s -X POST http://localhost:3650/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { signIn(email: \"<email>\", password: \"<password>\", client: \"zerp_admin\") { accessToken userId companyId branchId name } }"
  }'
```

Extract `accessToken`, `companyId`, and `branchId` from the response. Store them for use in subsequent requests and for identifying the test tenant.

If signIn fails, check:
- Credentials are correct
- The user exists and is active
- The `company` argument may be needed if the user belongs to multiple companies

### Step 3 — Backend GraphQL test

Send the relevant query or mutation. Example for inventory page:
```bash
curl -s -X POST http://localhost:3650/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "query": "query { inventoryPage(page: 1, limit: 5) { data { _id product { name } quantity } total } }"
  }'
```

Assert:
- Response HTTP status is `200`
- Response JSON has no `errors` array
- `data` contains the expected fields
- Values match what the test scenario requires

### Step 4 — Admin UI verification (Playwright)

If the Playwright MCP is unavailable (browser not connected), skip Step 4 and note "UI verification skipped — Playwright MCP not available" in the report.

Use the Playwright MCP tool to verify the result is visible in the admin UI:

1. Navigate to admin: `http://localhost:3651`
2. Log in if not already authenticated (use same credentials)
3. Navigate to the relevant page (e.g., `/inventory`, `/hr/leave`)
4. Assert the record created/updated in Step 3 is visible with the correct status
5. Take a screenshot as evidence

Playwright MCP tools to use:
- `browser_navigate` — go to URL
- `browser_fill_form` — fill login form
- `browser_click` — click buttons/links
- `browser_snapshot` — get page state
- `browser_take_screenshot` — capture visual evidence

### Step 5 — Report

Output a structured pass/fail summary:

```
=== ZERP E2E Test Report ===
Feature: [feature name]
Date: [timestamp]
Company ID: [companyId from auth]

BACKEND
  ✓ API reachable at http://localhost:3650/graphql
  ✓ Auth: signIn succeeded (userId: xxx, companyId: xxx)
  ✓ [operation name]: returned [N] records / created record id: xxx
  ✗ [operation name]: ERROR — [error message]

FRONTEND
  ✓ Admin UI reachable at http://localhost:3651
  ✓ Navigated to /inventory
  ✓ Record visible in table
  ✗ Stock quantity shows 0 instead of 50

RESULT: PASS / PARTIAL PASS / FAIL
Notes: [any observations, cleanup actions taken]
```

---

## Common Gotchas

1. **Soft deletes**: All records use `mongoose-delete`. Deleted records won't appear in normal page queries unless you explicitly include deleted records in the query.

2. **Multi-company scoping**: ZERP is strictly multi-tenant. All queries are auto-scoped to `companyId` from the JWT. If results appear empty, confirm the admin user's company has the relevant data.

3. **Fiscal period dependency**: Finance and payroll operations often require an active fiscal period. If a mutation fails with a fiscal period error, query `fiscalPage` first and ensure an OPEN period exists for the current month.

4. **Manufacturing BOM**: Work orders require a Bill of Materials (BOM). If manufacturing tests fail, check that a BOM exists for the product being tested.

5. **Subscription gating**: Some features are gated by the company's subscription plan. If a resolver returns a permission/subscription error, check `subscriptionPage` to see which features are enabled.

6. **Pagination shape**: All page queries return `{ data: [...], total: N, page: N, limit: N }`. Empty `data` with `total > 0` means you're on the wrong page.

7. **GraphQL schema**: The generated schema is at `src/schema.gql`. Grep it to discover exact field names: `grep -A 5 "type Leave " src/schema.gql`

8. **Admin URL routing**: zerp-admin pages are typically at `/<module>` (e.g., `/hr/leave`, `/inventory`, `/finance`). Check `src/modules/<name>/` in zerp-admin for the actual page file if a route 404s.

9. **Audit trail**: All mutations in ZERP write to the audit trail. After a test, you can verify side-effects by querying `auditTrailPage` — this is a good secondary assertion.

---
name: tester-msgd
description: Use when asked to test any feature in the MSG Gold ecosystem (msgld-be, msgld-admin, msgld-fe, msgld-app). Triggers on requests like "test the leave flow", "test cart checkout", "verify payroll in MSG", "run E2E test for [feature]".
---

# MSG Gold E2E Tester

## What This Skill Does

Guides Claude through full-stack on-demand E2E testing of the MSG Gold ecosystem:
- **Backend:** GraphQL API via HTTP against `msgld-be`
- **Frontend:** Admin UI via Playwright against `msgld-admin`

Always follow the 5-step execution process below — do not skip steps.

---

## App Map

| Service | Root Path | Port | Start Command |
|---|---|---|---|
| Backend API | `/Users/sabiridwan/Projects/MalikStreams/msgold/msgld-be` | **3550** | `npm run start:dev` |
| Admin UI | `/Users/sabiridwan/Projects/MalikStreams/msgold/msgld-admin` | **5311** | `npm run dev` |
| Customer FE | `/Users/sabiridwan/Projects/MalikStreams/msgold/msgld-fe` | **5312** | `npm run dev` |
| Mobile App | `/Users/sabiridwan/Projects/MalikStreams/msgold/msgld-app` | Expo (web mode) | `npm run web` |

GraphQL endpoint: `http://localhost:3550/graphql`

---

## Auth

### Credentials

Read live credentials from the backend `.env` file:
```bash
cat /Users/sabiridwan/Projects/MalikStreams/msgold/msgld-be/.env | grep -E "admin_email|admin_password|test_email|test_password"
```

If no test credentials are in `.env`, use the admin account visible in the running database (ask the user for credentials if needed).

### signIn Mutation

```graphql
mutation {
  signIn(
    email: "<admin-email>"
    password: "<admin-password>"
    client: "msg_admin"
  ) {
    accessToken
    userId
    name
  }
}
```

**Client values:**
- `msg_admin` — Admin panel (use for most tests)
- `msg_web` — Customer web
- `msg_app` — Mobile app
- `msg_staff` — Staff app

### Token Usage

All subsequent GraphQL requests must include:
```
Authorization: Bearer <accessToken>
```

CompanyId and branchId are **embedded in the JWT** — no separate headers needed for most queries. For ESS (Employee Self Service) endpoints, the `employeeId` must also be in the token payload.

---

## Module Index

Map user requests to the correct module path and GraphQL operation prefix:

| Feature area | Module path | GQL operation prefix |
|---|---|---|
| Authentication | `src/modules/auth/` | `signIn`, `refreshToken` |
| Employee | `src/modules/employee/` | `employeePage`, `createEmployee`, `updateEmployee` |
| HR — Leave | `src/modules/hr/leave/` | `leavePage`, `createLeave`, `cancelLeave` |
| HR — Leave Groups | `src/modules/hr/leave/group/` | `leaveGroupPage`, `createLeaveGroup` |
| HR — Attendance | `src/modules/hr/attendance/` | `attendancePage`, `createAttendance` |
| HR — Attendance Groups | `src/modules/hr/attendance/group/` | `attendanceGroupPage` |
| HR — Shifts | `src/modules/hr/attendance/shift/` | `shiftPage`, `createShift` |
| HR — Timetable | `src/modules/hr/attendance/timetable/` | `timetablePage` |
| HR — Payroll | `src/modules/hr/payroll/` | `payrollPage`, `createPayroll`, `runPayroll`, `approvePayroll`, `cancelPayroll` |
| HR — Advance | `src/modules/hr/advance/` | `advancePage`, `createAdvance` |
| HR — Loan | `src/modules/hr/loan/` | `loanPage`, `createLoan` |
| HR — Claim | `src/modules/hr/claim/` | `claimPage`, `createClaim` |
| HR — Calendar | `src/modules/hr/calendar/` | `calendarPage`, `createCalendar` |
| HR — Approval | `src/modules/hr/approval/` | `approvalPage`, `actionApproval` |
| HR — Org Chart | `src/modules/hr/org-chart/` | `orgChartPage` |
| HR — Dashboard | `src/modules/hr/dashboard/` | `hrDashboard` |
| HR — ESS | `src/modules/hr/ess/` | `essPage` (requires employee token) |
| Approval (general) | `src/modules/approval/` | `approvalPage`, `createApproval` |
| Item | `src/modules/item/` | `itemPage`, `createItem`, `updateItem` |
| Item Group | `src/modules/item/group/` | `itemGroupPage` |
| Customer | `src/modules/customer/` | `customerPage`, `createCustomer` |
| Cart | `src/modules/cart/` | `cartPage`, `createCart`, `checkoutCart` |
| Order | `src/modules/order/` | `orderPage`, `createOrder` |
| Catalogue | `src/modules/catalogue/` | `cataloguePage` |
| Discount | `src/modules/discount/` | `discountPage`, `createDiscount` |
| Ecard | `src/modules/ecard/` | `ecardPage`, `createEcard` |
| Hedging | `src/modules/hedging/` | `hedgingPage` |
| Gallery | `src/modules/gallery/` | `galleryPage` |
| Banner | `src/modules/banner/` | `bannerPage`, `createBanner` |
| Dashboard | `src/modules/dashboard/` | `dashboard` |
| Config | `src/modules/config/` | `configPage`, `updateConfig` |
| Communication | `src/modules/communication/` | `communicationPage` |
| Analytics | `src/modules/analytics/` | `analyticsPage` |

> If you need the exact resolver name, grep the resolver file:
> `grep "@Query\|@Mutation" src/modules/<feature>/<feature>.resolver.ts`

---

## Test Data

Before running any test, identify these values:

1. **Admin credentials** — read from `.env` or ask the user
2. **Company ID** — automatically embedded in the JWT and applied to all queries. To explicitly find your companyId, run a `companyPage` query after authenticating.
3. **Branch ID** — similarly from JWT or query
4. **Test employee** — query `employeePage(page: 1, limit: 1)` after auth to get a real employee ID for HR tests

For tests that create records, prefer creating then deleting in the same test session to keep the database clean. If deletion is not available, flag the created record ID in the report.

---

## 5-Step Test Execution Process

Follow these steps in order for every test request.

### Step 1 — Confirm backend is running

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3550/graphql -X POST -H "Content-Type: application/json" -d '{"query":"{ __typename }"}'
```

Expected: `200`. If not, instruct the user:
```
cd /Users/sabiridwan/Projects/MalikStreams/msgold/msgld-be && npm run start:dev
```

### Step 2 — Authenticate

Send the signIn mutation:
```bash
curl -s -X POST http://localhost:3550/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { signIn(email: \"<email>\", password: \"<password>\", client: \"msg_admin\") { accessToken userId name } }"
  }'
```

Extract `accessToken` from the response. Store it as `TOKEN` for subsequent requests.

If signIn fails, check:
- Credentials are correct
- The `client` value matches the user's role (`msg_admin` for admin users)

### Step 3 — Backend GraphQL test

Send the relevant query or mutation. Example for leave page:
```bash
curl -s -X POST http://localhost:3550/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "query": "query { leavePage(page: 1, limit: 5) { data { _id status employee { name } } total } }"
  }'
```

Assert:
- Response HTTP status is `200`
- Response JSON has no `errors` array (or errors array is empty)
- `data` contains the expected fields
- Values match what the test scenario requires

### Step 4 — Admin UI verification (Playwright)

Use the Playwright MCP tool to verify the result is visible in the admin UI:

1. Navigate to admin: `http://localhost:5311`
2. Log in if not already authenticated (use same credentials)
3. Navigate to the relevant page (e.g., `/hr/leave` for leave records)
4. Assert the record created/updated in Step 3 is visible with the correct status
5. Take a screenshot as evidence

If the Playwright MCP is unavailable (browser not connected), skip Step 4 and note "UI verification skipped — Playwright MCP not available" in the report.

Playwright MCP tools to use:
- `browser_navigate` — go to URL
- `browser_fill_form` — fill login form
- `browser_click` — click buttons/links
- `browser_snapshot` — get page state
- `browser_take_screenshot` — capture visual evidence

### Step 5 — Report

Output a structured pass/fail summary:

```
=== MSG Gold E2E Test Report ===
Feature: [feature name]
Date: [timestamp]

BACKEND
  ✓ API reachable at http://localhost:3550/graphql
  ✓ Auth: signIn succeeded (userId: xxx)
  ✓ [operation name]: returned [N] records / created record id: xxx
  ✗ [operation name]: ERROR — [error message]

FRONTEND
  ✓ Admin UI reachable at http://localhost:5311
  ✓ Navigated to /hr/leave
  ✓ Record visible with status PENDING
  ✗ Status badge shows DRAFT instead of PENDING

RESULT: PASS / PARTIAL PASS / FAIL
Notes: [any observations, cleanup actions taken]
```

---

## Common Gotchas

1. **Soft deletes**: All records use `mongoose-delete`. Deleted records have `deleted: true` and won't appear in normal page queries. Use `withDeleted: true` if querying deleted records.

2. **Multi-branch**: Queries are automatically scoped to `companyId`/`branchId` from the JWT. If results seem empty, verify the admin user's company/branch assignment.

3. **ESS endpoints**: ESS (Employee Self Service) resolvers require an employee token (`client: "msg_app"` with an employee user), not an admin token. Use a separate signIn with an employee account.

4. **Pagination shape**: All page queries follow `{ data: [...], total: N, page: N, limit: N }`. If a query returns an empty array when data is expected, check `total` — it will tell you if records exist on a different page.

5. **GraphQL schema**: The generated schema is at `src/schema.gql`. Grep it to discover exact field names: `grep -A 5 "type Leave " src/schema.gql`

6. **Admin URL routing**: The admin uses Next.js file-based routing. Module pages are typically at `/<module-name>` (e.g., `/hr/leave`, `/employee`, `/item`). If a page 404s, check `src/modules/<name>/page.tsx` for the actual route.

# ZyncGold / zerp HR — architecture map

Verified against `zyncg-server` @ `dev-v1` and `zerp-be` @ `development` / `dev-my`, 2026-08-21.
Re-verify with `scripts/hr_audit.sh` before relying on any count.

## Repos and what HR looks like in each

| Repo | Path to HR | Country | Notes |
|---|---|---|---|
| `zyncg-server` | `src/modules/hr/` | Malaysia | ~377 `.ts`, ~39k LOC, **0 `*.spec.ts`** |
| `zerp-be` (`dev-my`) | `src/modules/hr/` | Malaysia | ~460 `.ts`, **~70 specs** — upstream, richer |
| `zerp-be` (`development`) | `src/modules/hr/` + `src/plugins/nigeria/` | Nigeria | Nigeria is a seed plugin, not an engine |
| `zerp-admin` | `src/modules/hr/` | follows BE branch | `dev-my` carries `company-statutory/`, `employee-ea-form/` |
| `zyncg-admin` | `src/modules/hr/`, `src/modules/ess/`, `src/modules/employees/` | Malaysia | Apollo consumer |
| `zynchrs-be` | flat `src/modules/*` (`payroll`, `leave`, `attendance`, `claim`, `advance`, `loan`, `onboarding`, `offboarding`) | verify | **No `hr/` folder.** Different generation of the product — never assume path parity |

`zyncg-server` HR is a port of `zerp-be dev-my`. `payroll-country.ts` is byte-identical
between them. That means: **zerp-be's HR specs are directly portable to zyncg-server**, and
a bug fixed in one is almost certainly live in the other.

## Sub-module inventory (`src/modules/hr/`)

Time & attendance
: `attendance/` (+ `shift/`, `group/`, `timetable/`, `device-sync/` with a HikVision driver
  under `device-sync/hikv/`), `attendance-report/`, `timesheet/`, `roster/` (+ `swap/`),
  `calendar/`

Absence & entitlement
: `leave/` (+ `group/`, `leave-rule.ts`), `entitlement/` (+ `entitlement-scope.service.ts`),
  `policy/` (+ `eligibility.util.ts`)

Money to employees
: `claim/` (+ `group/`), `advance/` (+ `transaction/`), `loan/` (+ `transaction/`),
  `commission/`

Payroll
: `payroll/` — see the dedicated section below

People
: `employee/` (top-level `src/modules/employee/`, imported via `forwardRef`),
  `department/`, `employee-lifecycle/`, `org-chart/`, `performance/`
  (+ `review-scale/`, `review-template/`, `tasks/`), `training/`, `letter/`
  (+ `employee-letter/`, `employee-signature/`, `letter-approval/`, `letter/` for PDF)

Cross-cutting
: `approval/`, `approval-policy/` (+ `approval-policy.defaults.ts`),
  `approval-orchestrator/`, `dashboard/`, `ess/`, `decorators/hr-authorize.decorator.ts`

## Payroll internals — the part that actually computes money

```
payroll/
  payroll-country.ts              ← COUNTRY ENGINE. Pure functions. Statute lives here.
  payroll-tax-bands.ts            ← band lookup (lookupAnnualTax)
  payroll-mtd.ts                  ← MY cumulative MTD: monthly + additional-remuneration
  payroll-statutory-tables.ts     ← verbatim published SOCSO / EIS band tables
  payroll-statutory-schedule.ts   ← band lookup + SOCSO breakdown (invalidity vs SKBBK)
  payroll.constants.ts            ← ContributionFrequency / ContributionValueType / TaxCategory
  payroll-defaults.seed.ts        ← per-country default item settings (incl. NG rent relief)
  payroll-item-signature.ts       ← change detection on an employee's item set
  payroll-lock.ts                 ← run locking
  payroll-journal-posting.ts      ← GL posting
  payroll-import.utils.ts         ← bulk import
  payroll.read-cache.ts           ← read caching for the run loop
  payroll.service.ts              ← ~2060 LOC run orchestration
  employee/                       ← per-employee payroll record + payslip PDF + values util
  employee-item/  item/  item-group/  settings/item/  settings/tax-bracket/
  contribution/ (+ group/)        ← contribution types and employee grouping
  employee-statutory/  company-statutory/  statutory-manager/  statutory-table/
  statutory-remittance/           ← EPF / SOCSO-EIS / PCB / HRDF export file formats
  ea-form/  borang-e/             ← MY annual filings
```

### The country engine contract

`createPayrollCountryEngine(country)` returns a `PayrollCountryEngine` with:

- `getCountryLabel` / `getTaxLabel` / `getTaxBracketPrefix` / `getDefaultTaxBracketName`
  — **label-only**, and the *only* methods that currently branch on country.
- `getDefaultTaxBands`, `getDefaultPersonalReliefs`, `computeAnnualPersonalRelief`
- `capAnnualStatutoryReliefs`, `capNonEpfStatutoryReliefs`
- `calculateTaxDeduction`, `buildTaxBracketBreakdown`
- `calculateContributionAmount`, `calculateSkbbkEmployeeAmount`
- `calculateHrdfLevy`, `calcMonthlyItemRelief`
- `getCountrySpecificMasterSeeds`, `shouldSeedDefaultTaxBracket`

**Known state, stated plainly in the file's own comments:** `PayrollInstanceCountry.NIGERIA`
exists but every computation method is Malaysian statute. `resolvePayrollCountry()` ignores
its argument and always returns `MALAYSIA`. Nigeria works in `zerp-be development` only
because the *seed data* supplies NG bands and NG contribution groups into the generic
band-lookup and percentage paths — not because the engine knows about Nigeria.

Two env vars, easily confused:
- `tenant_country` — which engine this process runs (`NG` → Nigeria, anything else →
  Malaysia). Defaults to Malaysia.
- `seed_country` — gates one-time master-data seeding only, and **defaults to NG when unset**.

That asymmetry is deliberate but it is a trap: a tenant with neither var set runs the
Malaysia engine while seeding Nigerian master data.

## Country abstraction — where to extend

To make a country real, these must all be satisfied:

1. `calculateTaxDeduction` branches per country (bands + relief model + cumulative method).
2. `capAnnualStatutoryReliefs` / `capNonEpfStatutoryReliefs` express that country's cap model
   (Malaysia caps EPF and SOCSO+EIS; Nigeria caps nothing on pension/NHF but caps rent relief
   at the item level).
3. `calculateContributionAmount` knows that country's scheduled keys and **wage base per key**.
4. `getCountrySpecificMasterSeeds` seeds that country's statutory types.
5. Statutory remittance file formats exist for that country's agencies.
6. Annual filings exist (MY: EA + Form E/CP8D; NG: annual PAYE returns + Form H1).
7. Seeded tax brackets exist for the current **and next** year — payroll reads by `taxYear`
   alone, so a December run needs January's bracket already present.

Anything less and the country is a label.

## Cross-module dependencies

HR reaches into:
- `employee/`, `department/` (`forwardRef` — circular)
- `finance/` — payroll journal posting, chart of accounts, fiscal period locks
- `master/` — statutory types, master data trees
- `user/`, `auth/`, `access/`, `permission/` — ESS identity and HR permissions
- `notification/`, `upload/`, `template/` — payslips, letters, alerts
- `workflow/`, `approval/` — approval chains
- `company/`, `branch/`, `context/` — tenancy

Reached into HR from:
- `dashboard`, `report`, POS/sales commission, `zoom` (attendance-adjacent)

## Client side

- `zyncg-admin/src/modules/hr/*` — Next.js, `use<Feature>State()` + context, Apollo.
- `zyncg-admin/src/modules/ess/*` — employee self-service.
- `zyncg-staff-app` / `zyncg-app` — Expo, `src/modules/<feat>/{screen,context,gql}`.
- Rule that matters for HR: **the admin never recomputes payroll.** Any number shown must
  come from the server's stored run. An admin-side calculation is a defect by definition.

## Migrations

`src/migrations/` — HR-relevant precedent in `zerp-be`:
- `2026-08-04-purge-nigeria-contamination-from-malaysia.ts`
- `2026-08-06-fix-nigeria-pension-employer-rate.ts`

Both exist because country data leaked across tenants. Treat any new cross-country seed as
capable of the same and write the migration defensively (scope by tenant, never blanket-update).

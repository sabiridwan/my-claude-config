# HR test playbook

Jest 28 + `ts-jest`, specs colocated as `*.spec.ts`, mocks not a real DB
(`Test.createTestingModule({ providers: [{ provide: X, useValue: mockX }] })`).

`zerp-be` `dev-my` already carries ~70 HR specs. **Read and port those before writing new
ones** — they encode figures that were verified against published tables once already.

```bash
find /Users/sabiridwan/Projects/zerp/zerp-be/src/modules/hr -name "*.spec.ts"
```

---

## The rule: golden numbers, not smoke tests

A payroll test that asserts `expect(result.net).toBeGreaterThan(0)` is worse than no test —
it creates false confidence. Every payroll assertion must be an **exact figure a payroll
manager could reproduce by hand** from a published table or a worked example.

Every golden-number test carries a comment naming its source:

```ts
// PERKESO SOCSO schedule band 30 (wage 2,500.01–2,600.00), category 1:
// employer 44.65, employee invalidity 12.75, employee SKBBK 19.15, total 76.55.
```

If you cannot name the source, you have invented the number — go and find it in the country
skill, or mark the test `.todo` rather than assert a guess.

---

## Layer 1 — Country engine (pure functions). Do this first.

Cheapest and highest value: no Mongo, no Nest, no context.

`payroll-country.spec.ts`
- Every band boundary in `getDefaultTaxBands()`: exactly at, one minor unit below, one above.
- `deriveTaxBandBaseTax()` — cumulative correctness across all bands, and unsorted input.
- `computeAnnualPersonalRelief()` per `TaxCategory`, with 0 / 1 / many children.
- `capAnnualStatutoryReliefs()` — under cap, exactly at cap, over cap, unknown key passes
  through uncapped, and the non-EPF variant excluding EPF.
- `calcMonthlyItemRelief()` — the 4-way matrix of
  `{AMOUNT, PERCENTAGE} × {annual, monthly}` crossed with `TAX_RELIEF` and
  `isAdditionalRemuneration`. This is where the 1/12 bug lived; cover every cell.
- Non-resident flat-rate path: no reliefs, no rebate, bonus included.

`payroll-statutory-tables.spec.ts`
- Every band's published `total` reconciles with its components.
- Band boundaries: exact minimum, exact maximum, and the open top band.
- Age category switching at the statutory age.
- Foreign-worker rates where they differ.

`payroll-mtd.spec.ts` (or the equivalent cumulative-tax module for the country)
- Month 1 with no YTD.
- Mid-year with YTD — the accumulation and true-up.
- A month where the true-up is negative (over-withheld earlier) — does it floor at zero or
  refund? Assert the country's actual rule.
- Additional remuneration via the differential method.
- Rebate boundary — exactly at the chargeable-income threshold and one unit either side.
- Zakat / equivalent offsets, current and accumulated.

---

## Layer 2 — Payroll run assembly

`payroll.service.spec.ts` — mock the repositories, assert the produced lines.

Cases that must exist:

| Case | Assertion |
|---|---|
| Full month, salaried, no items | exact gross/statutory/tax/net |
| Joiner mid-month | prorated basic; identity `join-half + leave-half == full month` |
| Leaver mid-month | as above, plus encashment and loan settlement present |
| Unpaid leave, full month's worth | net deduction equals one full month |
| Bonus month | bonus taxed by the differential method, not annualised |
| Rate change mid-year | old months untouched, new months use the new rate |
| Rerun of an already-computed month | identical output; YTD not double-counted |
| Employee with no tax bracket for the year | explicit error, never silent zero tax |
| Locked/posted run | recompute rejected |
| Zero and negative net | handled explicitly, not NaN |
| Foreign / non-resident employee | country-correct rates and tax method |
| Employee aged over the statutory threshold | correct contribution category |

---

## Layer 3 — Statutory files and filings

A byte-wrong export is a rejected filing, so these are format tests, not value tests.

For each of `epf-file-format.ts`, `socso-eis-file-format.ts`, `pcb-file-format.ts`,
`hrdf-declaration-format.ts` (MY) and the NG equivalents:
- Fixed-width field positions and padding.
- Header/trailer record counts and control totals.
- Character-set and truncation rules for long names.
- A golden fixture file checked in, compared byte-for-byte.

Same for `ea-form/` and `borang-e/` (MY): assert the mapping from stored run to each box on
the form, including the boxes that are *sums of specific item categories* — that mapping is
where filings go wrong.

---

## Layer 4 — Leave, approvals, entitlement

`leave-rule.spec.ts` — every flag in `ILeaveTypeRules`, singly and in combination:
`singleDateOnly`, `allowHalfDay`, `halfDayOnly`, `minDuration`, `maxDuration`,
`requireAttachment`, `minAdvanceNoticeDays`. Assert that half days bypass duration bounds.

`leave.service.spec.ts`
- Balance derivation with carry-forward, adjustments, taken and pending.
- Pending request holds balance — two concurrent approvals cannot overdraw.
- Range spanning a public holiday and a rest day — those days are not leave days.
- Pro-rated entitlement for a joiner, including the rounding rule.
- Carry-forward expiry: lapse vs encash.
- Backdated request and the notice rule.

Approvals
- Requester is their own approver.
- Approver has left / is on leave — escalation.
- Reject releases held balance.
- Edit after approval is refused.
- Every transition writes an audit entry.

---

## Layer 5 — Attendance ingestion

Idempotency first, reporting second.

- Duplicate punch one second apart.
- Punches arriving out of order.
- Night shift crossing midnight — date attribution.
- Missing clock-out.
- Bulk backfill after device downtime — do reports for those dates recompute?
- Re-sync of a processed range — upsert, not duplicate.
- Device clock drift — a punch stamped in the future.

---

## Manual / end-to-end verification

Automated specs do not prove the product works for HR. Before calling a payroll release good:

1. Run a full month for a real tenant copy against last month's known-good output. **Diff
   every employee's net.** Any non-zero diff must have a named reason.
2. Regenerate last year's payslip PDF and compare to the archived one — proves
   reproduce-not-recompute (`domain.md` §10).
3. Export each statutory file and open it in the agency's validator or template.
4. Walk the ESS journey end to end: apply leave → approve → see it on the payslip.

Report results honestly, including diffs you could not explain. An unexplained one-cent diff
across 400 employees is a rounding bug, not noise.

---

## Running

```bash
npx jest src/modules/hr/payroll          # fast signal
npx jest src/modules/hr                  # full HR
npm run test:cov -- src/modules/hr       # coverage
```

Coverage percentage is not the goal. The goal is that every figure in the
`zync-hr-my` / `zync-hr-ng` tables is asserted somewhere, so the day a rate changes, exactly
one test fails and tells you where to edit.

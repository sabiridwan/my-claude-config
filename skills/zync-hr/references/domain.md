# HR & payroll domain rules — country-neutral

These are the rules that decide whether a design is right, independent of which country's
statute applies. Country figures live in `zync-hr-my` / `zync-hr-ng`.

## 1. The pay component model

Every amount on a payslip is an **item**, and every item must answer six questions before it
can be added to the system. If any answer is "we didn't decide", the item is wrong.

| Question | Consequence of getting it wrong |
|---|---|
| Earning or deduction? | sign errors, wrong net |
| Taxable, partly taxable, or exempt? | wrong withholding, employee owes at year end |
| Included in which statutory wage bases? | under/over-contribution, agency penalty |
| Ordinary pay or additional remuneration? | wrong tax method entirely |
| Frequency — monthly, annual, one-off? | 12× or 1/12 errors (the classic) |
| Prorated on partial months? | wrong joiner/leaver pay |

In this codebase those live on `PayrollItemSetting` (`settings/item/`) plus the per-employee
override in `employee-item/`. The engine helper is `calcMonthlyItemRelief()`.

**The 1/12 trap, documented in the code itself:** whether `amount` is still annual depends on
item type *and* `isAdditionalRemuneration`. `findActiveWithSettings` already smooths most
items to a month, but `TAX_RELIEF` items and additional remuneration keep the raw annual
figure. Dividing an already-monthly amount again produced an NHIS relief of 4,513.89/mo
instead of 54,166.67/mo. Any new item type must be classified into that rule explicitly.

## 2. Additional remuneration

Bonus, commission, arrears, ex-gratia, leave encashment. Distinct because:

- It is taxed by a **differential method** — tax the year with it, tax the year without it,
  withhold the difference — not by annualising it as if it recurred monthly.
- Its statutory treatment is per-contribution and per-country: some contributions include it,
  some exclude it, some include it up to a ceiling.
- It usually is not prorated.

`payroll-mtd.ts:calculateMtdOnAdditional()` implements the Malaysian version. Any country
added must supply its own; falling through to the ordinary path over-withholds badly.

## 3. Statutory wage bases

There is no single "gross" for statutory purposes. Each contribution has its own base:

- a subset of items (basic only / basic + named allowances / all cash pay)
- its own ceiling and floor
- its own treatment of additional remuneration
- its own age, nationality and residency conditions

**Audit probe:** find every call site that passes `salary`/`gross` into
`calculateContributionAmount` and confirm the value passed is that contribution's base, not
the payslip gross. This is the highest-yield single check in a payroll audit.

## 4. Published tables beat formulas

Statutory schedules are frequently published as band tables whose low bands do **not** match
the headline percentage. `payroll-statutory-tables.ts` says it outright: SOCSO band 1 charges
an employer share of RM0.40 where 1.75% of the midpoint gives RM0.25; EIS band 4 charges
RM0.20 against a formula result of RM0.15.

Rule: **if the agency publishes a table, hold the table verbatim.** A percentage
implementation of a banded schedule is wrong by construction, and it is wrong for the
lowest-paid employees — the ones most likely to notice and complain to the agency.

Corollary: tables must be seedable per tenant
(`payroll_statutory_contribution_tables`) so a rate change ships without a deploy. Built-in
constants are the fallback, and both must be updated together.

## 5. Proration

Pick one basis per tenant and apply it everywhere: joiners, leavers, unpaid leave, mid-month
salary change, mid-month transfer between entities.

Common bases: calendar days in month, working days in month, fixed 26 days, fixed 30 days.
Whichever is chosen, these must all reconcile:

```
prorated(join mid-month) + prorated(leave mid-month) == full month
sum(daily deductions for a full month of unpaid leave) == full month salary
```

That second identity is the test that catches a mixed basis. Write it.

## 6. Year-to-date is state, and reruns are where it breaks

Cumulative tax methods, relief caps and annual ceilings read YTD. Three failure modes:

1. **Rerun double-count** — recomputing month 7 while month 7's own figures are still in the
   YTD totals. The run must exclude its own prior version.
2. **Mid-year join** — an employee with prior employment elsewhere has YTD the system never
   saw. There must be an opening-balance mechanism, and the country's rule for whether prior
   employment counts must be honoured.
3. **Year rollover** — YTD reset, and next year's tax bracket must already exist. Payroll
   reads a bracket by `taxYear` alone, so a run in late December needs January's bracket
   seeded. `ngTaxBracketYears()` seeds current+next for exactly this reason.

## 7. Leave

Balance is **derived**: `entitlement + carry-forward + adjustments − taken − pending`.

Design points that generate bugs:
- Pro-rated entitlement for joiners, and whether it rounds up, down, or to a half day.
- Carry-forward cap and expiry date, and what happens to expired days (lapse vs encash).
- Half days and their interaction with `minDuration`/`maxDuration`
  (`leave-rule.ts` correctly exempts half days from duration bounds — preserve that).
- Whether a pending request holds balance. It must, or two approvals overdraw.
- Working-day computation must respect the branch calendar *and* the employee's shift/roster —
  a rest day inside a leave range is not a leave day.
- Unpaid leave must reach payroll as a deduction with the same proration basis as §5.
- Encashment on termination is additional remuneration (§2).

`leave-rule.ts` covers: `singleDateOnly`, `allowHalfDay`, `halfDayOnly`, `minDuration`,
`maxDuration`, `requireAttachment`, `minAdvanceNoticeDays` — enforced server-side in
`LeaveService.createLeave`, which manual/ESS/import all route through. Any new entry point
must go through the same method, not around it.

## 8. Attendance is untrusted input

Raw device punches (`attendance/device-sync/`, HikVision driver) arrive:
duplicated, out of order, with device clock drift, with missing OUTs, and across midnight.

Ingestion must be **idempotent and ordered** before anything downstream is trustworthy. Every
lateness, OT and absence figure inherits whatever ingestion decided. Specific probes:

- Two identical punches one second apart — one event or two?
- Night shift crossing midnight — which date does it belong to?
- Missing clock-out — absent, or full shift, or flagged for HR?
- Device offline then bulk-syncs three days — do reports recompute for those dates?
- Re-sync of an already-processed range — duplicates or upsert?

## 9. Termination is a payroll event

Not a status flip. It must trigger: final pay with proration, leave encashment, notice pay or
payment in lieu, outstanding loan/advance settlement, return of company property, final
statutory contributions and the country's leaver filing, and the cut-off for ESS access.

`employee-lifecycle/` models deactivate/reactivate with reason codes. Confirm the payroll
consequences actually fire from it rather than being a separate manual step someone forgets.

## 10. Payslips and reports reproduce, never recompute

A payslip PDF, an EA form, a Form E, an annual PAYE return — all must read the **stored run**.
If any of them calls the engine again, then changing a rate rewrites history and last year's
payslip stops matching last year's bank transfer.

`payslip-pdf.service.ts` / `payslip-values.util.ts` and `letter-pdf.service.ts` /
`letter-values.util.ts` are where to check this.

## 11. Approvals

One orchestrator (`approval-orchestrator/`, `approval-policy/`) serves leave, claim, advance,
loan, letter and roster-swap. Things to verify per flow:

- Approver resolution when the approver is the requester, is on leave, or has left.
- Whether an approved item can be edited (it must not, without re-approval).
- Whether a rejected item's held leave balance / budget is released.
- Delegation and escalation on timeout.
- `@AuditMeta()` on every state transition — an approval with no audit trail is worthless in
  a dispute.

## 12. Multi-tenancy and confidentiality

HR data is the most sensitive in the ERP. Two rules with no exceptions:

- Every repository query filters `companyId` (and `branchId` where the entity is branch-scoped).
  A missing filter on an HR collection is **Critical**, not Medium — it exposes salaries.
- Field-level access matters too: an ESS user reads their own records only; a manager reads
  their reports; only HR reads compensation. Check `hr-authorize.decorator.ts` and
  `entitlement-scope.service.ts` are actually applied, not merely defined.

## 13. Rounding

Decide once, at the money layer: round per component or round the total; round half up or
half even; round to the currency's minor unit or to the agency's published precision (some
agencies round contributions to the nearest 5 sen / whole naira).

The engine's `round()` is `Math.round(v * 100) / 100`. Anywhere a statutory agency specifies
different rounding, that agency's rule wins and must be implemented at that call site.

## 14. Anything shown to an employee is a promise

Payslip, leave balance, ESS claim status, letter. If the number changes after they saw it and
nobody told them, that is a trust incident. Immutability after issue, and an explicit
reissue/amendment path, is a product requirement — not a nicety.

# Nigeria — remittances, filings and the multi-state problem

Verified 2026-08-21. Confirm against the Nigeria Revenue Service and the relevant state IRS —
the 2025 Acts' administrative circulars are still landing through 2026.

## The multi-state problem — read this before designing anything

**PAYE is remitted to the state internal revenue service of the employee's state of
residence**, not the employer's head office and not the branch location.

`nigeria-seed.data.ts` flags this in its own comments and the seed is "data-only today",
meaning the *system does not yet act on it*. Consequences of getting it wrong:

- A company with staff in Lagos, Abuja (FCT-IRS), Rivers and Kano files **four** monthly
  returns, to four revenue services, each with its own portal, schedule format and reference
  numbering.
- Remitting everything to one state means the other states' employees have no tax credit — they
  cannot get a tax clearance certificate, and the employer is liable in the correct state for
  the whole amount plus penalties. The wrongly-paid state does not refund readily.
- The employee's state of residence can change mid-year.

**Product requirements this generates:**

1. `stateOfResidence` on the employee record, effective-dated.
2. Remittance schedules generated **per state**, with per-state totals and formats.
3. A per-state tax authority master with its own reference/payer ID for the company.
4. A validation that refuses to run remittance for an employee with no state of residence set.

If the system currently produces one national schedule, that is a **Critical** finding for any
multi-state Nigerian tenant.

## Monthly

| What | To | Due |
|---|---|---|
| PAYE remittance + schedule | state IRS of employee's residence | **10th** of the following month |
| Pension | employee's chosen PFA | within **7 working days** of salary payment |
| NHF | Federal Mortgage Bank of Nigeria | monthly |
| NSITF (Employees' Compensation) | NSITF | monthly |
| NHIA / HMO premium | the HMO | per scheme terms |

The 10th applies regardless of when in the month salaries were paid.

## Annual

| What | To | Due |
|---|---|---|
| **Form H1** — employer's annual PAYE return | state IRS | **31 January** |
| Employee individual returns (Form A) | state IRS | 31 March |
| ITF contribution | ITF | **31 March** |
| Employer's annual returns to PenCom (via PFA) | PenCom | per PenCom circular |

Form H1 reports each employee's annual emolument, reliefs claimed and PAYE remitted — the
Nigerian analogue of Malaysia's Form E + CP8D. Like every other output, it must map from the
**stored payroll run** and never recompute (`zync-hr/references/domain.md` §10).

Form H1 is also filed **per state**, matching the monthly schedules.

## Penalties — Nigeria Tax Administration Act 2025

- Late PAYE remittance: **₦25,000 penalty plus 10% per annum interest**.
- Administrative fines for certain failures: **₦50,000 for the first month** of infringement and
  **₦25,000 for each subsequent month**.
- Failure to deduct, or deducting and failing to remit, carries additional liability — the
  employer becomes liable for the tax itself, not merely a penalty.

Because penalties accrue monthly, a remittance-schedule bug compounds. Treat remittance
correctness as Critical severity.

## Employee documentation

| Document | What it is |
|---|---|
| **TIN / NIN** | required for the employee's tax record; the schedule is rejected or unmatched without it |
| **Tax Clearance Certificate (TCC)** | issued by the state IRS to the employee, evidencing 3 years of tax paid. Employees need it for visas, loans, property. It only exists if PAYE went to the **right** state |
| **PFA / RSA PIN** | the employee's pension account. Pension cannot be remitted without it |
| **NHF number** | required for NHF remittance |
| **HMO enrolment + dependants** | employee, one spouse, up to four children under 18 |
| **Rent relief evidence** | tenancy agreement, receipts, landlord name/contact/TIN-NIN |

Every one of these is a field the employee record must carry and payroll must validate before a
run. A missing RSA PIN is not a warning — it is a contribution that cannot be remitted.

## What a Nigerian payroll run should refuse to do

Make these hard validations, not warnings:

1. Run for an employee with **no state of residence** — PAYE cannot be routed.
2. Run for an employee with **no TIN/NIN** where the state requires it on the schedule.
3. Remit pension for an employee with **no RSA PIN**.
4. Use a tax bracket whose bands are the **PITA 2011 scale** for a period from January 2026.
5. Use a tax bracket carrying a **non-zero personal relief** (the CRA is abolished).
6. Compute pension on gross, or on a base failing the **one-third of total emolument** test.
7. Present an **employee-side NSITF** deduction — the Act forbids it.

Each of those is a defect that produces a legally wrong filing while the payroll run itself
looks perfectly healthy. They are exactly the class of bug that a "does payroll run?" smoke
test will never catch, which is why `zync-hr/references/test-playbook.md` insists on golden
numbers and format fixtures.

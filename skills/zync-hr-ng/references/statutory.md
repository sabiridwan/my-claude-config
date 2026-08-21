# Nigeria — statutory contributions and PAYE, in detail

Verified 2026-08-21. Primary sources: Nigeria Tax Act 2025 and Nigeria Tax Administration Act
2025 (in force 1 January 2026), Pension Reform Act 2014, National Housing Fund Act,
Employees' Compensation Act 2010, Industrial Training Fund Act, National Health Insurance
Authority Act 2022, National Minimum Wage (Amendment) Act 2024.

The 2025 Acts are new and administrative guidance is still being issued through 2026.
Re-verify anything you are about to compute money with.

---

## PAYE under the Nigeria Tax Act 2025

### Bands (annual chargeable income, ₦)

| From | To | Rate |
|---|---|---|
| 0 | 800,000 | 0% |
| 800,000 | 3,000,000 | 15% |
| 3,000,000 | 12,000,000 | 18% |
| 12,000,000 | 25,000,000 | 21% |
| 25,000,000 | 50,000,000 | 23% |
| 50,000,000 | — | 25% |

Stated in the Act as: first ₦800,000 at 0%; next ₦2,200,000 at 15%; next ₦9,000,000 at 18%;
next ₦13,000,000 at 21%; next ₦25,000,000 at 23%; above ₦50,000,000 at 25%.

Code: `NG_TAX_BRACKET_BANDS` in `zerp-be/src/plugins/nigeria/seed/nigeria-seed.data.ts`.
`baseTax` is intentionally absent and derived by `deriveTaxBandBaseTax()` so a hand-typed
cumulative figure cannot drift from the rates above it.

Bracket name: `Nigeria PAYE <year>`. `ngTaxBracketYears()` seeds **current and next** year,
because payroll reads a bracket by `taxYear` alone and a December run needs January's bracket.

### The old scale, for recognition only

PITA 2011: first ₦300,000 @7%, next ₦300,000 @11%, next ₦500,000 @15%, next ₦500,000 @19%,
next ₦1,600,000 @21%, above ₦3,200,000 @24%. **If you see this in a live tenant's bracket, it
is stale and PAYE is wrong from January 2026 onward.** Seeds never overwrite operator data, so
hand-entered brackets survive a seed run — they must be found and fixed per tenant.

### Chargeable income

```
gross emolument
  − pension (employee 8%)
  − NHF (employee 2.5%)
  − NHIS / NHIA contribution
  − life assurance premium
  − rent relief (lower of 20% of annual rent paid and ₦500,000)
  = chargeable income
```

**No Consolidated Relief Allowance.** The 2025 Act abolished it. `individualRelief`,
`spouseRelief` and `perChildRelief` on a Nigerian tax bracket must be **0** — a non-zero value
under-deducts PAYE for every employee on that bracket.

**Pension and NHF must reach the calculation uncapped.** In the shared engine they arrive at
`capAnnualStatutoryReliefs()` keyed `pension`/`nhf`, which are unscheduled keys there and so
pass through the uncapped fallback branch. Correct for Nigeria — and dependent on that branch
staying uncapped. Adding those keys to a cap table for any reason breaks Nigerian PAYE.

**Rent relief is modelled as a payroll item**, seeded via `NIGERIA_ITEM_SETTINGS` in
`payroll-defaults.seed.ts`, and flows through `calcMonthlyItemRelief()`. Two consequences:

1. If a tenant lacks the item, PAYE over-deducts and nobody notices until an employee complains.
2. The ₦500,000 cap is `maxTaxRelief` on the item, and the 20% is a `PERCENTAGE` relief — so
   the annual/monthly classification in `calcMonthlyItemRelief()` decides whether the relief is
   right or off by 12×. `TAX_RELIEF` items keep the raw annual figure; that is why the branch
   exists. Test it (`zync-hr/references/test-playbook.md` Layer 1).

### Evidence requirements for rent relief

Employee must supply: tenancy agreement, rent receipts, and the landlord's name, contact and
Tax ID/NIN. Product shape: an HR-verified employee declaration with document attachments and an
effective period, not a number typed into a salary field.

### Exemption

Annual income up to **₦800,000** attracts no tax (the 0% band). A minimum-wage-linked exemption
also exists in the Act — confirm its precise operation before relying on it for employees near
the floor.

---

## Pension — Pension Reform Act 2014

| Party | Rate |
|---|---|
| Employee | **8%** |
| Employer | **10%** minimum |

Applies to employers with **3 or more** employees. An employer may elect to bear the whole
contribution (minimum 20% in that case) or contribute above the floor.

### Pensionable emolument — the trap

The base is **basic salary + housing allowance + transport allowance**, with a statutory floor:
it must be at least **one-third of total emolument**, failing which total emolument becomes the
base. Neither gross nor basic-alone is correct.

Practical implication for the item model: the payroll item settings must carry a per-item flag
for "included in pensionable emolument", and the engine must compute the one-third test each
period rather than trusting a static base.

**The employer rate in live data may exceed the floor.** `zerp-be`'s seed keeps
`NG_STATUTORY_RATES.pension.employerRate` at the statutory 0.10 while the company's own
contribution group uses **11%** — the company's elected rate. The seed comments say so
explicitly. Do not normalise a company's higher rate down; a migration
(`2026-08-06-fix-nigeria-pension-employer-rate.ts`) already exists from getting this wrong once.

Remittance: to the employee's chosen PFA within **7 working days** of paying salary.

---

## NHF — National Housing Fund

Employee contributes **2.5% of monthly basic salary**. No employer contribution. Employer
deducts and remits to the Federal Mortgage Bank of Nigeria.

Base is **basic salary**, not gross and not pensionable emolument. Three contributions, three
different bases — this is the concrete reason `zync-hr/references/domain.md` §3 exists.

Applies to employees earning ₦3,000 per annum or more, i.e. effectively everyone.

---

## NSITF / Employees' Compensation Act 2010

Employer contributes **1% of total monthly payroll** to the Employees' Compensation Fund.

**Employer-only. The Act expressly forbids deducting it from the employee's remuneration,
directly or indirectly.** If the system exposes an employee-side NSITF percentage, that is a
compliance defect, not a configuration option.

Covers death, injury, disability and occupational disease arising from employment.

---

## ITF — Industrial Training Fund

Employer contributes **1% of annual payroll**, where the employer has **5 or more employees**
or annual turnover of **₦50 million or more**.

Annual, due **31 March**. Employers who train staff can apply for a partial refund — which
means training records (`hr/training/`) have a compliance purpose in Nigeria, not just an HR one.

---

## NHIA — National Health Insurance Authority Act 2022

Health insurance is **mandatory**. Employers with **5 or more staff** must enrol employees in an
NHIA-approved plan covering the **employee, one spouse and up to four children under 18**.

Contribution split varies by scheme; the commonly cited formal-sector split is employer 10% /
employee 5% of basic salary, but the operative figures come from the specific HMO/scheme.
Verify per tenant rather than hardcoding.

Employer obligations: HMO registration, timely contributions, and record-keeping. Penalties for
non-compliance apply.

---

## Statutory keys seeded in the codebase

From `nigeria-seed.data.ts`:

```
statutory types: pension, nhf, nsitf, itf, paye
NG_STATUTORY_RATES:
  pension { employeeRate: 0.08, employerRate: 0.10 }
  nhf     { employeeRate: 0.025, employerRate: 0 }
  nsitf   { employeeRate: 0,     employerRate: 0.01 }
  itf     { employeeRate: 0,     employerRate: 0.01 }
contribution group (company's elected rates):
  pension 8 / 11,  nhf 2.5 / 0,  nsitf 0 / 1,  itf 0 / 1
```

**PAYE is deliberately absent from the contribution group** — it is tax computed from bands,
never a contribution percentage. If PAYE ever appears as a contribution row, something has
been modelled wrong.

Note these are seeded as **percentage** contributions, not `ContributionValueType.TABLE`.
Nigeria has no published band tables, so that is correct — but it also means Nigerian
contributions do **not** pass through `MALAYSIA_SCHEDULED_KEYS`, and an operator can therefore
edit a Nigerian statutory rate to a wrong value in the UI. Deciding whether to lock them is an
open product question worth raising.

---

## Rounding and currency

Naira amounts are large; the engine's two-decimal `round()` produces kobo. Decide per tenant
whether payslips and remittance schedules present kobo or whole naira, and make the remittance
schedule match what the state IRS portal expects. A schedule that totals differently from the
payment is queried.

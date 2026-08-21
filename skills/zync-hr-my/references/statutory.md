# Malaysia — statutory contributions and tax, in detail

Verified 2026-08-21. Re-verify after any federal budget or agency circular.
Primary sources: KWSP (kwsp.gov.my), PERKESO (perkeso.gov.my), LHDN (hasil.gov.my),
HRD Corp (hrdcorp.gov.my).

---

## EPF / KWSP — Employees Provident Fund Act 1991

**Rates (Malaysian citizens and PRs, below age 60)**

| Monthly wages | Employee | Employer |
|---|---|---|
| ≤ RM5,000 | 11% | **13%** |
| > RM5,000 | 11% | **12%** |

Age 60 and above: reduced rates apply — confirm the current KWSP schedule; the rule has been
revised more than once.

**Non-citizen employees:** mandatory from **October 2025** at **2% employer / 2% employee**.
Before that it was voluntary at RM5/month employer. `ContributionContext.isForeigner` carries
this; `isMalaysianNationality()` decides it.

**Wages** for EPF are as defined in the Act — salary, bonus, commission, allowances, incentive
payments, arrears, paid leave. Excluded: service charge, overtime, gratuity, retirement
benefits, retrenchment/termination benefits, travelling allowance, director's fees paid to a
non-employee director. *Overtime is excluded from EPF but included in SOCSO wages* — this
asymmetry is exactly why one `gross` for all contributions is wrong.

**Contribution table:** KWSP publishes a table with RM20 wage steps below a threshold. Amounts
are derived from the table, not a raw multiplication, and rounded to the next ringgit in the
published manner. If the implementation multiplies and rounds itself, verify a sample of low
wages against the published table.

---

## SOCSO / PERKESO — Employees' Social Security Act 1969 (Act 4)

Two schemes: **Employment Injury** (employer only) and **Invalidity** (shared). The employee
share also carries **SKBBK** — the Non-Employment Injury Security Scheme, 24-hour protection.

| Category | Who | Composition |
|---|---|---|
| **Category 1** | employee under 60 | employer: Employment Injury + Invalidity. employee: Invalidity + SKBBK |
| **Category 2** | employee 60 and over | employer: Employment Injury. employee: SKBBK. **No invalidity** |

Headline rates: employer **1.75%**, employee **0.5%**. **Wage ceiling RM6,000**, raised from
RM4,000 with effect from **October 2024**.

### Why the table, not the percentage

`payroll-statutory-tables.ts` holds all 65 bands verbatim, with this justification:

> Band 1 (wages up to RM30) charges an employer share of RM0.40 where 1.75% of the band
> midpoint gives RM0.25; EIS band 4 charges RM0.20 against a formula result of RM0.15.

The published low bands do not follow the formula. A percentage implementation is wrong by
construction for those bands. Band 65 is the open top band (every wage above RM6,000) and
repeats band 64's amounts.

Row shape in code:
`[no, maxWage, c1Employer, c1Invalidity, c1Skbbk, c1Total, c2Employer, c2Skbbk, c2Total]` —
the published totals are kept alongside the components so a spec can reconcile them.

**Coverage:** all employees regardless of wage. Foreign workers are covered under Employment
Injury (domestic servants excluded). Self-employed have a separate scheme.

---

## EIS / SIP — Employment Insurance System Act 2017 (Act 800)

Employer **0.2%**, employee **0.2%**, wage ceiling **RM6,000**, published band table
(`EIS_ROWS`, same verbatim treatment as SOCSO).

**Not applicable to non-citizen employees.** Also excludes those aged 57+ who have never
contributed, and public-sector employees.

---

## PCB / MTD — Income Tax Act 1967, Rule 3 of the Income Tax (Deduction from Remuneration) Rules

### Resident individual bands (YA2024/YA2025 scale)

`baseTax` is the cumulative tax at the band's lower boundary.

| Chargeable income (RM) | Rate | baseTax |
|---|---|---|
| 0 – 5,000 | 0% | 0 |
| 5,000 – 20,000 | 1% | 0 |
| 20,000 – 35,000 | 3% | 150 |
| 35,000 – 50,000 | 6% | 600 |
| 50,000 – 70,000 | 11% | 1,500 |
| 70,000 – 100,000 | 19% | 3,700 |
| 100,000 – 400,000 | 25% | 9,400 |
| 400,000 – 600,000 | 26% | 84,400 |
| 600,000 – 2,000,000 | 28% | 136,400 |
| above 2,000,000 | 30% | 528,400 |

`deriveTaxBandBaseTax()` recomputes `baseTax` from the rates so a hand-typed cumulative value
can never drift. Use it whenever bands are written; never trust a client-supplied `baseTax`.

### Reliefs used in the MTD computation

| Relief | Annual (RM) | Constant |
|---|---|---|
| Individual | 9,000 | `MALAYSIA_INDIVIDUAL_RELIEF` |
| Spouse (not working) | 4,000 | `MALAYSIA_SPOUSE_RELIEF` |
| Child, unmarried under 18 | 2,000 each | `MALAYSIA_CHILD_RELIEF` |
| EPF cap | 4,000 | `MALAYSIA_EPF_RELIEF_CAP` |
| SOCSO + EIS combined cap | 350 | `MALAYSIA_SOCSO_EIS_RELIEF_CAP` |

Reliefs beyond these (lifestyle, medical, education, insurance, SSPN…) exist in the annual
return but reach MTD only where the employee files a **TP1** with the employer. If the product
supports TP1, those reliefs must flow into `itemMonthlyTaxRelief`; if not, say so — the
employee reclaims at year end.

The engine caps EPF and SOCSO+EIS by statutory key and lets **unscheduled keys pass through
uncapped** (`capMalaysiaStatutoryReliefs`). That is deliberate; adding a new key without
deciding its cap silently gives it unlimited relief.

`capNonEpfStatutoryReliefs` exists because `calculateMonthlyMtd` derives EPF relief itself
from `currentEpf`/`ytdEpf`. Passing EPF through both paths **double-subtracts it from P**.

### Section 6A rebate

RM400 against tax where annual chargeable income ≤ RM35,000, floored at zero
(`MALAYSIA_REBATE`). Applies to the resident path only.

### Non-resident

Flat **30%** on total remuneration including bonus. No reliefs, no rebate, no accumulation
(`calculateNonResidentTax`). Residency is the 182-day test, and the flat rate applies until
residency is established — a mid-year status change needs an explicit correction path.

### Zakat

- Accumulated (prior-month) zakat stays **inside** the `/(n+1)` numerator.
- Current-month zakat offsets PCB **ringgit-for-ringgit after rounding**.

Reversing that order changes the withheld amount. It is asserted in `payroll-mtd.spec.ts`
upstream — port that test.

### The two calculation paths

| Path | When | Function |
|---|---|---|
| Official cumulative MTD | `payMonth` supplied — always true on the production run loop | `calculateMonthlyMtd` |
| Simplified annualised estimate | no pay-period context — ad-hoc previews only | `buildAnnualizedTaxCalculator` |

If a production code path ever reaches the annualised estimate, that is a **Critical** finding:
previews and payslips will disagree.

---

## HRD Corp levy — PSMB Act 2001

- **1%** of basic salary + fixed allowances for employers with 10 or more Malaysian employees.
- **0.5%** for employers with 5–9 Malaysian employees who opt in.
- **Employer cost only.** Never deduct it from an employee.
- **Base excludes** overtime, bonus and commission (`HrdfLevyInput.base`).
- Eligibility by wage category: **Expatriates excluded**, Foreign and Local included.
- Registration is mandatory once the headcount threshold is crossed, by sector.

---

## Rounding

The engine's generic `round()` is `Math.round(v * 100) / 100`. Where an agency publishes its
own rounding (EPF rounds contributions up to the next ringgit in its table; PCB is rounded to
the nearest 5 sen in the published method), that agency's rule wins at that call site. A
generic two-decimal round applied where the agency rounds differently produces a file the
agency rejects on reconciliation.

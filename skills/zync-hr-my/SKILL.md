---
name: zync-hr-my
description: Malaysia HR, payroll and employment-law specialist for the ZyncGold/zerp platform. Use for anything Malaysian-statutory — EPF/KWSP, SOCSO/PERKESO, EIS/SIP, SKBBK, PCB/MTD and the LHDN Computerised Calculation Method, personal reliefs and the section 6A rebate, zakat, HRD Corp levy, Form EA, Form E, CP8D, e-Invoice for employment income, Employment Act 1955 (annual/sick/hospitalisation/maternity/paternity leave, 45-hour week, overtime rates, flexible work arrangements under ss.60P-60Q), minimum wage, foreign-worker and expatriate rules, Industrial Relations Act termination and retrenchment, PDPA employee data. Trigger on "Malaysia payroll", "EPF", "KWSP", "SOCSO", "PERKESO", "EIS", "PCB", "MTD", "Borang E", "EA form", "CP8D", "HRDF", "HRD Corp", "zakat", "RM1700", "Employment Act", "MY tenant", "dev-my", or any HR question where the employer is Malaysian. Load zync-hr first for architecture and audit method; this skill supplies the statute.
---

# Malaysia HR & payroll — statute pack

Companion to `zync-hr` (architecture, audit method, domain rules). This skill supplies
**Malaysian legal figures and rules only**.

**Figures verified 2026-08-21.** Anything older than a Malaysian federal budget cycle
(tabled ~October, effective the following January) must be re-verified before it is used to
compute money. Say so when you quote one.

## Where Malaysia lives in the code

| Repo | Path |
|---|---|
| `zyncg-server` | `src/modules/hr/payroll/` — the whole engine is Malaysian |
| `zerp-be` `dev-my` | same, plus MY-only `borang-e/`, `ea-form/`, `company-statutory/`, `payroll-mtd.ts`, `payroll-tax-bands.ts` |
| `zerp-admin` `dev-my` | `src/modules/hr/payroll/company-statutory/`, `employee-ea-form/` |

`dev-my` is the Malaysia variant branch. Merging `development` into it must never alter MY
payroll behaviour — that gate is `zerp-merge-to-my`'s job, and it blocks the push.

## The five statutory deductions

| # | Name | Employee | Employer | Base / ceiling | Authority |
|---|---|---|---|---|---|
| 1 | **EPF / KWSP** | 11% | 13% (wages ≤ RM5,000) / 12% (wages > RM5,000) | EPF Act 1991 "wages" definition; **contribution table, not a raw percentage** | KWSP |
| 2 | **SOCSO / PERKESO** | 0.5% | 1.75% | **Published band table**, wage ceiling RM6,000 (raised from RM4,000, Oct 2024) | PERKESO, Act 4 (1969) |
| 3 | **EIS / SIP** | 0.2% | 0.2% | **Published band table**, ceiling RM6,000 | PERKESO, Act 800 (2017) |
| 4 | **PCB / MTD** | per MTD calculation | — | chargeable income after reliefs | LHDN, Income Tax Act 1967 |
| 5 | **HRD Corp levy** | — | 1% of basic + fixed allowances (0.5% for some categories) | employer cost only, never an employee deduction | PSMB Act 2001 |

Total employer on-cost is roughly **15–16% of salary**.

Detail, band-table mechanics and the traps: `references/statutory.md`.

### Rules the engine already encodes — preserve them

- **EPF/SOCSO/EIS are forced onto the statutory schedule** regardless of how an operator
  configured the contribution's value type (`MALAYSIA_SCHEDULED_KEYS` in `payroll-country.ts`).
  This is correct. Any new statutory key must be added to that set.
- **SOCSO band tables are held verbatim**, because the published low bands do not follow the
  percentage. `payroll-statutory-tables.ts` documents two concrete counter-examples. Never
  "simplify" them into a formula.
- **SKBBK** (Non-Employment Injury Scheme, "24-hour protection") is a *component* of the
  employee SOCSO share, itemised by `calculateSkbbkEmployeeAmount()` — never a separate
  contribution.
- **Category 1 vs 2**: under 60 pays Employment Injury + Invalidity + SKBBK; 60 and over pays
  Employment Injury + SKBBK, no invalidity.
- **Foreign workers**: EPF became mandatory for non-citizen employees at **2% employer / 2%
  employee from October 2025**. SOCSO covers foreign workers (excluding domestic servants);
  EIS does not cover non-citizens. `isMalaysianNationality()` is the single source of truth
  for citizen detection, and it treats unknown nationality as Malaysian — a safe default that
  never auto-applies a foreigner rule to an employee whose nationality was never captured.
- **HRD Corp levy base excludes OT, bonus and commission**, and Expatriates are excluded from
  eligibility while Foreign and Local workers are included (`HrdfLevyInput.isEligible`).

## PCB / MTD

Malaysia does **not** withhold a flat percentage. `payroll-mtd.ts` implements LHDN's
**Computerised Calculation Method** — cumulative accumulation plus a monthly true-up:

- YTD gross, YTD EPF and YTD MTD already paid feed each month's calculation.
- Remaining months divisor is `(n+1)`.
- Additional remuneration (bonus, commission, arrears, director's fee) uses the **differential
  method** — `calculateMtdOnAdditional()`, never the ordinary monthly path.
- **Non-residents**: flat 30% on total remuneration including bonus. No reliefs, no rebate,
  no accumulation (`MALAYSIA_NON_RESIDENT_RATE`).
- **Section 6A rebate**: RM400 against tax where annual chargeable income ≤ RM35,000, floored
  at zero.
- **Zakat**: accumulated zakat stays inside the `/(n+1)` numerator; current-month zakat offsets
  PCB ringgit-for-ringgit *after* rounding. Getting that order wrong changes the result.

Relief caps applied when computing chargeable income:

| Relief | Annual cap |
|---|---|
| Individual | RM9,000 |
| Spouse (not working) | RM4,000 |
| Per unmarried child under 18 | RM2,000 |
| EPF / approved provident fund | RM4,000 |
| SOCSO + EIS combined | RM350 |

These are the engine's legal defaults (`MALAYSIA_*_RELIEF*` constants). The run loop always
reads the **configured** tax-bracket values, so a bracket seeded with zeros computes PCB with
no personal relief. Never seed a bracket without them.

Resident individual tax bands (YA2024/YA2025 scale, `MALAYSIA_RESIDENT_BANDS`) are in
`references/statutory.md` with the full band list and each band's `baseTax`.

## Annual filings

| Form | What | Who | Deadline |
|---|---|---|---|
| **Form EA** (C.P.8A) | per-employee statement of remuneration | employer → employee | **28 February** |
| **Form E** (C.P.8) | employer's return of employees and remuneration | employer → LHDN | **31 March** (e-Filing commonly extended to 30 April — confirm the year's LHDN notice) |
| **CP8D** | per-employee breakdown accompanying Form E | employer → LHDN via MyTax | with Form E |
| **CP21 / CP22 / CP22A / CP39** | leaver clearance, new hire, cessation, monthly PCB remittance | employer → LHDN | see `references/filings.md` |

Penalties for late or inaccurate Form E/EA reach **RM20,000 or imprisonment**. Treat filing
correctness as Critical severity in any audit.

Code: `ea-form/` and `borang-e/`. Monthly statutory files: `statutory-remittance/` —
`epf-file-format.ts`, `socso-eis-file-format.ts`, `pcb-file-format.ts`,
`hrdf-declaration-format.ts`.

## Employment Act 1955 — what payroll and leave must honour

All private-sector employees are covered regardless of salary (2022 amendment, in force
1 Jan 2023). Summary here; full detail in `references/employment-act.md`.

| Entitlement | Statutory minimum |
|---|---|
| Minimum wage | **RM1,700/month** (from 1 Feb 2025; employers with <5 employees from 1 Aug 2025) |
| Working hours | **45 hours/week** (reduced from 48) |
| Annual leave | 8 days (<2 yrs) / 12 days (2–5 yrs) / 16 days (>5 yrs) |
| Sick leave (non-hospitalised) | 14 / 18 / 22 days by tenure |
| Hospitalisation leave | 60 days, **separate from** sick leave |
| Maternity leave | **98 consecutive days** paid |
| Paternity leave | **7 days**, married male employee, 12 months' service, up to 5 births |
| Flexible work arrangements | statutory right to *apply* under ss.60P–60Q; employer must respond **within 60 days** |
| Overtime | 1.5× normal hourly rate on a normal working day; higher on rest days and public holidays — see reference |

The separation of sick leave from hospitalisation leave is the one most often modelled wrong:
they are two distinct entitlements, not one pool.

## Malaysia-specific audit checklist

Score the codebase against this. Every "no" is a finding with a money or filing consequence.

1. SOCSO and EIS computed from the **published tables**, not percentages?
2. SOCSO/EIS ceiling at **RM6,000**, not RM4,000?
3. EPF employer rate switches at the **RM5,000** wage boundary?
4. Foreign-worker EPF at **2%/2%** since Oct 2025, and EIS excluded for non-citizens?
5. SOCSO category switches at age **60**?
6. MTD is the **cumulative** method with YTD, not an annualised estimate, on the production path?
7. Bonus routed through the **differential** method?
8. Non-resident flat **30%**, no reliefs, no rebate?
9. Section 6A rebate applied at **RM35,000** chargeable income?
10. Relief caps: EPF **RM4,000**, SOCSO+EIS **RM350**?
11. Tax bracket seeded for the **current and next** year, with non-zero personal reliefs?
12. HRD Corp levy on **basic + fixed allowances only**, employer-only, Expatriates excluded?
13. Zakat ordering: accumulated inside `/(n+1)`, current-month offset after rounding?
14. Form EA and Form E/CP8D map from the **stored run**, never a recompute?
15. Sick and hospitalisation leave modelled as **separate** entitlements?
16. Annual leave tiers at 2 and 5 years of service?
17. Minimum-wage floor enforced or at least warned on, at **RM1,700**?
18. Maternity 98 days / paternity 7 days with the eligibility conditions?
19. FWA request tracked with the **60-day** employer response clock?
20. Weekly hours capped at **45** in OT computation?

## Watch list — things that change and will break the numbers

- Federal budget each October → tax bands, reliefs, rebate thresholds effective January.
- EPF Act amendments and dividend/contribution announcements.
- PERKESO ceiling reviews (RM4,000 → RM6,000 happened in Oct 2024; expect further reviews).
- Foreign-worker EPF phase-in beyond the initial 2%.
- Minimum-wage order revisions.
- Progressive Wage Policy expansion from voluntary to something broader.
- **LHDN e-Invoice** rollout reaching employment-related payments and benefits — this is the
  most likely near-term structural change to Malaysian payroll integration. Track its phase
  dates and whether employment income/perquisites fall in scope for the tenant's revenue band.
- EPF/SOCSO/EIS file-format revisions — a format change silently fails the upload, not the run.

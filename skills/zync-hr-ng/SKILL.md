---
name: zync-hr-ng
description: Nigeria HR, payroll and employment-law specialist for the ZyncGold/zerp platform. Use for anything Nigerian-statutory — PAYE under the Nigeria Tax Act 2025 (in force 1 January 2026), the six new tax bands, Rent Relief Allowance replacing the Consolidated Relief Allowance, pension under the Pension Reform Act 2014 (8% employee / 10% employer on basic+housing+transport), NHF 2.5%, NSITF/Employees Compensation 1%, ITF 1%, NHIA Act 2022 health insurance, state IRS remittance and Form H1 annual returns, Labour Act leave and termination rules, national minimum wage, and the Nigeria Tax Administration Act 2025 penalties. Trigger on "Nigeria payroll", "PAYE", "NTA 2025", "Nigeria Tax Act", "rent relief", "CRA", "consolidated relief", "PenCom", "PFA", "NHF", "NSITF", "ITF", "NHIA", "NHIS", "Form H1", "state IRS", "Labour Act", "NG tenant", "naira payroll", or any HR question where the employer is Nigerian. Load zync-hr first for architecture and audit method; this skill supplies the statute.
---

# Nigeria HR & payroll — statute pack

Companion to `zync-hr` (architecture, audit method, domain rules). This skill supplies
**Nigerian legal figures and rules only**.

**Figures verified 2026-08-21.** The Nigeria Tax Act 2025 came into force **1 January 2026**
and is the largest personal-tax change in over a decade — anything written before 2026 about
Nigerian PAYE is wrong. Re-verify before computing money, and say when a figure needs it.

## Where Nigeria lives in the code — and what it is not

| Repo / branch | Reality |
|---|---|
| `zerp-be` `development` | Nigeria via **`src/plugins/nigeria/seed/`** — a *data seed*, not an engine |
| `zyncg-server` | `PayrollInstanceCountry.NIGERIA` exists but is **label-only**. No `src/plugins`. `payroll-defaults.seed.ts` has `NIGERIA_ITEM_SETTINGS` but every calculation path is Malaysian statute |

State this plainly whenever someone asks whether ZyncGold supports Nigeria. `payroll-country.ts`
says so in its own comments: `resolvePayrollCountry()` ignores its argument and always returns
`MALAYSIA`; the country enum branches only on labels
(`getCountryLabel` / `getTaxLabel` / `getTaxBracketPrefix` / `getDefaultTaxBracketName`).

Nigeria "works" on `zerp-be development` because the seeded data supplies NG bands and NG
contribution-group percentages into the *generic* band-lookup and percentage paths — not
because the engine models Nigeria. That arrangement is fragile in a specific way:

- **Rent relief is an item, not a bracket relief.** Seeded in `payroll-defaults.seed.ts` as a
  `TAX_RELIEF` payroll item capped in naira. It reaches PAYE through `calcMonthlyItemRelief()`.
  If the item is missing or misconfigured on a tenant, PAYE **over-deducts** silently.
- **Pension and NHF pass through `capAnnualStatutoryReliefs()` uncapped** because they are
  unscheduled keys there. That is the correct Nigerian treatment and it is *accidental* — it
  works because the function's fallback branch is uncapped. Adding a cap for another purpose
  would break Nigeria.
- **Personal reliefs must stay 0.** The 2025 Act abolished the Consolidated Relief Allowance.
  A non-zero `individualRelief` on an NG bracket **under-deducts PAYE for every employee**.

The two env vars are a live trap: `tenant_country` picks the engine and **defaults to Nigeria**
since `f8aa622e` (2026-08-21), which inverted it — before that it defaulted to Malaysia, and a
tenant relying on the default silently changed country when that commit shipped. Resolution is
now: explicit `tenant_country` wins, else a `tenant_key` in `msgold_seed_tenant_keys` (default
`"msgold,msgd"`) means Malaysia, else Nigeria. Note the consequence for a MALAYSIAN tenant whose
key is not in that list — it now runs the Nigeria engine against whatever bands it holds;
`seed_country` gates master-data seeding and **defaults to NG when unset**. Since both now
default to NG, the trap has moved: it is the MALAYSIAN tenant that is exposed — one whose
`tenant_key` is missing from `msgold_seed_tenant_keys` runs the Nigeria engine AND seeds
Nigerian master data, silently, from the moment it is created. Two `zerp-be` migrations exist
because the earlier version of this leaked in the other direction:
`2026-08-04-purge-nigeria-contamination-from-malaysia.ts` and
`2026-08-06-fix-nigeria-pension-employer-rate.ts`.

## PAYE — Nigeria Tax Act 2025, Fourth Schedule, in force 1 January 2026

Annual bands. The Act states them as "first/next"; these are the same figures as absolute
bounds, which is what the band lookup expects.

| Annual chargeable income (₦) | Rate |
|---|---|
| 0 – 800,000 | **0%** |
| 800,000 – 3,000,000 | 15% |
| 3,000,000 – 12,000,000 | 18% |
| 12,000,000 – 25,000,000 | 21% |
| 25,000,000 – 50,000,000 | 23% |
| above 50,000,000 | 25% |

`baseTax` is deliberately absent from the seed and derived with `deriveTaxBandBaseTax()`.

**This is NOT the old PITA 2011 scale** (300k@7% / 300k@11% / 500k@15% / 500k@19% /
1.6m@21% / >3.2m@24%). Tenants onboarded before the seed existed may still carry hand-entered
PITA brackets, and a seed never overwrites operator data — so **check every live NG tenant's
bracket rows**, don't assume the seed fixed them.

### What replaced the Consolidated Relief Allowance

| Deduction | Rule |
|---|---|
| **Rent Relief Allowance** | lower of **20% of annual rent paid** and **₦500,000** |
| Pension (employee 8%) | deductible, uncapped |
| NHF (employee 2.5%) | deductible, uncapped |
| NHIS / NHIA contributions | deductible |
| Life assurance premiums | deductible |
| **Consolidated Relief Allowance** | **abolished** |

Rent relief requires evidence from the employee — tenancy agreement, receipts, landlord's name,
contact and TIN/NIN. That is a product requirement: a document-backed, HR-verified employee
declaration that feeds payroll, not a free-text number.

Employees earning **₦800,000 or less annually are exempt**. There is also a minimum-wage-linked
exemption; confirm its exact operation for the tenant's wage levels before relying on it.

## The other statutory contributions

| Contribution | Employee | Employer | Base | Applies when | Authority |
|---|---|---|---|---|---|
| **Pension** | **8%** | **10%** | **basic + housing + transport** — not gross | employer has ≥3 employees | PenCom, Pension Reform Act 2014 s.4(1) |
| **NHF** | **2.5%** | — | monthly basic salary | employees earning ≥ ₦3,000/yr | FMBN, NHF Act |
| **NSITF / Employees' Compensation** | — | **1%** | total monthly payroll | all employers | NSITF, Employees' Compensation Act 2010 |
| **ITF** | — | **1%** | annual payroll | ≥5 employees or ≥₦50m turnover | ITF Act |
| **NHIA** | employer/employee split by scheme | — | basic salary | employers with ≥5 staff (NHIA Act 2022) | NHIA |

**The pension base is the single biggest Nigeria-specific trap.** It is basic + housing +
transport, and it must be at least one-third of total emolument or the whole emolument becomes
the base. Computing pension on gross is wrong; computing it on basic alone is also wrong.

The 10% employer rate is the **statutory floor**. `zerp-be`'s seed keeps `NG_STATUTORY_RATES`
at 10% while the contribution group for that company uses **11%, the company's own elected
rate**. Never "fix" a company's higher rate down to the floor — read the seed comments before
touching it.

**NSITF is employer-only and may not be deducted from the employee**, directly or indirectly.
The Act says so explicitly.

Detail and the wage-base derivations: `references/statutory.md`.

## Labour Act — statutory minima

Nigeria's statutory minima are low; most employers contract above them. The system must
support both the floor and the generous contractual reality.

| Entitlement | Statutory minimum |
|---|---|
| National minimum wage | **₦70,000/month** (National Minimum Wage (Amendment) Act 2024) |
| Annual leave | **6 working days** after 12 months' continuous service (12 days if under 16) |
| Sick leave | **12 paid days** per year, medical certificate may be required |
| Maternity leave | **12 weeks** (typically 6 before / 6 after), at not less than 50% of wages where the employee has 6 months' service |
| Paternity leave | no federal statutory entitlement; **Lagos and some other states** and the public service grant it — state law matters |
| Public holidays | as declared federally |

Public holidays are **not** counted inside the annual leave minimum.

Full picture including termination and the NICN's practice: `references/labour-law.md`.

## Filing and remittance

| What | To | Due |
|---|---|---|
| PAYE remittance | **state IRS of the employee's state of residence** | **10th** of the following month |
| Pension | employee's chosen PFA | within **7 working days** of salary payment |
| NHF | FMBN | monthly |
| NSITF | NSITF | monthly |
| NHIA/HMO | the HMO | per scheme |
| **Form H1** annual PAYE return | state IRS | **31 January** |
| Employee tax returns | state IRS | 31 March |
| ITF | ITF | **31 March** (annual) |

**PAYE goes to the employee's state of residence, not the employer's location.** A company with
staff across Lagos, Abuja and Rivers files three separate returns to three revenue services,
each with its own portal and schedule format. Multi-state remittance schedules are a hard
product requirement in Nigeria, not an edge case.

Late PAYE remittance under the Nigeria Tax Administration Act 2025: **₦25,000 penalty plus 10%
per annum interest**, with administrative fines of ₦50,000 for the first month of infringement
and ₦25,000 per subsequent month for certain failures.

## Nigeria-specific audit checklist

1. Tax bracket carries the **NTA 2025 six bands**, not the PITA 2011 scale — checked on every
   live tenant, not just in the seed?
2. `individualRelief` / `spouseRelief` / `perChildRelief` on the NG bracket are **0**?
3. **Rent Relief** item exists, capped at the lower of 20% of rent and ₦500,000, with
   document-backed employee declaration?
4. Pension computed on **basic + housing + transport**, with the one-third-of-emolument floor?
5. Pension employer rate is the company's elected rate (≥10%), not silently forced to 10%?
6. NHF on **basic only** at 2.5%, employee side only?
7. NSITF 1% employer-only, **never deducted from the employee**?
8. ITF 1% applied only where headcount/turnover thresholds are met?
9. NHIA handled for employers with ≥5 staff, covering employee + 1 spouse + up to 4 children
   under 18?
10. Pension and NHF reach the tax calculation **uncapped**?
11. PAYE remittance schedules split **by employee state of residence**?
12. Form H1 generated from the stored run, due **31 January**?
13. `tenant_country` explicitly set on every NG tenant (never relying on the default)?
14. `seed_country` explicitly set on every MY tenant (it defaults to NG)?
15. Annual leave 6 days minimum with contractual overrides supported?
16. Minimum wage ₦70,000 enforced or warned on?
17. Naira rounding rule decided and applied consistently?

## Watch list

- **NTA 2025 / NTAA 2025 implementation circulars** from the Nigeria Revenue Service — the Acts
  are in force but administrative guidance is still landing through 2026. Band interpretation,
  rent-relief evidence standards and remittance mechanics can all be clarified retroactively.
- Nigeria Revenue Service replacing FIRS — naming, portals and forms.
- Minimum wage reviews (₦70,000 set in 2024; review cycle is short in practice).
- PenCom circulars on the pensionable-emolument definition.
- NHIA implementation directives extending mandatory coverage.
- State IRS portal/schedule format changes — each state independently.

# Nigeria — Labour Act and employment obligations

Verified 2026-08-21. Sources: Labour Act Cap L1 LFN 2004, National Minimum Wage (Amendment)
Act 2024, NHIA Act 2022, Employees' Compensation Act 2010, Nigeria Data Protection Act 2023,
National Industrial Court (NICN) practice.

## The shape of Nigerian employment law

Two things matter more than the statutory numbers:

1. **The Labour Act's minima are very low** — 6 days' annual leave, 12 days' sick leave — and
   almost every formal employer contracts well above them. The system must treat the statutory
   floor as a floor and the **contract** as the operative source of entitlement.
2. **The Labour Act only covers "workers"** — broadly, manual labour and clerical staff.
   Administrative, executive, technical and professional staff fall outside its protections and
   are governed by contract and common law. So a single hardcoded statutory rule applied to
   every employee is doubly wrong: too low for the covered, and inapplicable to the rest.
3. **The NICN applies international best practice**, not only the Act. It has read in
   protections the Act does not contain (unfair dismissal reasoning, workplace harassment).
   Compliance is therefore contract + Act + NICN practice, in that practical order.

## Minimum wage

**₦70,000 per month** — National Minimum Wage (Amendment) Act 2024.

Applies to employers with 25 or more employees (the Act's threshold). Below that, contract
governs, though paying under the national wage is reputationally and practically untenable.

## Leave entitlements

| Leave | Statutory minimum | Notes |
|---|---|---|
| **Annual** | **6 working days** after 12 months' continuous service | 12 working days if under 16 years old. Public holidays are **not** counted within it |
| **Sick** | **12 paid days** per year | medical certificate may be required. Beyond 12 days is employer discretion; 20–30 days is common practice, often 12 fully paid plus additional days at reduced pay |
| **Maternity** | **12 weeks** — typically 6 before and 6 after delivery | at not less than **50% of wages** where the employee has ≥6 months' service. Many employers pay 100% |
| **Nursing breaks** | 30 minutes twice daily | for 6 months after resumption |
| **Paternity** | **no federal entitlement** | Lagos State and the federal public service grant it (commonly 10–14 days). **State law decides** — the system needs per-state configuration |
| **Public holidays** | as declared federally | declared by the Federal Government; dates for Islamic holidays are announced close to the day |

**Product implications:**

- Annual leave must support a contractual entitlement far above the 6-day floor, with the floor
  as a validation minimum rather than the default.
- Sick leave needs a two-tier model — fully paid days then reduced-pay days — because that is
  what employers actually operate.
- Maternity pay at 50% vs 100% must be a policy setting, and the payroll consequence
  (partial-pay months) must flow through proration correctly.
- Paternity leave must be configurable **per state of work**, not globally.
- Public holidays are announced late; the calendar module must tolerate mid-year additions and
  recompute affected leave ranges.

## Working hours and overtime

The Labour Act does not fix a national maximum weekly hours figure the way Malaysia's does.
Normal hours are fixed by the contract, collective agreement, or industry practice — commonly
40 hours over 5 days.

Overtime rates are **contractual**, not statutory. The system must therefore let a tenant define
OT multipliers per day type rather than shipping a statutory default. Shipping Malaysia's
1.5×/2×/3× as a "default" into a Nigerian tenant is a defect.

Rest: at least one day off in every seven.

## Termination

- **Notice** under the Labour Act scales with service: 1 day (< 3 months), 1 week (3 months–2
  years), 2 weeks (2–5 years), 1 month (≥ 5 years). Contracts almost always improve on this —
  1–3 months is normal for professional staff.
- Payment in lieu of notice is permitted.
- **Redundancy**: the Act requires the employer to inform the trade union or workers'
  representative, adopt **last-in-first-out** subject to merit and reliability, and negotiate
  redundancy payments. Redundancy pay itself is not fixed by statute — it is negotiated or
  contractual.
- The NICN increasingly requires a **valid reason** for termination even where the contract
  permits termination on notice. Documented performance and disciplinary records therefore have
  legal weight — `hr/performance/` and the letter module are compliance artefacts, not
  administration.
- **Terminal benefits**: gratuity where contractual, accrued leave encashment, pension
  crystallisation with the PFA, final PAYE.

Payroll consequences of every termination: prorated final pay, leave encashment (taxable),
notice or payment in lieu, loan and advance settlement, final pension/NHF/NSITF, and the final
PAYE schedule to the correct state IRS.

## Employees' Compensation Act 2010

Employer contributes 1% of payroll to the Employees' Compensation Fund (see
`references/statutory.md`). Beyond the money, the employer must **report workplace incidents**
and cooperate with claims for compensation, medical care and rehabilitation. HR must therefore
hold an incident register — a real module requirement, commonly missing.

## NHIA Act 2022

Health insurance mandatory for employers with 5 or more staff, covering the employee, one
spouse and up to four children under 18. Obligations: HMO registration, timely contributions,
record-keeping. Dependants must be captured in the employee record — name, relationship, date
of birth — or enrolment cannot be completed.

## Nigeria Data Protection Act 2023

Employee records are personal data. Obligations: lawful basis, purpose limitation, retention
schedule, data subject access, breach notification, and registration with the NDPC as a data
controller of major importance where thresholds are met. Payslips, biometric attendance data
and health records are the sensitive categories.

**Biometric attendance devices process sensitive personal data.** If the tenant runs the
HikVision integration in Nigeria, consent, retention and access-control evidence are required.

## Trade unions and collective agreements

Trade Unions Act and the Labour Act's collective bargaining provisions. A collective agreement
can set terms above the statutory floor and binds the employer. Consequence for the system:
leave, OT and allowance rules must be overridable **per employee group**, since a unionised
category may have different terms from the rest of the workforce.

## What to check in our Nigerian leave/HR implementation

1. Annual leave supports contractual entitlements well above the 6-day floor.
2. Sick leave supports a fully-paid tier plus a reduced-pay tier.
3. Maternity supports 12 weeks with a configurable pay percentage, and payroll handles the
   partial-pay months.
4. Paternity is configurable **per state**, defaulting to none federally.
5. Public holidays can be added mid-year with recomputation of affected leave.
6. Overtime multipliers are tenant-configured, with no Malaysian defaults leaking in.
7. Notice periods scale by service and are overridable by contract.
8. Redundancy workflow captures union notification and the LIFO decision.
9. Termination captures a documented reason (NICN practice), not just a status change.
10. Dependants captured for NHIA enrolment.
11. Incident register exists for Employees' Compensation reporting.
12. Employee-group-level overrides exist for collective agreements.
13. Biometric/attendance data handling meets NDPA 2023 — consent, retention, access log.

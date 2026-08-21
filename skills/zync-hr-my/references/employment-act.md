# Malaysia — Employment Act 1955 and related labour law

Verified 2026-08-21. Sources: Employment Act 1955 as amended by the Employment (Amendment)
Act 2022 (in force 1 January 2023) and subsequent amendments; JTKSM/MOHR guidance;
Minimum Wages Order.

## Coverage

Since the 2022 amendment, **all private-sector employees are covered regardless of salary**.
The old First Schedule salary threshold no longer gates coverage, though a few sections
(overtime entitlement, termination benefits) still apply differently above a wage threshold —
check the current First Schedule before assuming a high earner gets statutory OT.

Sabah and Sarawak have their own Labour Ordinances. If a tenant operates there, do not assume
peninsular rules apply.

## Minimum wage

**RM1,700 per month**, national flat rate, from **1 February 2025**.
Employers with fewer than 5 employees: enforcement from **1 August 2025**.
Applies to local and foreign employees alike, all states.

Payroll should at minimum warn when basic pay for a full-time employee falls below the floor.
Note the floor is on *wages*, and allowances generally do not count toward it — verify against
the current Minimum Wages Order before implementing an allowance-inclusive check.

## Hours of work

- **45 hours per week** maximum (reduced from 48).
- Maximum 8 hours per day, subject to spread-over limits.
- At least one rest day per week.
- Overtime capped at 104 hours per month.

### Overtime rates

| When | Rate |
|---|---|
| Normal working day, beyond normal hours | **1.5×** hourly rate of pay |
| Rest day, within normal hours | half/one day's wages depending on hours worked |
| Rest day, beyond normal hours | **2.0×** hourly rate |
| Public holiday, within normal hours | **2.0×** the ordinary rate of pay for the day, in addition to the holiday pay |
| Public holiday, beyond normal hours | **3.0×** hourly rate |

The "ordinary rate of pay" is computed on the monthly wage divided by **26**, and the hourly
rate on the ordinary rate divided by normal hours per day. That 26 is statutory for OT — it
does **not** license using 26 as the proration basis everywhere else. Keep the two decisions
separate and documented (`zync-hr/references/domain.md` §5).

## Leave entitlements

| Leave | Entitlement |
|---|---|
| **Annual** | 8 days (< 2 years' service) / 12 days (2–5 years) / 16 days (> 5 years) |
| **Sick, non-hospitalised** | 14 days (< 2 years) / 18 days (2–5 years) / 22 days (> 5 years) |
| **Hospitalisation** | **60 days**, a separate entitlement — not deducted from the sick-leave pool |
| **Maternity** | **98 consecutive days** paid; eligibility conditions on service and number of surviving children |
| **Paternity** | **7 consecutive days** paid; married male employee, ≥12 months' service with the current employer, up to 5 births |
| **Public holidays** | at least 11 gazetted days per year, of which 5 are compulsory (National Day, Birthday of the Yang di-Pertuan Agong, Birthday of the Ruler/Federal Territory Day, Labour Day, Malaysia Day) |

**Modelling rule:** sick and hospitalisation are two entitlements, not one. Systems that pool
them either over-grant (22 + treating hospitalisation as extra) or under-grant (60 capped by
the sick balance). Both are wrong. Model them as separate leave types with separate balances,
and make the hospitalisation type require an attachment (`requireAttachment` in
`leave-rule.ts`).

Annual leave tiers change **on the service anniversary**, so an employee crossing 2 or 5 years
mid-year gets a blended entitlement. Decide and document whether the tier applies from the
anniversary or for the whole leave year.

## Flexible Work Arrangements — ss.60P and 60Q

Introduced by the 2022 amendment, with employer guidelines issued 2025.

- Employee has a statutory right to **apply** in writing for a change to hours, days or place
  of work. Not a right to receive one.
- Employer must **respond in writing within 60 days**, approving or refusing with reasons.
- Refusal must state grounds.

Product requirement: an FWA request entity with a 60-day response clock, written reasons on
refusal, and an audit trail. A missing response is itself the non-compliance.

## Termination, notice and benefits

- **Notice periods** (where the contract is silent): 4 weeks (< 2 years), 6 weeks (2–5 years),
  8 weeks (≥ 5 years). Payment in lieu is permitted.
- **Termination and lay-off benefits** under the Employment (Termination and Lay-Off Benefits)
  Regulations 1980 — payable on retrenchment, scaled by service, for employees within the
  covered wage band.
- **Retrenchment**: notify JTKSM via **Borang PK** ahead of the exercise; observe LIFO within a
  category unless justified otherwise.
- **Unfair dismissal** claims run through the Industrial Relations Act 1967 — s.20
  representation to the Director General for reinstatement, within 60 days of dismissal.
- **Foreign worker termination** requires notifying the Director General.

Payroll consequences of every termination: final prorated pay, annual leave encashment
(additional remuneration for tax), notice or payment in lieu, loan/advance settlement, final
EPF/SOCSO/EIS, and the LHDN leaver forms (`references/filings.md`).

## Other statutes that touch HR data and process

- **PDPA 2010** — employee personal data. Consent, purpose limitation, retention, and a data
  subject's right of access. Payslips and HR records are personal data; ESS access control and
  audit trails are the compliance evidence.
- **OSHA 1994** (as amended 2022) — safety committees, incident reporting. Reaches HR through
  accident records and SOCSO Employment Injury claims.
- **Industrial Relations Act 1967** — unions, collective agreements. A collective agreement can
  set terms *above* the Employment Act; the system must allow group-level overrides of leave
  and OT rules.
- **Children and Young Persons (Employment) Act 1966** — restrictions on employees under 18.
- **Anti-Sexual Harassment Act 2022** and the Employment Act's harassment provisions — a
  complaints workflow with confidentiality is a genuine product requirement, not a nicety.
- **Employment Insurance System Act 2017** — beyond the contribution, employers must report
  loss of employment for the employee's EIS claim.

## What to check in our leave implementation

1. Sick and hospitalisation are separate leave types with separate balances.
2. Annual leave tiers at 2 and 5 years, with a documented anniversary rule.
3. Maternity is 98 **consecutive** days — calendar days, not working days, and it does not
   pause for public holidays.
4. Paternity eligibility encodes married + 12 months' service + the 5-birth lifetime cap.
5. Public holidays and rest days inside a leave range are not leave days.
6. Carry-forward and encashment rules exist and are configurable per leave group.
7. FWA requests exist with the 60-day clock.
8. OT computed on the /26 ordinary rate at 1.5× / 2.0× / 3.0× as the day type requires.
9. Weekly hours capped at 45 before OT begins.
10. Minimum wage RM1,700 checked or warned on.

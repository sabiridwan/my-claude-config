# Malaysia — filings, remittances and file formats

Verified 2026-08-21. Confirm each year's exact dates against the LHDN/agency circular; LHDN
routinely grants an e-Filing grace period that is announced annually.

## Monthly

| What | To | Due | Code |
|---|---|---|---|
| EPF contribution + Form A | KWSP | **15th** of the following month | `statutory-remittance/epf-file-format.ts` |
| SOCSO + EIS contribution (Borang 8A / Lampiran) | PERKESO | **15th** of the following month | `socso-eis-file-format.ts` |
| PCB remittance + **CP39** | LHDN | **15th** of the following month | `pcb-file-format.ts` |
| HRD Corp levy | HRD Corp | **15th** of the following month | `hrdf-declaration-format.ts` |

All four land on the 15th. A single "statutory remittance day" workflow is therefore the right
product shape — but each file has its own layout and its own agency portal, so they cannot
share a formatter.

## Annual

| Form | What | Direction | Due |
|---|---|---|---|
| **Form EA (C.P.8A)** | statement of remuneration for each employee | employer → employee | **28 February** |
| **Form E (C.P.8)** | employer's return: headcount, total remuneration, total PCB | employer → LHDN | **31 March** (e-Filing grace commonly to 30 April) |
| **CP8D** | per-employee remuneration breakdown, submitted with Form E via MyTax | employer → LHDN | with Form E |
| **Borang 8A annual reconciliation** | PERKESO annual statement | employer → PERKESO | per PERKESO notice |

Penalty exposure on Form E/EA: fines up to **RM20,000** or imprisonment. Inaccurate CP8D data
is what triggers LHDN queries, because CP8D is what LHDN reconciles against each employee's
own return.

## Event-driven

| Form | Trigger | Due |
|---|---|---|
| **CP22** | new employee commencing employment | within 30 days of commencement |
| **CP22A** | cessation of employment (private sector) | not less than 30 days before cessation |
| **CP21** | employee leaving Malaysia for more than 3 months | not less than 30 days before departure |
| **CP38** | additional deduction directed by LHDN for tax arrears | as directed, alongside PCB |
| **TP1** | employee's claim for reliefs to be taken into MTD | when the employee submits it |
| **TP3** | prior-employment income in the same year, from the employee | on joining |
| **Borang PK** | retrenchment notification | to JTKSM ahead of the exercise |

**TP3 matters for correctness**, not just paperwork: a mid-year joiner's prior-employment YTD
must enter the cumulative MTD calculation, or the new employer under-withholds for the rest of
the year. If the product has no TP3/opening-balance mechanism, that is a real finding
(`zync-hr/references/domain.md` §6).

**CP22A before cessation** means the leaver workflow must fire the form *before* the final
payroll, not after. Sequencing this wrongly is the most common leaver compliance failure.

## Form EA — what it must contain

Mapped from the **stored payroll run**, never recomputed:

- Employer and employee identification, including the employee's income tax number.
- Gross salary, wages, leave pay.
- Fees, commissions, bonuses, gratuities, allowances, perquisites.
- Benefits in kind (value of car, driver, accommodation…) — these are computed by LHDN's
  prescribed valuation, not by cost.
- Value of living accommodation.
- Refunds from unapproved provident funds, compensation for loss of employment.
- Employee EPF and SOCSO contributions.
- Total PCB deducted, plus any CP38 deductions, plus zakat deducted.
- Total claim for deduction by employee via TP1.

**Benefits in kind and living accommodation are where EA forms go wrong.** They are valued by
prescribed formula (LHDN Public Rulings), not by what the item cost the company. If the system
carries them at cost, the EA is wrong and so was the PCB.

## File format testing

Every format is fixed-width or delimited with agency-specified positions. The tests are byte
tests, not value tests (`zync-hr/references/test-playbook.md` Layer 3):

- Field positions and padding characters.
- Header and trailer records, record counts, control totals.
- Name truncation and permitted character set — non-ASCII names are a real failure mode.
- Identification number formats (new IC, old IC, passport, army number) — each agency accepts
  a different set.
- A golden fixture checked in and compared byte-for-byte.

An upload rejected by the agency portal costs the client a late-payment penalty even though
the payroll run itself was correct. Treat format regressions as **Critical**.

## e-Invoice — the thing to watch

LHDN's e-Invoice mandate is being phased in by annual turnover band. Employment income itself
has been outside scope in the early phases, but **employee benefits, perquisites and certain
reimbursements interact with it**, and the phase boundaries have moved more than once.

Before building anything: confirm (a) the tenant's turnover band and its phase date, (b) whether
employment-related payments are in scope for that phase, (c) whether self-billed e-Invoices are
required for any payments the company makes to individuals. Do not design an integration off a
blog post — read the current LHDN e-Invoice guideline and its SDK.

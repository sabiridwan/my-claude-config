# Compliance

Regulation changes. Every figure here carries the date it was checked. **Re-verify before
relying on any threshold in advice you give** — a confidently stale number is worse than an
admitted unknown, and the primary sources are named for that reason.

Last verified: **August 2026**.

## Malaysia

**SST on gold jewellery — exempt.** Investment-grade precious metals and gold jewellery are
not subject to SST. Do not design a making-charge tax line for Malaysia on the assumption
that India's GST model transfers; it does not. If a tax line is needed it is for other
goods and services the business sells, not the jewellery.

**AML/CFT.** Dealers in precious metals and stones are **DNFBPs** under the AMLA and carry
obligations — customer due diligence, record keeping, and suspicious transaction reporting.

The **Cash Threshold Report (CTR)** is a separate obligation and a common source of
confusion: the threshold was reduced from RM50,000 to **RM25,000 per day effective 1 January
2019**, and per Bank Negara it applies to banking institutions, selected development
financial institutions, Lembaga Tabung Haji and licensed casinos — with other reporting
institutions notified if and when it is extended to them. So:

- Do **not** hardcode RM50,000; that figure is historical.
- Do **not** assert a CTR duty for a jewellery business without checking whether BNM has
  notified that sector — the CDD and STR duties apply regardless, but CTR may not.
- Splitting transactions to stay under a reporting threshold is **structuring**, an offence
  in its own right. A system that lets a counter break one RM60,000 purchase into three
  receipts without linking them is a compliance liability, so link same-customer same-day
  transactions and surface the aggregate.

Design consequence: capture verified identity at **acquisition** on cash payouts, aggregate
by customer by day, and make the gate block rather than report.

Primary source: `amlcft.bnm.gov.my`.

## India

**BIS hallmarking / HUID.** Mandatory for gold jewellery 9K–24K across 380 districts,
verified through a three-mark scheme in which every hallmarked piece carries a **6-character
alphanumeric HUID**. Silver hallmarking remains voluntary, but silver that *is* hallmarked
must carry a HUID under the revised IS 2112:2025.

The part that matters for software: since 2025 there is an **API integration mandate** —
assaying and hallmarking centres and jewellers are required to use software that talks to
the BIS portal directly rather than re-keying. Any India-facing design needs the HUID as a
first-class field on the piece, a block on billing unmarked stock, and a real integration
rather than a manual upload screen.

**GST** applies to gold and to making charges, at different rates, which is why gold value
and making charge must be separate lines on the invoice rather than one blended figure.

**Gold savings schemes** are constrained by deposit law. A scheme that runs beyond **365
days** from receipt of the advance stops being an advance against goods and becomes a
regulated **deposit**, pulling the business into a regime it is not licensed for. Penalties
for fraudulent default under unregulated-deposit law are severe — imprisonment from 3 to 10
years plus substantial fines. Design consequence: scheme tenure is a hard validation, not a
configurable nicety, and the system should refuse to create a plan whose maturity exceeds
the limit.

## Refinery documentation (LBMA practice)

Even where you are not LBMA-accredited, its chain-of-custody expectations are the benchmark
auditors reach for, and mirroring them costs little:

- Weigh on intake to **0.01 g**, assign a **lot reference**, issue an **intake certificate**
  stating gross weight.
- Maintain shipping and transport documents establishing custody from origin to refiner.
- Record **date of arrival** and **date of assay finalisation** separately.
- Settlement comprises an **assay report**, a **weight certificate** and an **itemised fee
  schedule** — a refiner supplying only a net number cannot be audited, and that is worth
  saying to the user when they are choosing a counterparty.
- Independent third-party assay is the normal tie-breaker in a settlement dispute, so store
  which lab produced each figure.

Primary source: `lbma.org.uk`, Responsible Gold Guidance and the sampling/assaying chapters.

## What to do when asked about a jurisdiction not covered here

Say the rule you know applies elsewhere, flag that you have not verified it locally, and
name what to check — tax treatment of metal vs making charge, the cash reporting threshold
and whether it binds this sector, hallmarking obligation, and deposit law limits on any
savings scheme. Those four cover most of the exposure.

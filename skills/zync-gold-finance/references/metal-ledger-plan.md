# Metal ledger — implementation plan (zyncg-server)

Covers baseline findings **#12** (no metal ledger), **#13** (rate has no effective date),
**#14** (no unfixed position / revaluation) and unlocks **#15** (the missing gold reports)
and **N8** (inter-branch transfer is a GL no-op).

Not a build ticket. This is the design that has to be agreed before code, because every
step after step 1 depends on the shape chosen in step 1.

---

## The problem in one line

The books answer in money only. A jeweller who is owed RM 400k and short 12 kg fine is not
solvent in the way the P&L claims, and today's ledger cannot say so.

`AccountTransaction` carries `purity` and `purityValue`, where
`purityValue = amount × purity/1000`. That is a **value split, not a metal ledger** — it has
no weight input, so it cannot answer "how many grams does this karigar owe us". The gram
column has to come from weight, not from money.

Metal position already exists on **stock** (`stock.schema.ts:97`, migration
`2026-08-19-gold-pricing-and-metal-position.ts`). It does not exist on the **ledger**. Stock
tells you what is on the floor; only the ledger can tell you what you owe and are owed.

---

## Step 1 — put weight on the ledger row

`finance_account_transactions` gains three fields:

| Field | Meaning |
|---|---|
| `netWeight` | grams of alloy on this leg (gross − stone, resolved upstream) |
| `purity` | per-mille — **already present**, reuse it |
| `fineWeight` | `netWeight × purity/1000`, derived server-side via `calculatePureWeight` |

**`fineWeight` is derived, never client-supplied** — same rule `purityValue` already follows
in `transaction.service.ts`. All arithmetic goes through
`inventory/shared/purity.util.ts`. Purity is per-mille; guessing a scale is banned.

Sign follows the leg: a DEBIT to a metal account is metal in, a CREDIT is metal out. The
gram column then aggregates exactly like the money column, which is the whole point — one
posting engine, two currencies.

**Decisions needed before coding:**
1. Which accounts are metal-bearing? Add `isMetal: boolean` to `Account`, or infer from
   `itemTypeId`? A flag is explicit and reportable; inference is fewer moving parts.
   *Recommendation: explicit flag* — inference will be wrong for the first odd account and
   nobody will notice.
2. What happens when a metal-bearing account receives a leg with no weight? Reject, or
   allow and report as unweighted? *Recommendation: allow initially, report loudly* — a
   hard reject on day one blocks every existing posting path at once.
3. `amount2` (declared, unreferenced, finding #19) — is it the abandoned first attempt at
   this? Decide whether to reuse or delete it. Do not leave it.

**Migration:** backfill `netWeight`/`fineWeight` where derivable — invoice legs can reach
item weights, melt legs have lot weights. Legs with no resolvable weight stay null and are
**counted and reported**, not guessed. Mirror the reporting style of
`2026-08-19-gold-pricing-and-metal-position.ts`.

---

## Step 2 — fix the rate before anything values metal

`Rate` currently has `buy`, `sell`, `purityId` and nothing else — no effective date (it
leans on `createdAt`), no branch scope, no source.

Add: an explicit `effectiveAt`, a `source` (board / spot / manual), and branch scope **only
if branches may genuinely post different board rates** — decide that with the business
rather than assuming.

**The rule that matters more than the schema:** the rate that priced a row is **stamped on
the row** — rate, side (buy/sell), and timestamp. Reconstructing "the rate at the time"
from a table that has since moved is the single most common source of unreproducible
margins. The scheme module already does this correctly (`marketRate`, `gramsGivenAway`,
`rateOverrideId`) — copy that pattern, do not invent a second one.

Do this **before** step 3. Revaluation is meaningless if the historical rate is a guess.

---

## Step 3 — fixed vs unfixed

Add `metalFixed: boolean` (default true) plus `fixedAt` / `fixedRate` to metal-bearing legs.

```
position_fine = owned_fine + receivable_fine − payable_fine
```

split fixed vs unfixed. The **unfixed** portion is the live price exposure — the number that
moves when gold moves and that the balance sheet does not currently show.

Revaluation at each reporting date, unfixed only:

| Account | Dr | Cr |
|---|---|---|
| Metal Revaluation Loss | 12,400 | |
| Metal Payable — unfixed | | 12,400 |

Both accounts **must be seeded** — neither exists in `finance.seed.ts` today.

Revaluation is a **posting**, not a report-time calculation. A synthetic line that only
exists inside a report cannot be reconciled, and the same mistake is already live in this
codebase: retained earnings is synthesised at report time and never posted (finding #16).

---

## Step 4 — the reports the gram column unlocks

Each named for the decision it drives, not the data it holds:

| Report | Decision |
|---|---|
| Metal position — fine g, per branch, fixed vs unfixed | Are we long or short, and how exposed? |
| Metal account statement per party | What does this karigar/supplier owe us in grams? |
| Melt yield & loss vs tolerance, per lot and branch | Is anyone stealing? |
| Aged receivable/payable in grams | Who is slow, and in which currency? |
| Inter-branch metal reconciliation | Does it net to zero? |
| Margin decomposition (metal / making / old-gold) | Which part of the business earns? |

The last two depend on branch scoping (#4) and on N8 (inter-branch currently posts
Dr Inventory / Cr Inventory on the **same** account, so it nets to zero trivially and proves
nothing). Sequence those first or these two reports will be vacuous.

---

## Build order — each step must ship value alone

1. **Weight on the row + backfill.** Ships alone: gram totals become queryable on the GL
   even before any report exists.
2. **Rate effective-dating + stamp-on-row.** Ships alone: margins become reproducible.
3. **Metal position + metal account statement reports.** The two the owner asks for daily.
4. **Fixed/unfixed flag + revaluation posting.** The hardest to get right; do it once 1–3
   are proven in production.
5. **Remaining reports**, after branch scoping and N8 land.

Do **not** start at step 4. Revaluing a position derived from unbackfilled weights and
guessed historical rates produces confident, wrong numbers — worse than the current honest
silence.

---

## Risks

- **Backfill coverage is the whole game.** If only 60% of legs get a weight, every gram
  report is quietly wrong. Report coverage per account and per period and set a threshold
  below which the reports refuse to render rather than mislead.
- **Two sources of truth.** Stock already carries metal position. Once the ledger does too,
  they must be reconciled — that reconciliation is itself a report, and disagreement between
  them is a finding, not a rounding artefact.
- **`validateBalanced` does not check grams.** A gram-unbalanced entry will pass silently
  unless the check is extended. Extend it in step 1, not later — retrofitting an integrity
  check after bad data exists means starting with a failing check.
- **65 posting call sites** must learn to pass weight. Expect a long tail of paths that
  never do; the "allow but report" decision in step 1 is what keeps that tail visible
  instead of silent.

# Metal math

Every number in this file is a trade constant. Use them; do not re-derive them, and do not
let a model "reason out" a conversion factor in prose — that is how a 1000× scale error
reaches production.

## Contents

- Karat, fineness, factor
- Weight units and conversions
- The three weights
- Pure weight and yield
- Melting loss tolerance bands
- Retail price build
- Buy-back spread
- Worked examples

## Karat, fineness, factor

Fineness is **per-mille** — the number of parts gold per thousand. Store purity this way
and only this way. A 0..1 factor and a 0..100 percentage cannot be told apart from a
per-mille value by magnitude alone (0.916, 91.6 and 916 are the same purity written three
ways), so any code that guesses the scale from the size of the number will silently produce
answers that are out by 10× or 1000×.

| Karat | Fineness | Factor | Notes |
|---|---|---|---|
| 24K | 999.9 / 999 | 0.9999 / 0.999 | fine gold, "four nine" |
| 23.5K | 999 | 0.999 | |
| 22K | 916 | 0.916 | Asian retail standard |
| 21K | 875 | 0.875 | Gulf standard |
| 20K | 835 | 0.835 | |
| 19K | 792 | 0.792 | |
| 18K | 750 | 0.750 | European, diamond mounts |
| 17K | 708 | 0.708 | |
| 16K | 667 | 0.667 | |
| 14K | 585 / 583 | 0.585 / 0.583 | 585 is the ISO value; 583 persists in South Asia |
| 12K | 500 | 0.500 | |
| 10K | 417 | 0.417 | US minimum for "gold" |
| 9K | 375 | 0.375 | UK/commonwealth minimum |

## Weight units

The gram is the ledger unit. Convert on input and store grams; keep the original unit and
its value alongside so a receipt can be reprinted in the unit the customer used.

| Unit | Grams | Where |
|---|---|---|
| gram | 1 | everywhere |
| tael (Chinese/HK/Malaysia) | 37.4290 | Malaysia, Hong Kong |
| tola | 11.6638 | India, Pakistan, Gulf |
| bhori / vori | 11.664 | Bangladesh (= 1 tola) |
| troy ounce | 31.1035 | international spot pricing |
| masha | 0.972 | India (1/12 tola) |
| ratti | 0.1215 | India, gemstones |
| carat (stones) | 0.2 | stones only — never metal |

Carat-the-stone-weight and karat-the-gold-purity are different things that sound identical
out loud. Name the fields `caratWeight` and `purity` so they can never be confused in code
or in a conversation with a counter clerk.

Weights are carried to the **milligram** (3 decimal places). Prices to 2.

## The three weights

Always in this order, always all three:

```
gross   as weighed, stones included
stone   removed / recorded separately
net     = gross − stone          the metal
pure    = net × purity / 1000    the gold
```

A schema with a single weight field cannot answer "was there a stone in it?" and therefore
cannot settle the most common customer dispute in the trade.

## Yield and loss

For a melt lot, or any process where metal goes in and comes back:

```
pureIn         = Σ (item.netWeight × item.purity / 1000)     declared at the counter
pureOut        = Σ (output.grossWeight × assayedPurity / 1000)
refineryDeduct = refiner's stated retention, in pure grams
loss           = pureIn − pureOut − refineryDeduct           may be negative
yieldPct       = pureOut / pureIn × 100
grossLossPct   = (netWeightIn − Σ output.grossWeight) / netWeightIn × 100
```

**Negative loss is not an error.** It means the counter under-assessed purity — the customer
was paid for less gold than they actually handed over. Track it in the same account so the
P&L shows a net figure, but treat a branch with persistent negative loss as a finding: they
are systematically underpaying customers, which is a different problem from theft and
usually a worse one commercially.

## Melting loss tolerance bands

Expected loss and the band around it, as a percentage of declared pure weight in. Outside
the band, a lot should not post without approval — without a band there is no variance, and
without variance theft is indistinguishable from normal furnace loss.

| Class | Expected | Tolerance |
|---|---|---|
| 999.9 scrap | 0.2% | 0.5% |
| 916 | 0.8% | 1.5% |
| 875 / 835 | 1.0% | 1.75% |
| 792 / 750 | 1.2% | 2.0% |
| 708 / 667 | 1.35% | 2.25% |
| ≤ 585 | 1.5% | 2.5% |
| mixed karat | 1.5% | 3.0% |

Add roughly 1 percentage point for solder-heavy work — chain, hollow bangles, anything with
many joints. Solder is a real alloy component that burns off, and a 916 chain lot running
2% is not necessarily a problem while a 916 casting lot at 2% is.

## Retail price build

```
goldValue    = netWeight × purity/1000 × ratePerGram
makingCharge = flat-per-gram | percentage-of-goldValue | fixed-total
stonePrice   = fixed | percentage-of-goldValue
total        = goldValue + makingCharge + stonePrice + diamondPrice (+ tax if applicable)
```

Making charge is sometimes quoted as a **wastage percentage** instead — the customer is
billed for `netWeight × (1 + wastage%)` grams of gold. Same money, different presentation,
and the two conventions must not both be applied to one line.

## Buy-back spread

Old gold is bought below the selling rate. The gap covers assay risk, expected melting loss
and margin — it is not pure margin, and modelling it as a single hardcoded haircut off the
sell rate always ends in a repricing crisis when spot moves fast.

Maintain a **separate buy and sell rate per purity**. That is the only structure that lets
a manager widen the spread on 750 (where assay risk is higher) without touching 916.

## Worked examples

**Trade-in, 22K chain with a stone**

```
gross 12.400g, stone 2.100g, declared purity 916, buy rate RM 300/g of pure
net   = 12.400 − 2.100          = 10.300 g
pure  = 10.300 × 0.916          =  9.435 g
payout= 9.435 × 300             = RM 2,830.50
```

**Melt lot reconciliation**

```
declared in : 250 pieces, pureIn 229.000 g   (250.000 g net at 916)
bar out     : 226.400 g gross, assayed 999.0 → pureOut 226.174 g
loss        = 229.000 − 226.174 = 2.826 g   → 1.234 % of pureIn
916 band    : expected 0.8 %, tolerance 1.5 %
verdict     : inside tolerance, posts without approval
```

**The same lot, mis-scaled**

If `purity` were stored as `0.916` and the code multiplied without dividing by 1000, pureIn
reads 0.229g and the lot appears to have gained 22,600% — or, with the error the other way,
229,000g of gold appears from nowhere. Both are instantly absurd, which is exactly why the
bug survives: nobody believes the number, so they "fix" the report instead of the scale.

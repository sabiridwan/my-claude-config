#!/usr/bin/env python3
"""Gold trade arithmetic.

Exists so the same conversions stop being re-derived in prose, where the per-mille
vs factor vs percentage ambiguity reliably produces 10x and 1000x errors.

Purity is ALWAYS per-mille here (916, not 0.916 and not 91.6).

  python3 metal_math.py pure    --net 10.3 --purity 916
  python3 metal_math.py yield   --pure-in 229 --pure-out 226.174 --karat K916
  python3 metal_math.py convert --value 2 --from tael --to gram
  python3 metal_math.py price   --net 10 --purity 916 --rate 300 --making-pct 12
  python3 metal_math.py karats
"""
import argparse
import sys

WEIGHT_DP = 3
MONEY_DP = 2

KARAT_FINENESS = {
    "K999_9": 999.9, "K999": 999.0, "K916": 916.0, "K875": 875.0,
    "K835": 835.0, "K792": 792.0, "K750": 750.0, "K708": 708.0,
    "K667": 667.0, "K585": 585.0, "K583": 583.0, "K500": 500.0,
    "K417": 417.0, "K375": 375.0,
}

# grams per unit
UNITS = {
    "gram": 1.0, "g": 1.0,
    "tael": 37.4290,
    "tola": 11.6638,
    "bhori": 11.664, "vori": 11.664,
    "troyoz": 31.1035, "oz": 31.1035,
    "masha": 0.972,
    "ratti": 0.1215,
    "carat": 0.2,          # stones only
}

# expected loss % and tolerance %, of declared pure weight in
TOLERANCE = {
    "K999_9": (0.2, 0.5), "K999": (0.2, 0.5),
    "K916": (0.8, 1.5),
    "K875": (1.0, 1.75), "K835": (1.0, 1.75),
    "K792": (1.2, 2.0), "K750": (1.2, 2.0),
    "K708": (1.35, 2.25), "K667": (1.35, 2.25),
    "K585": (1.5, 2.5), "K583": (1.5, 2.5),
    "K500": (1.5, 2.5), "K417": (1.5, 2.5), "K375": (1.5, 2.5),
    "MIXED": (1.5, 3.0),
}

SOLDER_UPLIFT_PCT = 1.0


def check_purity(p: float) -> float:
    if not (1 <= p <= 1000):
        sys.exit(
            f"purity {p} is not per-mille. Expected 1..1000 (916 for 22K). "
            "If you have 0.916 multiply by 1000; if you have 91.6 multiply by 10."
        )
    return p


def pure_weight(net: float, purity: float) -> float:
    return round(net * check_purity(purity) / 1000.0, WEIGHT_DP)


def cmd_pure(a):
    net = a.net if a.net is not None else round(a.gross - a.stone, WEIGHT_DP)
    pw = pure_weight(net, a.purity)
    if a.gross is not None:
        print(f"gross      {a.gross:.3f} g")
        print(f"stone      {a.stone:.3f} g")
    print(f"net        {net:.3f} g")
    print(f"purity     {a.purity:g} per-mille  (factor {a.purity/1000:.4f})")
    print(f"pure       {pw:.3f} g")
    if a.rate:
        print(f"value      {round(pw * a.rate, MONEY_DP):,.2f}  @ {a.rate:g}/g pure")


def cmd_yield(a):
    pure_in, pure_out = a.pure_in, a.pure_out
    if pure_in <= 0:
        sys.exit("pure-in must be greater than zero")
    loss = round(pure_in - pure_out - a.refinery_deduct, WEIGHT_DP)
    loss_pct = loss / pure_in * 100
    yield_pct = pure_out / pure_in * 100

    key = a.karat if a.karat in TOLERANCE else "MIXED"
    expected, tol = TOLERANCE[key]
    if a.solder_heavy:
        tol += SOLDER_UPLIFT_PCT

    print(f"pure in    {pure_in:.3f} g")
    print(f"pure out   {pure_out:.3f} g")
    if a.refinery_deduct:
        print(f"refinery   {a.refinery_deduct:.3f} g retained")
    print(f"loss       {loss:.3f} g   ({loss_pct:.3f} %)")
    print(f"yield      {yield_pct:.3f} %")
    print(f"band       {key}: expected {expected} %, tolerance {tol} %"
          + ("  (+solder uplift)" if a.solder_heavy else ""))

    if loss < 0:
        print("VERDICT    GAIN — assayed above declared. The counter underpaid the "
              "customer; investigate the purity testing, not the furnace.")
    elif loss_pct > tol:
        print(f"VERDICT    OUT OF TOLERANCE by {loss_pct - tol:.3f} pp — needs approval.")
    else:
        print("VERDICT    within tolerance.")


def cmd_convert(a):
    src, dst = a.src.lower(), a.dst.lower()
    for u in (src, dst):
        if u not in UNITS:
            sys.exit(f"unknown unit {u}. Known: {', '.join(sorted(set(UNITS)))}")
    grams = a.value * UNITS[src]
    print(f"{a.value:g} {src} = {round(grams / UNITS[dst], WEIGHT_DP):.3f} {dst}"
          + (f"  ({grams:.3f} g)" if dst not in ("gram", "g") else ""))


def cmd_price(a):
    pw = pure_weight(a.net, a.purity)
    gold = pw * a.rate
    if a.making_pct:
        making = gold * a.making_pct / 100.0
    elif a.making_per_gram:
        making = a.net * a.making_per_gram
    else:
        making = a.making_flat or 0.0
    total = gold + making + (a.stone_price or 0.0)
    print(f"pure       {pw:.3f} g")
    print(f"gold       {round(gold, MONEY_DP):,.2f}")
    print(f"making     {round(making, MONEY_DP):,.2f}")
    if a.stone_price:
        print(f"stone      {round(a.stone_price, MONEY_DP):,.2f}")
    print(f"TOTAL      {round(total, MONEY_DP):,.2f}")


def cmd_karats(_):
    print(f"{'key':<8} {'fineness':>9} {'factor':>8}   expected/tolerance loss %")
    for k, f in KARAT_FINENESS.items():
        e, t = TOLERANCE.get(k, ("-", "-"))
        print(f"{k:<8} {f:>9g} {f/1000:>8.4f}   {e} / {t}")


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("pure", help="net/gross + purity -> pure weight")
    s.add_argument("--net", type=float)
    s.add_argument("--gross", type=float)
    s.add_argument("--stone", type=float, default=0.0)
    s.add_argument("--purity", type=float, required=True, help="per-mille, e.g. 916")
    s.add_argument("--rate", type=float, help="price per gram of pure gold")
    s.set_defaults(func=cmd_pure)

    s = sub.add_parser("yield", help="reconcile a melt lot against its tolerance band")
    s.add_argument("--pure-in", type=float, required=True)
    s.add_argument("--pure-out", type=float, required=True)
    s.add_argument("--refinery-deduct", type=float, default=0.0)
    s.add_argument("--karat", default="K916", help="K916, K750, MIXED ...")
    s.add_argument("--solder-heavy", action="store_true")
    s.set_defaults(func=cmd_yield)

    s = sub.add_parser("convert", help="weight unit conversion")
    s.add_argument("--value", type=float, required=True)
    s.add_argument("--from", dest="src", required=True)
    s.add_argument("--to", dest="dst", default="gram")
    s.set_defaults(func=cmd_convert)

    s = sub.add_parser("price", help="retail price build")
    s.add_argument("--net", type=float, required=True)
    s.add_argument("--purity", type=float, required=True)
    s.add_argument("--rate", type=float, required=True)
    s.add_argument("--making-pct", type=float)
    s.add_argument("--making-per-gram", type=float)
    s.add_argument("--making-flat", type=float)
    s.add_argument("--stone-price", type=float)
    s.set_defaults(func=cmd_price)

    s = sub.add_parser("karats", help="print the karat and tolerance table")
    s.set_defaults(func=cmd_karats)

    a = p.parse_args()
    if a.cmd == "pure" and a.net is None and a.gross is None:
        sys.exit("pure needs --net or --gross")
    a.func(a)


if __name__ == "__main__":
    main()

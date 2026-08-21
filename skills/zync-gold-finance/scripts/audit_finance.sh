#!/usr/bin/env bash
# zync-gold-finance — static evidence pack for a finance audit.
#
#   ./audit_finance.sh [repo-root]     (default: cwd)
#
# Emits raw evidence only. It never judges — the skill interprets the pack against
# references/audit-checklist.md. Every section maps to a numbered check in that file.
#
# Exit code is always 0: absence of a hit is evidence, not failure.

set -uo pipefail

ROOT="${1:-$(pwd)}"
cd "$ROOT" || { echo "cannot cd to $ROOT" >&2; exit 0; }

FIN="src/modules/finance"
TS='--include=*.ts'
nospec() { grep -v '\.spec\.' ; }
hr() { printf '\n== %s ==\n' "$1"; }

echo "zync-gold-finance evidence pack"
echo "repo : $ROOT"
echo "sha  : $(git rev-parse --short HEAD 2>/dev/null || echo 'not a git repo')"
echo "branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '-')"
echo "date : $(date -u +%Y-%m-%dT%H:%M:%SZ)"

[ -d "$FIN" ] || { echo; echo "!! $FIN not found — not a zync-nestjs backend, or finance lives elsewhere."; exit 0; }

# ---------------------------------------------------------------- 3.1 / 11.1
hr "3.1+11.1  guard & audit coverage per finance resolver"
printf "%-46s %5s %5s %6s %6s\n" RESOLVER MUT LOCK POSTED AUDIT
for f in $FIN/*/*.resolver.ts; do
  [ -e "$f" ] || continue
  printf "%-46s %5s %5s %6s %6s\n" "${f#$FIN/}" \
    "$(grep -c '@Mutation' "$f")" \
    "$(grep -c 'GuardLockedPeriod' "$f")" \
    "$(grep -c 'GuardPostedEntry' "$f")" \
    "$(grep -c '@AuditMeta' "$f")"
done

# ---------------------------------------------------------------- 3.1 (service-side)
hr "3.1  services calling validateTransactionDate / isDateLocked"
grep -rn "validateTransactionDate\|isDateLocked" src $TS 2>/dev/null | nospec | grep -v "$FIN/fiscal/" || echo "(none)"

hr "3.1  finance services that do NOT reference the fiscal service"
for f in $FIN/*/*.service.ts; do
  [ -e "$f" ] || continue
  grep -q "fiscal" "$f" || echo "${f#$FIN/}"
done

# ---------------------------------------------------------------- 3.2
hr "3.2  no-fiscal-period hole"
grep -n "No fiscal period found" -B6 -A3 $FIN/fiscal/fiscal.service.ts 2>/dev/null || echo "(marker absent — read isDateLocked manually)"

# ---------------------------------------------------------------- 2.1
hr "2.1  AccountTransactionKind — references outside the schema (0 = never constructed)"
KINDS=$(sed -n '/enum AccountTransactionKind/,/^}/p' $FIN/transaction/transaction.schema.ts 2>/dev/null \
        | grep -oE '^\s+[A-Za-z0-9_]+ *=' | tr -d ' =')
for k in $KINDS; do
  n=$(grep -rl "AccountTransactionKind\.$k" src $TS 2>/dev/null | nospec | grep -vc 'transaction.schema.ts')
  printf "%4s  %s\n" "$n" "$k"
done | sort -n

# ---------------------------------------------------------------- 2.2
hr "2.2  value-handling modules and HOW they reach the ledger (0 in every column = posts nothing)"
echo "     A = AccountTransactionService · J = JournalEntryService · D = discriminator super.create"
echo "     A zero in one column is NOT a finding — a module posting via another mechanism"
echo "     scores 0 there. Only all-zero rows are candidates, and each must be read to confirm."
printf "%5s %5s %5s   %s\n" A J D MODULE
for m in inventory/melting inventory/transfer inventory/adjustment inventory/invoice \
         inventory/purchase inventory/returns inventory/sales job-order scheme membership \
         cash-drawer hr/payroll hr/advance subscription user; do
  [ -d "src/modules/$m" ] || continue
  a=$(grep -rl "AccountTransactionService" "src/modules/$m" $TS 2>/dev/null | nospec | wc -l | tr -d ' ')
  j=$(grep -rl "JournalEntryService" "src/modules/$m" $TS 2>/dev/null | nospec | wc -l | tr -d ' ')
  d=$(grep -rl "AccountTransactionKind\." "src/modules/$m" $TS 2>/dev/null | nospec | wc -l | tr -d ' ')
  printf "%5s %5s %5s   %s\n" "$a" "$j" "$d" "$m"
done | sort -k1,1n -k2,2n -k3,3n

# ---------------------------------------------------------------- 2.3
hr "2.3  posting calls guarded by a conditional (silent-skip risk)"
grep -rn -B4 "trans\(ac\)\?Svc\.create\|transSvc\.create\|transactionSvc\.create" src $TS 2>/dev/null \
  | nospec | grep -E "if ?\(" | head -30 || echo "(none found)"

# ---------------------------------------------------------------- 1.2 / 1.3
hr "1.2  entry-level balance enforcement"
grep -rn "totalDebit *- *totalCredit\|Math.abs(totalDebit\|not balance\|Unbalanced" src $TS 2>/dev/null | nospec || echo "(none)"

hr "1.3  validateBalanced — scope, kill-switch, logging"
grep -rn "validateBalanced" src $TS 2>/dev/null | nospec
grep -n "validation_disabled\|validation_enabled\|console.log" -n $FIN/account/account.service.ts 2>/dev/null | head

# ---------------------------------------------------------------- 4.2
hr "4.2  gold account constants — referencing files outside finance.model.ts (0 = never posted)"
for c in GOLD_IN_MELTING GOLD_MELTING_WASTAGE GOLD_MELTING_CHARGES WORK_IN_PROGRESS \
         PURCHASE_OLD_GOLD_JEWELLERY SALES_OLD_GOLD_JEWELLERY EXCHANGE_BALANCING SUSPENSE \
         MELT_ACCOUNT_CODES MAKING_CHARGE_ACCOUNT_CODES; do
  n=$(grep -rl "$c" src $TS 2>/dev/null | nospec | grep -vE 'finance.model.ts|melting.constants.ts' | wc -l | tr -d ' ')
  printf "%4s  %s\n" "$n" "$c"
done | sort -n

# ---------------------------------------------------------------- 5.1 / 5.4
hr "5.1  metal fields on the ledger row"
grep -nE "purity|purityValue|weight|grams|fine|amount2" $FIN/transaction/transaction.schema.ts 2>/dev/null || echo "(none)"

hr "5.4  declared-but-unreferenced ledger fields"
for fld in amount2 purityValue weight netWeight fineWeight; do
  n=$(grep -rl "$fld" src $TS 2>/dev/null | nospec | grep -vc 'transaction.schema.ts')
  printf "%4s  %s\n" "$n" "$fld"
done | sort -n

# ---------------------------------------------------------------- 5.2
hr "5.2  purity scale — shared util vs magnitude guessing (second list must be empty)"
grep -rn "toPurityFactor\|normalizeInboundPurity\|calculatePureWeight" src $TS 2>/dev/null | nospec | wc -l
grep -rnE "purity ?[/*] ?(100|1000)|purity ?> ?1 ?\?" src $TS 2>/dev/null | nospec | grep -v 'purity.util' || echo "(clean)"

# ---------------------------------------------------------------- 6
hr "6.1  rate schema"
sed -n 1,40p src/modules/rate/rate.schema.ts 2>/dev/null | grep -nE "@Prop|class |[a-zA-Z]+:" || echo "(no rate module)"

hr "6.3  rate override authorisation trail"
grep -rn "rateOverride\|marketRate\|gramsGivenAway" src $TS 2>/dev/null | nospec | head -20 || echo "(none)"

hr "6.4  unfixed / revaluation vocabulary"
grep -rniE "unfixed|mark.?to.?market|revaluat|metal position|hedge" src $TS 2>/dev/null | nospec | head -20 || echo "(none)"

# ---------------------------------------------------------------- 7.1
hr "7.1  branch scoping in reports (interface vs service)"
echo "report.service.ts  branchId hits: $(grep -c 'branchId' $FIN/report/report.service.ts 2>/dev/null)"
grep -n "branchId" $FIN/report/report.interface.ts $FIN/report/report.dto.ts 2>/dev/null || echo "(no branchId on report inputs)"

hr "7.4  fiscal period scope"
grep -nE "companyId|branchId" $FIN/fiscal/fiscal.schema.ts 2>/dev/null || echo "(none)"

# ---------------------------------------------------------------- 8
hr "8.1  tax computation"
grep -rn "computeLineTaxes\|LineTaxDirection\|taxInclusive" $FIN $TS 2>/dev/null | nospec | head -20 || echo "(none)"

hr "8.2  TaxEntry exclusion sites"
grep -rn "AccountTransactionKind.TaxEntry" src $TS 2>/dev/null | nospec | wc -l

# ---------------------------------------------------------------- 9.3
hr "9.3  ageing date basis"
grep -n "documentDate\|createdAt\|valueDate" $FIN/report/report.aged.utils.ts 2>/dev/null | head -20 || echo "(no aged utils)"

# ---------------------------------------------------------------- 10
hr "10  cash / AML gates"
grep -rniE "assertCash|cashThreshold|amlThreshold|structuring|kycVerified|reportableCash" src $TS 2>/dev/null | nospec | head -20 || echo "(none)"

hr "10.4  cash drawer posting"
if [ -d src/modules/cash-drawer ]; then
  grep -rl "AccountTransactionService" src/modules/cash-drawer $TS 2>/dev/null | nospec || echo "(cash-drawer posts nothing)"
else
  echo "(no cash-drawer module)"
fi

# ---------------------------------------------------------------- 11.3
hr "11.3  segregation-of-duties fields"
grep -rn "approvedBy\|submittedBy\|preparedBy\|requestedBy\|postedBy" src $TS 2>/dev/null | nospec | wc -l
grep -rnE "approvedBy.*!==.*(submittedBy|preparedBy|requestedBy)|(submittedBy|preparedBy|requestedBy).*!==.*approvedBy" src $TS 2>/dev/null | nospec || echo "(no maker-checker comparison found)"

# ---------------------------------------------------------------- 12.2
hr "12.2  year-end close / earnings roll-forward"
grep -rn "RETAINED_EARNINGS\|CURRENT_YEAR_EARNINGS\|yearEndClose\|rollForward" src $TS 2>/dev/null | nospec || echo "(none)"

# ---------------------------------------------------------------- 12.4
hr "12.4  report status filtering"
grep -n "AccountTransactionStatus" $FIN/report/report.service.ts 2>/dev/null | head -20 || echo "(report service does not filter on status)"

# ---------------------------------------------------------------- reports present
hr "12.3  reports currently exposed"
grep -n "name: \"" $FIN/report/report.resolver.ts 2>/dev/null | sed 's/.*name: "/  /;s/".*//' || echo "(none)"

hr "size  finance service line counts"
wc -l $FIN/*/*.service.ts $FIN/finance.service.ts 2>/dev/null | sort -rn | head -20

hr "end of evidence pack"
exit 0

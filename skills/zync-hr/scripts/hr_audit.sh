#!/usr/bin/env bash
# HR recon — phases 1 and 4 of references/audit-playbook.md, mechanically.
# Usage:  bash hr_audit.sh [repo-root]        (default: cwd)
# Read-only. Prints a report to stdout.

set -uo pipefail
ROOT="${1:-$(pwd)}"
cd "$ROOT" || { echo "cannot cd $ROOT"; exit 1; }

HR="src/modules/hr"
[ -d "$HR" ] || {
  echo "No $HR in $ROOT."
  echo "zynchrs-be uses a flat src/modules/* layout — audit those folders individually."
  ls src/modules 2>/dev/null
  exit 1
}

hr() { printf '\n=== %s ===\n' "$1"; }

hr "REPO"
echo "root:   $ROOT"
echo "branch: $(git branch --show-current 2>/dev/null || echo 'not a git repo')"
echo "head:   $(git log -1 --oneline 2>/dev/null)"

hr "COUNTRY SIGNALS"
grep -rn "tenant_country\|seed_country" src --include="*.ts" 2>/dev/null | head -10
echo "-- country plugins --"
ls src/plugins 2>/dev/null || echo "(no src/plugins)"
echo "-- country enum members --"
grep -rn "PayrollInstanceCountry" src --include="*.ts" 2>/dev/null | grep -E "=\s*\"" | head

hr "INVENTORY"
echo "sub-modules:"; ls "$HR"
printf '\nts files:   %s\n' "$(find "$HR" -name '*.ts' | wc -l | tr -d ' ')"
printf 'total LOC:  %s\n' "$(find "$HR" -name '*.ts' -exec wc -l {} + | tail -1 | awk '{print $1}')"
printf 'spec files: %s\n' "$(find "$HR" -name '*.spec.ts' | wc -l | tr -d ' ')"
printf 'resolvers:  %s\n' "$(find "$HR" -name '*.resolver.ts' | wc -l | tr -d ' ')"
printf 'repos:      %s\n' "$(find "$HR" -name '*.repository.ts' | wc -l | tr -d ' ')"

hr "LARGEST FILES (review-cost hotspots)"
find "$HR" -name "*.ts" -exec wc -l {} + | sort -rn | sed -n '2,16p'

hr "STATUTORY VOCABULARY PRESENT"
grep -rhoiE "\b(epf|kwsp|socso|perkeso|eis|sip|pcb|mtd|hrdf|zakat|borang|paye|pension|pencom|nhf|nsitf|itf|nhia|nhis)\b" \
  "$HR" --include="*.ts" 2>/dev/null | tr 'A-Z' 'a-z' | sort | uniq -c | sort -rn

hr "HARDCODED STATUTORY CONSTANTS (diff these against zync-hr-my / zync-hr-ng)"
grep -rnE "(RELIEF|CAP|RATE|CEILING|THRESHOLD|BAND|LEVY|MIN_WAGE|WAGE)[A-Z_]*\s*=\s*[0-9_]" \
  "$HR" --include="*.ts" 2>/dev/null | head -40

hr "TAX BANDS IN CODE"
grep -rn "ratePercentage" "$HR" --include="*.ts" 2>/dev/null | head -20

hr "COUNTRY ENGINE CALL SITES (wage-base probe — check each argument)"
grep -rn "calculateContributionAmount\|calculateStatutoryScheduleAmount\|calculateTaxDeduction\|calcMonthlyItemRelief" \
  "$HR" --include="*.ts" 2>/dev/null | grep -v "payroll-country.ts" | head -30

hr "REPRODUCE-NOT-RECOMPUTE PROBE (engine calls from PDF/form/report code)"
grep -rn "createPayrollCountryEngine\|calculateTaxDeduction" "$HR" --include="*.ts" 2>/dev/null \
  | grep -iE "pdf|form|report|payslip|letter" || echo "clean — no engine calls from output code"

hr "PRORATION BASES IN USE (should be exactly one)"
grep -rnoE "(/ ?26|/ ?30|daysInMonth|workingDays|calendarDays|prorat[a-zA-Z]*)" \
  "$HR" --include="*.ts" 2>/dev/null | awk -F: '{print $NF}' | sort | uniq -c | sort -rn

hr "TENANCY — repositories with no companyId filter (CRITICAL if any)"
found=0
while IFS= read -r f; do
  grep -qi "companyId" "$f" || { echo "  NO companyId: $f"; found=1; }
done < <(find "$HR" -name "*.repository.ts")
[ "$found" -eq 0 ] && echo "  all HR repositories reference companyId"

hr "AUTHORIZATION COVERAGE"
tot=$(find "$HR" -name "*.resolver.ts" | wc -l | tr -d ' ')
aut=$(grep -rln "ApGqlAuthorize\|HrAuthorize\|hr-authorize" "$HR" --include="*.resolver.ts" | wc -l | tr -d ' ')
echo "  $aut / $tot resolvers carry an authorize decorator"
grep -rLn "ApGqlAuthorize\|HrAuthorize\|hr-authorize" $(find "$HR" -name "*.resolver.ts") 2>/dev/null | head -15

hr "AUDIT TRAIL COVERAGE"
mut=$(grep -rh "@Mutation" "$HR" --include="*.resolver.ts" | wc -l | tr -d ' ')
aud=$(grep -rh "@AuditMeta" "$HR" --include="*.resolver.ts" | wc -l | tr -d ' ')
echo "  @Mutation: $mut   @AuditMeta: $aud"
grep -rLn "AuditMeta" $(find "$HR" -name "*.resolver.ts") 2>/dev/null | head -15

hr "HR MIGRATIONS"
ls src/migrations 2>/dev/null | grep -iE "payroll|leave|attendance|employee|statutory|hr|nigeria|malaysia" || echo "(none)"

hr "UPSTREAM SPECS AVAILABLE TO PORT"
UP=/Users/sabiridwan/Projects/zerp/zerp-be/src/modules/hr
if [ -d "$UP" ] && [ "$ROOT" != "/Users/sabiridwan/Projects/zerp/zerp-be" ]; then
  find "$UP" -name "*.spec.ts" | sed "s|$UP/|  |" | sort
else
  echo "(this is the upstream, or zerp-be not present)"
fi

hr "NEXT"
cat <<'EOF'
  1. Load zync-hr-my or zync-hr-ng per the COUNTRY SIGNALS above.
  2. Diff every row of HARDCODED STATUTORY CONSTANTS against that skill's figure table.
  3. Work phase 3 of references/audit-playbook.md by reading the CALL SITES listed above.
  4. Rank findings by money and law. Report unverified areas as unverified.
EOF

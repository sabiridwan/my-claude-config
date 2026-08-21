# HR audit playbook

Six phases. Run them in order. Every finding carries `file:line`, a concrete failure
scenario, and a fix. No finding without evidence you actually read or ran.

Start with `scripts/hr_audit.sh` — it produces phase 1 and most of phase 4 mechanically.

---

## Phase 0 — Establish country and branch

```bash
git branch --show-current
grep -rn "tenant_country\|seed_country" src --include="*.ts" | head
ls src/plugins 2>/dev/null
```

Load `zync-hr-my` or `zync-hr-ng` accordingly. Everything in phase 2 is scored against that
skill's figure table. Do not proceed without it.

---

## Phase 1 — Inventory

```bash
HR=src/modules/hr
ls "$HR"
find "$HR" -name "*.ts" | wc -l
find "$HR" -name "*.ts" -exec wc -l {} + | tail -1
find "$HR" -name "*.spec.ts" | wc -l
ls src/migrations | grep -icE "payroll|leave|attendance|employee|statutory|hr"
```

Record: sub-module list, LOC, spec count, spec-to-source ratio, HR migrations.

A spec count of 0 on a 39k-line money-handling module is itself a **Critical** finding — it
means no rate change, no refactor and no rerun fix can be shipped with confidence.

Compare against the upstream: `zerp-be` `dev-my` has ~70 HR specs for ~460 files. Anything
downstream of it that lost the specs during porting should get them back before new work.

---

## Phase 2 — Statute conformance

Extract every hardcoded statutory number, then diff against the country skill.

```bash
HR=src/modules/hr
# every numeric constant that smells statutory
grep -rnE "(RELIEF|CAP|RATE|CEILING|THRESHOLD|BAND|MIN_WAGE|LEVY)[A-Z_]*\s*=\s*[0-9]" "$HR" --include="*.ts"
# tax bands
grep -rn "minAmount\|maxAmount\|ratePercentage" "$HR" --include="*.ts" | head -40
# statutory keys in use
grep -rnoE "\"(epf|socso|eis|pcb|hrdf|zakat|paye|pension|nhf|nsitf|itf|nhia)\"" "$HR" --include="*.ts" | sort -u
# seeded country data
ls src/plugins/*/seed/*.data.ts 2>/dev/null
```

For each number produce a row:

| Constant | file:line | Code value | Statutory value (from country skill) | In force from | Verdict |
|---|---|---|---|---|---|

Verdict is `OK`, `STALE`, `WRONG` or `UNVERIFIED`. A `STALE` rate is Critical if it changes
money this pay period, High if it changes it at year end.

Also check the **seed-vs-fallback pair**. A rate typically exists twice: as an engine constant
and as seeded tenant data. Fixing one and not the other leaves tenants on the old number.

```bash
grep -rn "<the-constant-name>" src --include="*.ts"
```

---

## Phase 3 — Correctness probes

Turn each domain rule (`references/domain.md`) into a question answered by reading the code
path. Answer with `file:line`, not with an assumption.

1. **Wage base per contribution** — trace every `calculateContributionAmount` call site. Is
   the wage argument that contribution's statutory base, or the payslip gross?
   ```bash
   grep -rn "calculateContributionAmount\|calculateStatutoryScheduleAmount" src --include="*.ts"
   ```
2. **Additional remuneration** — is there a path where a bonus reaches the ordinary tax
   calculator? Check every caller of `calculateTaxDeduction` for whether `additionalGross`
   is populated.
3. **Item frequency / annualisation** — for each `PayrollItemSettingType`, which branch of
   `calcMonthlyItemRelief` does it hit? Is any new type unclassified?
4. **Proration** — find every place a partial month is computed and confirm one basis.
   ```bash
   grep -rnE "prorat|workingDays|daysInMonth|/ ?26|/ ?30" "$HR" --include="*.ts"
   ```
5. **Rerun idempotency** — when a run is recomputed, are its own prior figures excluded from
   `ytdGross` / `ytdEpf` / `ytdMtdPaid`? Read the YTD assembly in `payroll.service.ts`.
6. **Lock and posting** — can a locked or GL-posted run be recomputed? Read
   `payroll-lock.ts` and the guards around `payroll-journal-posting.ts`.
7. **Year rollover** — does bracket seeding cover next year? Does YTD reset correctly on the
   first run of a new tax year?
8. **Leave balance** — derived or stored? If stored, where is the reconciliation, and does a
   pending request hold balance?
9. **Attendance ingestion** — is the punch upsert idempotent and ordered? Test the five
   scenarios in `domain.md` §8.
10. **Payslip/report reproduce-not-recompute** — does any PDF or filing service call the
    country engine?
    ```bash
    grep -rn "createPayrollCountryEngine\|calculateTaxDeduction" "$HR" --include="*pdf*" --include="*form*" --include="*report*"
    ```
11. **Termination** — does `employee-lifecycle` actually trigger final pay, encashment and
    loan settlement, or only flip a status?

---

## Phase 4 — Tenancy, authorization, audit trail

`scripts/hr_audit.sh` prints this section. Read it as **candidates, not findings**.

Scoping is legitimately applied at any of three layers — repository `buildQuery()`, the
service (reading `contextSvc.companyId`), or the schema — and some entities are scoped
indirectly through `employeeId` or `branchId`. In `zyncg-server`, for example,
`payroll.repository.ts` has no `companyId` because `payroll.service.ts` carries 14 references
to it. A grep on the repository file alone therefore produces false positives.

The real check, per candidate sub-module: **trace one read path end to end** from resolver to
Mongo query and confirm a tenant predicate is present. Only then call it.

- Genuinely unscoped HR entity holding compensation or personal data → **Critical**.
- Unscoped reference/config entity (shift, timetable, item group) → decide whether it is
  intentionally global master data; if it is, say so and move on.
- Compensation-bearing resolver with no authorization decorator → **Critical**.
- Mutations without `@AuditMeta()` → High for approval and payroll transitions, Medium elsewhere.

---

## Phase 5 — Test gap, ranked by money at risk

Build the table:

| Behaviour | Money at risk if wrong | Spec exists? | Upstream spec to port |
|---|---|---|---|

Check what `zerp-be` already has and can be lifted:

```bash
find /Users/sabiridwan/Projects/zerp/zerp-be/src/modules/hr -name "*.spec.ts" | sed 's|.*/hr/||'
```

Known upstream specs worth porting first: `payroll-country.spec.ts`, `payroll-mtd.spec.ts`,
`payroll-statutory-tables.spec.ts`, `payroll-statutory-schedule.spec.ts`,
`payroll-journal-posting.spec.ts`, `payroll-lock.spec.ts`, `payroll-import.utils.spec.ts`,
`payroll.service.spec.ts`, `payroll-defaults.seed.spec.ts`.

---

## Phase 6 — Report

```markdown
## HR audit — <repo> @ <branch>, country <MY|NG>, <date>

### Summary
<3 lines: what works, what is broken, what is the single most expensive thing to fix>

### Critical
| # | Finding | file:line | Failure scenario | Fix |

### High / Medium / Low
<same shape>

### Statute conformance
<the phase-2 table>

### Test gap
<the phase-5 table, top 10>

### Not audited
<be explicit — anything skipped for time or access>
```

Rules for the report:
- Rank by money and law, never by ease of fixing.
- One line per finding in the table; detail goes underneath only where the fix is non-obvious.
- "Works correctly, here is the evidence" is a finding worth reporting — it stops the same
  ground being re-audited next quarter.
- Anything you could not verify goes in **Not audited**. Never let an unverified area read as
  a pass.

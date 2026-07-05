---
name: zerp-merge-to-my
description: Use when merging development branch updates into dev-my on zerp-be and zerp-admin, or when the user says "merge to my", "merge dev to dev-my", "sync dev-my", "update the MY branch", or asks to bring a feature just shipped to development into the Malaysia branch.
---

# Zerp — Merge development into dev-my

## Overview

`dev-my` is the **Malaysia variant branch** in both zerp repos. It carries MY-only commits (EA Form, Company Statutory, PCB/tax logic, HRDF, personal reliefs, statutory key mapping) on top of `development`. This skill merges `development` → `dev-my` in **both repos** — the merge is always one-way, and MY-specific behavior must survive every merge.

| Repo | Path | Verify after merge |
|------|------|--------------------|
| zerp-be | `/Users/sabiridwan/Projects/zerp/zerp-be` | `pnpm test` then `pnpm build` |
| zerp-admin | `/Users/sabiridwan/Projects/zerp/zerp-admin` | `pnpm build` |

Both repos use **pnpm** (`packageManager: pnpm@10.x`). Do BE first, then admin (BE gates the admin's read-side).

## Workflow

For **each repo**, in order (zerp-be, then zerp-admin):

1. **Preconditions**: `git status` must be clean (if not, STOP and ask). `git fetch origin`, then confirm both `development` and `dev-my` are in sync with origin (`git rev-list --left-right --count <br>...origin/<br>`). Fast-forward stale local branches with `git merge --ff-only origin/<br>`; if that fails, STOP and report.
2. **Dry-run first**: `git merge-tree $(git merge-base dev-my development) dev-my development | grep -A3 '^<<<'` (or `git merge-tree --write-tree dev-my development` on newer git) to preview conflicts before touching anything.
3. **Merge**: snapshot first — `PRE_MY=$(git rev-parse dev-my)` — then `git checkout dev-my && git merge development`. Default merge message (`Merge branch 'development' into dev-my`) is the repo convention — `git commit --no-edit`.
4. **Resolve conflicts** per the policy below. Verify zero conflict markers remain: `grep -rnE '^(<{7}|={7}|>{7})' <conflicted files>`.
5. **Verify** with the table's commands AND the Malaysia payroll protection gate below. In zerp-be, payroll specs are the usual casualty — run `npx jest src/modules/hr/payroll` first for a fast signal, then the full suite. If full-suite failures appear, check whether the same suites fail on `development` — pre-existing failures in modules untouched by the merge don't block, but the MY gate always does.
6. **Push both or neither**: only after BOTH repos pass verification, `git push origin dev-my` in each. Never push one side alone — BE and admin ship as a pair.
7. **Restore state**: `git checkout development` in both repos when done.

## Conflict policy (the point of this skill)

`dev-my`'s Malaysia behavior is the tenant's compliance layer. Dropping it is a production incident, not a style choice.

| Conflict situation | Resolution |
|---|---|
| MY payroll/statutory logic (tax calc, PCB, EPF/SOCSO/EIS, EA Form, HRDF, reliefs) vs development changes | **Keep dev-my's MY logic**, integrate development's structural changes around it. Never take development's side wholesale in these files. |
| Both branches inserted at the same spot in a list (navbar config, module registrations, providers, menu items) | **Keep both entries** — dev-my's MY entries plus development's new ones. |
| Test mocks / spec scaffolding diverged | **Standardize on development's naming** so the conflict doesn't recur on the next merge; keep dev-my-only test cases. |
| Pure development feature files (new modules) | Take development's side — these don't exist on dev-my. |

Known hotspots: `src/modules/hr/payroll/**` (be), `src/components/navbar/config.tsx`, payroll item settings, employee detail pages (admin).

If a conflict appears in a file the dry-run didn't predict, or you cannot tell whether code is MY-specific: `git merge --abort` and report — don't improvise.

## Malaysia payroll protection gate (hard rule — blocks push)

The merge must NOT affect anything in the Malaysia payroll process. Enforce this mechanically after every merge, not by eyeballing diffs.

**MY-only paths** — these exist only on dev-my; development can never legitimately change them, so the merge must leave them byte-identical:

- zerp-be (`src/modules/hr/payroll/`): `borang-e/`, `company-statutory/`, `ea-form/`, `payroll-mtd.ts` (+ spec), `payroll-tax-bands.ts`
- zerp-admin: `src/modules/hr/payroll/company-statutory/`, `src/modules/hr/payroll/employee-ea-form/`

After committing the merge, audit against the pre-merge snapshot:

```bash
# zerp-be
git diff --stat $PRE_MY dev-my -- src/modules/hr/payroll/borang-e src/modules/hr/payroll/company-statutory src/modules/hr/payroll/ea-form src/modules/hr/payroll/payroll-mtd.ts src/modules/hr/payroll/payroll-mtd.spec.ts src/modules/hr/payroll/payroll-tax-bands.ts
# zerp-admin
git diff --stat $PRE_MY dev-my -- src/modules/hr/payroll/company-statutory src/modules/hr/payroll/employee-ea-form
```

**Both must output nothing.** Any output = MY payroll was touched → `git reset --hard $PRE_MY` (if unpushed) and report. A conflict inside an MY-only path is itself a red flag (development has no version of those files) — abort, don't resolve.

**Shared files carrying MY branches** (`payroll.service.ts`, `payroll-country.ts`, `payroll-statutory-schedule.ts`, `employee-statutory/`, and in admin the employee-detail statutory tab + navbar MY entries): development legitimately edits these, so conflicts are resolved per the policy table (dev-my's MY logic wins). The regression gates below prove nothing broke:

1. **BE gate (blocking)**: `npx jest src/modules/hr/payroll` must be 100% green — it covers the MY specs (payroll-mtd, ea-form, company-statutory, statutory-schedule, payroll-country). A single failure here = MY payroll regressed; fix or reset, never push.
2. **Admin gate (blocking)**: after `pnpm build` passes, confirm the MY surface survived:
   ```bash
   grep -q 'payroll-company-statutory' src/components/navbar/config.tsx \
     && test -d src/modules/hr/payroll/company-statutory \
     && test -d src/modules/hr/payroll/employee-ea-form \
     && echo MY-SURFACE-OK
   ```

## Rollback

- Mid-merge: `git merge --abort`.
- Committed but not pushed: `git reset --hard origin/dev-my` (on dev-my).
- Pushed: do NOT force-push or revert unilaterally — report and wait.

## Don't

- Merge or cherry-pick `dev-my` → `development` (one-way only; MY code stays on dev-my)
- Resolve a conflict in an MY-only path by taking development's side — development has no legitimate version of those files; abort and report instead
- Push while the Malaysia payroll protection gate is red, even if everything else passes
- Rebase `dev-my` (shared branch, merge-based history)
- Use npm/yarn — both repos are pnpm
- Push one repo's dev-my without the other passing verification
- Leave the repos checked out on dev-my when finished

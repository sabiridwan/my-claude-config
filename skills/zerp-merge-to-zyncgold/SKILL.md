---
name: zerp-merge-to-zyncgold
description: Use when bringing development-branch updates from zerp-be/zerp-admin into the ZyncGold repos zyncg-be/zyncg-admin, or when the user says "merge to zyncgold", "merge dev to zyncgold", "sync zyncgold from zerp", "port zerp HR/finance to zyncgold", or asks to bring a feature just shipped to zerp development into the gold codebase without losing zyncgold's own customizations.
---

# Zerp → ZyncGold — HR/Finance port onto the current branch

## Overview

Brings `development` updates from the Zerp repos into the ZyncGold repos. **The two ecosystems have unrelated git history** (different roots, different GitHub orgs) — unlike `zerp-merge-to-my`, there is no branch to merge. This is a semantic diff-and-port, driven by a per-repo ledger.

Two rules define this skill:

1. **Port onto whatever branch the zyncgold repo is currently on.** Never checkout, never create a branch, never switch back.
2. **Every unit of work is delegated through `zync-model-orch` tier agents.** The main loop discovers, gates and commits; agents do the reading and porting.

| Repo | Path | Branch | Package manager | Verify |
|---|---|---|---|---|
| zerp-be (source) | `/Users/sabiridwan/Projects/zerp/zerp-be` | `development` | pnpm | — |
| zerp-admin (source) | `/Users/sabiridwan/Projects/zerp/zerp-admin` | `development` | pnpm | — |
| zyncg-be (target) | `/Users/sabiridwan/Projects/zyncgold/zyncg-be` | **current HEAD** | pnpm (`pnpm-lock.yaml` wins; a stale `package-lock.json` also sits in the tree — ignore it) | `npx jest <touched paths>` then `pnpm build` |
| zyncg-admin (target) | `/Users/sabiridwan/Projects/zyncgold/zyncg-admin` | **current HEAD** | pnpm | `pnpm build` |

Remotes are `Zync-Gold/zyncg-suite-be` and `Zync-Gold/zyncg-suite-fe`. `zyncg-server` no longer exists — that path is dead; the backend is `zyncg-be`.

## Scope

HR and Finance/Accounting only. Everything else in zerp is out of scope even when it changed.

- **HR**: employee, department, payroll (+ sub-components), leave (+ group), attendance (+ shift/timetable/report), roster, timesheet, claim (+ group/type), advance (+ transaction), loan (+ repayment), commission, approval (+ policy/orchestrator), calendar, entitlement, training, dashboard, org-chart, ESS, letters, performance, employee-lifecycle, policy.
- **Finance**: account (+ category), journal, transaction, payment, cashbook, note, trade, contra, taxation, shortcut, report, assets, fiscal.

**Paths differ between source and target — never hardcode.** Known divergences (re-verify each run, they drift): `employee`/`department` are under `hr/` in zerp-be but root-level modules in zyncg-be; `assets`/`fiscal` are root-level in zerp-be but live under `finance/` in zyncg-be. Resolve every mapping by name + content search before touching a file, and record it in the ledger.

## Current-branch rule (hard)

```bash
TARGET_BR=$(git rev-parse --abbrev-ref HEAD)   # per target repo
PRE=$(git rev-parse HEAD)                      # rollback anchor
```

- `TARGET_BR` is whatever it is (`dev-v1` today, something else tomorrow). Port there.
- Detached HEAD (`TARGET_BR == "HEAD"`) → STOP and report.
- Never `git checkout`, `git switch`, `git branch`, or `git stash` in a target repo.
- Working tree must be clean before starting. **`zyncg-be` is frequently dirty** — if it is, STOP and ask; do not stash, do not port on top of someone's WIP.

## Ledger

`docs/sync-ledger/zerp-sync.md` in each target repo (neither exists yet — the first run is a bootstrap for every sub-module and creates it):

```
| Module | Sub-module | zyncg path | Target branch | Last-synced zerp SHA | Date | Notes |
```

`Notes` records the resolved path mapping, zyncgold-only features preserved, and any conflict deferred back to the user.

**Bootstrap** (no ledger row): zerp-be alone has 1200+ HR/finance commits — replaying that history is noise against an independently-diverged target. Do a current-state feature diff instead: read zerp's full current implementation, read zyncgold's, diff semantically, port net-new additively, then seed the row with zerp's current HEAD SHA scoped to that sub-module path.

**Incremental** (row exists): `git log <lastSHA>..HEAD --oneline -- <resolved zerp path>` in the source repo, read the diffs, port, bump the SHA.

## Protection policy — auto-detected, no upfront list

Before editing any target file:

1. Read the target file's current full content.
2. Diff it semantically against the source file.
3. Anything present in the target but absent from source — fields, methods, whole files, gold-specific branches woven into shared functions (karat/purity/fineness/wastage, melting, scheme, wingold, job-order, cart, membership) — is **protected by default**. Never deleted, never silently overwritten.
4. Port only: (a) net-new zerp features absent from target, (b) fixes to genuinely shared (not diverged) logic — merged additively (new optional field, new branch, new method), never a wholesale file replace.
5. If a shared function diverged too far for an obviously-safe additive patch, **stop and report**. Record it in the ledger's Notes as deferred. Don't improvise.

## Model-orch routing (mandatory)

Classify each unit before dispatching:

```bash
~/.claude/hooks/model-orch.sh --explain "<the unit of work>"   # prints: TIER RULE
```

| Unit | Agent | Model |
|---|---|---|
| Resolve zyncgold path for a sub-module, list callers, map a tree | `orch-scout` | haiku |
| Mechanical 1–2 file edit already fully specified (rename, import path) | `orch-hand` | haiku |
| Commit message, ledger Notes prose, run summary | `orch-scribe` | haiku |
| Bounded port of a non-money sub-module (training, org-chart, calendar, letters, ESS surface) | `orch-mid` | sonnet |
| **Anything touching money, statutory or correctness** | `orch-deep` | fable |

**Veto class — always `orch-deep`, whatever the classifier says:** payroll and every payroll sub-component, statutory contributions and tax, commission, loan/advance repayment maths, journal, transaction, payment, cashbook, contra, taxation, assets depreciation, fiscal period, account category/ledger posting, and any migration. Routing one of these to `orch-hand`/`orch-mid` to save tokens is the expensive failure this rule exists to prevent.

Run BE and Admin streams concurrently; inside each stream port foundation sub-modules first (employee/department/account before their dependents) so a dependent's agent can read an already-ported foundation file.

## Phases

1. **Discover** (`orch-scout`, one per repo pair): read the ledger, resolve real target paths, produce a per-sub-module work-list — bootstrap vs incremental, resolved path mapping, commit range.
2. **Port** (`orch-mid` / `orch-deep` per the routing table): one agent per sub-module, protection policy in every prompt. Each agent updates its ledger row.
3. **Coexistence review** (`orch-deep`): read the full working-tree diff in BOTH repos. Every new GraphQL field/mutation/enum that zyncg-admin's `gql/query.ts` changes depend on must exist in zyncg-be with matching name/type/shape. Flag mismatches in either direction. Do not skip this because each side looks fine alone.
4. **Verify**: zyncg-be — `npx jest` scoped to touched hr/finance paths, then `pnpm build`. zyncg-admin — `pnpm build`. Do NOT run the Playwright e2e suite unless asked; mention it's available.
5. **Gate** (below), then **Commit** — never push.

## Gold protection gate (blocks the commit)

Mechanical, run against the working tree before committing:

```bash
git diff --diff-filter=D --name-only            # must be EMPTY — the port never deletes files
git diff | grep '^-' | grep -Ei 'karat|purity|fineness|wastage|melt|bullion|scheme|wingold|jobOrder|job-order|membership|cart'
```

The second command must return nothing. Any hit means a gold-specific line was removed — restore it or `git checkout -- <file>` and re-port that sub-module. A deletion or a gold-line removal is a production incident, not a style choice.

## Commit — never push

Only after Verify is green and the gate is clean, in each repo:

```bash
git add -A && git commit -m "chore(sync): port zerp HR/finance updates (<zerpShaRange>)"
```

- Ledger update goes in the same commit.
- Commit on `TARGET_BR` — the branch already checked out. No branch creation.
- **Never `git push`.** Report `git log --oneline origin/$TARGET_BR..$TARGET_BR` so the user sees what's waiting, and let them push.
- If only one repo passes, commit that one and report the other's failure plainly — do not silently hold both.

## Rollback

- Uncommitted: `git checkout -- <paths>` for the bad sub-module only.
- Committed, unpushed: `git reset --hard $PRE` on `TARGET_BR`.
- Never force-push, never revert a pushed commit unilaterally.

## Don't

- `git merge` / `cherry-pick` between zerp and zyncgold — unrelated histories, it cannot work
- Checkout, create, switch, or stash a branch in a target repo — port onto the current one
- Port outside HR/Finance because a zerp commit happened to touch it
- Delete or blind-overwrite anything zyncgold-only — protection is automatic via diff; when uncertain, stop and report
- Push, or commit while Verify is red or the gold gate has a hit
- Route payroll/statutory/journal/money work to a cheap tier
- Assume a ledger path mapping still holds — re-verify every run
- Replay zerp's full commit history on a bootstrap run — bootstrap is a current-state diff
- Use npm/yarn in either repo, or trust zyncg-be's stale `package-lock.json`
- Run the Playwright e2e suite by default

## Validation status

Written 2026-08-22, supersedes the retired `zync-sync-zerp-to-zyncg` (which pointed at the now-nonexistent `zyncg-server` path and used a `sync/from-zerp` branch instead of the current branch). Its one dry-run — porting the Advance auto-deduction feature from zerp-be into a zyncg worktree — validated the protection policy and the "stop and report, don't guess" contract: tsc clean, 23/23 tests, zero deletions, and a genuine Loan/Payroll architecture gap correctly deferred rather than improvised.

**Not yet exercised in this skill's shape:** the current-branch rule, the commit-never-push step, the gold protection gate, and model-orch routing have had no live run. Treat branch handling and the gate as open risk until one real run confirms them.

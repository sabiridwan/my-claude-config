---
name: zync-sync-zerp-to-zyncg
description: Use when porting HR or Accounting/Finance feature updates from zerp-be/zerp-admin into zyncg-server/zyncg-admin, or when the user says "sync zerp to zyncg", "port HR/finance to zyncg", "update zyncg from zerp", or asks to bring a zerp HR/Accounting change into the ZyncGold codebase without losing zyncg's own customizations.
---

# Zerp → ZyncGold — HR/Accounting Sync

## Overview

Ports HR and Accounting/Finance feature updates from the Zerp ecosystem into the ZyncGold ecosystem. Unlike `zerp-merge-to-my` (same repo, same git history, branch merge), the two ecosystems are **separate projects with unrelated git history** — this is a semantic diff-and-port operation, not a git merge. Unlike `zerp-hr-sync`/`zerp-account-sync` (blank-target replication), zyncg-server/zyncg-admin already have mature, independently-diverged HR and Finance implementations (scheme, membership, wingold, cart, job-order, plus extra finance sub-modules `assets`/`fiscal` and an HR `ledger` module with no zerp equivalent). **Anything zyncg has that zerp doesn't is protected by default — never deleted, never silently overwritten.**

| Repo | Path | Branch |
|---|---|---|
| zerp-be (source) | `/Users/sabiridwan/Projects/zerp/zerp-be` | `development` |
| zerp-admin (source) | `/Users/sabiridwan/Projects/zerp/zerp-admin` | `development` |
| zyncg-server (target) | `/Users/sabiridwan/Projects/zyncgold/zyncg-server` | `dev-v1` |
| zyncg-admin (target) | `/Users/sabiridwan/Projects/zyncgold/zyncg-admin` | `dev-v1` |

## Scope

Full sub-module parity, both repos:

- **HR**: employee, department, payroll (+ sub-components), leave (+ group), attendance (+ shift/group/timetable), timesheet, claim (+ group/type), advance (+ transaction), loan (+ repayment), approval (+ policy/orchestrator), calendar, training (+ group/assignment/progress), dashboard, org-chart, ESS, letters.
- **Finance/Accounting**: account (+ category), journal, transaction, payment, cashbook, note, trade, contra, taxation, shortcut, report, assets, fiscal.

**Sub-module locations already differ between source and target** — e.g. `employee`/`department` sit under `hr/` in zerp-be but are root-level modules in zyncg-server; `recruitment` is root-level in zerp-be but nested under `hr/` in zyncg-server. **Never hardcode a path.** Every run, locate the real target-side module by name + content search before touching anything, and record what you found in the ledger's `zyncg path` column so the next run doesn't rediscover it.

## Ledger

Each target repo has `docs/sync-ledger/zerp-sync.md`:

```
| Module | Sub-module | zyncg path | Last-synced zerp SHA | Date | Notes |
```

`Notes` records: the resolved path mapping, zyncg-only features preserved/skipped, and any conflict deferred back to the user. This file is part of the diff on `sync/from-zerp` — the user commits it themselves (see Branch Strategy).

### Bootstrap run (no ledger row for a sub-module yet)

zerp-be alone has 1275+ commits touching `hr/`+`finance/` — replaying that history is meaningless noise for an independently-diverged target. Bootstrap instead does a **current-state feature diff**:

1. Read the full current zerp implementation of the sub-module (all layer files).
2. Locate and read the full current zyncg implementation of the equivalent.
3. Diff semantically: zerp-only logic (port in) vs zyncg-only logic (protected, leave alone) vs shared logic that has diverged (see Protection Policy).
4. Port the net-new/changed pieces additively.
5. Seed the ledger row with zerp's current HEAD SHA (scoped to that sub-module's resolved path) as the baseline.

### Incremental run (ledger already has a row)

1. `git log <lastSHA>..HEAD --oneline -- <resolved zerp path>` in the source repo.
2. Read each commit's diff (or review the set together if long) to understand what changed.
3. Port relevant changes using the same additive/protection rules as bootstrap.
4. Bump the ledger row's SHA to the new HEAD, update notes.

## Protection Policy — auto-detect via diff, no upfront list

Before editing any target file:

1. Read the target file's current full content.
2. Diff it semantically against the corresponding source file.
3. Anything present in the target but absent from source (fields, methods, whole files, gold-specific branches woven into shared functions) is **protected by default** — never deleted, never silently overwritten.
4. Only port: (a) net-new source features absent from target, (b) fixes to logic that is genuinely shared (not diverged) — merged in additively (new optional field, new branch, new method), never a wholesale file replace.
5. If a shared function has diverged too far for a safe additive patch to be obvious, **stop and report the conflict** — record it in the ledger's Notes column as deferred. Don't improvise a merge.

This mirrors `zerp-merge-to-my`'s "abort and report, don't improvise" rule, applied to a diff-based port instead of a git merge.

## Branch Strategy

Each run, in both target repos:

1. Precondition: working tree clean. If not, stop and ask — don't stash or discard.
2. Ensure `sync/from-zerp` exists: create from current `dev-v1` if absent; if present, checkout and merge latest `dev-v1` into it first (avoid syncing against a stale base).
3. All porting happens on `sync/from-zerp`. **Never touch `dev-v1` directly.**
4. Never auto-commit, never auto-merge `sync/from-zerp` back into `dev-v1`. The user reviews, tests, commits, and merges manually.

## Don't

- Touch `dev-v1` (or whatever the real dev branch is) directly in either zyncg repo.
- Delete or blind-overwrite anything zyncg-only — protection is automatic via diff; when uncertain, stop and report rather than guess.
- Auto-commit or auto-merge `sync/from-zerp`.
- Assume a path mapping from a prior ledger entry without re-verifying it still holds — target repos restructure independently between runs.
- Replay zerp-be's full historical commit range on a bootstrap run — bootstrap is a current-state diff, not a history replay.
- Skip the coexistence review phase even when BE and Admin ports each look fine in isolation.
- Run the full Playwright e2e suite by default in the Verify phase — mention it's available on request, don't run it unasked.

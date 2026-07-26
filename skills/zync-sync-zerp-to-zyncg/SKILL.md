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

## Orchestration — Workflow tool, 4 phases

Given the scope (~16 HR + 13 Finance sub-modules × 2 repos), this skill is executed via the Workflow tool, not ad-hoc Agent calls, so BE and Admin porting run concurrently and get cross-checked before landing:

```js
export const meta = {
  name: 'zync-sync-zerp-to-zyncg',
  description: 'Port HR/Finance updates from zerp into zyncg-server + zyncg-admin',
  phases: [
    { title: 'Discover', detail: 'resolve ledger + compute per-sub-module work-list, both repo pairs' },
    { title: 'Port', detail: 'parallel BE/Admin streams, foundation sub-modules first' },
    { title: 'Coexistence review', detail: 'confirm BE-exposed fields match FE consumption' },
    { title: 'Verify', detail: 'jest + build both repos, update ledgers' },
  ],
}

phase('Discover')
const [beWork, adminWork] = await parallel([
  () => agent('Read zyncg-server ledger + hr/finance tree, read zerp-be equivalents, produce a per-sub-module work-list (bootstrap vs incremental per the Ledger section, resolved path mapping, commit range if incremental).', {label: 'discover:be'}),
  () => agent('Same for zerp-admin -> zyncg-admin.', {label: 'discover:admin'}),
])

phase('Port')
const [beResult, adminResult] = await parallel([
  () => pipeline(beWork.subModules, sm =>
    agent(`Port sub-module ${sm.name} from zerp-be (${sm.zerpPath}) into zyncg-server (${sm.zyncgPath}). Follow the Protection Policy: read zyncg's full current file(s) first, diff semantically, never remove zyncg-only logic, port net-new/changed zerp logic additively. Update the ledger row. If a shared function has diverged too far to patch safely, stop and report the conflict in the ledger Notes instead of guessing.`,
      {label: `port:be:${sm.name}`, phase: 'Port'})
  ).then(rs => rs.filter(Boolean)),
  () => pipeline(adminWork.subModules, sm =>
    agent(`Port sub-module ${sm.name} from zerp-admin into zyncg-admin. Same Protection Policy as the BE stream.`,
      {label: `port:admin:${sm.name}`, phase: 'Port'})
  ).then(rs => rs.filter(Boolean)),
])

phase('Coexistence review')
const coexistence = await agent(
  'Read the full diff on sync/from-zerp in BOTH zyncg-server and zyncg-admin. Confirm every new GraphQL field/mutation/enum zyncg-server now exposes that zyncg-admin gql/query.ts changes depend on actually exists with matching name/type/shape. Flag mismatches in either direction.',
  {schema: COEXISTENCE_SCHEMA}
)

phase('Verify')
const verify = await parallel([
  () => agent('In zyncg-server on sync/from-zerp: run `pnpm test` scoped to touched hr/finance paths, then `pnpm build`. Report pass/fail.', {label: 'verify:server'}),
  () => agent('In zyncg-admin on sync/from-zerp: run `pnpm build`. Do not run the Playwright e2e suite unless explicitly asked. Report pass/fail.', {label: 'verify:admin'}),
])

return { beResult, adminResult, coexistence, verify }
```

**Batching within Port:** order `beWork.subModules`/`adminWork.subModules` foundation-first — same shape as `zerp-hr-sync`/`zerp-account-sync`'s batching (e.g. Employee/Department/Account before their dependents) — so a dependent sub-module's port agent can read an already-ported foundation file if needed.

This script is a skeleton, not literal copy-paste — the invoking session fills in `beWork`/`adminWork` shapes and `COEXISTENCE_SCHEMA` from the actual Discover output before calling the Workflow tool.

## Don't

- Touch `dev-v1` (or whatever the real dev branch is) directly in either zyncg repo.
- Delete or blind-overwrite anything zyncg-only — protection is automatic via diff; when uncertain, stop and report rather than guess.
- Auto-commit or auto-merge `sync/from-zerp`.
- Assume a path mapping from a prior ledger entry without re-verifying it still holds — target repos restructure independently between runs.
- Replay zerp-be's full historical commit range on a bootstrap run — bootstrap is a current-state diff, not a history replay.
- Skip the coexistence review phase even when BE and Admin ports each look fine in isolation.
- Run the full Playwright e2e suite by default in the Verify phase — mention it's available on request, don't run it unasked.

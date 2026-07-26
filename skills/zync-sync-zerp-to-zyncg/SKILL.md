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

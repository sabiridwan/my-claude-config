# Agent tier table — z-agent

The five `orch-*` agent types are model-pinned. Each maps to one tier
defined by `model-orch-rules.json`. Use the **cheapest tier that can
still answer** — wrong tier either burns tokens (over-spec) or produces
wrong code (under-spec).

## Quick reference

| Tier | Agent | Model | Use for | Tools |
|---|---|---|---|---|
| T0 | `orch-scout` | Haiku 4.5 | read-only locate: "where is X", "list uses of Y" | All except write tools |
| T1 | `orch-hand` | Haiku 4.5 | 1-2 file mechanical edit: typo, rename, single-fn rewrite | Read, Edit, Write, Grep, Glob, Bash |
| T2 | `orch-scribe` | Sonnet 5 | prose only: commit msg, changelog, doc paragraph | Read, Grep, Glob, Bash |
| T3 | `orch-mid` | Sonnet 5 | bounded multi-file: new field through layers, small new module mirroring sibling | Read, Edit, Write, Grep, Glob, Bash |
| T4 | `orch-deep` | Opus 5.5 | architecture, root-cause debugging, correctness-critical (money, auth, migration) | Read, Edit, Write, Grep, Glob, Bash, WebSearch, WebFetch |

## When to pick what

**T0 — scout.** Default for "where is X". Fast, cheap, read-only.
Example prompt:

> "List every file under `src/modules/branch/` that imports
> `AbstractBaseService`. Return a file:line table."

**T1 — hand.** Default for "fix this typo" / "rename this variable".
Hard-refuses 3+ file scope. The main thread should not use Agent at all
for a single-file edit — `Edit` is cheaper.

> "Rename `disableAuto` to `disableAutoMerge` in
> `tools/autonomy-merge.mjs` line 131 and its only call site."

**T2 — scribe.** Prose deliverables. Commit messages, changelog entries,
doc paragraphs, summaries of a diff. Never edits code.

> "Write a Conventional Commits message for this diff
> `feat(zyncai): coverage for autonomy-merge scripts`. Body ≤ 3 lines."

**T3 — mid.** Bounded multi-file integration. Adding a field through its
layers, a new endpoint following an existing pattern, a small new module
that mirrors a sibling.

> "Add a `deletedAt` field to the Branch module: schema → repository
> (`findActive` filter) → service (`softDelete` method) → resolver
> (`softDeleteBranch` mutation). No migration script — soft delete only."

**T4 — deep.** Correctness-critical. Architecture, root-cause of
intermittent failures, payroll/money/auth code, migrations, data loss
risk. Most expensive — only when being wrong costs more than the tokens.

> "Audit `src/modules/payroll/payroll-run.service.ts` for off-by-one in
> the pro-rated unpaid leave deduction. Confirm the prorate formula
> matches Employment Act s.60I(2)(a). Report file:line."

## Prompt templates

Each tier takes a slightly different prompt shape. T0 prompts are
factual queries; T4 prompts include the stakes.

**T0/T1 template:**

```
Verb + scope. Return only the answer, no preamble.
Example: list uses of `X` in `path/`. File:line table.
```

**T2 template:**

```
Output: <format>. Voice: <terse | formal | commit-style>.
Source: <diff path | file path | inline text>.
Length: ≤ N words / N lines.
```

**T3 template:**

```
Task: <one-sentence verb-object>.
Target: <repo path>, branch <base>.
Pattern: <which sibling to mirror>.
Acceptance: <pass conditions>.
Constraints: <no migration, no push, etc.>.
```

**T4 template:**

```
Audit <scope> for <failure mode>. Stakes: <what goes wrong if missed>.
Expected ground truth: <citation, doc, statute, or sibling-correct code>.
Return: ranked findings, file:line evidence, test gap table.
Do NOT edit. Report only.
```

## Failure modes to avoid

- **T4 for locate.** Burning Opus on "where is X" is the most common
  cost mistake. Use T0.
- **T1 for 3+ files.** `orch-hand` will refuse; you'll pay the
  overhead and get nothing. Either batch the edit as multiple T1
  calls, or escalate to T3.
- **T2 to write code.** Scribes do prose. Asking for code returns prose
  about code, not code. Escalate to T1/T3.
- **T3 for architecture.** Mirroring a sibling is T3; designing a new
  pattern is T4. If the prompt says "create the pattern", it's T4.

## Concurrency on this tier table

All tiers share the same hook-driven cap. T4 calls cost more wall-clock
than T0, so a batch of 5 T4 may exhaust 30 minutes while a batch of 5
T0 finishes in 90 seconds. Plan batches around the slowest tier in
the batch, not the average.

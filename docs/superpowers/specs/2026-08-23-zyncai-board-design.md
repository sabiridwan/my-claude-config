# zyncai board — Phase 1 design

**Status:** approved design, not yet implemented
**Date:** 2026-08-23
**Depends on:** `2026-08-23-zyncai-design.md` (the zyncai spec proper)
**Scope:** Phase 1 of turning zyncai from one maintenance seat into an
end-to-end team — a durable, resumable board plus a blocking escalation
channel. Nothing else.

## Problem

zyncai's build session produced four verified modules in a few hours using a
structure that behaved like a development team: a controller, implementers,
independent reviewers, a written spec as binding authority, and fix rounds until
sign-off. That structure worked — nearly every defect was caught by review or by
mutation rather than by the implementer that wrote the code.

But the structure had no durable substrate. Three specific consequences:

1. **State lived in a transcript.** The 71KB `progress.md` ledger and a 2MB
   session transcript were the only record of what was dispatched, what was
   approved, and what was still open. A cold controller could not answer "what do
   I do next" without reading all of it.
2. **The record was gitignored.** `.superpowers/sdd/.gitignore` was `*` and
   `.gitignore:17` ignored `plans/`, so the plan, the ledger, the amendments, and
   every task report were one `git clean -fdx` from gone while the code they
   justified stayed safe. (Archived 2026-08-23 to
   `docs/superpowers/sdd-archive/2026-08-23-zyncai/`.)
3. **There was no escalation channel.** When an agent could not proceed, the only
   outcomes were "keep trying" or "the controller decides." Fix-round limits were
   invented mid-run (`round 1/5` appears in the ledger; it appears in neither the
   spec nor the plan), and spec-drift was caught twice by downstream agents
   noticing a contradiction rather than by any mechanism.

Phase 1 fixes exactly these three things. It adds no new agent roles.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Resume source of truth | Separate machine-readable `state.json`; the prose ledger stays human-facing and unparsed | The ledger's value is a reasoning agent explaining *why* — that is what caught two spec self-contradictions, and it does not survive compression into JSON. "What do I do next" is what prose is bad at after 71KB. |
| First consumer | zyncai's own remaining tasks T5–T9 | Dogfood immediately, on the exact tasks where spec-drift already bit twice. |
| Board scope | One board per ticket, centralized | Works identically whether a ticket touches one repo or five, and survives a target repo being deleted or re-cloned. |
| Escalation surfacing | Disk-first, live if a human is present | The disk record is what makes a cold resume see the block; the live prompt is what stops an interactive run from silently stalling. |
| Escalation triggers | Fix-round cap, review deadlock, safety-rail conflict | All three are "agent structurally cannot proceed" — mechanical, not judgment calls. Tier-4 findings and controller rulings are deliberately NOT escalations; they already have handling. |
| Escalation storage | Inside `state.json` | One file, one lock scope, nothing to fall out of sync with task state. |

## Layout

```
~/.claude/zyncai-board/<ticket-id>/
  state.json          machine state — single source of truth for resume
  ledger.md           human-facing prose record (today's progress.md, unchanged)
  amendments.md       binding rulings that override the original brief
  briefs/task-N.md    task briefs
  reports/task-N.md   implementer reports
  diffs/*.diff        review diffs
```

`state.json` is the only new artifact. Everything else is the existing prototype
from `.superpowers/sdd/2026-08-23-zyncai/`, carried over unchanged.

The board directory is committed to git and MUST NOT be gitignored. That is the
whole point of Phase 1, and it is the one rule most easily undone by a stray
ignore pattern.

## `state.json` schema

```json
{
  "ticketId": "zyncai",
  "specPath": "docs/superpowers/specs/2026-08-23-zyncai-design.md",
  "specCommitVerified": "0cef0863f1c2d4e5a6b7c8d9e0f1a2b3c4d5e6f7",
  "maxFixRounds": 5,
  "createdAt": "2026-08-23T01:00:00Z",
  "updatedAt": "2026-08-23T09:16:00Z",
  "tasks": [
    {
      "id": "T5",
      "title": "repo agent",
      "dependsOn": ["T1", "T2", "T3", "T4"],
      "status": "planned",
      "fixRounds": 0,
      "dispatchedAgainstSpecCommit": null,
      "briefPath": "briefs/task-5.md",
      "reportPath": "reports/task-5.md",
      "reviewDiffs": [],
      "lastFindingFingerprint": null,
      "verdict": null
    }
  ],
  "escalations": [
    {
      "id": "esc-1",
      "taskId": "T5",
      "reason": "fix_round_cap",
      "detail": "5 fix rounds, reviewer still rejects on the same point",
      "status": "open",
      "openedAt": "2026-08-23T09:20:00Z",
      "resolvedAt": null,
      "resolution": null
    }
  ]
}
```

### Field semantics

- `specCommitVerified` — the git commit of `specPath` at which `amendments.md`
  was last confirmed consistent with the spec. Not merely "the spec's current
  commit." Stored as the **full 40-character sha**, for the reason
  `study-template.md` already gives for `studiedSha`: a short prefix can name a
  different commit, and a false match here means drift is never detected.
  `dispatchedAgainstSpecCommit` follows the same rule.
- `status` — one of `planned`, `dispatched`, `in_review`, `fix_round`,
  `approved`, `escalated`, `cancelled`. `approved` is the only terminal-good
  state. `cancelled` is terminal — a task a human withdrew, most often resolving
  a `rail_conflict`; it never unblocks a dependent. `escalated` is terminal until
  a human resolves it.
- `fixRounds` — count of completed fix rounds. Preserved across an escalation
  resolution: a resolved escalation does not grant a fresh round.
- `dispatchedAgainstSpecCommit` — spec HEAD at the moment this task was
  dispatched. Lets a reader see that a task closed against an older spec than the
  current one.
- `lastFindingFingerprint` — hash of the most recent review finding
  (file + line + description), used for deadlock detection.
- `verdict` — the latest reviewer verdict on the task, `null` until a review
  returns, then `"approved"` or `"rejected"`. Distinct from `status`: `verdict`
  is what the reviewer said about the work, `status` is where the task sits in
  its lifecycle. A task reaches `status: "approved"` only via
  `verdict: "approved"`, but a task can hold `verdict: "rejected"` while
  `status` is `fix_round` — that is the normal case mid-loop.
- `reason` — one of `fix_round_cap`, `deadlock`, `rail_conflict`.
- An escalation's `status` — `"open"` or `"resolved"`. Only `"open"` escalations
  are read by resume.

## Behaviour

### Dependency resolution

Runnable tasks are those with `status: "planned"` whose every `dependsOn` entry
has `status: "approved"`. Only `approved` unblocks a dependent — `escalated` and
`fix_round` do not. No separate scheduler exists; this is a filter over the
`tasks` array.

### Deadlock detection

One field holds one round's worth of history, which is all this needs. When a
review returns, the controller fingerprints the finding and compares it to the
stored `lastFindingFingerprint` — which holds the *previous* round's — before
overwriting it. A match means the review sent the same finding back with no new
information, and the task auto-escalates with `reason: "deadlock"`, regardless of
how far below `maxFixRounds` the count is.

The fingerprint covers file, line, and description. A reviewer restating the same
defect in different words is therefore NOT detected as a deadlock — accepted
deliberately, because the alternative is fuzzy matching that would fire on two
genuinely different findings in the same function and escalate a healthy loop.

### Fix-round cap

Reaching `maxFixRounds` (default 5) without a verdict of `approved`
auto-escalates with `reason: "fix_round_cap"`.

### Spec-drift guard

Before dispatching any task, the controller compares the current git HEAD of
`specPath` against `specCommitVerified`. If they differ, dispatch is blocked
until `amendments.md` has been re-diffed against the new spec HEAD and
`specCommitVerified` bumped.

This mechanically enforces a rule the zyncai ledger already recorded by hand
twice, after `AMENDMENTS.md` item 8 was found to contradict the spec and after a
`headSha` gate landed following Task 4's close, leaving `safety-rails.md`
half-stale. Both were caught by an agent trying to *apply* a rule precisely, not
by review of the document. A required-reading file drifting from the spec is
worse than the spec drifting, because nobody re-reads it.

### Escalation flow

**On trigger,** the controller appends an `escalations[]` entry with
`status: "open"`, sets the task's status to `escalated`, and writes `state.json`.
If a human is present in the session, it then surfaces the escalation
immediately with its reason, task, and triggering finding. If no human is
present, it stops there — the board durably records the block and nothing waits.

**On resume,** open escalations are read before any new dispatch. If any open
escalation blocks a task that is otherwise runnable, no new work starts until it
is addressed. An open escalation that blocks nothing currently runnable is
reported but does not halt unrelated work.

**On resolution,** the controller writes `resolution` and `resolvedAt`, sets
`status: "resolved"`, and returns the task to `fix_round` (round count
preserved) or to `planned` if the resolution changes the approach. The resolution
text is appended to the task's brief file, not left only in JSON — the next
implementer and reviewer read the brief, not the board.

**Rail conflicts resolve differently.** A safety rail is never worked around;
`safety-rails.md` states that a rail is never satisfied by working around it. So
a `rail_conflict` escalation can resolve only to "task cancelled" or "task
redefined." The controller may not propose a workaround as the resolution. Only
the human may redefine the scope.

### What is explicitly NOT an escalation

- A tier-4 finding — already handled by draft PR plus `needs-human-review`.
- A minor or deferred finding — recorded in the ledger.
- A spec ambiguity the controller resolved itself — recorded as a ruling in the
  ledger, which is the existing and correct behaviour.

### Resume

```
resume(ticketId):
  state = read(zyncai-board/<ticketId>/state.json)
  if state.specCommitVerified != currentSpecHead(state.specPath):
    halt: re-diff amendments against spec HEAD, bump specCommitVerified
  open = state.escalations.filter(e => e.status == "open")
  if interactive and open.length: surface them first
  runnable = state.tasks.filter(t =>
    t.status == "planned" &&
    t.dependsOn.every(id => taskById(id).status == "approved"))
  dispatch each runnable task, writing state.json after every transition
```

`resume` is a function a controller calls at the top of a turn, not a daemon and
not a polling loop. It is cold-start-safe because everything it needs is in the
one file it just read.

## Implementation

A new module `board.mjs`, in `skills/zyncai/scripts/`, following the conventions
the existing four modules established:

- A named entry point that takes a board path and does its own I/O, documented in
  the file's header comment.
- Exported error-code constants; no consumer hardcodes a code string.
- Coded/uncoded error channel by provenance, and exit codes 0 / 1 / 2 at the CLI
  boundary.
- A colocated `board.test.mjs`.

### Error handling

| Condition | Channel |
|---|---|
| `state.json` absent | coded `ERR_BOARD_NOT_FOUND` — the ticket does not exist yet; the caller decides whether to create it |
| `state.json` present but fails schema validation | coded `ERR_BOARD_CORRUPT` — a condition of the board, not a bug in the module |
| A cycle in `dependsOn` | uncoded `TypeError` — a task-graph authoring bug, a shape nothing upstream should produce |

Writes use write-to-temp-then-rename, never in-place edit, so a crash mid-write
cannot leave a torn file for a concurrent reader. The zyncai build ran concurrent
agents against shared files and this is the class of problem it kept meeting.

### Testing

`board.test.mjs` covers, at minimum:

- The resume filter excludes a task whose dependency is not `approved`, including
  when that dependency is `escalated` or in `fix_round`.
- A repeated finding fingerprint escalates on round 2, not at `maxFixRounds`.
- The spec-drift guard blocks dispatch while `specCommitVerified` is stale and
  unblocks after it is bumped.
- Two concurrent writers leave a readable file (temp-then-rename).
- A malformed `state.json` raises `ERR_BOARD_CORRUPT` rather than returning a
  silently empty task list.
- `fixRounds` is preserved across an escalation resolution.
- A `rail_conflict` escalation resolves only to `cancelled` or to `planned` with
  a changed brief — never to `fix_round`, which would be a retry of the approach
  the rail rejected.
- A `cancelled` task never unblocks a dependent, even though it is terminal.

Coverage claims for this module are subject to the project's existing mutation
standard: any claim from a harness that did not verify its mutation actually
applied is unproven, not disproven.

## Out of scope

Deliberately excluded from Phase 1, in service of shipping the substrate rather
than the whole team:

- **Phase 2** — an intake seat turning a request into a spec, a machine-checkable
  spec clause registry, and amendment-reopens-downstream-tasks. Phase 1's
  spec-drift guard *blocks* on drift; it does not reopen closed tasks.
- **Phase 3** — architecture-as-retrieval over the canonical repos for greenfield
  work.
- Any new agent role. Phase 1 changes where state lives, not who does the work.
- A web UI, a daemon, or a scheduler. `resume` is a function.

Permanently out of scope, for any phase: priority, tradeoffs with stakes,
accountability for production, and irreversible actions — production deploys,
migrations against live data, and movement of money.

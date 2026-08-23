# zyncai as a team — plugin architecture design

**Status:** approved design, not yet implemented
**Date:** 2026-08-23
**Supersedes the architecture of:** `2026-08-23-zyncai-board-design.md`, whose
surviving parts are folded in here as the file ticket-store adapter
**Depends on:** `2026-08-23-zyncai-design.md` (the zyncai spec proper — unchanged)
**Models itself on:** SAMI (`git@git.sam-media.com:ouisys-ai-projects/sami.git`),
Sam Media's landing-page agent, which is the same shape already working in
production

## Problem

zyncai works as a maintenance function: audit → fix → verify → PR over existing
ZyncGold repos, with honest reporting about what it actually verified. Four
modules are built and reviewed. But it is **one seat**, and it structurally
cannot decide what to build, own a tradeoff, do greenfield architecture from
ambiguity, or be accountable.

The thing that *did* behave like a team was the harness that built zyncai: a
controller, implementers, independent reviewers, a written spec as binding
authority, and fix rounds until sign-off. Nearly every defect was caught by
review or by mutation rather than by the implementer that wrote the code. That
structure is what should be productized — not an extension of zyncai's scripts.

SAMI is that structure, already built and running. Rather than invent an
architecture, zyncai adopts SAMI's wholesale: one skill per seat, an
orchestrator that owns only sequencing, a per-seat handover gate, per-seat
evals, and a node graph that makes resume exact.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Architecture source | Copy SAMI's shape | Proven across real tickets (GENT-7186 / 7196 / 7201). Inventing a second team architecture in the same organisation is duplicated cost and divergent lessons. |
| Packaging | zyncai's own Claude Code plugin | Different domain (ZyncGold repo maintenance vs Sam Media landing pages), different audience, own release cadence. Sami's front door should not route two unrelated domains. |
| Repo | New repo at `~/Projects/zyncai`; the four scripts migrate once T1–T4 settle | A live session is landing commits in `~/.claude/.claude/worktrees/zyncai` right now. Scaffolding fresh means clean plugin history and zero interference with an actively-committing branch. |
| Ticket state | A **ticket-store interface** with a file adapter shipping first | The eventual ticket source is undecided — the zyncws workspace project, or a WhatsApp message listener. Committing to any store now would bake in the thing most likely to change. |
| Ticket store, not chosen | Notion | Deliberately rejected for zyncai even though SAMI uses it. |
| Prose record | Kept, human-facing, unparsed | The ledger's value is a reasoning agent explaining *why*; that is what caught two spec self-contradictions during the build, and it does not survive compression into JSON. |
| Escalation surfacing | Disk-first, live when a human is present | The store record is what a cold resume sees; the live prompt is what stops an interactive run from silently stalling. |
| Escalation triggers | Fix-round cap, review deadlock, safety-rail conflict | All three are "the agent structurally cannot proceed" — mechanical, not judgment calls. |

## The shape

A plugin whose skills are **seats on a team**, not modules.

```
zyncai/
  .claude-plugin/
    plugin.json                     manifest + skills scan paths
    marketplace.json                the catalog teammates install from
  skills/
    zyncai/                         front door — greets, offers the menu, routes
    zyncai-pipeline/                orchestrator: sequencing, loop limits, resume
      references/
        pipeline-graph.md           the node model — reads/produces per node
        ticket-protocol.md          the shared contract every seat follows
        safety-rails.md             global, binding on every seat
        learnings.md                distilled operating lessons
    zyncai-ops/                     intake + routing            user-invocable: false
    zyncai-audit/                   find findings, assign tiers  false
    zyncai-fix/                     implement the fix per tier   false
    zyncai-verify/                  the gate — judges, never fixes  false
    zyncai-pr/                      opens PRs; humans merge      false
    zyncai-study/                   repo knowledge capture       false
    zyncai-explain/                 read-only explainer          user-invocable
    zyncai-scope/                   blast radius of a ticket     user-invocable
    <seat>/references/deliverables.md   that seat's handover gate
    <seat>/evals/evals.json             one case per process
  tools/
    discover.mjs                    workspace repo manifest
    verify-chain.mjs                usable verify steps
    study-state.mjs                 study staleness
    validate-assets.mjs             reference asset validator
    ticket-store/file.mjs           the default adapter
```

**Team seats are `user-invocable: false`.** They are hidden from the `/` menu and
invoked by the orchestrator through the Skill tool. This is for context economy,
copied from SAMI directly: each seat's body loads only when its stage actually
runs, so a verify pass does not drag the whole audit checklist into context.

**The orchestrator owns only sequencing, loop limits, and resume.** It never
paraphrases a seat's job from its own file. Each seat's `deliverables.md` is its
handover gate.

## The seats

| Seat | Deliverable | Consumed by | Absorbs |
|---|---|---|---|
| `zyncai-ops` | the scoped ticket: which repos, what scope, acceptance criteria. The router. | audit | `discover.mjs`; the `dirty === false && headSha !== null` eligibility gate |
| `zyncai-audit` | the **findings**, each tiered 1–4 | fix | `audit-checklist.md`; graph provenance rules |
| `zyncai-fix` | the **fix on a branch**, one finding per branch | verify | tier→model routing: `orch-hand` (t1), `orch-mid` (t2/t3), `orch-deep` (t4) |
| `zyncai-verify` | the **verification table** — what ran, passed, failed, was unavailable, per command with reasons | fix (defects) and pr (evidence) | `verify-chain.mjs`; the mutation standard; the fixed result vocabulary |
| `zyncai-pr` | the **draft PR**, and the human merge gate | the human | `pr-policy.md` |
| `zyncai-study` | the repo's generated skill file, stamped with `studiedSha` | every later run | `study-state.mjs`, `study-template.md`, `validate-assets.mjs` |
| `zyncai-explain` | an answer with citations. Never writes. | the asker | already in the zyncai spec as `zyncai-explain` |
| `zyncai-scope` | a ticket's blast radius. Never writes. | the human | already in the zyncai spec as `/zyncai-scope` |

`zyncai-verify` judges and never fixes, exactly as `sam-qa` does. A gate that can
also repair what it is judging is not a gate.

Ops is the router. A gap found by a later seat (verify cannot judge a fix because
a repo's only lint script is `--fix` only) goes back through Ops, not sideways
between seats.

### T5–T9 become seats, not scripts

The remaining tasks of the current build are absorbed rather than discarded:
T5 (repo agent) becomes `zyncai-audit` plus `zyncai-fix`; T6 (contract auditor)
becomes part of `zyncai-audit`; T7 (orchestrator) becomes `zyncai-pipeline`;
T8 becomes `zyncai-scope`; T9 becomes the `zyncai` front door.

## The ticket-store boundary

The orchestrator talks to an interface, never to a store.

```
zyncai-pipeline  ──talks only to──▶  ticket-store interface
                                         │
                        ┌────────────────┼────────────────┐
                        ▼                ▼                ▼
                 file adapter      zyncws adapter    whatsapp adapter
                 (ships now)       (later)           (later, listener)
```

| Operation | Purpose |
|---|---|
| `openTicket(request)` | intake creates the ticket, returns an id |
| `readTicket(id)` | resume reads status and the last handover entry |
| `setStatus(id, status)` | stage transitions, including the two stop states |
| `appendLog(id, entry)` | the handover record each seat leaves for the next |
| `recordDeliverables(id, rows)` | gate evidence, per that seat's `deliverables.md` |

**Status vocabulary** — the pipeline names statuses, never stores:
`intake`, `auditing`, `fixing`, `verifying`, `pr_open`, `on_hold`,
`information_missing`, `completed`.

This follows SAMI's standing rule that integrations are interim: keep the
integration in its own module so swapping it is a contained change, and never
build a feature that assumes the current mechanism is permanent. A WhatsApp
listener later is an adapter plus an intake trigger, not a rewrite.

### The file adapter

Ships first, and is what makes the plugin usable with no external service. One
directory per ticket:

```
<store-root>/<ticket-id>/
  state.json      machine state — status, seats' progress, escalations
  ledger.md       human-facing prose record, unparsed by anything
  findings/       one file per finding
  reports/        per-seat handover reports
```

From the superseded board spec, these survive because each was paid for by a real
defect:

- **Atomic writes.** Temp-then-rename, never in-place. The build ran concurrent
  agents against shared files and this is the class of problem it kept meeting.
- **Error channel by provenance.** Content of `state.json` is hand-editable by
  design, so a truncated document or a bad enum is a *store condition* on the
  coded channel. A shape nothing upstream can produce is a caller bug, uncoded.
  At a CLI boundary the channel is the exit code: 0, 1 (store condition),
  2 (zyncai bug).
- **Full 40-character shas only.** A short prefix can name a different commit,
  and a false match means drift is never detected.

What does **not** survive: `state.json` as the architecture, and the task-graph
validator. `pipeline-graph.md` replaces the latter.

## Loop limits and the stop states

| Trigger | Response |
|---|---|
| **Fix-round cap** — `maxFixRounds` (default 5) reached without an approved verdict | `on_hold`; log the recurring defects; ask the human: keep iterating / change the scope / abandon |
| **Deadlock** — the same finding returned twice with no new information | `on_hold` with reason `deadlock`, regardless of rounds remaining |
| **Rail conflict** — a safety rail rejects the task's only viable approach | `information_missing`; state exactly what a human must decide |
| **Spec drift** — the spec moved past the commit its amendments were verified against | dispatch blocked until amendments are re-diffed and the verified commit bumped |

SAMI caps its QA loop at 3 rounds; zyncai's default is 5 because its own build
spent five productive rounds on Task 1 and each round found real defects. It is
a configured knob, not a constant.

**Deadlock detection** compares a fingerprint of the incoming finding
(file + line + description) against the stored previous round's, before
overwriting it. Exact, not fuzzy: a reviewer restating the same defect in
different words is therefore not caught, accepted deliberately, because fuzzy
matching would fire on two genuinely different findings in the same function and
escalate a healthy loop. SAMI has no equivalent; this is additive.

**The spec-drift guard** is likewise additive. zyncai's build hit spec drift
twice — `AMENDMENTS.md` item 8 contradicted the spec it was required reading for,
and a `headSha` gate landed after Task 4 closed, leaving `safety-rails.md`
half-stale. Both were caught by an agent trying to *apply* a rule precisely, not
by review of the document. A required-reading file drifting from the spec is
worse than the spec drifting, because nobody re-reads it. SAMI needs no
equivalent because its rules library is not a moving spec under active
amendment.

### Human moments

Two, and only two, mirroring SAMI's "sacred gates":

1. **Intake confirmation** — one shot, all details at once, before the ticket is
   created.
2. **The merge** — zyncai opens draft PRs and never merges. This is already a
   safety rail, and it is also the second gate.

Between them the pipeline runs without asking. A mid-run unknown is resolved by
a documented rule, a default, or a recorded ruling — never by a question. When a
seat genuinely cannot proceed it sets a stop state, says exactly what is needed,
and stops. It never ends a turn asking whether to continue, and never grants
itself a permission.

## Gates, graph, and evals

**`deliverables.md` per seat** — a table of rows with a "Met when" column. A seat
does not hand over until every row is met, and the receiving seat sends it back
rather than working around it. Copied from SAMI structurally.

**`pipeline-graph.md`** — the pipeline written as nodes, each declaring what it
reads and what it produces. Its role is exactness of resume: *a node whose
outputs already exist is skipped, never re-run.* Before the final handover the
graph is walked top to bottom; any node with missing outputs sends the ticket
back to that node's owner rather than forward with a gap.

**`evals/evals.json` per seat** — one case per process, so every stage of a seat's
workflow and every row of its `deliverables.md` has at least one case.

```jsonc
{
  "skill_name": "zyncai-verify",
  "evals": [{
    "id": 0,
    "eval_name": "mutating-lint-is-unavailable-not-passed",
    "process": "Verify steps (SKILL.md — execution gates)",
    "kind": "gate",
    "prompt": "…the situation the skill is dropped into…",
    "expected_output": "…what a correct run produces…",
    "files": [],
    "assertions": ["…", "…"]
  }]
}
```

`kind` is `happy_path` (the process runs as written), `gate` (the seat refuses to
hand over until its rows are met), or `regression` (a rule learned the hard way,
each tracing to a real run). The `assertions` **are** the eval: each is one thing
observably true of a run, phrased so a human or judge model can mark it without
re-reading the skill.

**A rule with no assertion is a rule nothing protects.** Every rule added to a
SKILL.md gets a case. zyncai's build produced a set of hard-won rules that
currently live only in a prose ledger — fail-closed mutation harnesses, the
provenance error channel, INFERRED edges are leads not citations, a check that
did not run is never reported as passed — and each becomes a `regression` case
traceable to the round that found it.

## Safety rails stay global

`safety-rails.md` moves to the orchestrator's references and binds every seat.
SAMI has no equivalent because it is not editing other people's repositories.
zyncai is, so it needs the rails more, not less: never auto-merge, never commit
to a protected branch, never `git add -A`, never bare `git stash`, never execute
a verify step flagged `mutates` or `watches`, never make a flagged step safe by
rewriting it, and never report a check that did not run as one that passed.

A rail is never satisfied by working around it. Rewriting a command, stripping a
flag, widening a path, or relaxing a comparison to get past a rail is the rail
doing its job — the response is to report the block.

## Migration

1. Scaffold `~/Projects/zyncai` as a new git repo with the plugin structure and
   empty seat skeletons. The live worktree is not touched.
2. Copy in the four committed scripts and the four reference documents from the
   worktree, distributed to the seats named in the table above. Copy, not move —
   a session is actively committing there.
3. Author the seats' `SKILL.md`, `deliverables.md`, and `evals.json`.
4. Ship the file ticket-store adapter.
5. Once T1–T4 stop moving, retire `skills/zyncai/` in the `~/.claude` worktree
   and make the plugin the single source of truth.

Load during development with `claude --plugin-dir ~/Projects/zyncai`. Do not
`claude plugin install` a local plugin — installing copies the root into
`~/.claude/plugins/cache/` and hands back a stale snapshot that ignores local
edits.

## Implementation staging

This design is one architecture but more than one plan's worth of work. It is
built in three milestones, each of which produces something that runs on its own
rather than a layer that only pays off later.

| Milestone | Contents | Usable on its own because |
|---|---|---|
| **M1 — walking skeleton** | plugin manifests, the front door, `zyncai-pipeline`, `zyncai-ops`, the file ticket-store adapter, `pipeline-graph.md`, `ticket-protocol.md`, `safety-rails.md` | a ticket can be opened, scoped, routed, stopped, and resumed exactly. No findings yet, but the team's spine is testable end to end. |
| **M2 — the maintenance loop** | `zyncai-audit`, `zyncai-fix`, `zyncai-verify`, `zyncai-pr`, each with its `deliverables.md` | this is zyncai's existing job, now running through the team: a real finding becomes a real draft PR with an honest verification table. |
| **M3 — knowledge and read-only seats** | `zyncai-study`, `zyncai-explain`, `zyncai-scope`, and the full eval sets across every seat | repo knowledge accumulates and stops being re-derived; the read-only commands answer without risk of writing. |

Each milestone gets its own implementation plan. M1's plan is written first;
M2 and M3 are not planned until M1 runs, because M1's pipeline graph is what
tells M2's seats what they must read and produce.

## Out of scope

- **Phase 2** — an intake seat that turns an ambiguous request into a spec, a
  machine-checkable spec clause registry, and amendment-reopens-downstream-tasks.
  This design *blocks* on spec drift; it does not reopen closed tasks.
- **Phase 3** — architecture-as-retrieval over the canonical repos for greenfield
  work.
- The zyncws and WhatsApp ticket-store adapters. The interface is specified here
  so they are contained changes later; neither is built now.
- Any live service (a listener daemon, a webhook receiver). The file adapter and
  an interactive session are the whole runtime.

Permanently out of scope, for any phase: priority, tradeoffs with stakes,
accountability for production, and irreversible actions — production deploys,
migrations against live data, and movement of money.

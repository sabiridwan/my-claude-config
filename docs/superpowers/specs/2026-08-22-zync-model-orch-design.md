# zync-model-orch — Design

**Date:** 2026-08-22
**Status:** Approved design, not yet implemented
**Scope:** Global (`~/.claude`), applies to every project

---

## Problem

Every prompt runs on the session model regardless of what it needs, with the full
conversation resent each turn. That is wrong in both directions:

- **Downward.** Trivial work — locating a symbol, fixing a typo, writing a commit
  message, answering a definition question — burns the session model.
- **Upward.** Genuinely hard work — architecture, deep debugging, correctness-critical
  payroll logic — gets the session model when a more capable one exists above it.

The goal is therefore routing to the *right* model, not merely the *cheap* one. Net
token effect is a reduction on read-heavy days and an increase on hard ones. This is
deliberate; the log measures which.

Model ladder, confirmed against the installed CLI:

```
haiku  <  sonnet  <  opus (current session)  <  fable
```

`Fable 5 - most capable for your hardest and longest-running tasks` (string extracted
from CLI 2.1.228).

## Constraint that shapes the design

**Hooks cannot change the model.** Verified against the installed CLI
(`~/.local/share/claude/versions/2.1.228`). The hook output schema carries only:

- `additionalContext`
- `permissionDecision`
- `updatedInput`
- `displayContent`
- `worktreePath`

There is no `model` field on any hook event. By the time `UserPromptSubmit` fires,
the turn is already bound to the session model. True per-prompt model routing inside
an interactive session is not achievable.

**This cuts both ways.** The hook can no more raise the session to `fable` than it can
drop it to `haiku`. Escalation therefore has exactly two mechanisms, both advisory:

1. Nudge the operator to run `/model fable` themselves for the next stretch of work.
2. Nudge the assistant to spawn a `fable` subagent for the hard part, leaving the
   session on `opus`.

Option 2 is the default recommendation because it is scoped to one task and needs no
human action. Option 1 is suggested only when the escalation signal repeats.

Model is selectable at four surfaces only:

| Surface | Mechanism |
|---|---|
| Session | `/model`, `--model` |
| Subagent definition | `model:` frontmatter in `.claude/agents/*.md` |
| Agent tool call | `model` param — **overrides frontmatter** |
| Headless | `claude -p --model <alias>` |

The `Agent` tool's `model` param overriding frontmatter is the load-bearing fact:
it means the router can name an existing agent AND a cheaper model at the call site,
with no new agent files and no edits to plugin-owned agent definitions.

## What this actually saves

The routing decision itself still costs session-model tokens on full context. That is
unavoidable and is not claimed as a saving.

Savings come from the *work* moving to a cheap model: file reads, greps, mechanical
edits, and their outputs never enter the main context. Estimated 20–40% on a
read-heavy day, near zero on an architecture day. The log (below) replaces this
estimate with a measured number.

---

## Architecture

```
~/.claude/
  hooks/
    model-orch.sh          UserPromptSubmit entry. Bash, zero deps.
    model-orch-rules.json  Ordered tier rules. Tunable without touching code.
    model-orch.test.sh     Fixture table -> expected tier. Runs <1s.
  settings.json            + hooks.UserPromptSubmit entry
  model-orch.log           Append-only decision log
```

No new agent files. No edits to `~/.claude/plugins/**` (plugin cache is clobbered on
update — anything written there is lost).

### Data flow

```
user prompt
  -> UserPromptSubmit hook fires, receives JSON on stdin
  -> model-orch.sh extracts prompt text
  -> veto check (forced T5)
  -> ordered rule match against model-orch-rules.json
  -> compound-clause escalation
  -> append decision to model-orch.log
  -> emit hookSpecificOutput.additionalContext (or emit nothing)
  -> main loop reads the nudge, delegates or ignores
```

---

## Tier table

| Tier | Prompt shape | Route |
|---|---|---|
| T0 | Pure knowledge question, no repo noun | Answer inline. No tools, no agent. |
| T1 | "where is X", "what calls Y", "list all", "map dir" | `Agent(cavecrew-investigator, model:"haiku")` |
| T2 | Typo, rename, comment removal, single-field tweak | `Agent(cavecrew-builder, model:"haiku")` |
| T3 | Commit message, docs, summarize, changelog | `Agent(general-purpose, model:"haiku")` |
| T4 | Bounded multi-file feature, already specified | `Agent(general-purpose, model:"sonnet")` |
| T5 | Everything else | Main loop. **No injection.** |
| T6 | Hardest work — architecture, deep debug, correctness-critical | `Agent(general-purpose, model:"fable")`, or suggest `/model fable` |

T2 targets `cavecrew-builder`, which hard-refuses 3+ file scope. That refusal is a
second safety net under the classifier: a misrouted large task bounces back rather
than being done badly.

---

## Classifier

### Ordering — safety first

1. **Veto list runs first.** Any match forces T5 regardless of every other rule:

   `payroll|statutory|contribution|tax|migration|production|deploy|security|auth|
    credential|secret|failing|not working|why is|debug|refactor|architect`

   `schema` was considered and rejected. In a Mongoose codebase almost every backend
   prompt contains the word, so vetoing on it would suppress routing across the entire
   repo. `migration` covers the genuinely irreversible case.

   Rationale: these are the domains where a wrong answer is expensive and where the
   session model's judgment is the product. Payroll and statutory code must never be
   routed to a cheap model by accident.

   A veto hit lands on **T5 by default**. It escalates to **T6** only when a
   hardness signal is also present:

   `architect|design the|rewrite|from scratch|end.to.end|whole (system|module)|
    root cause|intermittent|race condition|data loss|corrupt|audit`

   So `"fix the payroll typo"` is T5 (veto stops the haiku route, nothing more) while
   `"find the root cause of the intermittent payroll rounding drift"` is T6.

2. **Ordered first-match-wins regex** against the lowercased prompt.

3. **Compound-clause handling.** A prompt joining two or more clauses with
   `and` / `then` / `also` does **not** change tier — the matched rule is still the
   best available guess at the work. It lowers confidence to `low`, which softens the
   injected wording.

   `T0` is the single exception. A knowledge question welded to an action clause
   (`"what is a repository and then show me one"`) is no longer answerable inline, so
   it drops to `T5` and the main loop takes it. Routing it to an edit agent would act
   on a half-understood ask, which is worse than not routing at all.

   An earlier draft escalated compound prompts by one tier. That was dropped: moving a
   locate request up to an edit agent because it contained the word "then" changes what
   the agent is permitted to *do*, on the basis of a signal that only indicates the
   prompt is long.

### Default is silence

No confident match emits nothing. The failure mode of this system is "does nothing",
never "does something wrong." Every prompt that does not clearly fit a tier behaves
exactly as it does today.

### Confidence

Two levels only:

- `high` — rule matched, no escalation signal present. Wording: `prefer Agent(...)`.
- `low` — rule matched but an escalation signal is also present. Wording:
  `this may be routable to Agent(...) — use judgment`.

There is no third level. A prompt that matches no rule emits nothing at all; it is
not "low confidence T5", it is simply absent from the output.

### Output contract

```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "[zync-model-orch] tier=T1 confidence=high — prefer Agent(cavecrew-investigator, model:\"haiku\") for this. Override if the classification is wrong."
  }
}
```

Wording is advisory throughout. The nudge always ends with an explicit override
clause so a misclassification costs one sentence of context, not a wrong result.

---

## Rules file format

`model-orch-rules.json`, ordered array, first match wins:

```json
{
  "veto": "payroll|statutory|...",
  "escalate": "\\band\\b.*\\b(also|then)\\b|\\bthen\\b",
  "tiers": [
    {
      "tier": "T0",
      "match": "^(what (is|does|are)|define|explain)\\b",
      "inline": true
    },
    {
      "tier": "T1",
      "match": "^(where|which file|what calls|find|locate|list all|map|show me all)\\b",
      "agent": "cavecrew-investigator",
      "model": "haiku"
    }
  ]
}
```

A rule carries either `inline: true` (T0 — answer directly, delegate to nothing) or
an `agent` + `model` pair (T1–T4, T6). Never both, never neither. T5 is the absence of
a rule, so it is never listed in `tiers`.

T6 is not a `tiers` entry either. It is derived: veto hit AND `hardness` regex match.
It lives beside `veto` at the top level:

```json
{
  "veto": "payroll|statutory|...",
  "hardness": "architect|root cause|race condition|...",
  "escalate": "\\band\\b.*\\b(also|then)\\b|\\bthen\\b",
  "tiers": [ ... ]
}
```

Rules live in data, not code, so tuning against the log is an edit to one JSON file
and a test run — no shell logic changes.

---

## Logging

Every fire appends one line to `~/.claude/model-orch.log`:

```
2026-08-22T14:03:11Z | /Users/sabiridwan/Projects/zerp/zerp-be | T1 | rule:locate | where is resolveGroupId defined
```

Prompt is truncated to 60 characters. Silent (T5, no-match) decisions are logged too,
with `tier=T5 rule=none` — otherwise there is no way to find prompts that *should*
have matched but did not.

The log is the only way to know whether this works. Without it the savings number
stays a guess.

---

## Error handling

- Hook exits 0 on every path. A crashing router must never block a prompt.
- Malformed or missing rules file: log the error to stderr, emit nothing, exit 0.
- Missing `jq`: fall back to a `sed`-based prompt extraction, or emit nothing. Never fail.
- Log write failure (disk full, permissions): ignored. Logging is not load-bearing.
- Unparseable stdin: emit nothing, exit 0.

The whole component is designed to degrade to a no-op.

---

## Testing

`model-orch.test.sh` — a fixture table of prompt strings mapped to expected tiers,
asserted in pure bash. No network, no API calls, sub-second.

Fixture set must include:

- Real prompts from the session that produced this spec
  (`"what is short form of orchestration"` -> T0,
   `"what does that mean"` -> T0)
- One veto probe per veto keyword — asserting T5 even when the prompt *also* matches
  a cheap tier (e.g. `"where is the payroll tax band defined"` -> T5, not T1)
- Two compound-clause cases: one asserting the tier is *unchanged*
  (`"where is resolveGroupId defined and then rename it"` -> T1, not T2) and one
  asserting the T0 exception (`"what is a repository and then show me one"` -> T5)
- At least three prompts that must produce no output at all

- One T5-vs-T6 discrimination pair sharing a veto keyword, asserting that the hardness
  signal is what separates them:
  `"fix the payroll typo"` -> T5, `"find the root cause of the intermittent payroll
  rounding drift"` -> T6

The veto probes are the most important tests. They are the ones that prevent an
expensive mistake in the cheap direction. The T5/T6 pair guards the expensive
direction: without it, every veto hit could silently drift into `fable`.

---

## Non-goals

- Headless CLI router (`zo "..."` wrapper). Considered, deferred. Real routing but
  one-shot and outside the interactive session.
- Any API-based classifier. Local heuristic only — zero token cost, deterministic,
  debuggable.
- Editing plugin-owned agent files.
- Blocking or rewriting prompts. This system only appends context.
- Automatically switching the session model to `fable`. Not possible from a hook, and
  not desirable unattended — `fable` is the most expensive rung on the ladder.

---

## Noted, not in scope

Three agent definitions have no `model:` line and therefore inherit the session model
for work that does not need it:

- `~/.claude/plugins/cache/caveman/caveman/*/agents/cavecrew-builder.md` (plugin-owned)
- `~/.claude/agents/zync-gold-finance.md`
- `~/.claude/agents/zync-supervision.md`

`cavecrew-builder` is the notable one: the bounded-edit agent runs on the session
model today. The `Agent` tool's `model` param override means this design works
regardless, but fixing the frontmatter would help every other caller too.

Flagged only. Not touched — separate decision.

---

## Implementation order

1. Probe the real `UserPromptSubmit` stdin payload with a throwaway hook that dumps
   it to a file. Do not guess the field names.
2. `model-orch-rules.json` — veto list and tier rules.
3. `model-orch.test.sh` — fixtures first, including all veto probes.
4. `model-orch.sh` — until tests pass.
5. Wire `hooks.UserPromptSubmit` into `~/.claude/settings.json`, preserving the
   existing `SessionStart` caveman hook.
6. Run for one week. Read the log. Tune the rules.

---
name: z-agent
description: Dispatch parallel Agent calls for fan-out work — search/locate, mechanical edits, prose drafts, bounded multi-file, architecture. Triggers on "fan out", "in parallel", "across N files/repos", "use subagents", "split this", "agent team", "parallel scan", "z-agent", or any request that smells like N independent units of work. Respects the concurrency-lift cap (5 on laptop, higher on GPU), batches 3-5 at a time, waits between batches, and refuses wider fan-out unless explicitly asked.
---

# z-agent — fan-out dispatcher

When a request smells like N independent units of work — sweep many files,
run N checks in parallel, edit N modules against the same pattern — this
skill decides **whether** to fan out, **how many** at once, and **which
agent tier** to dispatch for each unit.

The dispatcher itself does not do the work. It picks the right agent
(`orch-scout` for locate, `orch-hand` for typo, etc.) and the right model
(cheapest that can still answer), wires the prompt, and respects the
host-wide concurrency cap from `concurrency-lift.mjs`.

## When to invoke

Trigger if **any** of the following is true:

1. **N is enumerable.** "Check every `*.module.ts` in zyncg-server" — N=86, parallelisable.
2. **Units are independent.** Each scan reads its own file; nothing crosses.
3. **Cost of waiting > cost of dispatch.** N unit searches in serial is N×wall-clock.
4. **User asked.** "fan out", "in parallel", "across these repos", "use subagents".

Do **not** trigger when:

- N ≤ 3 and any unit needs design judgment (one combined Opus call is cheaper).
- Units have ordering dependencies ("after B runs, A is no longer needed").
- Single read or single edit — `Agent` tool is overkill, use `Read`/`Edit`.
- The fan-out would cross the host concurrency cap (see below).

## The decision tree

```
User request → {N units, independent?}
   ├─ no → do it inline, this skill is the wrong tool
   └─ yes → is N > 5?
        ├─ no  → single batch, dispatch all N in parallel
        └─ yes → batch in groups of ≤ 5, wait between batches
                 (sleep 1–2s; the next turn the harness sees results)
```

Within a batch, **tier per unit** is decided by the work, not by the
batch. See `references/agents.md` for the tier table.

## Host concurrency cap

| Host | Cap | Source |
|---|---|---|
| Local Mac | **5** | `~/.claude/hooks/concurrency-lift.mjs` (PreToolUse Agent) |
| GPU box (`gpu`, `msprod`, hostname `gpu*`, env `ZYNCAI_GPU=1`) | **lifted** | same hook, recognises the marker `~/.zyncai/gpu-mode` |

`ListAgents` is the source of truth for "currently running". If the
counter file (`/tmp/zyncai-agent-count-<sid>`) shows `>= 5` but no
agents are actually running, the counter leaked — delete it. Memory
`project_concurrency_counter_leak` documents the failure mode.

**Always run `ListAgents` before dispatching a new batch.** If `>= 5`,
wait; do not spawn more.

## Per-unit prompt shape

Every Agent call gets the same four fields:

| Field | Content |
|---|---|
| `subagent_type` | one of `orch-scout`, `orch-hand`, `orch-scribe`, `orch-mid`, `orch-deep` (model-pinned; do not override) |
| `description` | "verb + scope" — "audit HR payroll", not "do HR thing" |
| `prompt` | the unit, standalone — no shared state, no referring to siblings |
| `isolation` | `worktree` only if units must not race on the same checkout |

Prompts **must not** include credentials, full file dumps (link paths
instead), or instructions to push/merge/deploy. Those are caller-side.

## When to refuse

- **Push/merge/deploy in the prompt.** Orchestrator-side only. Refuse and re-route.
- **>10 units in one batch.** Beyond the cap, batching math breaks down — ask before fanning wider.
- **Cross-repo destructive ops.** Same destructive-belt applies as the main thread.
- **One Opus call would be cheaper than five Sonnet calls.** Use main thread with Opus, not five subagents.

## Related skills

- `superpowers:using-superpowers` — skill lookup baseline.
- `zync-autopilot` — full autonomous execution; z-agent is its fan-out primitive.
- `zync-model-orch` — model router for solo work (this skill is for multi-agent).
- `concurrency-lift` hook (in `~/.claude/hooks/`) — the cap this skill respects.

See `references/agents.md` for the per-tier agent table and prompt templates.

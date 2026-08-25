# zyncai autonomous audit→ticket sweep — design

Date: 2026-08-26
Status: approved, ready for implementation plan

## Problem

zyncai's intake is Ops-only, human-initiated free text, one ticket at a time.
Phase 1 of the team plan ([[zyncai-team-phase-plan]] in memory) requires
issue fixes end-to-end on existing repos with the human touching only two
moments: intake and merge. Today intake is one repo's worth of work per
human interaction — there is no way to say "audit everything and open
tickets for what you find" without a human writing N requests by hand.

Prerequisite work (2026-08-26, commit `55f0691`): removed the auto-merge
lane so every zyncai PR is a draft and no seat merges. This design assumes
that is in place — a sweep that opens N tickets autonomously would be far
riskier stacked on top of an auto-merge lane.

## Non-goals

- Scheduling (cron, recurring sweeps). Explicitly deferred — see Decision 3.
- Changing anything about Fix, Verify, PR, or Review. A sweep-opened ticket
  runs the identical unattended pipeline a human-opened ticket runs from
  `auditing` onward.
- Cross-repo contract auditing (T6 / `zyncai-contract`). Out of scope,
  unbuilt, tracked separately.

## Decisions

### 1. Consent is amortized to the sweep, not per-finding

The codebase currently declares two "sacred" human moments: Ops's one-shot
yes and the merge. A sweep must not silently invent a third path around the
first one. Instead the one-shot yes is asked once, for the whole sweep
(scope, tier ceiling, caps), and every ticket the sweep opens inherits that
consent. This preserves a real, reasoned consent moment — the human approves
something they can actually evaluate (a scope) rather than being asked to
approve findings they haven't seen yet — while keeping the per-ticket loop
fully unattended, matching the existing rule that nothing between the two
sacred moments asks a question.

Rejected: a proposal queue (reintroduces a per-finding human step, which is
just Ops's interview with added latency and no clearer consent); dropping
the moment entirely (the draft PR becomes the only checkpoint, which risks
burning many fix/verify rounds before a human sees anything); a standing
policy file (durable but silently authorizes work under conditions that
have since changed).

### 2. One ticket per repo

A sweep spans multiple repos and yields many findings. Granularity is one
ticket per eligible repo, opened at `auditing`. This is not a new model — it
is the existing one, run N times. Audit already writes `findings[]` for one
repo onto one ticket; Fix/Verify/PR already loop per finding via node 11's
re-entry. A wedged repo (`on_hold`, `information_missing`) affects only its
own ticket; the others proceed and resume independently.

Rejected: one ticket per sweep (a single bad repo would freeze status for
every other repo, and resume would have to re-derive which repo a
multi-repo ticket was mid-way through — the store has no field for that);
one ticket per finding (requires Audit to run *before* any ticket exists,
inverting its entry contract of `readTicket` on entry, and bypasses node
11's already-working loop for no benefit).

### 3. Manual trigger only — no scheduler

`/zyncai-sweep` is a command a human runs. No cron, no daemon. The trigger
and the consent moment are the same act, which keeps this design small: no
scheduler to build, no stale-policy problem, no story needed for a sweep
firing while the last one is still mid-flight. Autonomy is entirely in what
happens *after* the yes — N repos audited, fixed, verified, PR'd, all
without a further prompt.

Scheduling is explicitly deferred, not foreclosed: nothing in the ticket
model below assumes a human triggered the sweep by hand, so a future cron
front-end could reuse everything except the interview.

### 4. Ops gains a sweep mode; the command is a thin front door

Two shapes were considered: a standalone `zyncai-sweep` seat that
re-implements discovery, the eligibility gate, and ticket-opening; or
`/zyncai-sweep` as a thin collector that hands off to Ops running in a
second mode. The standalone seat would duplicate Ops's eligibility gate —
the exact logic standing between the pipeline and a dirty repo — in a
second implementation that can silently drift from the first. Chosen:
Ops gains sweep mode. `/zyncai-sweep` collects the consent and invokes
`zyncai-ops` once; Ops remains the only caller of `openTicket`, so
`ticket-protocol.md`'s claim that only Ops opens tickets stays true instead
of becoming a convention the code no longer enforces.

Cost accepted: Ops's `references/interview.md` is single-request shaped and
needs a genuine second path (`references/sweep.md`), not a flag on the
existing one. Ops becomes the largest seat. This is a visible, bounded cost
versus the duplicated-gate risk, which fails silently and expensively.

## Architecture

```
human ── /zyncai-sweep ──▶ collects consent ──▶ zyncai-ops (sweep mode)
                                                      │
                              discover.mjs (once) + eligibility gate (once)
                                                      │
                                    one-shot yes, covering the whole sweep
                                                      │
                        for each eligible repo, up to cap (SERIAL, not parallel):
                          openTicket({ request: synthesized,
                                        repos: [repo],
                                        origin: 'sweep:<sweepId>' })
                          → ticket criteria set from ceiling
                          → routed straight to `auditing`
                                                      │
                    each ticket now runs the UNCHANGED pipeline: audit → fix →
                    verify → pr → review, exactly as a human-opened ticket does
                                                      │
                              sweep report: repos audited, tickets opened,
                              tickets capped-out (named), PRs pending
```

Nothing downstream of "ticket enters `auditing`" changes. This is the load-
bearing property of the whole design: a sweep-opened ticket is
indistinguishable from a human-opened one to every seat from Audit onward.

## Data model changes

`tools/ticket-store/file.mjs`:

- **`origin` field.** `openTicket` gains `origin` (default `'human'`,
  or `'sweep:<sweepId>'`). `validate()` requires it present. No migration
  needed — no production ticket data predates this design.
- **`swp-NNNN` id sequence** for sweeps themselves, parallel to `zai-NNNN`
  for tickets. A sweep is not a ticket; it does not go through
  `openTicket`, `setStatus`, or the ticket status vocabulary. It is a
  record of a consent event and its resulting ticket ids, written once when
  the sweep starts and appended to as tickets open.
- **Atomic id allocation.** `nextId` currently scans for max `zai-NNNN` and
  writes max+1 with no atomicity — two concurrent opens can collide, and
  the second `writeState` silently overwrites the first (`file.mjs:142`).
  Fix: try-create the candidate id's directory with an exclusive flag,
  retry candidate+1 on a "already exists" failure. Applies to both
  sequences. This is required even though sweep ticket-opening is serial
  (decision below) — Fix/Verify/PR still run across a sweep's tickets
  concurrently in principle, and the fix is cheap and general.

## Ops sweep mode

New `skills/zyncai-ops/references/sweep.md`. Consent shape, collected by
`/zyncai-sweep` and handed to Ops:

```
{
  repos: 'all' | [repo names],
  tierCeiling: 1 | 2 | 3 | 4,
  maxRepos: <int>,
  maxFindingsPerRepo: <int>,
  criteria: <string, optional override>
}
```

Default synthesized criteria (used unless the human overrides it in the
consent interview): *"every confirmed finding at or below tier
`tierCeiling` reaches a draft PR; nothing merges without a human."*

Ops runs `discover.mjs` once and the eligibility gate once — not once per
repo — producing the same `repos[]` with `dirty`/`headSha` the single-ticket
path already produces. The one-shot confirmation is presented once, naming
every eligible repo it is about to open a ticket for, the tier ceiling, and
the caps. On yes, Ops opens tickets **serially**, one per eligible repo up
to `maxRepos`, each with `origin: 'sweep:<sweepId>'` and criteria from the
consent. Serial, not parallel: it removes the id-allocation race as a live
concern for ticket-opening specifically (the atomic-id fix above still
exists as defense in depth for the rest of the pipeline), and keeps the
eligibility report coherent as one pass rather than N interleaved ones.

## Edge cases

| Case | Behavior |
|---|---|
| `maxRepos` reached mid-sweep | Stop opening. Report exactly which eligible repos were left out by name — never silently truncate, matching the existing honesty rules in `safety-rails.md`. |
| A repo is gate-rejected (dirty, no headSha) | Same skip-with-reason as the single-ticket path today. Does not count against `maxRepos`. |
| One repo's ticket goes `on_hold` or `information_missing` | No effect on the sweep's other tickets — this is the payoff of one-ticket-per-repo. Each resumes independently via the existing resume table. |
| `maxFindingsPerRepo` reached | Audit still files every finding it confirms per its own contract (never silently dropped there); this cap governs how many findings *this sweep's fix loop will act on* for that repo — findings beyond it are named in the sweep report as not acted on this run, not hidden. |
| Sweep report | Once at sweep-end: repos audited, tickets opened (ids), repos skipped (name + reason), tickets capped out. Same honesty shape as node 4's per-ticket finish report today. |

## What this design does not decide

- Exact wording/flow of the sweep consent interview (mirrors
  `interview.md`'s style; left to implementation).
- Whether `maxFindingsPerRepo` limits Fix rounds or PR count — needs one
  more concrete choice during planning, not a new design decision.
- The live `studying` status bug found during the prior audit
  (`TICKET_STATUSES` in `file.mjs:61-70` is missing `studying`, which
  `ticket-protocol.md`, `ops/deliverables.md` and pipeline nodes 7a/8a all
  require). Unrelated to this design; tracked separately, not fixed here.

## Related

[[zyncai-project-state]], [[zyncai-team-phase-plan]], [[zyncai-verification-rules]]

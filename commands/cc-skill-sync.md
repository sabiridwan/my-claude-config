---
description: Harvest lessons from shipped cc page repos and propose cc-* skill edits (report only, nothing applied)
---

Dispatch the `cc-skill-maintainer` subagent to harvest lessons from the Sam Media / Ouisys
credit-card page repos and propose edits to the `cc-*` skills.

Run it synchronously (`run_in_background: false`) — the report is the point of the command, so wait
for it.

Pass through any argument the user gave as extra scope: $ARGUMENTS
- A repo name or path → harvest only that repo, ignoring the state file's SHA check.
- A skill name → only propose edits targeting that skill.
- Empty → normal run: every repo whose SHA changed since the last run.

When the agent returns:

1. Show the proposal list — fingerprint, target, claim, kind — plus the watchlist and discarded
   counts. Point at the report file for the full diffs.
2. Ask which proposals to apply. Do not apply anything unasked; the agent deliberately has no `Edit`
   tool and that boundary is the whole design.
3. For each approved proposal: apply the diff to the skill file, then commit in `~/.claude` with
   `docs(cc-skills): <claim>`.
4. Update `~/.claude/cc-skill-sync/state.json` from the report's `## State patch` block — advance the
   harvested SHAs, and append the fingerprints of anything rejected to `state.rejected` so it is
   never proposed again.

Step 4 is not optional. Skip it and the next run re-proposes everything the user just rejected.

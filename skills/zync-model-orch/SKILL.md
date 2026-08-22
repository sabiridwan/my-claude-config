---
name: zync-model-orch
description: >
  Inspect, tune, and troubleshoot the zync-model-orch prompt router — the
  UserPromptSubmit hook that classifies each prompt and nudges trivial work toward
  cheaper models. Use when asked "is model orch working", "what is the router doing",
  "why didn't that route", "tune the model orch rules", "add a routing rule", "model
  orch status", or when reviewing whether the router is actually saving anything.
  Also use before editing model-orch-rules.json by hand — rule edits without a fixture
  can silently break the veto that keeps payroll and migration work off cheap models.
---

# zync-model-orch

An advisory prompt router. A `UserPromptSubmit` hook classifies every prompt with local
regex, then injects a one-line nudge naming which agent and model should do the work.

## What it can and cannot do

**It cannot change the model of the current turn.** Verified against the CLI binary: the
hook output schema has 19 fields and none of them is `model`. By the time
`UserPromptSubmit` fires, the turn is bound. The router moves *work* to cheap models by
nudging delegation to a subagent; it never switches the session model.

**It is Claude Code only.** Claude Desktop has no hooks system — its config holds MCP
servers and preferences, nothing executable. There is no surface to attach to.

Never tell the user this routes their session model. It does not.

## Layout

```
~/.claude/hooks/model-orch.sh          classifier + hook mode
~/.claude/hooks/model-orch-rules.json  all routing data — edit this, not the script
~/.claude/hooks/model-orch.test.sh     fixtures; the gate for every change
~/.claude/model-orch.log               one line per decision, including silent ones
~/.claude/agents/orch-*.md             the five tier agents
```

## Tiers

| Tier | Shape | Route |
|---|---|---|
| T0 | knowledge question | answer inline, no agent |
| T1 | locate: where/what-calls/list | `orch-scout` haiku |
| T2 | mechanical 1-2 file edit | `orch-hand` haiku |
| T3 | prose: commit msg, docs, summary | `orch-scribe` haiku |
| T4 | bounded multi-file build | `orch-mid` sonnet |
| T5 | everything else | main loop, **no output** |
| T6 | veto + hardness signal | `orch-deep` fable |

Two rules govern everything: **veto matches the full prompt text** (wrappers included) and
runs before any tier rule; **tier rules match wrapper-stripped text** so `^`-anchors land
on what the user typed. Over-stripping can only cost a route, never cause one.

## Status check

```bash
python3 -c "
import json,pathlib
d=json.loads((pathlib.Path.home()/'.claude/settings.json').read_text())
print([h['command'] for g in d['hooks'].get('UserPromptSubmit',[]) for h in g['hooks']])"
bash ~/.claude/hooks/model-orch.test.sh | tail -2
tail -5 ~/.claude/model-orch.log
```

If the log's newest line predates the user's last prompt, the hook is registered but not
firing — check that the script is executable and that `settings.json` parses.

## Report

Tier distribution:
```bash
awk -F' [|] ' '{print $3}' ~/.claude/model-orch.log | sort | uniq -c | sort -rn
```

Prompts that matched nothing — the tuning worklist:
```bash
awk -F' [|] ' '$3=="T5" && $4=="none" {print $5}' ~/.claude/model-orch.log |
  sort | uniq -c | sort -rn | head -30
```

Veto hits (work correctly kept off cheap models):
```bash
awk -F' [|] ' '$4 ~ /veto/ {print $4, $5}' ~/.claude/model-orch.log | sort | uniq -c
```

**Read the distribution honestly.** If T5 dominates, the router is saving nothing — say so
plainly rather than presenting the log as success. If T0–T4 are firing on prompts that
actually needed the session model, that is the expensive failure and matters more than
missed savings.

## Explain one prompt

```bash
~/.claude/hooks/model-orch.sh --explain "the prompt text"   # prints: TIER RULE
```

`--classify` prints the tier alone. `--explain` also prints the matched rule, which is how
you tell "vetoed" from "matched nothing" — both land on T5.

To see what the tier rules actually matched against, strip wrappers first: harness blocks
like `<ide_selection>` and `<ide_opened_file>` are removed before tier matching but not
before the veto.

## Tuning — fixture first, always

Rule edits are the one way to silently break this thing. The veto is what keeps payroll,
statutory, migration, security and "not working" prompts off cheap models, and a broadened
tier regex can shadow it in a way no error message will ever surface.

1. Pull a real prompt from the log's unmatched list. Never invent one — invented prompts
   encode what you imagine the user types, and the log records what they actually type.
2. Add it to `model-orch.test.sh` as a `te` fixture with the tier and rule you expect.
3. Run the suite. **Watch it fail.** A fixture that passes before you change anything is
   testing nothing.
4. Edit `model-orch-rules.json` only. Do not touch the script for a routing change.
5. Run the full suite. Every pre-existing veto fixture must still pass — those are the
   ones protecting against expensive mistakes.
6. Commit rules and fixtures together.

**Rule ordering is load-bearing.** `tiers` is first-match-wins, and the broad
`^(add|create|implement|build)` rule sits last on purpose. A new broad rule placed early
will shadow every narrower one below it.

Never add a term to the veto without checking its frequency in the log first — `schema`
was rejected during design because in a Mongoose codebase it appears in nearly every
prompt and would have suppressed routing repo-wide.

## Adding a tier rule

```json
{ "tier": "T1", "match": "^(where|which file)\\b", "agent": "orch-scout", "model": "haiku" }
```

Each entry carries `tier` plus either `inline: true` (T0) or both `agent` and `model`.
Never both, never neither — the suite enforces this, along with the requirement that every
named agent exists on disk and its pinned `model:` matches the tier routing to it.

## Gotcha: the log field separator

Use `awk -F' [|] '`, never `-F' \| '`. macOS awk treats `\|` as alternation rather than a
literal pipe, so the separator degrades to "space or space", every field index shifts by
one, and `$3` returns the working directory instead of the tier. It produces plausible
output rather than an error, so the report looks fine and is wrong.

## Known limits

- Rules only recognise fairly rigid phrasings. Conversational prompts ("go ahead",
  "can we check…") match nothing and fall to T5. This is the main reason the hit rate is low.
- `%.60s` log truncation is not multi-byte-boundary safe. Cosmetic.
- The 20-iteration wrapper-strip guard means a pathological input falls to T5 rather than
  being fully stripped. Safe direction, by design.

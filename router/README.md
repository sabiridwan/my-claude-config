# zync-router

Local proxy that classifies each prompt and **actually swaps the model** that serves it.

This is the thing `zync-model-orch` could not be. That hook fires on `UserPromptSubmit`,
after the turn is already bound to a model, and its output schema has no `model` field —
so it could only ever *suggest* delegating to a subagent. This sits on the wire and
rewrites `body.model` before the request reaches Anthropic.

## How it works

```
Claude Code
  |  ANTHROPIC_BASE_URL=http://127.0.0.1:8787
  v
zync-router
  1. reads the newest user message
  2. strips ambient text (IDE wrapper blocks, URLs)
  3. regex rules -> tier;  no match -> Haiku classifies
  4. tier -> model, unless a guard holds it
  5. rewrites body.model
  v
api.anthropic.com
```

Auth is relayed verbatim. The proxy never reads, stores, or needs a credential of its
own — it works with subscription OAuth exactly as it does with an API key.

## Tiers

| Tier | Model | Fires on |
|---|---|---|
| trivial | Haiku 4.5 | greetings, "what is X" |
| simple | Haiku 4.5 | locate code, typo, rename, commit message |
| moderate | Sonnet 5 | add / create / build / implement, tests, components |
| complex | Opus 5 | architecture, root cause, "why is", "not working" |
| critical | Opus 5 | high stakes — money/billing, secrets/auth, irreversible ops |

No rule match → the LLM classifier decides. It failing → the requested model is kept.
Every unknown path is transparent passthrough.

## Two guards

**Ambient stripping.** `<ide_opened_file>`, `<ide_selection>`, `<system-reminder>` blocks
and bare URLs are removed before classification. Without this, the file you happen to have
open decides your tier — one billing or auth path in the sidebar pins every prompt in the
repo to the most expensive model. That is not hypothetical: it is why the regex hook
vetoed 13 of its 15 hits.

**Stickiness** (`guards.stickyAboveTokens`, default 40k). Prompt caches are keyed by
model, so every switch re-reads the whole transcript uncached — at 100k context that is
roughly 90k of input thrown away. A session alternating easy and hard asks would flip on
every turn and spend more than the cheaper model saves.

So above the floor the rule is asymmetric: **escalate freely, never de-escalate.** Once a
conversation has needed Opus it stays there, because dropping back for one easy question
buys a small saving and pays two cache misses — down and back up. Below the floor the
transcript is small enough that a miss is cheap, and routing runs unrestricted.

**Read-only exemption.** A locate/read ask (`where`, `find`, `grep`, `show`) skips the
high-stakes check. Finding the billing config is a grep no matter what it contains; only
*acting* on it earns the expensive tier.

**Fit the window, don't give up** (`guards.contextLimits`, `guards.contextSafety`).
A long conversation is a reason to pick a bigger *window*, not to stop routing. The router
walks up the cost ladder from the tier's ideal model to the cheapest one that actually
holds the context — so a 400k-token session asking a simple question still drops Opus to
Sonnet, even though Haiku could never hold it. Only when nothing cheaper fits is the
requested model kept, logged as `held:ctx~NNNk`. It never climbs past what the client
asked for: routing may spend less, never more.

On a subscription this is the main lever. You are not billed per token, but model tier
dominates how fast you burn your usage limit, and Opus→Sonnet on long sessions is where
that saving actually lives.

## Subscription vs API key

**Both work, and subscription is verified.** Pointing Claude Code at a probe on a custom
base URL showed it send:

```
POST /v1/messages?beta=true
authorization: Bearer <oauth token>
anthropic-beta: claude-code-20250219,oauth-2025-04-20,context-1m-2025-08-07,…
model: claude-opus-5          max_tokens: 64000     stream: true
```

So the client does honour `ANTHROPIC_BASE_URL` while on subscription OAuth, and it sends
the credential to whatever host you point it at. The proxy relays that header untouched
and holds nothing.

Two things that probe changed in the design:

- **`context-1m-2025-08-07` rides on every request.** Downgrade the model without pruning
  it and the cheap model is handed a flag it does not implement. Betas matching
  `guards.dropBetasOnDowngrade` are stripped whenever the model is rewritten; platform
  betas (`claude-code-*`, `oauth-*`) always survive.
- **`max_tokens` is 64000**, from `CLAUDE_CODE_MAX_OUTPUT_TOKENS`, sized for the model you
  picked. It is clamped to `guards.maxOutput[model]` on a downgrade.

What is *not* verified without live traffic: whether the account accepts the swapped model
on that path. `guards.retryOriginalOn4xx` covers it — any 4xx on a request the router
rewrote is replayed once with the untouched original, so a bad route costs the saving
rather than the turn. Watch for `retry-original` in the log; a steady stream of them means
the routing is wrong, not that the proxy is broken.

## Test

Three layers, cheapest first. Nothing below layer 3 touches the network or your
credentials.

**1–2. Automated — classification + wire behaviour.**

```bash
bash ~/.claude/router/test.sh      # 30 fixtures, ~3s, exits non-zero on failure
```

Layer 1 asserts the tier for real prompt shapes. Layer 2 stands up a mock upstream on
:9911 and proves the things that only show up on the wire: the rewritten model actually
arrives, the `Authorization` header is relayed byte-for-byte, SSE chunks stream in order,
the context hold blocks a downgrade, a malformed body forwards instead of 500ing, and
non-`/v1/messages` paths pass through untouched.

Run this after every `config.json` edit. Rules are first-match-wins, so a new broad rule
placed high silently shadows every narrower one below it — the suite is what catches that.

**Check one prompt** without the server:

```bash
node ~/.claude/router/server.js --classify "find the root cause of the flaky test"
# complex rule
```

`veto` in the output means the high-stakes rule fired; `none` means nothing matched and
the LLM classifier would decide at runtime.

**3. Live — real traffic, one throwaway session.**

Do this in a scratch directory, not a real project, so a misroute costs nothing.

```bash
node ~/.claude/router/server.js &          # terminal 1
tail -f ~/.claude/router.log               # terminal 2

cd /tmp && mkdir -p router-trial && cd router-trial
ANTHROPIC_BASE_URL=http://127.0.0.1:8787 claude
```

Scoping the env var to that one command means every other Claude Code window keeps going
straight to Anthropic — you are testing on one session, not your whole setup.

Then type a prompt from each tier and watch the log:

| Type this | Expect |
|---|---|
| `hey` | `trivial … -> claude-haiku-4-5-20251001` |
| `where is package.json` | `simple … -> claude-haiku-4-5-20251001` |
| `add a hello world script` | `moderate … -> claude-sonnet-5` |
| `why is this failing` | `complex … -> claude-opus-5` |
| `rotate the api key` | `critical … -> claude-opus-5` |

Confirm independently that the swap is real: ask `which model are you?` — a routed turn
answers Haiku, not Opus.

**What "working" looks like after a week.** Tail the log and count:

```bash
awk -F' [|] ' '{print $2}' ~/.claude/router.log | sort | uniq -c | sort -rn
grep -c 'held:ctx' ~/.claude/router.log
```

If most lines are `held:ctx`, the router is doing nothing — long sessions blow past the
downgrade threshold and there is little to save. That is the honest failure mode to watch
for, and it argues for shorter sessions rather than a lower threshold.

## Enable / disable

Installed as a launchd agent, so it starts at login and is restarted if it dies — Claude
Code cannot reach the API at all while it is down, so `KeepAlive` is not optional.

```bash
launchctl load   ~/Library/LaunchAgents/com.zync.router.plist   # on
launchctl unload ~/Library/LaunchAgents/com.zync.router.plist   # off
```

`ANTHROPIC_BASE_URL=http://127.0.0.1:8787` lives in the `env` block of
`~/.claude/settings.json`. Remove that line and unload the agent to go back to talking to
Anthropic directly; nothing else needs undoing.

## What this plan actually supports

Verified live against the account, not assumed:

| Route | Result |
|---|---|
| Opus → **Sonnet 5** | works with the request untouched |
| Opus → **Haiku 4.5** | rejected, three separate times |
| `context-1m` beta on Haiku | `"The long context beta is not yet available for this subscription."` |
| Extra classifier API call | 429 rate-limited |

Haiku refused the Opus request shape in layers — first `thinking` ("adaptive thinking is
not supported on this model"), then `output_config.effort`, then mid-conversation
`role: "system"` messages. The first two are handled; the third is not, so no tier points
at Haiku. Sonnet needed none of it.

That is why every cheap tier maps to Sonnet. On a subscription the saving is quota, not
dollars, and Opus→Sonnet is where nearly all of it lives anyway.

Two consequences worth remembering:

- **The LLM classifier is off.** On a subscription it inherits betas the plan rejects,
  spends the very quota the router is saving, and 429s under load. Classification is
  pure regex, and `defaultTier` catches anything unmatched so nothing silently parks on
  Opus.
- **Sonnet is treated as a 200k model**, because this plan has no long-context beta below
  Opus. Sessions past ~170k therefore stay on Opus by necessity — raise
  `guards.contextLimits` if the plan ever gains it.

## Tune

Edit `config.json` — models, rules, high-stakes terms and thresholds all live there.
The shipped rules are deliberately domain-neutral: they key off task shape (locate /
mechanical / build / diagnose) and off universal stakes (money, secrets, irreversible
actions), not off any one project's vocabulary. Add your own jargon to
`guards.vetoToCritical` if a domain term should always buy the strong model.
Rules are **first-match-wins**, and the order is load-bearing: the `complex` rule sits
above the `simple` locate rules on purpose, or `find the root cause of ...` matches
`^find` and routes to the cheapest tier.

Check a prompt without starting the server:

```bash
node ~/.claude/router/server.js --classify "find the root cause of the rounding drift"
# complex rule
```

## Watch it

```bash
tail -f ~/.claude/router.log
```

```
2026-08-22T… | simple   | ^(where|which file…  | claude-opus-5[1m] -> claude-haiku-4-5-20251001 | where is foo defined
2026-08-22T… | critical | veto                 | claude-opus-5 -> claude-opus-5                  | recalculate the PAYE bands
2026-08-22T… | simple   | ^(where|which file…  | claude-opus-5[1m] -> claude-opus-5[1m] (held:ctx~171k) | where is foo
```

## Caveats

- Interposing on Claude Code's API traffic is unsupported. A client update can change the
  wire format and break this; disabling is a one-line unset.
- Watch the log for `held:ctx` lines. If most turns are held, the router is doing nothing
  and the honest read is that long sessions have little to save.

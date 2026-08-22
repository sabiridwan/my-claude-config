#!/usr/bin/env bash
# zync-model-orch — advisory model router for UserPromptSubmit.
# Degrades to a no-op on every error path. Never exits non-zero.
# NOTE: no `set -e` — a crashing router must not block a prompt.
set -uo pipefail

RULES="${MODEL_ORCH_RULES:-$HOME/.claude/hooks/model-orch-rules.json}"
LOG="${MODEL_ORCH_LOG:-$HOME/.claude/model-orch.log}"

# classify <lowercased-prompt> -> prints tier, and (via globals) the route
TIER=""; AGENT=""; MODEL=""; RULE=""

classify() {
  local lc="$1"
  TIER="T5"; AGENT=""; MODEL=""; RULE="none"

  [ -r "$RULES" ] || return 0

  local veto hardness escalate
  veto=$(jq -r '.veto // empty' "$RULES" 2>/dev/null)
  hardness=$(jq -r '.hardness // empty' "$RULES" 2>/dev/null)
  escalate=$(jq -r '.escalate // empty' "$RULES" 2>/dev/null)

  # Fail closed: the veto is the one safety rail keeping payroll/migration/
  # security/"not working" prompts off cheap tiers. If a rules-file edit ever
  # drops or empties the veto key, silently falling through to the ordered
  # tier rules would reroute every veto fixture to a cheap tier with no
  # runtime signal. Treat a missing/empty veto as unsafe to route at all.
  if [ -z "$veto" ]; then
    TIER="T5"; RULE="no-veto-fail-closed"
    return 0
  fi

  # 1. Veto first, always. Lands on T5, or T6 if a hardness signal is also present.
  if printf '%s' "$lc" | grep -qE "$veto"; then
    if [ -n "$hardness" ] && printf '%s' "$lc" | grep -qE "$hardness"; then
      TIER="T6"; AGENT="general-purpose"; MODEL="fable"; RULE="veto+hardness"
    else
      TIER="T5"; RULE="veto"
    fi
    return 0
  fi

  # 2. Ordered first-match-wins tier rules.
  local n i m
  n=$(jq -r '.tiers | length' "$RULES" 2>/dev/null) || return 0
  [ -n "$n" ] || return 0
  for ((i = 0; i < n; i++)); do
    m=$(jq -r ".tiers[$i].match // empty" "$RULES" 2>/dev/null)
    [ -n "$m" ] || continue
    if printf '%s' "$lc" | grep -qE "$m"; then
      TIER=$(jq -r ".tiers[$i].tier" "$RULES")
      AGENT=$(jq -r ".tiers[$i].agent // empty" "$RULES")
      MODEL=$(jq -r ".tiers[$i].model // empty" "$RULES")
      RULE="tier:$TIER"
      break
    fi
  done

  # 3. Compound-clause handling. A compound prompt does NOT change tier — the
  #    matched rule is still the best guess at the work. It only lowers confidence,
  #    which softens the injected wording.
  #    T0 is the one exception: a knowledge question welded to an action clause is
  #    no longer answerable inline, so it drops to T5 (silence) and the main loop
  #    handles it. Routing it to an edit agent would act on a half-understood ask.
  if [ -n "$escalate" ] && printf '%s' "$lc" | grep -qE "$escalate"; then
    case "$TIER" in
      T0) TIER="T5"; AGENT=""; MODEL=""; RULE="compound-t0" ;;
      T1|T2|T3|T4) RULE="$RULE+compound" ;;
    esac
  fi
  return 0
}

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

# collapse newlines/CR/tabs to spaces so classify() (and grep's line-oriented
# ^-anchors within it) see one logical line instead of being fed a multi-line
# prompt one physical line at a time. Must run BEFORE classify(), not just
# before the log line, or ^-anchored rules and multi-word veto tokens can be
# evaded by splitting them across a newline.
sanitize() { printf '%s' "$1" | tr '\n\r\t' ' '; }

# --- test entry point: pure, no logging, no JSON
if [ "${1:-}" = "--classify" ]; then
  classify "$(lower "$(sanitize "${2:-}")")"
  printf '%s\n' "$TIER"
  exit 0
fi

# --- test entry point: like --classify but also exposes RULE, so tests can
# tell "vetoed" apart from "matched nothing" (both land on T5 via --classify).
if [ "${1:-}" = "--explain" ]; then
  classify "$(lower "$(sanitize "${2:-}")")"
  printf '%s %s\n' "$TIER" "$RULE"
  exit 0
fi

# --- hook mode
input=$(cat 2>/dev/null) || exit 0
[ -n "$input" ] || exit 0

prompt=$(printf '%s' "$input" | jq -r '.prompt // empty' 2>/dev/null) || exit 0
[ -n "$prompt" ] || exit 0
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)

sanitized_prompt=$(sanitize "$prompt")
classify "$(lower "$sanitized_prompt")"

# Log every decision, including silent ones — otherwise prompts that SHOULD have
# matched but did not are invisible, and the rules can never be tuned.
# Reuse the same newline/CR/tab collapse classify() already saw (see sanitize()
# above — it must run before classify, not just before this log line), then
# additionally swap any literal "|" for "/" so a pipe-bearing prompt can never
# desync the " | "-delimited fields below.
log_prompt=$(printf '%s' "$sanitized_prompt" | tr '|' '/')
{
  printf '%s | %s | %s | %s | %.60s\n' \
    "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${cwd:-?}" "$TIER" "$RULE" "$log_prompt"
} >> "$LOG" 2>/dev/null || true

[ "$TIER" = "T5" ] && exit 0

# Guard against a malformed rules entry: any tier other than T0 must carry
# both an agent and a model, or there is nothing sane to route to. Silence
# is the correct output for a malformed rule, not `Agent(, model:"")`.
if [ "$TIER" != "T0" ] && { [ -z "$AGENT" ] || [ -z "$MODEL" ]; }; then
  exit 0
fi

case "$RULE" in
  *+compound) conf="low" ;;
  *)          conf="high" ;;
esac

if [ "$TIER" = "T0" ]; then
  msg="tier=T0 confidence=$conf — knowledge question. Answer inline; no tools, no subagent."
elif [ "$conf" = "high" ]; then
  msg="tier=$TIER confidence=high — prefer Agent($AGENT, model:\"$MODEL\") for this. Override if the classification is wrong."
else
  msg="tier=$TIER confidence=low — this may be routable to Agent($AGENT, model:\"$MODEL\") — use judgment. Override if the classification is wrong."
fi

jq -nc --arg m "[zync-model-orch] $msg" \
  '{hookSpecificOutput:{hookEventName:"UserPromptSubmit",additionalContext:$m}}' \
  2>/dev/null || true

exit 0

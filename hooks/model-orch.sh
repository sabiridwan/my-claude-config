#!/usr/bin/env bash
# zync-model-orch — advisory model router for UserPromptSubmit.
# Degrades to a no-op on every error path. Never exits non-zero.
# NOTE: no `set -e` — a crashing router must not block a prompt.
set -uo pipefail

RULES="${MODEL_ORCH_RULES:-$HOME/.claude/hooks/model-orch-rules.json}"
LOG="${MODEL_ORCH_LOG:-$HOME/.claude/model-orch.log}"

# classify <lowercased-prompt> -> prints tier, and (via globals) the route
TIER=""; AGENT=""; MODEL=""; RULE=""

# classify <full-text> [<stripped-text>]
#   $1 full text, sanitized+lowercased — the VETO matches against this, wrappers
#      included, so a payroll reference pasted inside an <ide_selection> still
#      vetoes even when the typed ask looks routable. Safety sees everything.
#   $2 same text with harness wrapper blocks removed — the ORDERED TIER RULES match
#      against this, so ^-anchors land on what the user actually typed. Defaults to
#      $1. Over-stripping can therefore only cost a route (silence), never cause one.
classify() {
  local lc="$1"
  local ask="${2:-$1}"
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
      # T6's route lives in the rules file like every other tier, so retargeting it
      # is a data edit rather than a code edit. Falls back to the previous hardcoded
      # pair if the key is absent, so an older rules file still routes rather than
      # emitting a nudge naming an empty agent.
      TIER="T6"; RULE="veto+hardness"
      AGENT=$(jq -r '.t6.agent // "general-purpose"' "$RULES" 2>/dev/null)
      MODEL=$(jq -r '.t6.model // "fable"' "$RULES" 2>/dev/null)
      [ -n "$AGENT" ] || AGENT="general-purpose"
      [ -n "$MODEL" ] || MODEL="fable"
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
    if printf '%s' "$ask" | grep -qE "$m"; then
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
  if [ -n "$escalate" ] && printf '%s' "$ask" | grep -qE "$escalate"; then
    case "$TIER" in
      T0) TIER="T5"; AGENT=""; MODEL=""; RULE="compound-t0" ;;
      T1|T2|T3|T4) RULE="$RULE+compound" ;;
    esac
  fi
  return 0
}

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

# collapse newlines/CR/tabs/vtab/formfeed to spaces, then squeeze runs of
# spaces down to one, so classify() (and grep's line-oriented ^-anchors
# within it) see one logical line instead of being fed a multi-line prompt
# one physical line at a time. Must run BEFORE classify(), not just before
# the log line, or ^-anchored rules and multi-word veto tokens ("not
# working", "why is") can be evaded by splitting them across a newline —
# including CRLF, an indented continuation line, a trailing space before the
# newline, or a blank line between clauses, all of which leave TWO spaces
# after a naive tr collapse unless the run is also squeezed.
sanitize() { printf '%s' "$1" | tr '\n\r\t\v\f' ' ' | tr -s ' '; }

# Remove harness-injected wrapper blocks so the ordered tier rules see the user's
# typed text. Claude Code prepends <ide_selection>, <task-notification>,
# <system-reminder> and command blocks to the prompt; because sanitize() has already
# folded everything onto one line, a ^-anchored rule would otherwise anchor to the
# wrapper and never fire — killing T0, T1 and T4, three of the five routable tiers.
# Run AFTER sanitize(): the blocks span newlines in the raw payload, and sed is
# line-oriented, so stripping first would only ever catch single-line blocks.
# Greedy on purpose. Matching is greedy between the first open tag and the last close
# tag of the same name, so a prompt sandwiched between two blocks of one kind is eaten
# too. That is the safe direction: the veto still reads the FULL text, so an over-strip
# costs a route and yields silence, never a cheap route that should have been blocked.
# Remove harness-injected wrapper blocks so the ordered tier rules see the user's
# typed text. Claude Code and the IDE extension prepend blocks such as
# <ide_selection>, <ide_opened_file>, <task-notification> and <system-reminder>;
# because sanitize() has already folded everything onto one line, a ^-anchored rule
# would otherwise anchor to the wrapper and never fire, killing T0, T1 and T4 — three
# of the five routable tiers — whenever the harness injects anything.
#
# GENERIC on purpose, never an allowlist. The injected tag set is not ours to
# enumerate: <ide_selection> and <ide_opened_file> come from the IDE extension and
# appear nowhere in the CLI binary, so a list of tags we happened to observe silently
# stops matching the day a new one ships. That is not hypothetical — it is how
# <ide_opened_file> slipped through and reverted every anchored rule to T5.
#
# Pure bash parameter expansion, no sed. BSD sed supports backreferences only on the
# replacement side, so the natural generic form `s#<([a-z-]+)>.*</\1>##g` matches
# nothing at all on macOS, silently. This also drops a subprocess from the hot path.
# Removal is shortest-match (first open tag to its first close), so adjacent blocks
# are stripped individually rather than swallowing the text between them.
# An unclosed tag is left alone: better to lose a route than eat the user's prompt.
strip_wrappers() {
  local s="$1" tag open close guard=0
  while [ "$guard" -lt 20 ]; do
    guard=$((guard + 1))
    [[ "$s" =~ \<([a-z][a-z0-9_-]*)\> ]] || break
    tag="${BASH_REMATCH[1]}"
    open="<$tag>"; close="</$tag>"
    case "$s" in
      *"$open"*"$close"*) s="${s%%"$open"*}${s#*"$close"}" ;;
      *) break ;;
    esac
  done
  printf '%s' "$s"
}

# --- test entry point: pure, no logging, no JSON
if [ "${1:-}" = "--classify" ]; then
  _s=$(lower "$(sanitize "${2:-}")")
  classify "$_s" "$(strip_wrappers "$_s")"
  printf '%s\n' "$TIER"
  exit 0
fi

# --- test entry point: like --classify but also exposes RULE, so tests can
# tell "vetoed" apart from "matched nothing" (both land on T5 via --classify).
if [ "${1:-}" = "--explain" ]; then
  _s=$(lower "$(sanitize "${2:-}")")
  classify "$_s" "$(strip_wrappers "$_s")"
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
_lc=$(lower "$sanitized_prompt")
_ask=$(strip_wrappers "$_lc")
classify "$_lc" "$_ask"

# Log every decision, including silent ones — otherwise prompts that SHOULD have
# matched but did not are invisible, and the rules can never be tuned.
# Reuse the same newline/CR/tab collapse classify() already saw (see sanitize()
# above — it must run before classify, not just before this log line), then
# additionally swap any literal "|" for "/" so a pipe-bearing prompt can never
# desync the " | "-delimited fields below.
# Log the wrapper-stripped ask, not the raw prompt. A wrapped prompt would otherwise
# spend its whole 60-character budget on <ide_selection> boilerplate, leaving the
# tuning pass unable to see what was actually asked — the log's only purpose. Falls
# back to the full text when stripping leaves nothing but whitespace, so a prompt that
# is entirely wrapper still logs something identifiable rather than an empty field.
log_source=$(strip_wrappers "$sanitized_prompt")
[ -n "${log_source// /}" ] || log_source="$sanitized_prompt"
log_prompt=$(printf '%s' "$log_source" | tr '|' '/')
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

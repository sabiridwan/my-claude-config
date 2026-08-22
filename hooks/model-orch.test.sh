#!/usr/bin/env bash
# Pure classification tests. No network, no API, no hook invocation.
SCRIPT="$(dirname "$0")/model-orch.sh"
export MODEL_ORCH_RULES="$(dirname "$0")/model-orch-rules.json"
export MODEL_ORCH_LOG=/dev/null
pass=0; fail=0

t() {
  local prompt="$1" expected="$2" got
  got=$("$SCRIPT" --classify "$prompt" 2>/dev/null)
  if [ "$got" = "$expected" ]; then
    pass=$((pass+1))
  else
    fail=$((fail+1))
    printf 'FAIL  want=%-3s got=%-3s  %s\n' "$expected" "${got:-<empty>}" "$prompt"
  fi
}

# te (test-explain): asserts TIER *and* RULE via --explain, so a fixture can
# tell "vetoed" apart from "matched nothing" — both land on T5 through
# --classify alone. Used for the veto fixtures, per the design spec calling
# those "the most important tests".
te() {
  local prompt="$1" expected_tier="$2" expected_rule="$3" got got_tier got_rule
  got=$("$SCRIPT" --explain "$prompt" 2>/dev/null)
  got_tier="${got%% *}"
  got_rule="${got#* }"
  if [ "$got_tier" = "$expected_tier" ] && [ "$got_rule" = "$expected_rule" ]; then
    pass=$((pass+1))
  else
    fail=$((fail+1))
    printf 'FAIL  want=%s/%s got=%s/%s  %s\n' "$expected_tier" "$expected_rule" "${got_tier:-<empty>}" "${got_rule:-<empty>}" "$prompt"
  fi
}

# --- T0: knowledge questions, answered inline (real prompts from the design session)
t "what is short form of orchestration"                       T0
t "what does that mean"                                       T0
t "explain how mongoose-delete works"                         T0

# --- T1: locate
t "where is resolveGroupId defined"                           T1
t "what calls handlePageFacet"                                T1
t "list all resolvers in the hr module"                       T1

# --- T2: mechanical edit
t "fix the typo in the branch resolver"                       T2
t "rename branchId to storeId in that file"                   T2

# --- T3: prose
t "write a commit message for this diff"                      T3
t "summarize what changed in this file"                       T3

# --- T4: bounded build
t "add a leaveBalance field to the employee schema"           T4
t "create a repository for the new report module"             T4

# --- T5: no match, must emit nothing (spec: at least three)
t "hmm"                                                       T5
t "ok do that"                                                T5
t "the client called about the invoice"                       T5

# --- VETO: cheap-tier pattern present, veto must win anyway
# Asserts the reason (RULE), not just the tier — without this a veto-less
# rules file that also happens to match nothing would still show T5 here.
te "where is the payroll tax band defined"                    T5 veto
te "find the statutory contribution rate"                     T5 veto
te "rename the migration file"                                T5 veto
te "what is the production deploy command"                    T5 veto

# --- T5 vs T6: same veto keyword, hardness signal is the only difference
te "fix the payroll typo"                                     T5 veto
te "find the root cause of the intermittent payroll rounding drift"  T6 veto+hardness
te "architect the statutory remittance module from scratch"   T6 veto+hardness

# --- compound: tier is unchanged, only confidence drops (T0 is the exception)
t "where is resolveGroupId defined and then rename it"        T1
t "what is a repository and then show me one"                 T5

# --- multi-line prompts: grep is line-oriented, so ^-anchored rules and
# multi-word veto tokens must not be evadable by a newline. classify() must
# see one collapsed logical line, not be fed the prompt one physical line at
# a time. $'...' below embeds a REAL newline (not the two characters "\n").
t $'fix the typo in branch.resolver.ts\nwhat is the right label for it'  T2

# --- multi-line veto evasion: a plain "\n"-to-space collapse alone leaves
# TWO spaces wherever the split introduces extra whitespace around the
# newline (CRLF, an indented continuation line, a trailing space before the
# newline, a blank line between clauses) — a two-word veto token like "not
# working" only survives collapse-without-squeeze if the split happens to
# land on a bare "\n" with nothing else around it. sanitize() must squeeze
# the collapsed run down to one space so all of these still match the veto.
# Assert via --explain (not just tier) so these can't pass by accident by
# landing on T5 "no match" instead of T5 "veto".
te $'rename the getRate helper because it is not\nworking'         T5 veto
te $'rename the getRate helper because it is not\r\nworking'       T5 veto
te $'rename the getRate helper because it is not\n  working'       T5 veto
te $'rename the getRate helper because it is not\n\nworking'       T5 veto


# --- hook mode: stdin JSON in, advisory JSON (or silence) out
h() {
  local prompt="$1" expect="$2" got
  got=$(printf '{"prompt":%s,"cwd":"/tmp"}' "$(printf '%s' "$prompt" | jq -Rs .)" \
        | "$SCRIPT" 2>/dev/null)
  case "$expect" in
    silent)
      if [ -z "$got" ]; then pass=$((pass+1))
      else fail=$((fail+1)); printf 'FAIL  want silence, got: %s\n' "$got"; fi ;;
    *)
      if printf '%s' "$got" | jq -e --arg e "$expect" \
           '.hookSpecificOutput.hookEventName == "UserPromptSubmit"
            and (.hookSpecificOutput.additionalContext | contains($e))' >/dev/null 2>&1
      then pass=$((pass+1))
      else fail=$((fail+1)); printf 'FAIL  want %s in output, got: %s\n' "$expect" "${got:-<empty>}"; fi ;;
  esac
}

h "where is resolveGroupId defined"        "cavecrew-investigator"
h "where is resolveGroupId defined"        "haiku"
h "what is short form of orchestration"    "T0"
h "find the root cause of the intermittent payroll rounding drift"  "fable"
h "fix the payroll typo"                   silent
h "hmm"                                    silent
h "the client called about the invoice"    silent
h "what is a repository and also show me one"   silent

# malformed / empty stdin must never produce output or a non-zero exit
if [ -z "$(printf 'not json'  | "$SCRIPT" 2>/dev/null)" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL  malformed stdin produced output"; fi
if [ -z "$(printf ''          | "$SCRIPT" 2>/dev/null)" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL  empty stdin produced output"; fi
if printf 'not json' | "$SCRIPT" >/dev/null 2>&1; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL  malformed stdin exited non-zero"; fi

# jq broken: must stay silent and still exit 0 (spec: never fail).
# Shadow only jq — blanking PATH would break the `env bash` shebang instead,
# and the test would pass for the wrong reason.
shadow=$(mktemp -d); printf '#!/bin/sh\nexit 127\n' > "$shadow/jq"; chmod +x "$shadow/jq"
jqout=$(printf '{"prompt":"where is foo","cwd":"/x"}' | PATH="$shadow:$PATH" "$SCRIPT" 2>/dev/null); jqrc=$?
rm -rf "$shadow"
if [ -z "$jqout" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL  no-jq produced output: $jqout"; fi
if [ "$jqrc" -eq 0 ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL  no-jq exited $jqrc"; fi

# unreadable rules file: must stay silent and still exit 0
rout=$(printf '{"prompt":"where is foo","cwd":"/x"}' | MODEL_ORCH_RULES=/nonexistent/rules.json "$SCRIPT" 2>/dev/null); rrc=$?
if [ -z "$rout" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL  missing rules produced output: $rout"; fi
if [ "$rrc" -eq 0 ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL  missing rules exited $rrc"; fi

# log sanitisation: an embedded newline must not split the log into multiple
# physical lines (structure check, not just a grep for content).
# Build the payload via jq -Rs . (as h() does) so the newline survives as a
# real JSON-escaped \n rather than a raw byte that would make the JSON invalid.
logfile=$(mktemp)
printf '{"prompt":%s,"cwd":"/x"}' "$(printf 'line one\nline two' | jq -Rs .)" \
  | MODEL_ORCH_LOG="$logfile" "$SCRIPT" >/dev/null 2>&1
lines=$(wc -l < "$logfile" | tr -d ' ')
if [ "$lines" = "1" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL  embedded newline produced $lines physical lines"; fi
rm -f "$logfile"

# log sanitisation: a literal "|" in the prompt must not desync the
# " | "-delimited fields — must still parse into exactly 5 fields with the
# tier landing in field 3 under awk -F' \\| '
logfile=$(mktemp)
printf '{"prompt":"where is foo | bar defined","cwd":"/x"}' | MODEL_ORCH_LOG="$logfile" "$SCRIPT" >/dev/null 2>&1
nf=$(awk -F' \\| ' '{print NF}' "$logfile")
tier_field=$(awk -F' \\| ' '{print $3}' "$logfile")
if [ "$nf" = "5" ] && [ "$tier_field" = "T1" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL  pipe in prompt desynced fields, NF=$nf field3=$tier_field"; fi
rm -f "$logfile"


# --- harness wrappers: the classifier receives ide_selection / task-notification /
# system-reminder blocks prepended to the user's actual text. Anchored rules (T0, T1,
# T4) must see the typed prompt, not the wrapper, or three of five tiers are dead.
te $'<ide_selection>lines 1-10 of foo.ts</ide_selection>where is resolveGroupId defined' T1 'tier:T1'
te $'<task-notification>agent done</task-notification>what is a repository'             T0 'tier:T0'
te $'<system-reminder>be nice</system-reminder>add a leaveBalance field'                T4 'tier:T4'
te $'<ide_selection>x</ide_selection>write a commit message for this diff'              T3 'tier:T3'

# --- SAFETY: the veto matches the FULL text, wrapper included. A payroll reference in
# a pasted selection must still veto even though the typed ask looks routable.
te $'<ide_selection>the payroll tax band table</ide_selection>rename the getRate helper' T5 'veto'
te $'<system-reminder>production deploy in progress</system-reminder>where is foo'       T5 'veto'

# --- unwrapped prompts must be completely unaffected
te 'where is resolveGroupId defined'  T1 'tier:T1'
te 'what is a repository'             T0 'tier:T0'


# --- the log must record the user's ask, not the harness wrapper: a wrapped prompt
# would otherwise spend its whole 60-char budget on boilerplate, blinding the tuning pass.
lw=$(mktemp)
printf '%s' '<ide_selection>lines 1 to 10 of some very long selected file content here</ide_selection>where is resolveGroupId defined' \
  | jq -Rs '{prompt:.,cwd:"/t"}' | MODEL_ORCH_LOG="$lw" "$SCRIPT" >/dev/null 2>&1
if grep -q 'where is resolveGroupId defined' "$lw" && ! grep -q 'ide_selection' "$lw"; then
  pass=$((pass+1)); else fail=$((fail+1)); printf 'FAIL  log kept the wrapper: %s\n' "$(cat "$lw")"; fi
rm -f "$lw"


# --- wrapper stripping must be GENERIC, not an allowlist. The injected tag set is not
# ours to enumerate: <ide_selection> and <ide_opened_file> come from the IDE extension
# and appear nowhere in the CLI binary, so any tag added later would silently kill the
# anchored rules again — which is exactly how <ide_opened_file> got missed.
te $'<ide_opened_file>The user opened /a/b/c.ts in the IDE.</ide_opened_file>where is resolveGroupId defined' T1 'tier:T1'
te $'<some-future-tag>whatever this turns out to be</some-future-tag>what is a repository'                    T0 'tier:T0'
te $'<a>x</a><b>y</b>where is foo'                                                                            T1 'tier:T1'
te $'<outer>before</outer>add a leaveBalance field<trailing>after</trailing>'                                  T4 'tier:T4'

# an unclosed tag must NOT eat the rest of the prompt
te $'<unclosed>where is resolveGroupId defined'                                                               T5 'none'

# SAFETY: a generic strip must still leave the veto reading the full text
te $'<ide_opened_file>src/hr/payroll/payroll.service.ts</ide_opened_file>rename the getRate helper'           T5 'veto'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]

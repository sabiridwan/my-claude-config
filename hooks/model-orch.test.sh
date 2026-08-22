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
t "where is the payroll tax band defined"                     T5
t "find the statutory contribution rate"                      T5
t "rename the migration file"                                 T5
t "what is the production deploy command"                     T5

# --- T5 vs T6: same veto keyword, hardness signal is the only difference
t "fix the payroll typo"                                      T5
t "find the root cause of the intermittent payroll rounding drift"  T6
t "architect the statutory remittance module from scratch"    T6

# --- compound: tier is unchanged, only confidence drops (T0 is the exception)
t "where is resolveGroupId defined and then rename it"        T1
t "what is a repository and then show me one"                 T5


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

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]

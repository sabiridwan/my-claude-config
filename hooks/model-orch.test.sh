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

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]

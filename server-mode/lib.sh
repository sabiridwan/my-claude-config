#!/usr/bin/env bash
# Shared helpers for zync server mode.
SM_DIR="$HOME/.claude/server-mode"
SM_STATE_DIR="$SM_DIR/state"
SM_HOSTS="$SM_DIR/hosts.json"
SM_PTR="$SM_DIR/.last-session"
SM_PTR_DIR="$SM_DIR/ptr"

# Pointer key: a hash of the working directory. Concurrent Claude Code sessions
# (CLI, desktop, other accounts) each get their own pointer, so activation can
# never land on a different session that happened to prompt more recently.
sm_ptr_key() { printf '%s' "${1:-$PWD}" | shasum -a 256 | cut -c1-16; }

sm_session_id() {
  # Returns the session id this shell script is acting on behalf of.
  #
  # Priority:
  #   1. SM_SESSION_ID env var (set by inject.sh from the harness payload).
  #      This is the AUTHORITATIVE value — set whenever a Claude Code
  #      session invokes activate.sh, so server mode is bound to the
  #      session that actually asked for it.
  #   2. ptr/<sha256(cwd)[:16]>. The cwd pointer is written by inject.sh
  #      on every prompt and is per-cwd, NOT per-session. Use it ONLY
  #      as a fallback when running activate.sh from a non-Claude
  #      shell. Cross-session invocation will read the wrong pointer
  #      and may act on the wrong session — guard.py is now strict
  #      (ignores cwd for state lookup), but the bash helpers cannot
  #      be.
  #   3. .last-session. Last-resort fallback for manual one-shot
  #      invocations; same caveat as the cwd pointer.
  #   4. 'default'. Used when nothing else is set; lands at
  #      state/default.json which activate.sh on/off both refuse to
  #      touch unless explicitly told to.
  if [ -n "${SM_SESSION_ID:-}" ]; then printf '%s' "$SM_SESSION_ID"; return; fi
  local k; k="$(sm_ptr_key)"
  if [ -f "$SM_PTR_DIR/$k" ]; then head -1 "$SM_PTR_DIR/$k"; return; fi
  [ -f "$SM_PTR" ] && head -1 "$SM_PTR" || printf 'default'
}

sm_state_file() { printf '%s/%s.json' "$SM_STATE_DIR" "$(sm_session_id)"; }

sm_get() { # sm_get <key>  -> value from state, empty if inactive
  local f; f="$(sm_state_file)"
  [ -f "$f" ] || return 1
  python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get(sys.argv[2],""))' "$f" "$1" 2>/dev/null
}

sm_host_field() { # sm_host_field <target> <key>
  python3 -c 'import json,sys
d=json.load(open(sys.argv[1]))
t=d.get(sys.argv[2])
print("" if t is None else t.get(sys.argv[3],""))' "$SM_HOSTS" "$1" "$2" 2>/dev/null
}

SM_SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=60 -o ServerAliveCountMax=5)

SM_ACCOUNT_POLICY="${SM_ACCOUNT_POLICY:-$SM_DIR/account-policy.json}"

# The Claude login this session runs under, per the harness's own config.
sm_account_email() {
  python3 -c 'import json,os
try:
    d=json.load(open(os.path.expanduser("~/.claude.json")))
    print((d.get("oauthAccount") or {}).get("emailAddress",""))
except Exception:
    print("")' 2>/dev/null
}

# Is this login barred from server mode? Prints the reason and returns 0 when
# barred, returns 1 when allowed. FAILS OPEN: a missing or malformed policy
# file, or an unreadable account, allows activation - the guard exists to stop
# the known work login, not to strand the user when a file goes missing.
sm_account_barred() {
  [ -n "${ZYNC_ALLOW_WORK_ACCOUNT:-}" ] && return 1
  python3 - "$SM_ACCOUNT_POLICY" "$(sm_account_email)" <<'PYEOF'
import json, sys
policy_path, email = sys.argv[1], sys.argv[2]
try:
    p = json.load(open(policy_path))
except Exception:
    sys.exit(1)                      # no policy -> allow
if not email:
    sys.exit(1)                      # account unknown -> allow
work = [e.lower() for e in p.get("work_accounts", [])]
personal = [e.lower() for e in p.get("personal_accounts", [])]
mode = p.get("policy", "deny_work")
e = email.lower()
if mode == "allow_personal_only":
    if e not in personal:
        print(f"{email} is not in personal_accounts")
        sys.exit(0)
elif e in work:
    print(f"{email} is a work account")
    sys.exit(0)
sys.exit(1)                          # allowed
PYEOF
}

# Refuse to go further when the login is barred. Used by activate.sh and by
# every routed tool, so a state file left behind by an earlier session cannot
# become a way in.
sm_require_personal_account() {
  local reason
  reason="$(sm_account_barred)" || return 0
  cat >&2 <<EOF
SERVER MODE BLOCKED — $reason.

Server mode runs work on personal infrastructure (the GPU box, personal
credits), so it is restricted to a personal Claude login.

  policy:  $SM_ACCOUNT_POLICY
  to run it here anyway, once:  ZYNC_ALLOW_WORK_ACCOUNT=1 <command>
EOF
  return 3
}

# Which target a directory belongs to, per projects.json - "<target> <remote>".
# A CONVENIENCE for an explicit `activate.sh on`, never a trigger: a new session
# is local until the user says otherwise, whatever directory it opens in.
sm_project_target() {
  python3 - "${1:-$PWD}" <<'PYEOF' 2>/dev/null
import json, os, sys
cwd = os.path.normpath(os.path.expanduser(sys.argv[1]))
path = os.path.expanduser("~/.claude/server-mode/projects.json")
try:
    entries = json.load(open(path)).get("projects", [])
except Exception:
    sys.exit(0)
best = None
for e in entries:
    root = os.path.normpath(os.path.expanduser(e.get("local", "")))
    if not root:
        continue
    if cwd == root or cwd.startswith(root + os.sep):
        # Longest matching root wins, so a nested project beats its parent.
        if best is None or len(root) > len(best[0]):
            best = (root, e)
if best:
    print(best[1].get("target", ""), best[1].get("remote", ""))
PYEOF
}

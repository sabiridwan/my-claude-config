#!/usr/bin/env python3
"""
Zync server-mode guard — PreToolUse classifier.

Two jobs, both FAIL OPEN (any unexpected error => allow the tool call):

  A. Routing.  While server mode is ACTIVE for the calling session, every tool
     call that would touch the Mac's filesystem or burn the Mac's CPU/RAM is
     denied, with the exact zrun/zput command to use instead. Applies to the
     main thread and to subagents (which resolve via the working-directory
     pointer their parent wrote).

  B. Local memory floor.  Always on, server mode or not. A heavy build/test
     command is denied when the Mac is low on RAM or already has too many large
     node processes resident.
"""
import json, os, re, subprocess, sys

HOME = os.path.expanduser("~")
SM_DIR = os.path.join(HOME, ".claude", "server-mode")

FREE_MIN_GB = float(os.environ.get("ZYNC_GUARD_FREE_MIN_GB", "6"))
MAX_HEAVY_NODE = int(os.environ.get("ZYNC_GUARD_MAX_HEAVY_NODE", "5"))
HEAVY_NODE_MB = int(os.environ.get("ZYNC_GUARD_HEAVY_NODE_MB", "800"))

# Paths that legitimately live on the Mac even in server mode: the harness's own
# config, skills, memory and docs, plus the session scratchpad and OS temp.
LOCAL_OK = [
    re.compile(p) for p in (
        r"^" + re.escape(os.path.join(HOME, ".claude")) + r"(/|$)",
        r"^/private/tmp/claude-\d+(/|$)",
        r"^/tmp/claude-\d+(/|$)",
        r"^/var/folders/(/|$|.)",
        r"^" + re.escape(os.path.join(HOME, ".ssh", "config")) + r"$",
    )
]

# Files the model may read locally for its own eyes — vision input is not "work".
MEDIA_EXT = re.compile(r"\.(png|jpe?g|gif|webp|bmp|tiff?|heic|svg|pdf|mp4|mov|webm|m4a|mp3|wav)$", re.I)

# Commands that mean "a toolchain is about to chew the Mac".
HEAVY = re.compile(r"""
 (^|[;&|(]|&&|\|\|)\s*
 (sudo\s+)?(timeout\s+[\d.]+\s+)?(env\s+\w+=\S*\s+)*
 (
   (npx|npm|pnpm|yarn|bun)\s+(run\s+)?(build|test|lint|start|dev|ci|install|i|exec)\b
  |(npx|pnpm|yarn|bun)\s+(jest|tsc|next|nest|webpack|vite|eslint|expo|eas|turbo|tsx|ts-node|vitest)\b
  |(jest|tsc|webpack|vitest|pytest|cargo|gradle|mvn|rustc|go\s+(build|test))\b
  |next\s+(build|dev|lint|start)\b
  |nest\s+(build|start)\b
  |expo\s+(start|export|prebuild|run)\b
  |(make|cmake|ninja)\b
  |docker\s+(build|compose)\b
  |python3?\s+-m\s+(pytest|build|pip)\b
  |pip3?\s+install\b
 )
""", re.X)

# Cheap local introspection that never needs a server.
CHEAP = re.compile(r"""^\s*(sudo\s+)?(
  echo|printf|pwd|date|whoami|id|uname|hostname|which|type|env|true|false
 |ps|top|df|du|uptime|vm_stat|sysctl|memory_pressure|sw_vers|nproc|sleep
 |jq|python3?\s+-c|node\s+-e
)\b""", re.X)

ROUTED = re.compile(r"(server-mode/)?\b(zrun|zsync|zput)\b")

# Commands bound to hardware that only exists on the Mac: the microphone, the
# speakers, and the launchd agent that owns them. Routing these to the server is
# not "running the work in the right place" - there is no microphone there, so a
# denial simply removes dictation from every server-mode session.
DEVICE_BOUND = re.compile(r"""(
   \bztalk\b                       # voice in: record and transcribe
 | voice-ptt/[\w.-]+               # the push-to-talk daemon and its scripts
 | voice-out/speak\b                # voice out: macOS say
 | (?:^|[|;&]\s*)speak\b           # ...invoked as a command, not merely mentioned
 | \bcom\.zyncai\.voiceptt\b       # launchctl against the voice agent
)""", re.X)

# Anything that looks like a filesystem path in a shell command.
PATHISH = re.compile(r"(?<![\w=])(~?/[\w.\-/@+]{2,}|\./[\w.\-/@+]+)")


def out(decision, reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": decision,
        "permissionDecisionReason": reason}}))
    sys.exit(0)


def allow():
    sys.exit(0)


def is_local_ok(path):
    if not path:
        return True
    p = os.path.expanduser(path)
    if not p.startswith("/"):
        return False
    p = os.path.normpath(p)
    return any(rx.match(p) for rx in LOCAL_OK)


def load_state(sid, cwd):
    """Look up server-mode state for the calling session only.

    Server mode is bound to the SESSION that activated it, not to the
    working directory. The earlier cwd-based fallback (read ptr/<hash>
    when state/<sid> missing) made every concurrent Claude Code session
    in the same cwd inherit whichever session happened to activate last
    — a cross-session bleed. Removed: the guard now returns None
    unless the calling session itself has a state file.
    """
    del cwd  # intentionally ignored — kept in signature for hook callers
    if not sid:
        return None
    f = os.path.join(SM_DIR, "state", f"{sid}.json")
    if os.path.isfile(f):
        return json.load(open(f))
    return None


def memory_snapshot():
    free, heavy = 999.0, 0
    try:
        vm = subprocess.run(["vm_stat"], capture_output=True, text=True, timeout=5).stdout
        def g(k):
            m = re.search(rf"{k}:\s+(\d+)", vm)
            return int(m.group(1)) if m else 0
        free = (g("Pages free") + g("Pages inactive") + g("Pages speculative")
                + g("Pages purgeable")) * 16384 / 1073741824
    except Exception:
        pass
    try:
        ps = subprocess.run(["ps", "-eo", "rss,comm"], capture_output=True, text=True, timeout=5).stdout
        for line in ps.splitlines()[1:]:
            parts = line.split(None, 1)
            if len(parts) == 2 and "node" in parts[1] and int(parts[0]) / 1024 > HEAVY_NODE_MB:
                heavy += 1
    except Exception:
        pass
    return free, heavy


HOWTO = """
How to do this on the server instead:
  run a command      ~/.claude/server-mode/zrun '<cmd>'
  long job           ~/.claude/server-mode/zrun --bg <name> '<cmd>'   then  zrun --tail <name>
  read a file        ~/.claude/server-mode/zrun 'sed -n "1,120p" <file>'
  edit a file        ~/.claude/server-mode/zrun 'python3 - <<"PY" ... PY'
  search             ~/.claude/server-mode/zrun 'grep -rn "x" <dir>'  /  zrun 'find ... '
  send a local file  ~/.claude/server-mode/zput <local-file>          -> prints the remote path
  send pasted bytes  printf %s "<base64>" | ~/.claude/server-mode/zput --b64 <name.png>
  push a tree        ~/.claude/server-mode/zsync push <local> [remote]

If the repo is not on the server yet: zrun 'git clone <url>' (or zsync push for uncommitted work).
To work locally on purpose, exit first: ~/.claude/server-mode/activate.sh off"""


def deny_routing(state, what, detail=""):
    out("deny", f"""ZYNC SERVER MODE is ACTIVE (target: {state.get('target','?')}, remote cwd: {state.get('remote_cwd','?')}).
Everything for this session runs on that server — this call would run on the Mac, which is what exhausted local RAM and shut the machine down.

Blocked: {what}
{detail}{HOWTO}""")


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        allow()
    if os.environ.get("ZYNC_GUARD_OFF") == "1":
        allow()

    tool = payload.get("tool_name") or ""
    ti = payload.get("tool_input") or {}
    sid = payload.get("session_id") or ""
    cwd = payload.get("cwd") or ""
    state = load_state(sid, cwd)

    # ---------- A. routing, only while server mode is active ----------
    if state:
        if tool in ("Write", "Edit", "NotebookEdit", "MultiEdit"):
            fp = ti.get("file_path") or ti.get("notebook_path") or ""
            if not is_local_ok(fp):
                deny_routing(state, f"{tool} on {fp}",
                             "That file belongs on the server. Edit it there.\n")
            allow()

        if tool == "Read":
            fp = ti.get("file_path") or ""
            if is_local_ok(fp) or MEDIA_EXT.search(fp or ""):
                allow()   # config, scratchpad, or something the model must actually see
            deny_routing(state, f"Read of {fp}",
                         "Read the server's copy instead — the Mac's copy is not the one being worked on.\n")

        if tool in ("Glob", "Grep"):
            p = ti.get("path") or cwd
            if not is_local_ok(p):
                deny_routing(state, f"{tool} under {p}",
                             "Search on the server, not on the Mac.\n")
            allow()

        if tool == "Bash":
            cmd = ti.get("command") or ""
            # ROUTED: already going to the server. DEVICE_BOUND: can only ever
            # run here, because the hardware is here.
            if not cmd or ROUTED.search(cmd):
                allow()
            # Device-bound only earns its exemption alone. Chained with real Mac
            # work it would be a way to smuggle a build past the guard.
            if DEVICE_BOUND.search(cmd) and not HEAVY.search(cmd):
                allow()
            paths = [m.group(0) for m in PATHISH.finditer(cmd)]
            foreign = [p for p in paths if not is_local_ok(p)]
            if HEAVY.search(cmd):
                deny_routing(state, cmd,
                             "This is a build/test/install — exactly the class of work that must not run on the Mac.\n")
            if foreign:
                deny_routing(state, cmd,
                             f"It touches Mac paths that belong on the server: {', '.join(sorted(set(foreign))[:5])}\n")
            if not paths and CHEAP.match(cmd):
                allow()   # local introspection: ps, df, vm_stat, echo ...
            if not paths:
                deny_routing(state, cmd,
                             "Run it on the server; nothing in it requires the Mac.\n")
            allow()   # every path it touches is harness-local

        allow()

    # ---------- B. local memory floor, always on ----------
    if tool != "Bash":
        allow()
    cmd = ti.get("command") or ""
    if not cmd or ROUTED.search(cmd) or not HEAVY.search(cmd):
        allow()

    free, heavy = memory_snapshot()
    if free < FREE_MIN_GB:
        out("deny", f"""LOCAL MEMORY GUARD: only {free:.1f} GB of RAM is available (floor {FREE_MIN_GB:.0f} GB). Running this now risks another out-of-memory shutdown.

Blocked: {cmd}

Pick one:
  1. Move it to a server:  ~/.claude/server-mode/activate.sh on gpu   then  ~/.claude/server-mode/zrun --bg build '<cmd>'
  2. Free memory first — inspect with  ps -eo rss,pid,args -r | head -20  — and stop idle dev servers (nest --watch, next dev, expo start).
  3. If it must run locally, cap it:  NODE_OPTIONS=--max-old-space-size=2048 <cmd> --maxWorkers=2
Do not retry unchanged.""")

    if heavy > MAX_HEAVY_NODE:
        out("deny", f"""LOCAL MEMORY GUARD: {heavy} node processes over {HEAVY_NODE_MB} MB are already resident, above the cap of {MAX_HEAVY_NODE}. Stacking another build/test fan-out on top of them is what took the Mac down.

Blocked: {cmd}

Run builds and suites ONE AT A TIME, never in parallel subagents. Options:
  1. Wait for the running work to finish, then retry.
  2. Move it to a server:  ~/.claude/server-mode/zrun --bg <name> '<cmd>'
  3. Inspect and stop what is idle:  ps -eo rss,pid,args -r | head -20""")

    allow()


try:
    main()
except SystemExit:
    raise
except Exception:
    sys.exit(0)   # fail open, always

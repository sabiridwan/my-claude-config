---
name: zync-server-mode
description: Point this chat session at a remote server so every subsequent command, build, training run, file read and file edit happens there over SSH instead of on the local Mac — until turned off. Takes a target argument (gpu, msprod), or off / status / no argument to list targets. Triggers on "zync-server-mode", "zync-server-mode gpu", "server mode", "server mode off", "work on the gpu server", "do this on the server", "point yourself at <server>", "back to local", "what servers can you work on".
---

# Zync server mode

One command, one argument. `$ARGUMENTS` is the target.

| Argument | Meaning |
|---|---|
| `gpu` | Zync GPU box — `zync-gpu-1`, RTX A6000 48 GB |
| `msprod` | MS Gold / ZyncGold **production** — read the safety notes below |
| `off` | Back to running on the local Mac |
| `status` | Is this session remote, and where |
| *(empty)* | List registered targets, then ask which one |

## Dispatch

```bash
# target given
~/.claude/server-mode/activate.sh on <target>

# off / status
~/.claude/server-mode/activate.sh off
~/.claude/server-mode/activate.sh status

# no argument — list, then ask
python3 -c 'import json,os
d=json.load(open(os.path.expanduser("~/.claude/server-mode/hosts.json")))
for k,v in d.items(): print("%-10s %s" % (k, v["label"]))'
```

Activation SSH-probes the host first and refuses if unreachable. If it fails,
report the error and stop — do **not** fall back to running the work locally.

On success report in one or two lines: host, GPU/VRAM if present, remote working
directory. Then get on with whatever the user actually asked for, using the
remote tooling below.

Before `off`, check for still-running background jobs (`zrun --jobs`) and tell
the user — they keep running, but `--tail` is unreachable until mode is back on.

## Working remotely

A `UserPromptSubmit` hook re-injects these rules every turn, so they hold for the
whole conversation.

| Need | Command |
|---|---|
| Run anything | `~/.claude/server-mode/zrun '<cmd>'` |
| Change remote dir (persists) | `zrun --cd <path>` |
| Show remote dir | `zrun --pwd` |
| Read a remote file | `zrun 'sed -n "1,120p" <file>'` |
| Edit a remote file | `zrun 'python3 - <<"PY" … PY'`, or heredoc / `sed -i` via `zrun` |
| Long job (train/build/serve) | `zrun --bg <name> '<cmd>'` — tmux-backed, survives disconnect |
| Watch it | `zrun --tail <name> [lines]` / `zrun --jobs` / `zrun --kill <name>` |
| GPU state | `zrun --gpu` |
| Free VRAM an idle ComfyUI is parking | `zrun --vram` |
| Remote dev servers | `zdev list` / `zdev start <name\|all>` / `zdev stop` / `zdev logs <name>` |
| Forward remote dev ports to the Mac | `zdev tunnel` / `zdev status` / `zdev tunnel-stop` |
| Land a pasted/dropped file on the server | `~/.claude/server-mode/zput <local-file>` → prints remote path |
| Land pasted bytes (image, PDF) | `printf %s "<base64>" \| ~/.claude/server-mode/zput --b64 <name.png>` |
| Inspect the remote inbox | `zput --ls` / `zput --path` (`~/.zync-inbox`) |
| Mac → server | `~/.claude/server-mode/zsync push <local> [remote]` |
| Server → Mac | `~/.claude/server-mode/zsync pull <remote> [local]` |

Full path is `~/.claude/server-mode/zrun`; it is not on `$PATH`.

### Hard rules

- **Never** use the Read / Edit / Write tools on server files — they act on this
  Mac. Remote file work goes through `zrun`.
- Never do the task's real work locally "because SSH was slow". If the server is
  unreachable, say so and stop.
- Long-running work goes through `zrun --bg`, not a foreground `zrun` that blocks.
- Repos: clone directly on the server (`zrun 'git clone …'`) rather than rsyncing
  a local checkout — unless the local tree has uncommitted work, then `zsync push`.
- **Subagents inherit server mode.** A subagent's Bash calls are routed the same
  way — spell out in the subagent's prompt that it must run builds and tests with
  `~/.claude/server-mode/zrun`, because the per-turn directive is injected into
  the main thread only.

### Enforcement (not advisory)

`~/.claude/server-mode/guard.sh` → `guard.py` runs as a `PreToolUse` hook on
`Bash`, `Read`, `Write`, `Edit`, `MultiEdit`, `NotebookEdit`, `Glob` and `Grep`,
for the main thread **and for subagents**. It fails **open** on any internal
error. Escape hatches: `ZYNC_GUARD_OFF=1` for a single call, or
`activate.sh off` to leave server mode properly.

**While server mode is active, the Mac is off-limits.** Denied, each with the
exact `zrun`/`zput` replacement in the message:

| Tool | Denied when | Use instead |
|---|---|---|
| `Bash` | it invokes a toolchain (`next build`, `jest`, `tsc`, `nest build`, `eslint`, `expo`, `npm/pnpm/yarn run …`, `make`, `cargo`, `pip install`, `docker build`), references a Mac path outside the local allowlist, or is anything beyond cheap introspection | `zrun '<cmd>'`, `zrun --bg <name> '<cmd>'` |
| `Write` `Edit` `MultiEdit` `NotebookEdit` | `file_path` is outside the local allowlist | `zrun 'python3 - <<"PY" … PY'` |
| `Read` | the file is outside the allowlist **and** is not media | `zrun 'sed -n "1,120p" <file>'` |
| `Glob` `Grep` | `path` is outside the allowlist | `zrun 'grep -rn … '` / `zrun 'find … '` |

**Still allowed locally**, because they are harness business rather than the
task's work: anything under `~/.claude/`, the session scratchpad
(`/private/tmp/claude-*`), `/var/folders`, `~/.ssh/config`; commands already
written as `zrun`/`zsync`/`zput`; cheap introspection (`ps`, `df`, `vm_stat`,
`uptime`, `echo`, `date`, `which`, …); and **reading an image or PDF** so the
model can actually see what the user pasted.

### Pasted, dropped and @-mentioned input

Input the user hands over is still input — but the work on it happens on the
server. `zput` lands it there and prints the absolute remote path:

```bash
~/.claude/server-mode/zput ~/Desktop/mockup.png          # -> /home/<user>/.zync-inbox/mockup.png
printf %s "<base64>" | ~/.claude/server-mode/zput --b64 shot.png
echo "<log text>"    | ~/.claude/server-mode/zput --stdin build.log
~/.claude/server-mode/zput --ls                          # what is in the inbox
```

Feed the printed path straight into `zrun`. Read the image locally first if you
need to see it; do not process it locally.

### Local memory floor (always on, even with server mode off)

The same guard denies a heavy build/test command whenever free RAM is below
`ZYNC_GUARD_FREE_MIN_GB` (default 6) or more than `ZYNC_GUARD_MAX_HEAVY_NODE`
(default 5) node processes above `ZYNC_GUARD_HEAVY_NODE_MB` (default 800 MB)
are already resident. This is the backstop against a parallel fan-out of builds
exhausting RAM and shutting the Mac down — it applies whether or not a server is
in play.

## Auto-activation per project

`~/.claude/server-mode/projects.json` maps a local directory tree to a target.
A `SessionStart` hook (`autostart.sh`) activates server mode automatically when
a session opens at or under one of those roots — longest prefix wins — and sets
the remote working directory from the entry's `remote` field. Trees not listed
stay local, so light work is unaffected.

Currently mapped, all to `gpu`:

| Mac | Server |
|---|---|
| `~/Projects/MalikStreams/msgold` | `/workspace/development/msgold` |
| `~/Projects/MalikStreams/msbullion` | `/workspace/development/msbullion` |
| `~/Projects/zyncgold` | `/workspace/development/zyncgold` |
| `~/Projects/zerp` | `/workspace/development/zerp` |
| `~/Projects/zyncws` | `/workspace/development/zyncws` |

If the server is unreachable the hook says so and leaves the session local
rather than failing it. `ZYNC_AUTOSTART_OFF=1` disables it; `activate.sh off`
exits for the current session.

Only add a tree once its repo actually exists on the server. Routing without
provisioning is the original failure: the model is denied the Mac, finds nothing
on the server, and stalls.

## What already exists on the GPU box

`/workspace` (symlink to `/nvme0n1-disk/workspace`, 1.7 T, 1.6 T free) holds a
full `development/` checkout — msgold, msbullion, zerp, zyncgold, zyncws,
zync-comfy, ~30 repos — with node 22, pnpm 11, corepack, mongod 8 and redis 8
running. **Do not clone these repos again into `~/Projects`.** Work in
`/workspace/development/<org>/<repo>`.

Caveat: the server has only branches that were **pushed**. A Mac-local feature
branch is not there — push it, or `zsync push` the tree, before expecting a
build to reproduce what the Mac has.

## Dev servers (PM2 on the server, ports forwarded to the Mac)

Ten services already run under PM2 on the box. `zdev` drives them and forwards
their ports, so `http://localhost:<port>` on the Mac reaches the server copy:

| Port | Service | Repo |
|---|---|---|
| 7100 / 7110 / 7120 | zyncgold be / admin / web | `zyncgold/zyncg-*` |
| 7200 / 7210 | zerp be / admin | `zerp/zerp-*` |
| 7300 | mfv-studio | `mfvstudio/app` |
| 7400 / 7410 / 7420 | msgold be / admin / fe | `msgold/msgd-*` |
| 7600 | zyncws | `zyncws` |

```bash
zdev list                 # PM2 processes + the port map
zdev tunnel               # forward every port to this Mac
zdev status               # tunnel state + per-port reachability
zdev restart dev-msgold-be\(7400\)
zdev logs "dev-msgold-be(7400)" 80
zdev local                # what is still listening on the Mac
```

`zdev tunnel` skips a port the Mac is already listening on and names the local
process to stop — the local copy is what the server copy replaces. The tunnel
runs with `ControlPath=none`, so killing it never disturbs `zrun`'s shared
connection.

Note the msgold port scheme differs between machines: the Mac ran it on
5310/5315, the server runs it on 7400/7410/7420. Use the server ports.

## GPU / VRAM

`zrun --vram` frees VRAM that an idle ComfyUI is parking. ComfyUI keeps models
resident long after a run; its `/free` endpoint unloads them progressively, so
the command calls it twice with a pause and reports before/after. It is
non-destructive — queued and in-flight ComfyUI work is unaffected. Measured:
42.4 GB → 387 MiB, i.e. the full 48 GB card comes back.

Run `zrun --vram` before any heavy GPU work, and `zrun --gpu` to confirm.

## Target facts

**`gpu`** — `zync-gpu-1`, Ubuntu 24.04, SSH alias `gpu`. RTX A6000 48 GB,
driver 560.31.02. 229 G disk, ~183 G free. Has git 2.43, node 22.23, npm 10.9,
python3.12, rsync, tmux. **No docker, no uv** — install what a task needs.
Verified 2026-09-14; check `zrun --gpu` before heavy work, the card is often
already loaded.

**`msprod`** — production. Automation scope is `/workspace/development` **only**;
never touch `production/`, `mongodb/`, `db-backups/`, `services/`. Database is
read-only, enforced for Mongo writes by a `PreToolUse` hook.

## Registering a new target

1. Add a `Host` block to `~/.ssh/config` with `HostName`, `User`, `IdentityFile`,
   plus `ControlMaster auto` / `ControlPath ~/.ssh/cm/%r@%h:%p` / `ControlPersist 10m`
   so repeated `zrun` calls reuse one connection.
2. Add an entry to `~/.claude/server-mode/hosts.json`: `ssh_alias`, `label`,
   `default_cwd`, `notes`. Put real safety constraints in `notes` — the hook
   injects them into every turn.
3. Verify with `~/.claude/server-mode/activate.sh on <target>`.

Addresses and usernames live in `~/.ssh/config` only, per the host-runbook house
style — do not copy them into `hosts.json` or into docs.

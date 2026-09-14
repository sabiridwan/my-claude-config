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

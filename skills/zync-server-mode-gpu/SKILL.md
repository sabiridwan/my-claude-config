---
name: zync-server-mode-gpu
description: Put this chat session into server mode pointed at the Zync GPU box (zync-gpu-1, RTX A6000). From then on every command, build, training run, file read and file edit happens on that server over SSH instead of on this Mac, until server mode is turned off. Triggers on "zync-server-mode-gpu", "server mode gpu", "work on the gpu server", "do this on the gpu box", "point yourself at the gpu server".
---

# Server mode — GPU

Activate, then work remotely for the rest of the session.

## Activate

```bash
~/.claude/server-mode/activate.sh on gpu
```

If the probe fails, stop and report the SSH error. Do **not** fall back to
running the work locally — the whole point is that it lands on the server.

On success, report to the user in one or two lines: host, GPU model and free
VRAM, remote working directory. Then continue with whatever they actually asked
for, using the remote tooling below.

## Working remotely

A `UserPromptSubmit` hook re-injects these rules every turn, so they stay in
force even in a long conversation.

| Need | Command |
|---|---|
| Run anything | `~/.claude/server-mode/zrun '<cmd>'` |
| Change remote dir (persists) | `zrun --cd <path>` |
| Show remote dir | `zrun --pwd` |
| Read a remote file | `zrun 'sed -n "1,120p" <file>'` |
| Edit a remote file | `zrun 'python3 - <<"PY" … PY'`, or heredoc / `sed -i` via `zrun` |
| Long job (train/build/serve) | `zrun --bg <name> '<cmd>'` — tmux-backed, survives disconnect |
| Watch a long job | `zrun --tail <name> [lines]` / `zrun --jobs` / `zrun --kill <name>` |
| GPU state | `zrun --gpu` |
| Mac → server | `~/.claude/server-mode/zsync push <local> [remote]` |
| Server → Mac | `~/.claude/server-mode/zsync pull <remote> [local]` |

Full path is `~/.claude/server-mode/zrun`; it is not on `$PATH`.

### Hard rules

- **Never** use the Read / Edit / Write tools on server files. They act on this
  Mac. Remote file work goes through `zrun`.
- Never run the task's real work locally "because SSH was slow". If the server
  is unreachable, say so and stop.
- Anything long-running goes through `zrun --bg`, not a foreground `zrun` that
  will sit there blocking.
- Repos: clone directly on the server (`zrun 'git clone …'`) rather than
  rsyncing a local checkout, unless the local tree has uncommitted work — then
  `zsync push`.

## Box facts (verified 2026-09-14)

`zync-gpu-1`, Ubuntu 24.04, user `administrator`, SSH alias `gpu`.
NVIDIA RTX A6000 48 GB, driver 560.31.02. 229 G disk, ~183 G free.
Present: git 2.43, node 22.23, npm 10.9, python3.12, rsync, tmux.
Absent: docker, uv. Install what a task needs rather than assuming.

## Turn it off

```bash
~/.claude/server-mode/activate.sh off
```

Or the user says `/zync-server-mode-off`, "server mode off", "back to local".

## Status

```bash
~/.claude/server-mode/activate.sh status
```

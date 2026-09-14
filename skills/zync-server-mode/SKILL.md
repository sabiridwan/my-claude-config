---
name: zync-server-mode
description: Point this chat session at any registered remote server so all subsequent work happens there over SSH instead of on the local Mac. Use when the user names a target other than the GPU box, asks which servers are available, or wants to register a new one. Triggers on "server mode", "zync-server-mode <name>", "work on <server>", "switch server mode to", "what servers can you work on".
---

# Server mode — generic

Registry: `~/.claude/server-mode/hosts.json`. Each entry maps a short target
name to an SSH alias in `~/.ssh/config`, a label, a default working directory
and safety notes.

## List targets

```bash
python3 -c 'import json;d=json.load(open("'$HOME'/.claude/server-mode/hosts.json"));[print(f"{k:10} {v[\"label\"]}") for k,v in d.items()]'
```

## Activate / deactivate / status

```bash
~/.claude/server-mode/activate.sh on <target>
~/.claude/server-mode/activate.sh off
~/.claude/server-mode/activate.sh status
```

Activation probes the host first and refuses to activate if SSH fails.

## Working remotely

Same contract as `zync-server-mode-gpu` — read that skill for the full table.
Short version: `~/.claude/server-mode/zrun '<cmd>'` for everything,
`zrun --cd` for the persistent remote directory, `zrun --bg/--tail/--jobs/--kill`
for long jobs, `~/.claude/server-mode/zsync push|pull` for transfers. The
Read / Edit / Write tools stay pointed at the local Mac and must not be used
for server files.

## Registering a new server

1. Add a `Host` block to `~/.ssh/config` with `HostName`, `User`, `IdentityFile`,
   plus `ControlMaster auto` / `ControlPath ~/.ssh/cm/%r@%h:%p` / `ControlPersist 10m`
   so repeated `zrun` calls reuse one connection.
2. Add an entry to `hosts.json`: `ssh_alias`, `label`, `default_cwd`, `notes`.
   Put real safety constraints in `notes` — the hook injects them into every turn.
3. Verify with `~/.claude/server-mode/activate.sh on <target>`.

Addresses and usernames live in `~/.ssh/config` only, per the existing host-runbook
house style — do not copy them into `hosts.json` or into docs.

## Registered safety notes

- `msprod` is production. Automation scope is `/workspace/development` only;
  never touch `production/`, `mongodb/`, `db-backups/`, `services/`. The
  database is read-only, and a `PreToolUse` hook enforces that for Mongo writes.

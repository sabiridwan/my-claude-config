---
name: zync-claude-cleanup
description: Use when the user wants to clean up, prune, update, or reclaim disk from their Claude Code install — plugins, external/marketplace skills, npx-linked skills, stale caches. Triggers on "clean up my skills", "update my plugins", "remove unused skills", "free up claude disk", "prune plugins", "claude cleanup", "which skills do I never use". NEVER touches the user's own custom skills.
---

# Zync — Claude Code Cleanup

Keep the Claude Code install lean: bump plugins to latest, reclaim disk from stale
caches, and prune external skills/plugins that are never used. The mechanical parts
are a deterministic script; the "never used → remove" judgement is done here with
your confirmation.

**Iron rule — never touch custom skills.** Everything under `~/.claude/skills/` that
is a real directory (not a symlink) is the user's own work: `zync-*`, `zerp-*`,
`sam-*`, `cc-*`, `dmb-*`, `sabi-*`, `graphify`, `content-match`, `ouisys-*`,
`tester-msgd`, etc. Update and remove only **external** things: marketplace plugins
and npx-linked skills (symlinks pointing into `~/.agents/skills/`). When unsure whether
something is custom, treat it as custom and leave it.

## The janitor script

`~/.claude/scripts/claude-cleanup.sh` does the deterministic, no-judgement work:

| Subcommand | Effect |
|---|---|
| `report` (default) | Read-only. Shows reclaimable stale caches, dead symlinks, empty/orphaned dirs, skill-lock drift. Changes nothing. |
| `update` | `claude plugin marketplace update` + `claude plugin update` for every installed plugin. |
| `gc` | Removes stale/orphaned plugin cache version dirs + dead symlinks. **Dry-run unless `--apply`.** |
| `all` | `update` then `gc`. |

The script only ever deletes plugin cache dirs not referenced by
`installed_plugins.json` (old shas left behind by every update — the bulk of the junk)
and broken symlinks. It reports empty custom dirs and lock drift but never deletes them.

## Workflow

1. **Report first.** Run `~/.claude/scripts/claude-cleanup.sh report`. Show the user
   what's reclaimable before changing anything.

2. **Update plugins** (if the user wants latest): `claude-cleanup.sh update`. Note that
   plugin updates need a Claude Code restart to load.

3. **Reclaim disk:** `claude-cleanup.sh gc` (dry-run) → confirm → `gc --apply`.
   Report `before -> after` size.

4. **Usage audit (the judgement part — this is why it's a skill, not just the script).**
   Find external skills/plugins never invoked, from the session transcripts:

   ```bash
   cd ~/.claude/projects
   # actual Skill-tool invocations
   grep -rhoE '"skill":"[^"]+"' . | sed 's/"skill":"//;s/"//' | sort | uniq -c | sort -rn
   # slash-command invocations
   grep -rhoE '<command-name>[^<]+</command-name>' . | sort | uniq -c | sort -rn
   # MCP tool calls (real calls carry "name":"mcp__...")
   grep -rhoE '"name":"mcp__[a-zA-Z_]+' . | sort | uniq -c | sort -rn
   # subagent usage (for agent-only plugins like code-simplifier, feature-dev)
   grep -rhoE '"subagent_type":"[^"]+"' . | sort | uniq -c | sort -rn
   ```

   **Read the counts, not raw name mentions** — every session lists all skill names in
   context (ambient), so a bare name grep gives false positives. Only the four patterns
   above mean the thing was actually *used*. Cross-reference against installed plugins
   (`claude plugin list`) and linked skills (symlinks in `~/.claude/skills`). Note the
   history window start date — a skill installed before the oldest transcript may have
   earlier untracked use; say so.

5. **Propose, confirm, remove.** List the zero-use external items in a table. Ask before
   deleting (situational skills may simply not have triggered yet — Stripe, shadcn, etc.).
   Then:
   - marketplace plugin: `claude plugin uninstall <name>@<marketplace>` — **then** GC its
     leftover cache (uninstall does NOT free the cache): re-run `gc --apply`.
   - npx-linked skill: `npx -y skills@latest remove <name> -y`. It removes the symlink +
     folder but may leave a stale `.skill-lock.json` entry — reconcile the lock if so.
   - orphaned marketplace (0 plugins installed): `claude plugin marketplace remove <name>`.

6. **Final report.** Re-run `claude-cleanup.sh report`; state what was updated, removed,
   reclaimed, and remind the user to restart Claude Code for plugin changes to load.

## Notes

- Removals are cheap to reverse: plugins via `claude plugin install <name>@<marketplace>`,
  linked skills via `npx skills add <repo>`. Say this when proposing removals.
- `claude plugin prune` only removes auto-installed dependencies — it does NOT clean
  orphaned caches of manually-uninstalled plugins. That's what `gc` is for.
- Manual only by design. If the user wants it unattended, offer to schedule
  `claude-cleanup.sh all --apply` via cron/launchd (mechanical only — the usage audit
  stays interactive).

---
name: link-skill
description: Use when the user wants to link an external skill from the npx skills ecosystem into their Claude skills and push to git. Triggers on "link_skill <name>", "link skill <name>", or any request to add a skill link.
---

# Link Skill

Links an external skill from the npx skills ecosystem into `~/.claude/skills/` as a symlink, then commits and pushes to git so updates always flow through.

## How It Works

`npx skills add <name> -g` installs to `~/.agents/skills/<name>` and auto-creates a symlink at `~/.claude/skills/<name>`. The symlink is what gets committed to git — so `npx skills update -g` keeps it fresh forever.

## Steps

1. **Extract the skill name** from the user's message (strip `/` prefix if present)

2. **Check if already linked:**
   ```bash
   ls -la ~/.claude/skills/<name>
   ```

3. **Install and link:**
   ```bash
   npx skills add <name> -g -y 2>&1
   ```
   If it fails (skill not found by short name), try searching first:
   ```bash
   npx skills find <name> 2>&1
   ```
   Then use the full `owner/repo@skill-name` form.

4. **Verify symlink was created:**
   ```bash
   ls -la ~/.claude/skills/<name>
   ```
   Should show `-> ../../.agents/skills/<name>`

5. **Commit and push:**
   ```bash
   git -C ~/.claude add skills/<name>
   git -C ~/.claude commit -m "feat(skills): link <name>"
   git -C ~/.claude push origin main
   ```

## Quick Reference

| Scenario | Action |
|---|---|
| Short name works | `npx skills add <name> -g -y` |
| Short name fails | `npx skills find <name>` → use full package path |
| Already a symlink | Skip install, just commit if not yet in git |
| Already in git | Tell user it's already linked |

## Example

User: `link_skill code-simplifier`

```bash
npx skills add code-simplifier -g -y
ls -la ~/.claude/skills/code-simplifier   # verify symlink
git -C ~/.claude add skills/code-simplifier
git -C ~/.claude commit -m "feat(skills): link code-simplifier"
git -C ~/.claude push origin main
```

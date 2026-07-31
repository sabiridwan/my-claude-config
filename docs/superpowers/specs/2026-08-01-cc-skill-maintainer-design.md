# cc-skill-maintainer — design

Date: 2026-08-01
Status: approved, implementing

## Problem

The seven `cc-*` skills encode how to build, upload, panel-configure, and QA Sam Media / Ouisys
credit-card landing pages. Every page shipped teaches something — a boilerplate trap, a panel field
that moved, a template file that drifted from what actually ships. Today those lessons land in the
page repo's own `CLAUDE.md` and die there. The next page rediscovers them.

Goal: a repeatable harvest that turns shipped-page experience into skill edits, without letting
page-specific facts poison the skills.

## Decisions (settled during brainstorming)

| Question | Decision |
|---|---|
| What it watches | Finished local cc repo work only — git history + `CLAUDE.md` + template drift. No Notion, no panel scraping, no transcript mining. |
| Write authority | **Propose only.** Agent has no `Edit` tool. It emits a report with exact diffs; the human applies. |
| Trigger | Manual `/cc-skill-sync`. No hook, no cron — an agent that fires on an empty diff trains you to ignore its reports. |
| Scan scope | Repos with new commits since last run, tracked in a state file. First run harvests everything. |

Rejected: writing straight to `main` (a wrong generalization silently poisons every future page);
per-repo subagent fan-out (over-built for a typical 1–3 changed repos).

## Artifacts

| Path | Role |
|---|---|
| `~/.claude/agents/cc-skill-maintainer.md` | Subagent definition. Tools: `Read, Grep, Glob, Bash, Write`. No `Edit` — the tool list is the enforcement. |
| `~/.claude/commands/cc-skill-sync.md` | Thin slash command that dispatches the agent. |
| `~/.claude/cc-skill-sync/state.json` | Per-repo last-harvested SHA, last run date, rejected-lesson fingerprints. **Read-only to the agent.** |
| `~/.claude/cc-skill-sync/reports/YYYY-MM-DD.md` | The report. The agent's only write target. |

State lives outside `skills/` so it never pollutes skill discovery.

## Harvest sources, per changed repo

Descending signal:

1. **`CLAUDE.md`** sections `Gotchas learned the hard way`, `Resolved decisions`, `Next steps` — a
   past session already did the generalizing work. Highest-value source.
2. **`git log <storedSHA>..HEAD`** — commit subjects and bodies, `fix(...)` especially.
3. **Template drift** — shipped code diffed against skill templates
   (`src/checkout/*` vs `cc-payment-integration/templates/*`).

## Candidate classification

Each candidate carries: target skill + file + section; `kind`; exact proposed diff; evidence as
`file:line` plus commit SHA; fingerprint.

`kind` is one of:

- `gotcha` — add to a SKILL.md gotchas section
- `template-drift` — a skill template file is stale versus shipped code
- `process-order` — a documented pipeline step is wrong or out of order
- `reference-gap` — a `references/*.md` is missing something the work needed

## Scope filter

The load-bearing part. Most page-repo commits are page-specific and must never become skill rules.

- Generalize **only** when the lesson concerns shared boilerplate: `ssr-dynamic.js`,
  `pre-build-dynamic.js`, `deploy.sh`, webpack/SSR config, the panel wizard, the build/upload
  contract, or a skill template file.
- Product-specific values never enter a skill: slug, xcid, `merchantId`, `gatewayMerchantId`, brand
  colors, fonts, plan prices, MCC entity, ticket IDs.
- One repo showing a behaviour is enough **only** if the file is shared boilerplate. Otherwise it
  needs corroboration in a second repo.

## Fingerprints and state

Fingerprint = first 12 chars of `shasum` over `<target-path>|<claim-slug>`. Rejected fingerprints
persist in `state.json` so a rejected proposal is never raised again.

The agent does **not** write `state.json`. It emits a `## State patch` block in the report; the main
thread applies it after the human's apply/reject decisions. This keeps state truthful about what was
actually accepted — advancing a repo SHA before the decision would silently drop a lesson.

## Routing table

| Lesson concerns | Target skill |
|---|---|
| build, SSR, webpack, S3 upload, `deploy.sh`, node version, repo scaffold | `cc-dynamic-lp` (+ `references/build-upload-contract.md`) |
| checkout, card, Apple Pay, Google Pay, API payloads, `src/checkout/*` | `cc-payment-integration` (+ `references/payment-architecture.md`, `templates/`) |
| panel wizard fields, template creation, publish, clone | `cc-ouisys-panel` (+ `references/create-page.md`, `clone-and-update.md`, `templates.md`) |
| QA flows, non-comp, pricing verification, leakage scanning | `cc-tester` |
| end-to-end pipeline ordering across steps | `cc-launch` |
| brand system, visual design | `cc-designer` / `cc-page` |

## Skill copy targets

`~/.claude/skills/cc-*` is the live, git-tracked copy — the only write target.
`SamMedia/credit-card/cc-*` holds an untracked duplicate of every cc skill; the agent must ignore it.
Whether to delete or symlink those copies is a separate decision, out of scope here.

## Acceptance test

Run against the streamtrainfit repo as it stands today. Its `CLAUDE.md` documents five gotchas.

Correct output:

- **Proposes** the pty/`deploy.sh` gotcha and the nvm/`navigator` TypeError gotcha into
  `cc-dynamic-lp` — both concern shared boilerplate, both generalize.
- **Discards** xcid `xhfjm`, slug `cc_acquired-streamtrainfit5999_000-`, `merchantId`, and the
  `PEPPEROSE LIMITED` MCC entity.

If a streamtrainfit-specific value appears in a proposed skill diff, the scope filter is broken.

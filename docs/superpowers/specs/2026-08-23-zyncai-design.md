# zyncai — autonomous per-repo audit/fix/PR agent, workspace-scoped

Date: 2026-08-23
Status: approved design, pending implementation plan

## Problem

Across ~/Projects there are multiple multi-repo workspaces (e.g. `zerp/`
holding `zerp-be`, `zerp-admin`, `zerp-app`, `zerp-master`, `zerp-pos` as
sibling git repos, or `zyncgold/` holding `zyncg-be`, `zyncg-admin`,
`zyncg-app`, etc). Each repo accumulates issues (mechanical, test gaps,
standards drift, logic bugs) that go unaudited between sessions, and
nothing currently tracks the *contracts between* sibling repos (BE schema
vs FE queries) so cross-repo breakage is invisible until runtime.

Separately: turning a feature request into a scoped implementation brief,
or turning legacy code into a written-down requirement, is manual every
time, even though the same project knowledge would answer both.

## Goals

- Deploy the same tool into any workspace folder; it discovers every git
  repo inside (arbitrary depth), audits/fixes each independently, and
  additionally checks the seams between them.
- Each repo accumulates durable, versioned project knowledge (a generated
  skill + a graphify graph) that improves every future Claude session in
  that repo, not just zyncai's own runs.
- Fixes are proposed as PRs, tiered by risk, never silently merged.
- Reuse existing infra: `orch-scout/hand/mid/deep` for model tiering,
  `graphify` for structural knowledge, existing MCP (Notion, gh) where
  useful. Don't rebuild what exists.
- Two read-only requirement-understanding entry points share the same
  per-repo knowledge base zyncai builds for audit/fix.

## Non-goals

- No auto-merge, ever.
- No fixing across repos in one PR — cross-repo drift is *reported*, not
  auto-fixed (two-sided changes are too risky to automate blind).
- No CI/cloud deployment in this pass — local Claude Code invocation only
  (explicitly deferred; the design keeps the pipeline reusable later).
- No new state/orchestration library — plain fan-out via the Agent tool.

## Architecture

```
/zyncai [path]                     (workspace-scoped entry point)
  │
  ├─ 1. Discovery
  │     walk from path, find every subfolder containing .git
  │     skip: node_modules, dist, build, .next, coverage, *.worktrees,
  │           any folder that is a git-worktree of an already-listed repo
  │     read workspace-root CLAUDE.md if present → shared context
  │     build manifest: { workspaceRoot, repos: [{name, path, branch, headSha}] }
  │
  ├─ 2. Fan out — one subagent per repo, parallel, isolated context
  │     each repo-agent runs the per-repo pipeline (below)
  │
  └─ 3. Cross-repo contract auditor (runs after all repo-agents finish
        STUDY, using pre-fix state) → workspace-level report, no PR
```

### Per-repo pipeline (one subagent per repo)

**a) Study** (skip if `<repo>/.claude/skills/zyncai-<repo>/SKILL.md`
frontmatter `studiedSha` == current HEAD sha)
- Read repo's own CLAUDE.md/AGENTS.md, package.json, folder structure
  (node_modules excluded from every read/grep/graphify pass).
- Run graphify over the repo → `graphify-out/` (gitignored — derived
  cache, regenerable, not source of truth).
- Detect real verify chain from package.json scripts (typecheck/lint/
  test/build) — only commands that actually exist get run, ever.
- Write/update `<repo>/.claude/skills/zyncai-<repo>/SKILL.md`: module
  map, this repo's layering rules, verify commands, known landmines,
  domain glossary. Frontmatter stamps `studiedSha` + timestamp.
  Committed to the repo — versioned, reviewable, usable by any future
  session in that repo.

**b) Audit** — using the skill just built, sweep for findings, each
tagged with a risk tier:
| Tier | Kind | Fix model |
|---|---|---|
| 1 | mechanical (typo/lint/dead code/build break) | `orch-hand` |
| 2 | failing/missing tests | `orch-mid` |
| 3 | standards drift (layering violations, hardcoded values, etc) | `orch-mid` |
| 4 | logic/business bugs | `orch-deep` |

**c) Fix** — one branch per finding: `zyncai/t<tier>-<slug>`, off current
HEAD. Never touches main/master/production directly. If repo has
uncommitted local changes at pipeline start, **skip the whole repo**,
report why — never branch off dirty state.

**d) Verify** — run whatever real verify commands exist for the touched
area; record pass/fail/unavailable per command, honestly, per command.

**e) PR** — tier 1 with all verify steps green → normal PR. Tier 2–4, or
anything with an "unavailable" verify step → **draft PR**; body states
exactly what ran, what passed, what could not be checked — never claims
tested when it wasn't. Tier 4 additionally gets a `needs-human-review`
tag and a one-line "why I think this is a bug."

### Cross-repo contract auditor

- Input: every repo-agent's skill file from this run (module maps +
  exposed contracts — GraphQL schema for `-be`-suffixed repos, REST
  routes, shared type files).
- Finds seams where one repo's expectation doesn't match another's
  reality (renamed/removed BE field still queried by admin/app, REST
  endpoint renamed but still called elsewhere, drifted shared types).
- Findings-only, no fix (two-sided, too risky to automate).
- Output: `<workspaceRoot>/.zyncai/cross-repo-report.md`, echoed in the
  run summary.

### Requirement-understanding entry points

Both reuse the same per-repo skill + graphify knowledge (re-run study
first if stale). Both are strictly read/report-only — no code, no PRs.

**`/zyncai-scope <ticket text|link> [repo|workspace]`**
- Ticket in (plain text, or Notion link via existing Notion MCP).
- Cross-references target repo(s)' skill + graph: files/modules touched,
  which architectural layer each piece lands in, existing vs net-new. If
  workspace-scoped, also surfaces cross-repo fan-out.
- Output: scoped brief (chat or artifact) — feeds the normal
  brainstorm→plan→implement flow, doesn't replace it.
- Model: `orch-mid`.

**`/zyncai-explain <module|path>`**
- Walks one module top to bottom (Resolver→Service→Repository→Schema, or
  component→context→gql) and writes up the business rules it currently
  encodes.
- Output: `<repo>/.claude/skills/zyncai-<repo>/explained/<module>.md` —
  reviewable, versioned, feeds back into future study passes.
- Model: `orch-deep` for finance/HR-grade domains, else `orch-mid`.

## Safety rails (all entry points, non-negotiable)

- Never auto-merge. Every PR opened, none merged by zyncai.
- Never commit directly to main/master/production; always a fresh branch.
- Never force-push, hard-reset, or delete another actor's branch.
- node_modules/dist/build: never read, never graphified, never edited.
- Git-worktree folders excluded from repo discovery outright.
- Dirty repo at pipeline start → skip that repo, report it.
- Tier 4 fixes always flagged `needs-human-review`.

## Open items for the implementation plan

- Exact subagent invocation shape (Agent tool per repo vs Workflow tool)
  — Workflow tool is the natural fit for "fan out N repo-agents in
  parallel, one contract-auditor after" but needs explicit user opt-in
  per its own tool rules; plan should decide/ask.
- `.zyncai/` workspace-level state (run history, last-studied shas index)
  vs relying solely on each skill file's own frontmatter — plan should
  pick one to avoid duplicate bookkeeping.
- Command names to register: `/zyncai`, `/zyncai-scope`, `/zyncai-explain`.

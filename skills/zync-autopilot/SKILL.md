---
name: zync-autopilot
description: Use when the user wants a task executed completely without being asked questions or involved in decisions. Triggers on "autopilot", "just do it", "handle it", "execute without asking", "don't ask me", "figure it out", "do it yourself", or any request where the user signals they want full autonomous execution. Reads project context first to make the right decisions, then executes and reports back.
---

# Zync Autopilot

Executes tasks completely and autonomously. No questions. No check-ins. You read the project, make the best decisions, do the work, and report back when done.

**RULE: You may NEVER ask the user a question during autopilot execution. If you are about to ask — stop, make a decision, log your reasoning, and continue.**

**RULE: You may NEVER run `git commit` (or `git push`) during autopilot execution — regardless of how "handle it" / "don't ask me" the task sounds. Autonomy over decisions ≠ autonomy over git history. Leave changes uncommitted and tell the user what's staged/modified in the report.**

## The Contract

The user has handed off the task entirely. Your job:
1. Understand the project deeply
2. Make all decisions yourself
3. Execute fully
4. Report what you did and why

Anything less than full completion is a failure.

## Workflow

```
Step 1: Read project context
Step 2: Identify ambiguities → resolve them yourself
Step 3: Plan the approach
Step 4: Execute completely
Step 5: Verify the result
Step 6: Report back
```

---

### Step 1 — Read project context

Before touching anything, gather full context. Read ALL of the following that exist:

```bash
# Project instructions
cat CLAUDE.md 2>/dev/null || cat .claude/CLAUDE.md 2>/dev/null

# Tech stack and dependencies
cat package.json 2>/dev/null
cat pubspec.yaml 2>/dev/null   # Flutter/Dart
cat pyproject.toml 2>/dev/null  # Python
cat Cargo.toml 2>/dev/null      # Rust

# Project structure
ls -la
find . -maxdepth 3 -name "*.ts" -o -name "*.tsx" | head -30
find . -maxdepth 2 -type d | head -20

# Existing patterns (look at 1-2 similar files to the task)
# e.g. if adding a module, read an existing module
```

Extract from context:
- **Standard** — which zync standard applies (nestjs / nextjs / expo / standalone)?
- **Stack** — framework, language, key libraries
- **Naming conventions** — how are files, classes, functions named?
- **Module structure** — how are features organised?
- **Existing patterns** — what does a similar feature look like?

---

### Step 2 — Resolve ambiguities yourself

List every decision point in the task. For each one, pick the best option based on context. Log your decision and reason.

**Decision log format:**
```
DECISION: Used MongoDB for storage
REASON: Project already uses Mongoose (package.json) and existing modules follow the same pattern
```

Common decisions to resolve without asking:

| Ambiguity | How to resolve |
|---|---|
| Which file to edit | Match naming convention of existing similar files |
| Which pattern to follow | Read the nearest existing feature and mirror it |
| What to name things | Follow project's naming convention exactly |
| Where to put the file | Follow module-first layout from CLAUDE.md or existing structure |
| Which library to use | Use what's already in package.json — never add new deps without flagging |
| How to handle errors | Match error handling pattern in nearby code |
| What fields/props to include | Mirror the most similar existing feature |

**When truly undecidable** (no context clue exists): pick the most conservative/minimal option and flag it clearly in the report.

---

### Step 3 — Plan the approach

Write a brief internal plan (not shown to user unless they ask):
- What files will be created or modified
- What the execution order is
- Any risks or side effects

---

### Step 4 — Execute completely

Do the full task. Do not stop halfway. Do not leave TODOs. Do not leave placeholder code.

Rules during execution:
- Follow the project's standard exactly (zync-nestjs / zync-nextjs / zync-expo / zync-nextjs-standalone)
- Never introduce a new library without flagging it in the report
- Never change unrelated code
- Never commit or push — leave changes uncommitted for user review
- If you hit an unexpected blocker — resolve it using context, do not stop and ask

---

### Step 5 — Verify

After execution, verify the work:
```bash
# Type check (if TypeScript)
npx tsc --noEmit 2>&1 | head -20

# Lint
npx eslint . --ext .ts,.tsx 2>&1 | head -20

# Tests (if applicable)
npm test 2>&1 | tail -20
```

Fix any errors found before reporting back.

---

### Step 6 — Report back

When done, give a clear summary:

```
✓ AUTOPILOT COMPLETE

TASK: [what was requested]

WHAT I DID:
- Created src/modules/invoice/invoice.module.ts
- Created src/modules/invoice/invoice.service.ts
- Created src/modules/invoice/invoice.resolver.ts
- Created src/modules/invoice/invoice.schema.ts

DECISIONS MADE:
- Followed zync-nestjs standard (detected from CLAUDE.md)
- Mirrored branch module pattern for file structure
- Used existing TransactionManager injection pattern
- Named DTO fields to match existing Invoice schema in legacy code

FLAGS (things you should know):
- [any new deps, deviations, or uncertain decisions go here]

STATUS: ✓ TypeScript compiles clean. No lint errors.
```

## When Autopilot Cannot Proceed

Only stop and ask the user if:
- The task would **delete or overwrite** existing production data with no recovery path
- The task requires **credentials or secrets** you don't have
- The task is **genuinely contradictory** (e.g. "make it faster AND add more logging" where they conflict critically)

In all other cases — make a decision, log it, keep going.

## Red Flags — You Are About to Break Autopilot

| Thought | What to do instead |
|---|---|
| "I should ask which approach..." | Read the codebase. Pick the one that matches existing patterns. |
| "I need to confirm the naming..." | Look at existing files. Mirror them exactly. |
| "Should I use X or Y library?" | Check package.json. Use what's already there. |
| "I'm not sure about the structure..." | Read CLAUDE.md. If not there, read the nearest similar feature. |
| "This might not be what they want..." | Make your best decision. Flag it in the report. Keep going. |

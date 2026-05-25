---
name: zync-brainstorm
description: Use when starting any new feature, idea, or creative work on a Zync project. Triggers on "brainstorm", "let's think about", "I have an idea", "plan this", "what should we build", or any request to explore, design, or spec something before building. Runs the full brainstorming workflow with Zync project context loaded first.
---

# Zync Brainstorm

Entry point for all brainstorming on Zync projects. Loads project context first, then runs the full brainstorming workflow via `superpowers:brainstorming`.

**REQUIRED: Invoke `superpowers:brainstorming` — this skill wraps it with Zync-specific context loading.**

## Step 1 — Load Zync project context first

Before any brainstorming begins, read:

```bash
cat CLAUDE.md 2>/dev/null          # project-specific rules and standard
cat package.json 2>/dev/null       # stack and dependencies
ls src/modules/ 2>/dev/null        # existing modules (avoid duplication)
```

Identify:
- Which Zync standard applies: **zync-nestjs / zync-nextjs / zync-expo / zync-nextjs-standalone**
- What modules already exist (don't re-brainstorm what's built)
- Any constraints documented in CLAUDE.md

## Step 2 — Run superpowers:brainstorming

Hand off to `superpowers:brainstorming` with the loaded context in mind. The full brainstorming checklist applies:

1. Explore project context
2. Ask clarifying questions (one at a time)
3. Propose 2-3 approaches with trade-offs
4. Present design → get approval
5. Write design doc to `docs/superpowers/specs/`
6. Spec self-review

## Zync-Specific Design Constraints

When proposing approaches, always validate against:

| Constraint | Rule |
|---|---|
| Layering | Resolver → Service → Repository → Schema (nestjs) or Component → Context → Query (nextjs/expo) |
| Module layout | Feature-first, self-contained modules only |
| State management | React Context only — no Redux/Zustand |
| Multi-tenancy | Always consider `companyId` / `branchId` context |
| Naming | PascalCase classes, kebab-case files, `Ap*` shared components |
| DTOs | CommonInput → CreateInput / UpdateInput(PartialType) / QueryInput |

If a proposed approach would violate these — flag it and adjust before presenting to the user.

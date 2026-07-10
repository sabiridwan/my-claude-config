---
name: zync-superpowers
description: Use when you need to know which superpowers skill to apply for a given task on a Zync project, or when starting any significant development workflow. Master reference for all superpowers skills — maps tasks to the right skill and ensures the correct workflow is followed.
---

# Zync Superpowers

Master reference for all superpowers skills available in this setup. Maps every type of task to the right skill so the correct workflow is always followed.

**REQUIRED background: `superpowers:using-superpowers` — read it first if you haven't this session.**

## Skill Map

| When you need to... | Use this skill |
|---|---|
| Plan a new feature or idea | `zync-brainstorm` → `superpowers:brainstorming` |
| Turn a spec into an implementation plan | `superpowers:writing-plans` |
| Execute an implementation plan | `superpowers:executing-plans` |
| Run independent tasks in parallel | `superpowers:subagent-driven-development` |
| Dispatch parallel agents | `superpowers:dispatching-parallel-agents` |
| Debug a bug or failing test | `superpowers:systematic-debugging` |
| Write tests before code | `superpowers:test-driven-development` |
| Review your own code before finishing | `superpowers:verification-before-completion` |
| Request a code review | `superpowers:requesting-code-review` |
| Receive and apply a code review | `superpowers:receiving-code-review` |
| Wrap up a feature branch | `superpowers:finishing-a-development-branch` |
| Work in isolation (git worktree) | `superpowers:using-git-worktrees` |
| Create or edit a skill | `superpowers:writing-skills` |
| Execute a task without user involvement | `zync-autopilot` |
| Design UI with consistency | `zync-design` |

## Recommended Flow for a Full Feature

```
zync-brainstorm
    ↓ (design approved)
superpowers:writing-plans
    ↓ (plan ready)
superpowers:using-git-worktrees   ← isolate work
    ↓
superpowers:executing-plans       ← or zync-autopilot
    ↓
superpowers:verification-before-completion
    ↓
superpowers:finishing-a-development-branch
```

## Rules

- **Always brainstorm before implementing** — never skip `zync-brainstorm` for anything non-trivial.
- **Always verify before finishing** — `superpowers:verification-before-completion` is not optional.
- **Skill priority:** process skills (brainstorming, debugging) before implementation skills.
- **If unsure which skill applies** — check this map first, then `superpowers:using-superpowers`.

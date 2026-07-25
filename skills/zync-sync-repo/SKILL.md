---
name: zync-sync-repo
description: Use when the user wants to pull latest changes, push their work, or "sync" a repo (any zerp-* repo or any other git repo) without losing local uncommitted work or already-pushed commits. Triggers on "pull latest", "sync my branch", "git pull", "update my branch", "push my changes", "pull without losing my changes", or any git pull/push request in a repo that might have dirty local state or a rewritten remote history. Also use proactively before any pull/rebase if the user's working tree is dirty or the remote branch may have been force-pushed.
---

# Zync — Sync Repo Safely

## Overview

Two ways to lose work during a routine pull/push, and both have already happened in this ecosystem:

1. **Local uncommitted changes get clobbered or silently merged** by a pull/checkout that assumes a clean tree.
2. **`git pull --rebase` silently drops already-pushed commits** after a teammate force-pushes the remote branch — git's fork-point heuristic treats your commits as "already merged" because they were once part of the now-rewritten upstream, and prints a cheerful "Successfully rebased" while your work vanishes. This has hit `origin/development` in both zerp-be and zerp-admin multiple times.

This skill's job is to make every pull/push round-trip provably lossless — diagnose before integrating, never assume, never force.

## Before touching anything

- `git status` — never run a destructive-adjacent command (`checkout`, `restore`, `reset`, `stash drop`, `clean`) without having just seen current status.
- Default to the repo at the current working directory. If the user names multiple repos (e.g. "sync be and admin"), repeat the full workflow independently per repo — never batch-assume they're in the same state.
- Don't auto-commit the user's in-progress work to make a pull easier. If the working tree is dirty, stash it — committing on their behalf is not your call to make unless they asked for a commit.

## Safe pull workflow

1. **`git fetch origin`** — never pull directly; fetch first so you can inspect before integrating.
2. **Diagnose for a rewritten remote before doing anything else**:
   ```bash
   git reflog show origin/<branch> | head -5
   ```
   Signature to watch for: `fetch: forced-update`. If a `forced-update` line sits above an `update by push` at one of the user's own SHAs, the remote was force-pushed and their commits may be missing upstream — stop and report before integrating; do not silently rebase past it.
3. **Stash dirty local work** (skip if `git status` is clean):
   ```bash
   git stash push -u -m "zync-sync-repo: pre-pull $(git branch --show-current)"
   ```
   `-u` is required — untracked new files are lost silently without it.
4. **Integrate**:
   - No divergence (fast-forward possible): `git merge --ff-only origin/<branch>`.
   - Diverged, remote NOT force-pushed: `git merge origin/<branch>` — merge, not rebase. This ecosystem's branches already carry merge commits in their history, so a merge is idiomatic here, not a workaround. Only rebase if the user explicitly asks for a linear history, and then use `--no-fork-point` so the force-push trap above can't reoccur.
   - Diverged, remote WAS force-pushed: tell the user what got clobbered (the SHAs above the `forced-update` line), and ask how they want to recover before merging — don't guess whether their commits are still needed.
5. **Restore local work**: `git stash pop`. If it conflicts, resolve deliberately — never resolve by dropping one side. If you can't tell which side should win, leave the stash entry (don't `stash drop`) and ask.
6. **Confirm nothing is missing**: `git status` should be clean (or show only the user's original uncommitted changes, unmodified). For anything that mattered pre-pull, `git merge-base --is-ancestor <sha> HEAD` should hold true.

## Safe push workflow

1. `git fetch origin` immediately before pushing — don't push against a stale view of the remote.
2. If local is behind, run the safe pull workflow above first. Never respond to a rejected push by reflexively rebasing.
3. Plain `git push origin <branch>` only. Force-push (`--force`, `--force-with-lease`) is a hard-confirm action per this project's safety rules — never run it to "resolve" a push rejection without the user explicitly asking for it, and explain what it would overwrite first.
4. After push, sanity-check: `git log origin/<branch>..HEAD` should be empty (nothing local left unpushed) and `git status` clean.

## Don't

- Run `git pull` or `git pull --rebase` directly — always fetch, diagnose, then integrate deliberately.
- Rebase a shared/team branch (`development`, `dev-my`, `main`) as a reflex — check this ecosystem's convention first; several branches here are merge-based by design.
- Commit the user's uncommitted work to unblock a pull unless they asked you to commit.
- Drop a stash before confirming its contents landed somewhere safe.
- Force-push, hard-reset, or `stash drop`/`clean -f` without explicit per-instance confirmation, even if you did the equivalent last time in this session.
- Assume a non-fast-forward rejection means "just rebase" — it may mean the remote was force-pushed; diagnose first.

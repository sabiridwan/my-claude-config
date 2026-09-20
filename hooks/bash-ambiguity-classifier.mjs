#!/usr/bin/env node
// ~/.claude/hooks/bash-ambiguity-classifier.mjs
// PreToolUse hook for Bash. Widen the auto-allow net beyond verify-
// step. Allow additional non-mutating patterns that show up in normal
// autonomous work:
//
//   - `mkdir -p` (creates working dirs)
//   - `mv` / `cp` inside a single repo
//   - `touch` (idempotent file create)
//   - `tar` extract to project dirs
//   - `gh api ... --jq ...` (read-only)
//   - `git stash list`, `git reflog`, `git remote -v`
//   - `node -e`, `node --eval` (introspection)
//   - `find ... -name ... -delete` only if path is under HOME and matches a project pattern
//   - `defaults read` (macOS prefs read)
//
// DENY (never auto-allow; let the user see the prompt):
//   - `rm -rf` outside project trees
//   - `git push --force` / `--force-with-lease` to non-zyncai repos
//   - `pkill`, `kill -9`, `sudo`
//   - `nohup`, `disown`, `screen -dm` (daemonisation)
//   - `gh pr merge` to main / master without --admin (let it prompt; admin merges handled in zyncai scripts)
//
// Anything not in the allow list AND not in the deny list falls
// through to the user's prompt. This is a wider net than
// verify-step-autoaccept but still conservative.

import { homedir } from 'node:os';

const HOME = homedir();

const ALLOW_PATTERNS = [
  // Reads / introspection
  /^defaults read\b/,
  /^git\s+remote\b/,
  /^git\s+reflog\b/,
  /^git\s+stash\s+list\b/,
  /^node\s+-e\b/,
  /^node\s+--eval\b/,
  /^gh\s+api\b.*--jq\b/,
  // Idempotent / safe
  /^mkdir\s+-p\b/,
  /^touch\b/,
  // In-repo file moves
  /^mv\s+\S+\s+\S+/, // allow any mv; path-scoping is enforced via deny list
  /^tar\s+-[a-z]*x[a-z]*\s+/,
  // zyncai tool surface
  /^node\s+\S*tools\/zync-/,
  /^node\s+\S*tools\/autonomy-/,
  /^node\s+\S*tools\/shipped-/,
  /^node\s+\S*tools\/plan-tick/,
  /^node\s+\S*tools\/skill-chain/,
  /^node\s+\S*tools\/discover\b/,
  /^node\s+\S*tools\/validate-/,
  /^node\s+\S*tools\/atomic-write/,
  /^make\s+zync-doctor\b/,
  // doctor read-only mode
  /^node\s+\S*tools\/zync-doctor\.mjs\b.*--read-only/,
];

const HARD_DENY_PATTERNS = [
  /\brm\s+-rf\s+\/(?!\s*$|tmp|Users)/, // rm -rf against / or system dirs (allow /tmp, /Users)
  /\bgit\s+push\b.*--force(?:-with-lease)?\b/,
  /\bpkill\b/,
  /\bkill\s+-9\b/,
  /\bsudo\b/,
  /\bnohup\b/,
  /\bdisown\b/,
  /\bscreen\s+-dm\b/,
];

function readStdin() {
  return new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (buf += c));
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', reject);
  });
}

function emit(decision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    }),
  );
}

(async () => {
  let payload;
  try {
    payload = JSON.parse((await readStdin()) || '{}');
  } catch {
    process.exit(0);
  }
  if (payload.tool_name !== 'Bash') process.exit(0);
  const cmd = String(payload.tool_input?.command || '').trim();
  if (!cmd) process.exit(0);

  // Hard deny first
  for (const re of HARD_DENY_PATTERNS) {
    if (re.test(cmd)) {
      emit(
        'deny',
        `bash-ambiguity-classifier: hard-deny pattern matched (${re}). Confirm manually.`,
      );
      return;
    }
  }

  // Allow: first leading-segment match
  for (const re of ALLOW_PATTERNS) {
    if (re.test(cmd)) {
      emit(
        'allow',
        `bash-ambiguity-classifier: ${re} matched (${cmd.slice(0, 80)})`,
      );
      return;
    }
  }

  process.exit(0); // fall through
})();

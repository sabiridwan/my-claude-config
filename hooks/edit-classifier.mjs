#!/usr/bin/env node
// ~/.claude/hooks/edit-classifier.mjs
// PreToolUse hook for Edit|Write|MultiEdit|NotebookEdit. Allow files
// under known-safe path trees. Deny writes to prod-config / secrets /
// out-of-tree locations. Anything not classified falls through to the
// user's default prompt.
//
// Safe path roots:
//   ~/Projects/**              (all repos)
//   ~/SamMedia/**              (legacy Sam Media work)
//   ~/.claude/**               (claude config, skills, memory, plugins)
//   /tmp/**                    (scratch)
//   /Users/sabiridwan/**       (broad — last-line catch; covered by ~/Projects too)
//
// DENY paths:
//   ~/.ssh/**                  (keys)
//   ~/.aws/**                  (credentials)
//   ~/.config/gh/hosts.yml     (gh auth tokens)
//   /etc/**, /usr/local/**, /System/**
//   anything matching ~/.npmrc, ~/.netrc, ~/.gitconfig
//
// Same shape as verify-step-autoaccept.mjs: stdin JSON → stdout JSON
// decision. Exit 0 no-output = fall through.

import { homedir } from 'node:os';

const HOME = homedir();

const SAFE_PREFIXES = [
  `${HOME}/Projects/`,
  `${HOME}/SamMedia/`,
  `${HOME}/Playground/`,
  `${HOME}/.claude/`,
  `${HOME}/Library/`,
  `${HOME}/Documents/`,
  `${HOME}/Desktop/`,
  '/tmp/',
  '/private/tmp/',
  '/private/var/folders/',
];

const DENY_PATTERNS = [
  /\.ssh\//,
  /\.aws\//,
  /\.gnupg\//,
  /\.npmrc$/,
  /\.netrc$/,
  /\.gitconfig$/,
  /\/etc\//,
  /\/usr\/local\//,
  /\/System\//,
  /\.config\/gh\/hosts\.yml$/,
  /\.docker\/config\.json$/,
];

const TOOL_TO_FIELD = {
  Edit: 'file_path',
  Write: 'file_path',
  MultiEdit: 'file_path',
  NotebookEdit: 'notebook_path',
};

function classify(toolName, filePath) {
  if (!filePath || typeof filePath !== 'string') return 'fallthrough';
  if (DENY_PATTERNS.some((re) => re.test(filePath))) {
    return 'deny';
  }
  if (SAFE_PREFIXES.some((p) => filePath.startsWith(p))) {
    return 'allow';
  }
  return 'fallthrough';
}

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
  const out = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(out));
}

(async () => {
  let payload;
  try {
    payload = JSON.parse((await readStdin()) || '{}');
  } catch {
    process.exit(0);
  }
  const toolName = payload.tool_name || '';
  const toolInput = payload.tool_input || {};
  const field = TOOL_TO_FIELD[toolName];
  if (!field) {
    process.exit(0);
  }
  const filePath = toolInput[field];

  // MultiEdit has file_path but also nested edits — just one decision per file is fine.
  const decision = classify(toolName, filePath);
  if (decision === 'allow') {
    emit('allow', `edit-classifier: ${toolName} under safe path (${filePath})`);
  } else if (decision === 'deny') {
    emit(
      'deny',
      `edit-classifier: ${toolName} target is in protected path (${filePath}). Secrets / system config — confirm manually.`,
    );
  } else {
    process.exit(0); // fallthrough
  }
})();

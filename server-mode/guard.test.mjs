#!/usr/bin/env node
// Tests for guard.py: PreToolUse hook that gates server-mode routing.
//
// Each test synthesises a JSON payload, runs the guard, and asserts the
// resulting decision. Tests use a tmp HOME so the real state/ and ptr/
// directories stay untouched.
//
// Run:  node /Users/sabiridwan/.claude/server-mode/guard.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const GUARD = '/Users/sabiridwan/.claude/server-mode/guard.py';

// Make a fake HOME with state/, ptr/, hosts.json, account-policy.json
// matching the real layout, then point HOME at it via env so the guard
// reads from the sandbox.
function setupSandbox() {
  const home = mkdtempSync(join(tmpdir(), 'guard-test-'));
  mkdirSync(join(home, '.claude', 'server-mode', 'state'), { recursive: true });
  mkdirSync(join(home, '.claude', 'server-mode', 'ptr'), { recursive: true });
  writeFileSync(
    join(home, '.claude', 'server-mode', 'hosts.json'),
    JSON.stringify({
      gpu: { ssh_alias: 'gpu', label: 'gpu', default_cwd: '/tmp', notes: '' },
    }),
  );
  writeFileSync(
    join(home, '.claude', 'server-mode', 'account-policy.json'),
    JSON.stringify({ policy: 'deny_work', work_accounts: [], personal_accounts: [] }),
  );
  return home;
}

function writeState(home, sid, payload) {
  writeFileSync(
    join(home, '.claude', 'server-mode', 'state', `${sid}.json`),
    JSON.stringify(payload),
  );
}

function writePtr(home, cwd, ownerSid) {
  const k = createHash('sha256').update(cwd).digest('hex').slice(0, 16);
  writeFileSync(join(home, '.claude', 'server-mode', 'ptr', k), `${ownerSid}\n`);
}

function runGuard(home, payload) {
  return spawnSync('python3', [GUARD], {
    input: JSON.stringify(payload),
    env: { ...process.env, HOME: home, PATH: process.env.PATH },
    encoding: 'utf8',
    timeout: 10_000,
  });
}

function readDecision(result) {
  // The guard prints a JSON object with hookSpecificOutput.permissionDecision
  // on the last line of stdout, OR exits 0 with no output (allow path).
  const out = result.stdout.trim();
  if (!out) return { decision: 'allow', reason: '' };
  try {
    const j = JSON.parse(out);
    return {
      decision: j.hookSpecificOutput?.permissionDecision ?? 'allow',
      reason: j.hookSpecificOutput?.permissionDecisionReason ?? '',
    };
  } catch {
    return { decision: 'unknown', reason: out };
  }
}

test('guard allows when session has no state file (even if cwd pointer exists)', () => {
  const home = setupSandbox();
  try {
    // Stale ptr from a previous (now-deactivated) session A
    writePtr(home, '/Users/sabiridwan/Projects/zyncai', 'sid-A');
    // Session B starts fresh — no state file for it
    const r = runGuard(home, {
      tool_name: 'Bash',
      tool_input: { command: 'echo hello' },
      session_id: 'sid-B',
      cwd: '/Users/sabiridwan/Projects/zyncai',
    });
    assert.equal(r.status, 0);
    const d = readDecision(r);
    assert.equal(d.decision, 'allow', `expected allow, got ${d.decision}: ${d.reason}`);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('guard denies when session has its own state file (server mode active for THIS session)', () => {
  const home = setupSandbox();
  try {
    writeState(home, 'sid-A', {
      target: 'gpu',
      ssh_alias: 'gpu',
      label: 'zync-gpu-1',
      notes: 'GPU box',
      remote_cwd: '/workspace/development',
      activated_at: '2026-09-24',
    });
    const r = runGuard(home, {
      tool_name: 'Bash',
      tool_input: { command: 'git status' },
      session_id: 'sid-A',
      cwd: '/Users/sabiridwan/Projects/zyncai',
    });
    const d = readDecision(r);
    assert.equal(d.decision, 'deny', `expected deny for sid-A with state file, got ${d.decision}`);
    assert.match(d.reason, /SERVER MODE is ACTIVE/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('guard denies for the OWN session but NOT for a sibling session in same cwd', () => {
  const home = setupSandbox();
  try {
    // Session A activated server mode in cwd X
    writeState(home, 'sid-A', {
      target: 'gpu',
      ssh_alias: 'gpu',
      label: 'zync-gpu-1',
      notes: 'GPU box',
      remote_cwd: '/workspace/development',
      activated_at: '2026-09-24',
    });
    // Session A's cwd ptr is stale (older, but irrelevant — guard ignores it)
    writePtr(home, '/Users/sabiridwan/Projects/zyncai', 'sid-A');

    // 1. Session A in cwd X: should be DENIED (its own state file)
    const rA = runGuard(home, {
      tool_name: 'Bash',
      tool_input: { command: 'git status' },
      session_id: 'sid-A',
      cwd: '/Users/sabiridwan/Projects/zyncai',
    });
    assert.equal(readDecision(rA).decision, 'deny', 'sid-A should be denied');

    // 2. Session B in cwd X: should be ALLOWED (no state file for sid-B,
    //    cwd pointer must NOT inherit sid-A's state)
    const rB = runGuard(home, {
      tool_name: 'Bash',
      tool_input: { command: 'git status' },
      session_id: 'sid-B',
      cwd: '/Users/sabiridwan/Projects/zyncai',
    });
    const dB = readDecision(rB);
    assert.equal(dB.decision, 'allow',
      `sid-B should NOT inherit sid-A's server mode, got: ${dB.reason}`);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('guard allows read of local-ok path even when server mode is active', () => {
  const home = setupSandbox();
  try {
    writeState(home, 'sid-A', {
      target: 'gpu',
      ssh_alias: 'gpu',
      label: 'zync-gpu-1',
      notes: '',
      remote_cwd: '/workspace/development',
      activated_at: '2026-09-24',
    });
    // ~/.claude/* is on the LOCAL_OK list (HOME is the sandbox here,
    // so use a path under it)
    const localPath = join(home, '.claude', 'CLAUDE.md');
    const r = runGuard(home, {
      tool_name: 'Read',
      tool_input: { file_path: localPath },
      session_id: 'sid-A',
      cwd: '/Users/sabiridwan/Projects/zyncai',
    });
    const d = readDecision(r);
    assert.equal(d.decision, 'allow', 'LOCAL_OK paths must bypass the guard');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('guard denies when sid is empty string (no payload session_id)', () => {
  const home = setupSandbox();
  try {
    writeState(home, 'sid-A', {
      target: 'gpu', ssh_alias: 'gpu', label: '', notes: '',
      remote_cwd: '/workspace/development', activated_at: '',
    });
    writePtr(home, '/Users/sabiridwan/Projects/zyncai', 'sid-A');
    // sid is empty — should NOT inherit via cwd ptr
    const r = runGuard(home, {
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      session_id: '',
      cwd: '/Users/sabiridwan/Projects/zyncai',
    });
    const d = readDecision(r);
    assert.equal(d.decision, 'allow',
      `empty sid must not inherit cwd-pointer state, got: ${d.reason}`);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

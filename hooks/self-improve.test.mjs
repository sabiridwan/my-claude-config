#!/usr/bin/env node
// Tests for self-improve.mjs. Run with `node hooks/self-improve.test.mjs`.
// The hook reads stdin and writes to MEMORY_FILE; tests stub both.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const HOOK_PATH = new URL('./self-improve.mjs', import.meta.url).pathname;

// Synthesise a JSONL transcript where every entry has the exact shape
// the hook expects to read.
function makeTranscript(entries) {
  return entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
}

function buildAssistantToolUse(name, input) {
  return {
    type: 'assistant',
    message: {
      content: [{ type: 'tool_use', name, input }],
    },
  };
}

function buildUserToolResult(text) {
  return {
    type: 'user',
    message: {
      content: [{ type: 'tool_result', content: text }],
    },
  };
}

function runHook({ cwd, transcript, memoryPath }) {
  // The hook reads MEMORY_FILE from homedir(); redirect via env by
  // monkey-patching import.meta.url would be cleaner, but a wrapper
  // process with HARNESS overrides is simpler — just verify behaviour
  // via the real file at a temp MEMORY_FILE pointed through the
  // HOME-resolution path. We monkey-patch by setting HOME and using a
  // sandbox directory mirroring ~/.claude/projects/.../memory.
  const fakeHome = mkdtempSync(join(tmpdir(), 'si-home-'));
  const dir = join(fakeHome, '.claude', 'projects', '-Users-sabiridwan-Projects-zyncai', 'memory');
  // We rely on the hook's hardcoded path; redirect via symlink at
  // HOME to a fixture dir that mirrors the target path.
  // Simpler: write HOME=/tmp/x, and accept the default file lands at
  // /tmp/x/.claude/projects/.../memory/project_autonomy_self_improve.md.
  const payload = JSON.stringify({
    session_id: 'abcdef1234567890',
    transcript_path: transcript,
    cwd,
    reason: 'test',
  });
  const result = spawnSync('node', [HOOK_PATH], {
    input: payload,
    env: { ...process.env, HOME: fakeHome },
    encoding: 'utf8',
  });
  const memFile = join(dir, 'project_autonomy_self_improve.md');
  const written = existsSync(memFile) ? readFileSync(memFile, 'utf8') : null;
  rmSync(fakeHome, { recursive: true, force: true });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status, memory: written };
}

test('writes heartbeat even when no friction', () => {
  const transcript = join(tmpdir(), `si-transcript-${Date.now()}.jsonl`);
  writeFileSync(transcript, makeTranscript([
    { type: 'assistant', message: { content: [{ type: 'text', text: 'plain thinking' }] } },
    { type: 'user', message: { content: [{ type: 'text', text: 'ok' }] } },
  ]));
  const out = runHook({ cwd: '/Users/sabiridwan/Projects/zyncai', transcript });
  rmSync(transcript, { force: true });
  assert.equal(out.status, 0);
  assert.ok(out.memory, 'memory file should exist');
  assert.match(out.memory, /heartbeat|events, \d+ tool_use/, 'must include heartbeat line');
  assert.match(out.memory, /no friction signals/);
});

test('skips non-zyncai cwd', () => {
  const transcript = join(tmpdir(), `si-transcript-${Date.now()}.jsonl`);
  writeFileSync(transcript, makeTranscript([{ type: 'assistant' }]));
  const out = runHook({ cwd: '/Users/sabiridwan/Projects/other', transcript });
  rmSync(transcript, { force: true });
  assert.equal(out.status, 0);
  assert.equal(out.memory, null, 'must not write for non-zyncai cwd');
});

test('detects repeated Bash command and suggests allowlist entry', () => {
  const transcript = join(tmpdir(), `si-transcript-${Date.now()}.jsonl`);
  const bashCmd = 'git worktree remove /Users/sabiridwan/Projects/zyncai/admin-mgmt --force';
  writeFileSync(transcript, makeTranscript([
    buildAssistantToolUse('Bash', { command: bashCmd }),
    buildAssistantToolUse('Bash', { command: bashCmd }),
    buildAssistantToolUse('Bash', { command: bashCmd }),
  ]));
  const out = runHook({ cwd: '/Users/sabiridwan/Projects/zyncai', transcript });
  rmSync(transcript, { force: true });
  assert.equal(out.status, 0);
  assert.ok(out.memory);
  assert.match(out.memory, /Bash retried 3x/);
  assert.match(out.memory, /permissions\.allow/);
});

test('detects hook-deny signature in tool_result', () => {
  const transcript = join(tmpdir(), `si-transcript-${Date.now()}.jsonl`);
  writeFileSync(transcript, makeTranscript([
    buildAssistantToolUse('Bash', { command: 'echo hi' }),
    buildUserToolResult('{"permissionDecision":"deny","permissionDecisionReason":"hard-deny"}'),
  ]));
  const out = runHook({ cwd: '/Users/sabiridwan/Projects/zyncai', transcript });
  rmSync(transcript, { force: true });
  assert.equal(out.status, 0);
  assert.ok(out.memory);
  assert.match(out.memory, /hook denied a tool call/);
});

test('stays under MAX_PER_SESSION_BYTES', () => {
  const transcript = join(tmpdir(), `si-transcript-${Date.now()}.jsonl`);
  const entries = [];
  for (let i = 0; i < 200; i++) {
    entries.push(buildAssistantToolUse('Bash', { command: `git status --short --branch-${i}` }));
  }
  writeFileSync(transcript, makeTranscript(entries));
  const out = runHook({ cwd: '/Users/sabiridwan/Projects/zyncai', transcript });
  rmSync(transcript, { force: true });
  assert.ok(out.memory);
  // Truncation marker only appears when the block was actually cut.
  assert.ok(out.memory.length < 8192, `memory block must stay small, got ${out.memory.length}`);
});
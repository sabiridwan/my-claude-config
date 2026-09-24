#!/usr/bin/env node
// ~/.claude/hooks/self-improve.mjs
// Stop hook. After each session ends, scan the session transcript for
// friction events (denied tool calls, repeated prompts on the same
// command, hook denials) and propose allow / hook additions that
// would have prevented them.
//
// Output: appends one block per session to
// ~/.claude/projects/-Users-sabiridwan-Projects-zyncai/memory/project_autonomy_self_improve.md
// (or creates it). Idempotent. Stays under 4 KiB per session entry
// to keep the memory file bounded.
//
// Always writes a heartbeat line so the feedback loop is observable;
// friction-suggestions are appended below it when detected.

import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const HOME = homedir();
const MEMORY_FILE = join(
  HOME,
  '.claude',
  'projects',
  '-Users-sabiridwan-Projects-zyncai',
  'memory',
  'project_autonomy_self_improve.md',
);
const MAX_PER_SESSION_BYTES = 4096;
// Friction threshold: a Bash command issued >=N times in one session is
// almost certainly a denied/repeated-prompt pattern, not normal reuse.
const REPEAT_THRESHOLD = 2;

async function readStdin() {
  return new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (buf += c));
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', reject);
  });
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d+Z$/, 'Z');
}

// Extract tool_use entries from an assistant turn. Returns
// [{ name, input }] for each tool_use block in message.content.
function extractToolUses(entry) {
  if (entry?.type !== 'assistant') return [];
  const content = entry?.message?.content;
  if (!Array.isArray(content)) return [];
  const out = [];
  for (const c of content) {
    if (c?.type === 'tool_use' && c?.name) {
      out.push({ name: c.name, input: c.input || {} });
    }
  }
  return out;
}

// Pull every string-ish content out of a tool_result block so we can
// scan for hook-deny signatures and permission reasons.
function extractToolResultText(entry) {
  if (entry?.type !== 'user') return '';
  const content = entry?.message?.content;
  if (!Array.isArray(content)) return '';
  const parts = [];
  for (const c of content) {
    if (c?.type === 'tool_result') {
      const body = c?.content;
      if (typeof body === 'string') parts.push(body);
      else if (Array.isArray(body)) {
        for (const b of body) {
          if (typeof b === 'string') parts.push(b);
          else if (b?.text) parts.push(b.text);
        }
      }
    }
  }
  return parts.join('\n');
}

// Build the set of friction signals from the full transcript.
function collectFriction(lines) {
  const suggestions = new Set();
  const bashCounts = new Map(); // cmd -> count
  let toolUses = 0;
  let toolResults = 0;
  let eventsScanned = 0;

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!entry || typeof entry !== 'object') continue;
    eventsScanned++;

    for (const tu of extractToolUses(entry)) {
      toolUses++;
      if (tu.name === 'Bash' && typeof tu.input?.command === 'string') {
        const cmd = tu.input.command.replace(/\s+/g, ' ').trim();
        // Skip trivial commands that always fire (read-only introspection).
        if (cmd.length < 5) continue;
        bashCounts.set(cmd, (bashCounts.get(cmd) || 0) + 1);
      }
    }

    const resultText = extractToolResultText(entry);
    if (resultText) toolResults++;

    // Hook-deny signatures: server-mode guard, edit-classifier, skill-classifier
    if (resultText.includes('permissionDecision') && resultText.includes('"deny"')) {
      suggestions.add('hook denied a tool call this session — review the reason in the transcript and widen the relevant classifier');
    }
    if (resultText.includes('ZYNC SERVER MODE is ACTIVE')) {
      suggestions.add('session was in server mode — verify no local Mac-path command was needed');
    }
    if (resultText.includes('evolve self-tripwire')) {
      suggestions.add('evolve-self-tripwire blocked a write under skills/zyncai-evolve/ — confirm intentional');
    }
    if (resultText.includes('agent concurrency limit') || resultText.includes('Agent concurrency cap')) {
      suggestions.add('Agent concurrency cap hit — review whether fan-out should be batched smaller');
    }
  }

  // Repeated Bash commands => suggest adding to allowlist.
  for (const [cmd, count] of bashCounts.entries()) {
    if (count >= REPEAT_THRESHOLD) {
      const trimmed = cmd.slice(0, 80);
      suggestions.add(`Bash retried ${count}x — add Bash(${cmd.split(' ')[0]}*) to permissions.allow in ~/.claude/settings.json, OR widen bash-ambiguity-classifier.mjs ALLOW: \`${trimmed}\``);
    }
  }

  return { suggestions, eventsScanned, toolUses, toolResults };
}

(async () => {
  // Stop hook payload: { session_id, transcript_path, cwd, reason }
  let payload;
  try {
    payload = JSON.parse((await readStdin()) || '{}');
  } catch {
    process.exit(0);
  }

  const sessionId = payload.session_id || 'unknown';
  const cwd = payload.cwd || '';

  // Skip non-zyncai sessions — self-improve is project-scoped
  if (!cwd.includes('/Users/sabiridwan/Projects/zyncai')) {
    process.exit(0);
  }

  const transcriptPath = payload.transcript_path;
  if (!transcriptPath || !existsSync(transcriptPath)) {
    process.exit(0);
  }

  let transcript;
  try {
    transcript = readFileSync(transcriptPath, 'utf8');
  } catch {
    process.exit(0);
  }

  const lines = transcript.split('\n').filter(Boolean);
  const { suggestions, eventsScanned, toolUses, toolResults } = collectFriction(lines);

  // Heartbeat first — the loop is observable even when nothing fired.
  const heartbeat = `## ${nowIso()} session=${sessionId.slice(0, 8)} — ${eventsScanned} events, ${toolUses} tool_use, ${toolResults} tool_result`;

  const body = suggestions.size > 0
    ? [
        heartbeat,
        `cwd: ${cwd}`,
        ``,
        `Friction surfaced:`,
        ...[...suggestions].slice(0, 12).map((s) => `- ${s}`),
        ``,
      ].join('\n')
    : [heartbeat, `cwd: ${cwd}`, `(no friction signals)`, ``].join('\n');

  const block = `\n${body}`;
  const trimmed = block.length > MAX_PER_SESSION_BYTES ? block.slice(0, MAX_PER_SESSION_BYTES) + '\n[...truncated]\n' : block;

  if (!existsSync(MEMORY_FILE)) {
    mkdirSync(join(MEMORY_FILE, '..'), { recursive: true });
    const header = [
      `---`,
      `name: zyncai-autonomy-self-improve`,
      `description: Auto-generated heartbeat + friction suggestions from self-improve.mjs Stop hook. Each session appends one block. Promote concrete suggestions into actual allow / hook edits.`,
      `metadata:`,
      `  type: project`,
      `---`,
      ``,
      `# Autonomy self-improve log`,
      ``,
      `Each block below was generated by ~/.claude/hooks/self-improve.mjs at session stop. The heartbeat line proves the loop ran; the friction lines are concrete allow / hook edit candidates.`,
      ``,
    ].join('\n');
    writeFileSync(MEMORY_FILE, header + trimmed, 'utf8');
  } else {
    appendFileSync(MEMORY_FILE, trimmed, 'utf8');
  }

  process.exit(0);
})();
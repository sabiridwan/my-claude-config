#!/usr/bin/env node
// ~/.claude/hooks/mcp-classifier.mjs
// PreToolUse hook for mcp__* tools. Allow broad namespaces for the
// MCP servers that are part of the standing toolkit:
//
//   mcp__chrome-devtools__*    browser automation (debug Chrome)
//   mcp__ouisys-panel__*       Ouisys panel ops
//   mcp__Claude_Browser__*     Claude's own browser tool
//   mcp__msgld__*              msgld user_update / estimate_approve (already project-allowed)
//
// Other mcp__* namespaces (e.g. mcp__plugin_*) fall through.
//
// This is intentionally permissive on the read-like MCPs. The
// chrome-devtools / ouisys-panel / Claude_Browser tools do their own
// damage control (sandboxed Chrome, scoped credentials).

const ALLOWED_NAMESPACES = [
  'mcp__chrome-devtools__',
  'mcp__ouisys-panel__',
  'mcp__Claude_Browser__',
  'mcp__msgld__',
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
  const name = String(payload.tool_name || '');
  if (!name.startsWith('mcp__')) process.exit(0);

  const ns = ALLOWED_NAMESPACES.find((p) => name.startsWith(p));
  if (!ns) process.exit(0); // fall through for unrecognised mcp__*

  emit('allow', `mcp-classifier: ${name} in trusted namespace ${ns}`);
})();

#!/usr/bin/env node
// ~/.claude/hooks/skill-classifier.mjs
// PreToolUse hook for Skill. Broad allow + explicit deny list for
// skills the project / global rules say NOT to invoke proactively.
//
// Allow:
//   - any Skill invocation except the ones in DENY_SKILLS below
//
// Deny:
//   - superpowers:brainstorming (zync-autonomy rule)
//   - z-brainstorm / zyncai:z-brainstorm / zyncai:zync-brainstorm
//   - zyncai:plan-handoff / zyncai:z-plan-handoff / plan-handoff
//     (zync-autonomy rule: never invoke; only when user types by name)
//
// Match pattern: case-insensitive contains on skill name.

const DENY_SKILLS = [
  'brainstorm',
  'plan-handoff',
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
  if (payload.tool_name !== 'Skill') process.exit(0);

  const skill = String(payload.tool_input?.skill || '').toLowerCase();
  if (!skill) process.exit(0);

  const hit = DENY_SKILLS.find((p) => skill.includes(p));
  if (hit) {
    emit(
      'deny',
      `skill-classifier: ${skill} is on the proactive-deny list (autonomy rule). User must invoke by slash-command to bypass.`,
    );
    return;
  }

  emit('allow', `skill-classifier: ${skill} not on deny list`);
})();

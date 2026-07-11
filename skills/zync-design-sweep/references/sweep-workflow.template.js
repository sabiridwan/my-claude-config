// zync-design-sweep — parallel fan-out template.
// FILL IN: SPEC path, ROOT, GROUPS (dirs or explicit files), WIP.
// Then launch with the Workflow tool: Workflow({scriptPath: '<this file, copied to scratchpad & filled>'})
// Split whale modules (30+ files) into 2 groups. Assign shared components explicit file lists.
// ~13 groups is the sweet spot (concurrency caps at ~min(16, cores-2)).

export const meta = {
  name: 'design-uniform-sweep',
  description: 'Apply uniform radius + zero shadow + restrained polish across assigned module groups',
  phases: [{ title: 'Sweep', detail: 'one agent per module group, visual-only edits per DESIGN_SPEC' }],
};

const SPEC = '<ABSOLUTE PATH to filled design-spec in scratchpad>';
const ROOT = '<ABSOLUTE repo root>';

// Files with uncommitted in-flight work — NEVER edit these.
const WIP = [/* 'src/modules/gallery', 'src/modules/item', ... */];

// Each group → one agent. Use `dirs` (recurse) and/or `rootFiles` (this-folder-only) for modules,
// or `files` (explicit list) for shared components.
const GROUPS = [
  // { key: 'moduleA', dirs: ['src/modules/moduleA'] },
  // { key: 'big-module-part1', dirs: ['src/modules/big/components'] },
  // { key: 'big-module-part2', dirs: ['src/modules/big/screens', 'src/modules/big/new'], rootFiles: ['src/modules/big'] },
  // { key: 'shared-chrome', files: ['src/components/header/index.tsx', 'src/components/modal/confirm.tsx'] },
];

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['group', 'filesEdited', 'shadowsRemoved', 'radiiNormalized', 'notes'],
  properties: {
    group: { type: 'string' },
    filesEdited: { type: 'array', items: { type: 'string' } },
    filesScanned: { type: 'integer' },
    shadowsRemoved: { type: 'integer' },
    radiiNormalized: { type: 'integer' },
    colorsCalmed: { type: 'integer' },
    notes: { type: 'string' },
  },
};

const targetDesc = (g) => {
  if (g.files) return 'Edit ONLY these exact files (absolute under ' + ROOT + '/):\n' + g.files.map((f) => '  - ' + f).join('\n');
  const dirs = (g.dirs || []).map((d) => '  - ' + d + '  (recurse into subfolders)');
  const roots = (g.rootFiles || []).map((d) => '  - ' + d + '  (ONLY .tsx directly in this folder, do NOT recurse)');
  return 'Scan these directories and edit the presentational files in them:\n' + dirs.concat(roots).join('\n') +
    '\n\nUse Glob/Bash to enumerate the files first, then Read + edit each one that needs changes.';
};

const rules = (g) => `You are a senior UI engineer doing a VISUAL-ONLY design sweep. Sales/first modules may already be done; extend the SAME system.

FIRST: Read the design spec in full and follow it EXACTLY: ${SPEC}

Your group is "${g.key}".
${targetDesc(g)}

NEVER touch these WIP paths (user is mid-edit): ${WIP.join(', ') || '(none)'}. Skip any assigned file that overlaps them.
SKIP non-visual files: context.tsx, model.ts, service.ts, gql/*, query.ts, fragment.ts, barrel index.ts. Only edit files with className / StyleSheet visual props / inline visual styles.

For EACH presentational file: Read it, then per the spec:
1. Remove EVERY shadow (className shadow-* incl. colored; StyleSheet shadowColor/Offset/Opacity/Radius + elevation). Add a hairline border only where a card lost its ONLY separator and isn't on a colored/gradient/dark fill.
2. Normalize radius: rounded-3xl→rounded-2xl; rounded-lg/md/sm on cards→rounded-2xl; on inner icon chips→rounded-xl; inline borderRadius on surfaces→16 (12 inner); rounded-t-3xl→rounded-t-2xl. Keep rounded-full.
3. Calm where it clearly helps: font-extrabold values→font-bold; a row of many-pastel tiles→unify to one accent-tint tile + accent icon. Keep semantic status colors.
4. Replace raw hex icon colors (#94a3b8/#64748b) with the muted/gray token — and if you introduce a token reference, ENSURE that token is imported IN THAT FILE (this is the #1 regression — do not repeat it).

HARD CONSTRAINTS: VISUAL ONLY (no logic/data/hooks/props/nav/conditionals/maps). No rename/move/delete/export changes. Preserve every onPress/href/prop. If a file needs nothing, skip it.

AFTER editing, re-scan your files: zero shadow-* classes, zero shadow StyleSheet props, zero rounded-3xl/lg/md on cards, and every token you referenced is imported. Fix leftovers.

Return ONLY the structured object: filesScanned, filesEdited, shadowsRemoved, radiiNormalized, colorsCalmed, notes (incl. anything deliberately skipped).`;

phase('Sweep');
const results = await parallel(
  GROUPS.map((g) => () => agent(rules(g), { label: `sweep:${g.key}`, phase: 'Sweep', schema: SCHEMA, agentType: 'general-purpose' }))
);

const clean = results.filter(Boolean);
const totalShadows = clean.reduce((a, r) => a + (r.shadowsRemoved || 0), 0);
const totalRadii = clean.reduce((a, r) => a + (r.radiiNormalized || 0), 0);
const totalFiles = clean.reduce((a, r) => a + (r.filesEdited?.length || 0), 0);
log(`Sweep done: ${clean.length}/${GROUPS.length} groups, ${totalFiles} files, ${totalShadows} shadows removed, ${totalRadii} radii normalized`);
return { groups: clean, totalFiles, totalShadows, totalRadii };

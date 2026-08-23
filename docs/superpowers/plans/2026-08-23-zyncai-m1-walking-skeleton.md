# zyncai M1 — Walking Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up zyncai as a loadable Claude Code plugin whose spine works end to end — a ticket can be opened from a request, scoped by Ops, routed, stopped, and resumed exactly — with no findings, fixes, or PRs yet.

**Architecture:** A plugin whose skills are seats on a team, copied from SAMI. The orchestrator (`zyncai-pipeline`) owns only sequencing, loop limits, and resume; it talks to a five-operation ticket-store interface, never to a store. M1 ships the file adapter behind that interface, the orchestrator, the Ops seat, and the front door. Team seats are `user-invocable: false` so each body loads only when its stage runs.

**Tech Stack:** Claude Code plugin manifests (`.claude-plugin/`), skills as Markdown with YAML frontmatter, Node ≥18 built-ins only for tooling (`node:fs`, `node:path`, `node:url`), `node:test` + `node:assert/strict`. No dependencies.

**Spec:** `~/.claude/docs/superpowers/specs/2026-08-23-zyncai-plugin-architecture-design.md` — read it before Task 1. This plan implements its M1 row only. The spec wins any conflict with this plan.

## Global Constraints

- **The spec is the authority, not this plan.** zyncai's own build recorded this ruling after Task 1 shipped six defects by copying its brief's code verbatim: a plan is an argument for the spec, not an authority over it. If a step here contradicts the spec, follow the spec and record the divergence.
- **Node built-ins only.** No dependencies, no `package.json` beyond what tests need.
- **Never touch the live worktree.** `~/.claude/.claude/worktrees/zyncai` has a session actively committing to `worktree-zyncai`. Files are **copied out of it**, never moved, and nothing in this plan writes there.
- **All shas are full 40 characters.** A short prefix can name a different commit; a false match means drift is never detected.
- **Error channel by provenance.** A value an upstream module or an ordinary human file edit can legitimately produce is a *store condition* → coded `ERR_TICKET_*`, caller records and continues. A shape nothing upstream can produce is a caller bug → uncoded `TypeError`, allowed to abort.
- **CLI exit codes:** `0` success, `1` store condition (coded), `2` zyncai bug (uncoded). stderr carries the code itself, not only the message.
- **Every error code is exported.** A consumer forced to hardcode a string will eventually typo it, and a typo'd comparison fails open.
- **Two human moments only:** intake confirmation, and the merge. Nothing between them asks a question.
- **Staging is by explicit path.** Never `git add -A`, `git add .`, or `git commit -a`. Never bare `git stash`.
- **Status vocabulary is fixed:** `intake`, `auditing`, `fixing`, `verifying`, `pr_open`, `on_hold`, `information_missing`, `completed`. No seat invents a status.
- **A rule with no assertion is a rule nothing protects.** Every rule written into a `SKILL.md` in this plan gets at least one eval assertion in the same task.

---

## File Structure

| File | Responsibility |
|---|---|
| `~/Projects/zyncai/.claude-plugin/plugin.json` | Manifest + skills scan paths. What `--plugin-dir` reads. |
| `~/Projects/zyncai/.claude-plugin/marketplace.json` | The catalog teammates install from. |
| `~/Projects/zyncai/README.md` | How to load it, what the seats are, the two human gates. |
| `~/Projects/zyncai/tools/ticket-store/file.mjs` | The default adapter: the five operations, atomic writes, the error channel. |
| `~/Projects/zyncai/tools/ticket-store/file.test.mjs` | Colocated tests for the adapter. |
| `~/Projects/zyncai/tools/discover.mjs` | Copied from the worktree. Ops' eligibility tool. |
| `~/Projects/zyncai/skills/zyncai-pipeline/SKILL.md` | Sequencing, loop limits, resume. Nothing else. |
| `~/Projects/zyncai/skills/zyncai-pipeline/references/safety-rails.md` | Copied. Global, binds every seat. |
| `~/Projects/zyncai/skills/zyncai-pipeline/references/ticket-protocol.md` | The shared contract: statuses, handover entries, deliverables rows. |
| `~/Projects/zyncai/skills/zyncai-pipeline/references/pipeline-graph.md` | The node model. What each node reads and produces. |
| `~/Projects/zyncai/skills/zyncai-ops/SKILL.md` | Intake and routing. |
| `~/Projects/zyncai/skills/zyncai-ops/references/{interview.md,deliverables.md}` | The question graph and the handover gate. |
| `~/Projects/zyncai/skills/zyncai/SKILL.md` | Front door: greets, offers the menu, routes, resumes. |
| `~/Projects/zyncai/skills/*/evals/evals.json` | One case per process, per seat. |

One module of real code in M1 (`file.mjs`). Everything else is skill authorship, where the eval assertions and a manual walkthrough are the test — stated plainly here rather than dressed up as a red-green cycle it isn't.

---

### Task 1: Repo and plugin manifests

**Files:**
- Create: `~/Projects/zyncai/.claude-plugin/plugin.json`
- Create: `~/Projects/zyncai/.claude-plugin/marketplace.json`
- Create: `~/Projects/zyncai/README.md`
- Create: `~/Projects/zyncai/.gitignore`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a plugin that `claude plugin validate .` accepts and `--plugin-dir` loads. Every later task adds skills under the scan path `./skills/`.

- [ ] **Step 1: Create the repo**

```bash
mkdir -p ~/Projects/zyncai/.claude-plugin ~/Projects/zyncai/skills ~/Projects/zyncai/tools
cd ~/Projects/zyncai
git init
```

- [ ] **Step 2: Write `.claude-plugin/plugin.json`**

```json
{
  "name": "zyncai",
  "description": "zyncai — the ZyncGold repo maintenance team: audit, fix, verify, PR. Say \"hey zyncai\" to start, or use /zyncai:explain and /zyncai:scope.",
  "version": "0.1.0",
  "author": {
    "name": "Zync Tech"
  },
  "skills": ["./skills/"]
}
```

- [ ] **Step 3: Write `.claude-plugin/marketplace.json`**

```json
{
  "name": "zync-tech",
  "owner": {
    "name": "Zync Tech"
  },
  "metadata": {
    "description": "Zync Tech internal Claude Code plugins."
  },
  "plugins": [
    {
      "name": "zyncai",
      "source": "./",
      "skills": ["./skills/"],
      "description": "zyncai — the ZyncGold repo maintenance team: audit, fix, verify, PR, with the safety rails that keep it read-only until a human merges.",
      "version": "0.1.0",
      "author": { "name": "Zync Tech" }
    }
  ]
}
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
.DS_Store
graphify-out/
```

`graphify-out/` is a derived cache — gitignored, regenerable, never a source of truth, never committed. Nothing else is ignored: the whole point of this repo is that its reasoning artifacts stay tracked.

- [ ] **Step 5: Write `README.md`**

```markdown
# zyncai — ZyncGold repo maintenance, as a team

One skill per seat: Ops routes, Audit finds, Fix implements, Verify judges, PR
hands to a human. The orchestrator owns only sequencing, loop limits, and
resume.

## Run it

```bash
claude --plugin-dir ~/Projects/zyncai
```

Alias it:

```bash
echo "alias zyncai='claude --plugin-dir ~/Projects/zyncai'" >> ~/.zshrc
```

**Don't `claude plugin install` this locally.** Installing copies the plugin
root into `~/.claude/plugins/cache/` and hands back a stale snapshot that
ignores your edits. `--plugin-dir` loads in place.

Validate manifests after any change to `.claude-plugin/`:

```bash
claude plugin validate .
```

## The two human moments

1. **Intake** — one shot, all details at once, before a ticket is created.
2. **The merge** — zyncai opens draft PRs and never merges. This is a safety
   rail, not a preference.

Between them the pipeline runs without asking. A mid-run unknown is resolved by
a documented rule, a default, or a recorded ruling — never by a question.

## Seats

| Seat | Deliverable |
|---|---|
| `zyncai-ops` | the scoped ticket; the router |
| `zyncai-audit` | tiered findings (M2) |
| `zyncai-fix` | the fix on a branch (M2) |
| `zyncai-verify` | the verification table (M2) |
| `zyncai-pr` | the draft PR (M2) |
| `zyncai-study` | the repo's generated skill file (M3) |
| `zyncai-explain` / `zyncai-scope` | read-only answers (M3) |

Seats are `user-invocable: false` — invoked by `zyncai-pipeline` through the
Skill tool, so each body loads only when its stage runs.

## State

Ticket state sits behind a five-operation interface: `openTicket`, `readTicket`,
`setStatus`, `appendLog`, `recordDeliverables`. The file adapter
(`tools/ticket-store/file.mjs`) ships now and needs no external service. A
zyncws or WhatsApp adapter is a contained change later — the pipeline names
statuses, never stores.
```

- [ ] **Step 6: Validate and commit**

```bash
cd ~/Projects/zyncai
claude plugin validate .
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json README.md .gitignore
git commit -m "feat: scaffold zyncai as a Claude Code plugin

Skills are seats on a team. Manifests only here; the
seats arrive in later tasks under the ./skills/ scan path."
```

Expected: `claude plugin validate .` reports the manifests valid. If it fails, fix the manifest before continuing — every later task depends on the scan path resolving.

---

### Task 2: The file ticket-store adapter

**Files:**
- Create: `~/Projects/zyncai/tools/ticket-store/file.mjs`
- Test: `~/Projects/zyncai/tools/ticket-store/file.test.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `openTicket({ request, repos, storeRoot })` → `{ id, ... }`; `readTicket(id, storeRoot)` → ticket object; `setStatus(id, status, storeRoot)` → ticket; `appendLog(id, entry, storeRoot)` → ticket; `recordDeliverables(id, rows, storeRoot)` → ticket; `TICKET_STATUSES` (a `Set`); `ERR_TICKET_NOT_FOUND`, `ERR_TICKET_CORRUPT`, `TICKET_ERROR_CODES`, `isStoreConditionError(err)`. Tasks 4–6 consume these names exactly.

- [ ] **Step 1: Write the failing tests**

(`assert.throws()` returns `undefined`, never the caught error — inspect a thrown
error with the validator-function form, as below, not by assigning its result.)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  openTicket,
  readTicket,
  setStatus,
  appendLog,
  recordDeliverables,
  TICKET_STATUSES,
  ERR_TICKET_NOT_FOUND,
  ERR_TICKET_CORRUPT,
  TICKET_ERROR_CODES,
  isStoreConditionError,
} from './file.mjs';

function store() {
  return mkdtempSync(join(tmpdir(), 'zyncai-store-'));
}

test('openTicket mints a readable ticket at status intake', () => {
  const root = store();
  const t = openTicket({ request: 'audit zerp-be', repos: ['zerp-be'], storeRoot: root });
  assert.match(t.id, /^zai-\d{4}$/);
  assert.equal(t.status, 'intake');
  assert.equal(readTicket(t.id, root).request, 'audit zerp-be');
  rmSync(root, { recursive: true, force: true });
});

test('ticket ids are sequential, so a second ticket does not collide', () => {
  const root = store();
  const a = openTicket({ request: 'one', repos: [], storeRoot: root });
  const b = openTicket({ request: 'two', repos: [], storeRoot: root });
  assert.equal(a.id, 'zai-0001');
  assert.equal(b.id, 'zai-0002');
  rmSync(root, { recursive: true, force: true });
});

test('reading a ticket that does not exist is a store condition', () => {
  const root = store();
  assert.throws(() => readTicket('zai-9999', root), (err) => {
    assert.equal(err.code, ERR_TICKET_NOT_FOUND);
    assert.equal(isStoreConditionError(err), true);
    return true;
  });
  rmSync(root, { recursive: true, force: true });
});

test('a truncated ticket file is corrupt, never a silently empty ticket', () => {
  const root = store();
  const t = openTicket({ request: 'x', repos: [], storeRoot: root });
  writeFileSync(join(root, t.id, 'state.json'), '{"id": "zai-0001",');
  assert.throws(() => readTicket(t.id, root), (err) => {
    assert.equal(err.code, ERR_TICKET_CORRUPT);
    return true;
  });
  rmSync(root, { recursive: true, force: true });
});

test('an unknown status is refused — no seat invents a status', () => {
  const root = store();
  const t = openTicket({ request: 'x', repos: [], storeRoot: root });
  assert.throws(() => setStatus(t.id, 'nearly_done', root), TypeError);
  assert.equal(readTicket(t.id, root).status, 'intake');
  rmSync(root, { recursive: true, force: true });
});

test('every status in the vocabulary is accepted', () => {
  const root = store();
  const t = openTicket({ request: 'x', repos: [], storeRoot: root });
  for (const s of TICKET_STATUSES) {
    assert.equal(setStatus(t.id, s, root).status, s, `status ${s} must be settable`);
  }
  rmSync(root, { recursive: true, force: true });
});

test('appendLog is append-only — an earlier entry is never rewritten', () => {
  const root = store();
  const t = openTicket({ request: 'x', repos: [], storeRoot: root });
  appendLog(t.id, { seat: 'zyncai-ops', note: 'scoped to 1 repo' }, root);
  appendLog(t.id, { seat: 'zyncai-ops', note: 'routed to audit' }, root);
  const log = readTicket(t.id, root).log;
  assert.equal(log.length, 2);
  assert.equal(log[0].note, 'scoped to 1 repo');
  assert.equal(log[1].note, 'routed to audit');
  rmSync(root, { recursive: true, force: true });
});

test('a log entry without a seat is a caller bug — the log is how the next seat receives work', () => {
  const root = store();
  const t = openTicket({ request: 'x', repos: [], storeRoot: root });
  assert.throws(() => appendLog(t.id, { note: 'who wrote this?' }, root), TypeError);
  rmSync(root, { recursive: true, force: true });
});

test('recordDeliverables stores the gate rows against the seat that met them', () => {
  const root = store();
  const t = openTicket({ request: 'x', repos: [], storeRoot: root });
  recordDeliverables(t.id, { seat: 'zyncai-ops', rows: [{ row: 'repos eligible', met: true, evidence: '1 of 1 clean' }] }, root);
  const d = readTicket(t.id, root).deliverables['zyncai-ops'];
  assert.equal(d[0].met, true);
  assert.equal(d[0].evidence, '1 of 1 clean');
  rmSync(root, { recursive: true, force: true });
});

test('a deliverable row claiming met with no evidence is a caller bug', () => {
  const root = store();
  const t = openTicket({ request: 'x', repos: [], storeRoot: root });
  assert.throws(
    () => recordDeliverables(t.id, { seat: 'zyncai-ops', rows: [{ row: 'repos eligible', met: true }] }, root),
    TypeError,
  );
  rmSync(root, { recursive: true, force: true });
});

test('a reader never sees a torn file while a writer is mid-write', () => {
  const root = store();
  const t = openTicket({ request: 'x', repos: [], storeRoot: root });
  writeFileSync(join(root, t.id, 'state.json.tmp'), '{ truncated');
  assert.equal(readTicket(t.id, root).id, t.id);
  rmSync(root, { recursive: true, force: true });
});

test('the ledger is created as prose and is never parsed', () => {
  const root = store();
  const t = openTicket({ request: 'audit zerp-be', repos: ['zerp-be'], storeRoot: root });
  const ledger = readFileSync(join(root, t.id, 'ledger.md'), 'utf8');
  assert.match(ledger, /audit zerp-be/);
  // Corrupting the ledger must not affect the machine state — they are separate
  // records on purpose: prose says why, state.json says what to do next.
  writeFileSync(join(root, t.id, 'ledger.md'), 'not markdown at all');
  assert.equal(readTicket(t.id, root).status, 'intake');
  rmSync(root, { recursive: true, force: true });
});

test('isStoreConditionError is membership, not "has a code"', () => {
  const foreign = Object.assign(new Error('raw fs failure'), { code: 'EACCES' });
  assert.equal(isStoreConditionError(foreign), false);
  assert.equal(TICKET_ERROR_CODES.has(ERR_TICKET_CORRUPT), true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd ~/Projects/zyncai && node --test tools/ticket-store/file.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` — `file.mjs` does not exist yet.

- [ ] **Step 3: Write the implementation**

```js
#!/usr/bin/env node
// zyncai ticket store — the FILE adapter.
// One directory per ticket: state.json is what resume reads, ledger.md is the
// human record nothing parses. Ships first so the plugin needs no external
// service; a zyncws or WhatsApp adapter implements the same five operations
// later without the pipeline changing.
// Usage: node file.mjs <ticketId> [storeRoot]   (prints the ticket as JSON)
//
// SUPPORTED ENTRY POINTS: the five operations — openTicket, readTicket,
// setStatus, appendLog, recordDeliverables — and the CLI above them. Each takes
// a store root and does its own I/O.
//
// The error channel follows PROVENANCE, not whether a function does I/O:
//
// - The CONTENT of state.json is a store condition. It is hand-editable by
//   design — a human resolves a stop state, fixes a typo, or a write is
//   truncated — so a malformed document arrives coded and a caller auditing
//   several tickets records this one and continues.
// - A SHAPE nothing upstream produces is a caller bug and stays uncoded: an
//   invented status, a log entry with no seat, a deliverable claiming `met`
//   with no evidence. None of those can come from a file this module wrote.
//
// At the CLI boundary the channel is the EXIT CODE: 0 success, 1 store
// condition (record it, continue), 2 zyncai bug (stop). stderr carries the code
// itself, not just the message.

import { readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

/** No ticket directory at that id. */
export const ERR_TICKET_NOT_FOUND = 'ERR_TICKET_NOT_FOUND';

/** The ticket exists but its state.json is not a valid ticket document. */
export const ERR_TICKET_CORRUPT = 'ERR_TICKET_CORRUPT';

export const TICKET_ERROR_CODES = new Set([ERR_TICKET_NOT_FOUND, ERR_TICKET_CORRUPT]);

/**
 * Is this error a store condition (record it, continue) or a zyncai bug (stop)?
 *
 * Membership is the test, NOT "does it carry a code". An error carrying a
 * foreign code — a raw EACCES from an fs call added later without a wrapper —
 * is a bug in this module, and answering true would file that bug away as one
 * skippable ticket. Fail-safe direction: an unrecognised failure surfaces as
 * "stop and look".
 */
export function isStoreConditionError(err) {
  return TICKET_ERROR_CODES.has(err?.code);
}

/**
 * The status vocabulary, fixed. The pipeline names statuses, never stores, so
 * this Set is the contract every seat and every future adapter shares.
 */
export const TICKET_STATUSES = new Set([
  'intake',
  'auditing',
  'fixing',
  'verifying',
  'pr_open',
  'on_hold',
  'information_missing',
  'completed',
]);

export const DEFAULT_STORE_ROOT = join(homedir(), '.zyncai', 'tickets');

function coded(code, message, cause) {
  const err = new Error(message, cause ? { cause } : undefined);
  err.code = code;
  return err;
}

function corrupt(message, cause) {
  return coded(ERR_TICKET_CORRUPT, message, cause);
}

function ticketDir(id, storeRoot = DEFAULT_STORE_ROOT) {
  return join(storeRoot, id);
}

function statePath(id, storeRoot) {
  return join(ticketDir(id, storeRoot), 'state.json');
}

/** Validate a ticket document. Coded: this is file content. */
function validate(doc) {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    throw corrupt('state.json must contain a JSON object');
  }
  for (const field of ['id', 'request', 'status', 'createdAt', 'updatedAt']) {
    if (typeof doc[field] !== 'string' || doc[field] === '') {
      throw corrupt(`state.json is missing required string field "${field}"`);
    }
  }
  if (!TICKET_STATUSES.has(doc.status)) {
    throw corrupt(`state.json has unknown status "${doc.status}"`);
  }
  if (!Array.isArray(doc.repos)) throw corrupt('state.json needs repos to be an array');
  if (!Array.isArray(doc.log)) throw corrupt('state.json needs log to be an array');
  if (doc.deliverables === null || typeof doc.deliverables !== 'object' || Array.isArray(doc.deliverables)) {
    throw corrupt('state.json needs deliverables to be an object keyed by seat');
  }
  return doc;
}

/** Atomic write: temp-then-rename, so a concurrent reader sees one whole file. */
function writeState(id, doc, storeRoot) {
  const next = { ...doc, updatedAt: new Date().toISOString() };
  const text = JSON.stringify(next, null, 2);
  validate(JSON.parse(text)); // the bytes that land are the bytes a reader accepts
  const target = statePath(id, storeRoot);
  const tmp = `${target}.tmp`;
  try {
    writeFileSync(tmp, `${text}\n`);
    renameSync(tmp, target);
  } catch (cause) {
    throw corrupt(`could not write ${target}: ${cause.message}`, cause);
  }
  return next;
}

function nextId(storeRoot) {
  let highest = 0;
  if (existsSync(storeRoot)) {
    for (const name of readdirSync(storeRoot)) {
      const m = /^zai-(\d{4})$/.exec(name);
      if (m) highest = Math.max(highest, Number(m[1]));
    }
  }
  return `zai-${String(highest + 1).padStart(4, '0')}`;
}

/** Create a ticket at status `intake`, plus its prose ledger. */
export function openTicket({ request, repos = [], storeRoot = DEFAULT_STORE_ROOT } = {}) {
  if (typeof request !== 'string' || request === '') {
    throw new TypeError('openTicket needs a non-empty request string');
  }
  if (!Array.isArray(repos)) throw new TypeError('openTicket needs repos to be an array');
  const id = nextId(storeRoot);
  const dir = ticketDir(id, storeRoot);
  mkdirSync(join(dir, 'findings'), { recursive: true });
  mkdirSync(join(dir, 'reports'), { recursive: true });
  const now = new Date().toISOString();
  // The ledger is prose and stays prose. Nothing parses it — its value is a
  // reasoning agent explaining WHY, which does not survive compression into
  // JSON. Corrupting it cannot affect machine state.
  writeFileSync(
    join(dir, 'ledger.md'),
    `# ${id} — ledger\n\nOpened ${now}.\n\n**Request:** ${request}\n\n**Repos:** ${repos.join(', ') || '(none yet)'}\n\n## Log\n\n`,
  );
  return writeState(
    id,
    { id, request, repos, status: 'intake', log: [], deliverables: {}, createdAt: now, updatedAt: now },
    storeRoot,
  );
}

/** Read and validate a ticket. */
export function readTicket(id, storeRoot = DEFAULT_STORE_ROOT) {
  if (typeof id !== 'string' || id === '') throw new TypeError('readTicket needs a ticket id');
  const p = statePath(id, storeRoot);
  let text;
  try {
    text = readFileSync(p, 'utf8');
  } catch (cause) {
    if (cause.code === 'ENOENT') throw coded(ERR_TICKET_NOT_FOUND, `no ticket at ${p}`, cause);
    throw corrupt(`could not read ${p}: ${cause.message}`, cause);
  }
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (cause) {
    throw corrupt(`${p} is not valid JSON: ${cause.message}`, cause);
  }
  return validate(doc);
}

/** Move the ticket to a status in the vocabulary. An invented status is a bug. */
export function setStatus(id, status, storeRoot = DEFAULT_STORE_ROOT) {
  if (!TICKET_STATUSES.has(status)) {
    throw new TypeError(`unknown status "${status}"; the vocabulary is fixed: ${[...TICKET_STATUSES].join(', ')}`);
  }
  return writeState(id, { ...readTicket(id, storeRoot), status }, storeRoot);
}

/**
 * Append one handover entry. Append-only: the log is how the next seat
 * receives the work, so rewriting an earlier entry would rewrite history a
 * later seat already acted on.
 */
export function appendLog(id, entry, storeRoot = DEFAULT_STORE_ROOT) {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new TypeError('appendLog needs an entry object');
  }
  if (typeof entry.seat !== 'string' || entry.seat === '') {
    throw new TypeError('a log entry must name the seat that wrote it — the log is a handover record');
  }
  if (typeof entry.note !== 'string' || entry.note === '') {
    throw new TypeError('a log entry needs a note');
  }
  const t = readTicket(id, storeRoot);
  return writeState(id, { ...t, log: [...t.log, { ...entry, at: new Date().toISOString() }] }, storeRoot);
}

/**
 * Record a seat's gate rows.
 *
 * A row claiming `met: true` with no evidence is refused: "met" without
 * evidence is the shape of a check that did not run being reported as one that
 * passed, which is the failure this whole project exists to prevent.
 */
export function recordDeliverables(id, { seat, rows } = {}, storeRoot = DEFAULT_STORE_ROOT) {
  if (typeof seat !== 'string' || seat === '') throw new TypeError('recordDeliverables needs a seat');
  if (!Array.isArray(rows) || rows.length === 0) throw new TypeError('recordDeliverables needs a non-empty rows array');
  for (const r of rows) {
    if (r === null || typeof r !== 'object') throw new TypeError('every deliverable row must be an object');
    if (typeof r.row !== 'string' || r.row === '') throw new TypeError('every deliverable row needs a row name');
    if (typeof r.met !== 'boolean') throw new TypeError(`row "${r.row}" needs met to be a boolean`);
    if (r.met && (typeof r.evidence !== 'string' || r.evidence === '')) {
      throw new TypeError(`row "${r.row}" claims met with no evidence`);
    }
  }
  const t = readTicket(id, storeRoot);
  return writeState(id, { ...t, deliverables: { ...t.deliverables, [seat]: rows } }, storeRoot);
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  const [id, storeRoot] = process.argv.slice(2);
  try {
    if (!id) throw new TypeError('usage: node file.mjs <ticketId> [storeRoot]');
    console.log(JSON.stringify(readTicket(id, storeRoot || DEFAULT_STORE_ROOT), null, 2));
  } catch (err) {
    // The channel must be machine-readable where consumers actually stand.
    // A catch-all exit 1 would let a genuine bug be recorded as one failed
    // ticket and hidden behind plausible-looking entries.
    const isStoreCondition = isStoreConditionError(err);
    const tag = isStoreCondition ? err.code : (err.name ?? 'Error');
    console.error(`ticket-store: ${tag}: ${err.message}`);
    process.exit(isStoreCondition ? 1 : 2);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd ~/Projects/zyncai && node --test tools/ticket-store/file.test.mjs`
Expected: PASS, all 13 tests.

- [ ] **Step 5: Add the CLI tests and run them**

```js
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const SCRIPT = fileURLToPath(new URL('./file.mjs', import.meta.url));
const cli = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

test('the CLI prints a ticket and exits 0', () => {
  const root = store();
  const t = openTicket({ request: 'x', repos: [], storeRoot: root });
  const r = cli([t.id, root]);
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).id, t.id);
  rmSync(root, { recursive: true, force: true });
});

test('a missing ticket exits 1 and names the CODE on stderr', () => {
  const root = store();
  const r = cli(['zai-9999', root]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /ERR_TICKET_NOT_FOUND/);
  rmSync(root, { recursive: true, force: true });
});

test('no arguments exits 2 with usage, never silently 0', () => {
  const r = cli([]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage/);
});
```

Run: `cd ~/Projects/zyncai && node --test tools/ticket-store/file.test.mjs`
Expected: PASS, 16 tests.

- [ ] **Step 6: Mutation-check the four guards that fail silently if wrong**

The harness must verify each substitution actually applied before believing the result — a mutation that silently no-ops looks identical to one no test caught, and that false confidence is the exact defect zyncai's own build found in its verification harness. For each: apply by literal substring replacement, assert the file changed, run the suite, restore.

1. `isStoreConditionError` body → `return err?.code !== undefined` — the foreign-code test must fail.
2. `process.exit(isStoreCondition ? 1 : 2)` → `process.exit(1)` — the usage test must fail.
3. In `recordDeliverables`, delete the `r.met && ...` evidence check — the met-with-no-evidence test must fail.
4. In `appendLog`, replace `[...t.log, entry]` with `[entry]` — the append-only test must fail.

If any mutation leaves the suite green, the test is not pinning what it claims. Fix the test, not the mutation.

- [ ] **Step 7: Commit**

```bash
cd ~/Projects/zyncai
git add tools/ticket-store/file.mjs tools/ticket-store/file.test.mjs
git commit -m "feat(ticket-store): add the file adapter behind the five operations

state.json is what resume reads; ledger.md is the human record nothing
parses. File CONTENT is a store condition on the coded channel because it
is hand-editable by design; an invented status, a seatless log entry, and
a deliverable claiming met with no evidence are shapes nothing upstream
produces, so they stay uncoded.

A row claiming met with no evidence is refused outright: that is the shape
of a check that did not run being reported as one that passed."
```

---

### Task 3: The pipeline's references

**Files:**
- Create: `~/Projects/zyncai/skills/zyncai-pipeline/references/safety-rails.md` (copied)
- Create: `~/Projects/zyncai/skills/zyncai-pipeline/references/ticket-protocol.md`
- Create: `~/Projects/zyncai/skills/zyncai-pipeline/references/pipeline-graph.md`

**Interfaces:**
- Consumes: `TICKET_STATUSES` and the five operations from Task 2 (named in the protocol).
- Produces: the three reference documents Task 4's `SKILL.md` points at, and the node table Task 5's Ops seat is gated by.

- [ ] **Step 1: Copy the safety rails out of the live worktree**

```bash
cd ~/Projects/zyncai
mkdir -p skills/zyncai-pipeline/references
cp ~/.claude/.claude/worktrees/zyncai/skills/zyncai/references/safety-rails.md \
   skills/zyncai-pipeline/references/safety-rails.md
wc -l skills/zyncai-pipeline/references/safety-rails.md   # expect ~243
```

Copy, never move. A session is committing in that worktree right now.

- [ ] **Step 2: Append the seat-scope section to the copied rails**

Append to `skills/zyncai-pipeline/references/safety-rails.md`:

```markdown
## Scope of these rails

These rails bind **every seat**, not just the ones that write code. A rail is
never satisfied by working around it: rewriting a command, stripping a flag,
widening a path, or relaxing a comparison to get past a rail is the rail doing
its job, and the response is to report the block.

A seat that hits a rail sets `information_missing`, states exactly what a human
must decide, and stops. It never proposes the workaround itself.
```

- [ ] **Step 3: Write `ticket-protocol.md`**

```markdown
# Ticket protocol — the contract every seat follows

The ticket is the pipeline's memory. A seat that does not write to it has not
finished, whatever its chat output says.

## The store is behind an interface

Seats never name a store. They call five operations, provided by whichever
adapter is configured (`tools/ticket-store/file.mjs` today; a zyncws or
WhatsApp adapter later):

| Operation | When |
|---|---|
| `openTicket({ request, repos })` | Ops, once, after the human's one-shot yes |
| `readTicket(id)` | every resume, and every seat on entry |
| `setStatus(id, status)` | every stage transition |
| `appendLog(id, { seat, note })` | every handover |
| `recordDeliverables(id, { seat, rows })` | at every gate, before handing over |

Never build a seat that assumes the current adapter is permanent.

## Status vocabulary — fixed

| Status | Means | Who sets it |
|---|---|---|
| `intake` | being scoped | Ops (at open) |
| `auditing` | findings being produced | Ops → Audit |
| `fixing` | a finding is being fixed | Audit → Fix |
| `verifying` | a fix is being judged | Fix → Verify |
| `pr_open` | a draft PR awaits a human | PR |
| `on_hold` | a loop limit was hit; a human must choose | pipeline |
| `information_missing` | blocked on something no seat can source | any seat |
| `completed` | the human merged, or closed it | PR |

No seat invents a status. The store refuses one that is not in this list.

## Handover entries

One entry per handover, naming the seat that wrote it and what the next seat is
receiving. The entry is how the next seat gets its input — not chat scrollback,
which does not survive a resume.

## Deliverables rows

Each seat's `references/deliverables.md` is a table of rows. At its gate the
seat records every row with `met` and, when met, the `evidence` that shows it.
A row claiming `met` with no evidence is refused by the store, because that is
the shape of a check that did not run being reported as one that passed.

## Honesty rules, binding on every seat

- A check that did not run is never reported as a check that passed.
  `unavailable` is a valid and required outcome.
- Exclusions are not failures. A repo skipped because it is `node_modules` and
  a repo that could not be read are different things and are reported
  separately.
- A finding may be **raised** from any evidence, but **filed** only once
  confirmed against the code with a `file:line`. An INFERRED or AMBIGUOUS graph
  edge is a lead, never a citation.
```

- [ ] **Step 4: Write `pipeline-graph.md`**

```markdown
# Pipeline graph — the node model

The pipeline as nodes. Each declares what it **reads** and what it
**produces**. Its job is exactness of resume:

**A node whose outputs already exist is skipped, never re-run.**

Before the final handover the graph is walked top to bottom. Any node with
missing outputs sends the ticket back to that node's owner — never forward with
a gap. A missing output means the stage is not finished, whatever the status
says.

| # | Node | Owner | Reads | Produces |
|---|---|---|---|---|
| 1 | request captured | ops | the human's request | `request` on the ticket |
| 2 | repos resolved | ops | `request`, `discover.mjs` manifest | `repos[]`, each with `dirty` and `headSha` |
| 3 | eligibility gate applied | ops | node 2 | eligible repos; skipped repos **with reasons**, split into exclusions and failures |
| 4 | scope agreed | ops | nodes 1–3 | the one-shot confirmation, and the human's yes |
| 5 | ticket opened | ops | node 4 | ticket id at `intake` |
| 6 | acceptance criteria set | ops | nodes 1–5 | criteria rows on the ticket |
| 7 | routed | ops | node 6 | `auditing`, plus the handover entry naming what Audit receives |

Nodes 8+ arrive with M2 (audit, fix, verify) and M3 (study). M1 is complete when
nodes 1–7 can each be produced, skipped on resume, and shown missing when they
are.

## Resume

Read the ticket. Its `status` says which stage owns it; its last log entry says
what that stage was handed. Enter there — do not re-run a node whose outputs are
already on the ticket.

| Status | Enter at |
|---|---|
| `intake` | Ops, continuing from the first node with missing outputs |
| `auditing` | Audit (M2) |
| `fixing` | Fix (M2) |
| `verifying` | Verify (M2) |
| `pr_open` | report it is waiting on a human merge; nothing to run |
| `on_hold` | present the recurring defects and the three choices; do not silently resume |
| `information_missing` | present what is needed; do not guess it |
| `completed` | report it is done |
```

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/zyncai
git add skills/zyncai-pipeline/references/
git commit -m "docs(pipeline): add the rails, the ticket protocol, and the node graph

safety-rails.md is copied from the worktree and scoped to bind every seat,
not only the ones that write code. The graph's job is exact resume: a node
whose outputs exist is skipped, never re-run, and a node with missing
outputs sends the ticket back rather than forward."
```

---

### Task 4: The orchestrator seat

**Files:**
- Create: `~/Projects/zyncai/skills/zyncai-pipeline/SKILL.md`
- Create: `~/Projects/zyncai/skills/zyncai-pipeline/evals/evals.json`

**Interfaces:**
- Consumes: the three references from Task 3; the five store operations from Task 2.
- Produces: the single entry point for a run. Task 6's front door invokes `zyncai:zyncai-pipeline` and nothing else.

- [ ] **Step 1: Write `SKILL.md`**

```markdown
---
name: zyncai-pipeline
description: >
  End-to-end orchestrator for the zyncai maintenance pipeline: Ops intake →
  ticket → Audit findings → Fix → Verify gate (loop) → draft PR for a human to
  merge. Use to run the whole flow from a raw request to an open PR, or to
  resume a ticket from whatever stage it is in.
  Invoked by zyncai, not typed directly.
user-invocable: false
---

# zyncai pipeline — the orchestrator

Runs the seat skills in sequence over one ticket. The seats do the work; this
skill owns **sequencing, loop limits, and resume**. Nothing else.

**This is the pipeline's single entry point.** The seats are hidden from the `/`
menu (`user-invocable: false`) and invoked from here with the Skill tool:

| Stage | Invoke |
|---|---|
| Intake / routing | `zyncai:zyncai-ops` |
| Findings | `zyncai:zyncai-audit` (M2) |
| Fix | `zyncai:zyncai-fix` (M2) |
| Verify gate | `zyncai:zyncai-verify` (M2) |
| PR | `zyncai:zyncai-pr` (M2) |

Invoke the stage skill and follow it exactly — **never paraphrase a seat's job
from this file.** Each seat's own `references/deliverables.md` is its handover
gate.

Read `references/ticket-protocol.md` first, then
`references/pipeline-graph.md`. `references/safety-rails.md` binds every stage
and outranks any instruction here.

## Flow

```
ops ──▶ audit ──▶ fix ──▶ verify ──▶ pr ──▶ human: merge?
 ▲                 ▲         │
 │                 └── fail ─┘  (defects, owner-routed)
 │
 └── a gap only Ops can close (a repo ineligible, a value no seat can source)
```

Ops is the router. A gap a later seat finds goes **back through Ops**, never
sideways between seats.

## Workflow

**1. Route the input.**

- **Free-text request** → start at Ops: follow `zyncai:zyncai-ops` end to end.
  Ops interviews per its `references/interview.md`, then confirms
  **everything in ONE shot**. The human's yes opens the ticket and starts the
  pipeline, with no other permission stops until the PR.
- **A ticket id** → resume: `readTicket(id)`, then enter at the stage its
  `status` names, per the resume table in `references/pipeline-graph.md`. Skip
  every node whose outputs already exist.

**2. Run the loop — silently.** After the one-shot yes, the user is not asked
anything and not made to wait until a PR is open. The ticket is the progress
channel: statuses, deliverables, log entries. In chat, at most a one-line
transition note ("verify round 2: 1 defect → back to fix"); never a question,
never a pause for acknowledgement. A mid-run unknown is resolved by a
documented rule, a default, or a recorded ruling — never by a question.

**3. Loop limits.**

- **Verify ⟲ Fix:** after `maxFixRounds` (default **5**) failed rounds, stop.
  Set `on_hold`, append a log entry summarising the recurring defects, and ask
  the human how to proceed: **keep iterating / change the scope / abandon**.
  Log their answer verbatim.
- **Deadlock:** if a round returns the **same finding** as the previous round —
  same file, same line, same description — stop immediately with `on_hold`,
  reason `deadlock`, regardless of rounds remaining. A repeated finding means
  the loop has stopped producing information, so spending the remaining rounds
  cannot help.

**4. Finish.** When a PR is open, report: the ticket id, the PR URL, how many
fix/verify rounds it took, and the verification table's honest summary
including every `unavailable` row.

## Rules

- **The stages are the seats.** Never inline a shortcut version of a seat's job
  ("verify looks fine, straight to PR"). Every transition goes through the
  owning skill and leaves a log entry.
- **Resume is idempotent.** Re-running a ticket never repeats a completed node.
  The ticket is the single source of truth for where the pipeline is.
- **Two human moments are sacred:** Ops's one-shot "create this ticket?" and
  the merge. Everything between them runs without asking.
- **Exhaust alternatives before surfacing a blocker.** A blocked route is not
  an answer. Try every legitimate path first, and when genuinely stuck say
  exactly what the human must do. Never end a turn asking whether to continue;
  never self-grant a permission.
- **Never merge.** zyncai opens draft PRs. Humans merge them. This is a rail.
- **A seat's gate is not this file's business.** If a seat says it cannot hand
  over, the answer is to fix the gap, never to route around the gate.
```

- [ ] **Step 2: Write `evals/evals.json`**

```json
{
  "skill_name": "zyncai-pipeline",
  "evals": [
    {
      "id": 0,
      "eval_name": "silent-between-the-two-gates",
      "process": "Workflow §2 (run the loop silently)",
      "kind": "happy_path",
      "prompt": "A ticket has just been opened after the human's one-shot yes. Ops has routed it to auditing. Audit returns two tier-1 findings.",
      "expected_output": "The pipeline invokes each seat in turn through the Skill tool, writing status and log entries to the ticket, emitting at most one-line transition notes in chat, and asks the human nothing until a draft PR is open.",
      "files": [],
      "assertions": [
        "No question is put to the human between the intake yes and the open PR",
        "Every stage transition is written to the ticket with setStatus and appendLog",
        "Each seat is invoked through the Skill tool rather than its job being paraphrased inline",
        "Chat output contains no request for acknowledgement"
      ]
    },
    {
      "id": 1,
      "eval_name": "deadlock-stops-before-the-cap",
      "process": "Workflow §3 (loop limits — deadlock)",
      "kind": "gate",
      "prompt": "Verify round 2 returns a finding identical to round 1: same file, same line, same description. maxFixRounds is 5, so three rounds remain.",
      "expected_output": "The pipeline stops at once, sets on_hold with reason deadlock, logs the repeated finding, and asks the human to choose between keep iterating, change the scope, and abandon. It does not spend the remaining rounds.",
      "files": [],
      "assertions": [
        "Status is set to on_hold on round 2, not round 5",
        "The log entry names the repeated finding and identifies it as a deadlock",
        "The human is offered exactly the three documented choices",
        "No further fix round is dispatched before the human answers"
      ]
    },
    {
      "id": 2,
      "eval_name": "resume-skips-completed-nodes",
      "process": "Workflow §1 (resume) + pipeline-graph.md",
      "kind": "regression",
      "prompt": "A ticket at status auditing already has repos[], the eligibility gate outcome, and acceptance criteria recorded on it. The pipeline is asked to resume it.",
      "expected_output": "The pipeline reads the ticket, enters at Audit, and does not re-run repo discovery, the eligibility gate, or the interview — every node whose outputs are already on the ticket is skipped.",
      "files": [],
      "assertions": [
        "discover.mjs is not re-run",
        "The human is not re-interviewed",
        "Execution begins at the stage the status names",
        "No node whose outputs exist is repeated"
      ]
    },
    {
      "id": 3,
      "eval_name": "never-routes-around-a-seats-gate",
      "process": "Rules (a seat's gate is not this file's business)",
      "kind": "gate",
      "prompt": "Verify reports it cannot judge a fix because the repo's only lint script is `eslint … --fix`, which the rails forbid executing. The pipeline is under time pressure from the user.",
      "expected_output": "The pipeline routes the gap back through Ops rather than accepting the fix unverified or rewriting the lint command. The unavailable step is reported as unavailable, never as passed.",
      "files": [],
      "assertions": [
        "The mutating lint step is never executed",
        "The command is not rewritten to strip --fix",
        "The gap is routed back through Ops, not sideways to another seat",
        "The step is reported as unavailable (mutating), never as passed or omitted"
      ]
    }
  ]
}
```

- [ ] **Step 3: Verify the skill loads**

```bash
cd ~/Projects/zyncai
claude plugin validate .
python3 -c "import json; d=json.load(open('skills/zyncai-pipeline/evals/evals.json')); print(d['skill_name'], len(d['evals']), 'cases')"
```

Expected: manifests valid; `zyncai-pipeline 4 cases`. Every rule in the SKILL.md's Rules section and every loop limit has at least one assertion above — a rule with no assertion is a rule nothing protects.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/zyncai
git add skills/zyncai-pipeline/SKILL.md skills/zyncai-pipeline/evals/evals.json
git commit -m "feat(pipeline): add the orchestrator seat

Owns sequencing, loop limits and resume, and nothing else — it invokes each
seat through the Skill tool rather than paraphrasing its job. Deadlock stops
the loop on the round the finding repeats, not at the cap, because a repeated
finding means the loop stopped producing information."
```

---

### Task 5: The Ops seat

**Files:**
- Create: `~/Projects/zyncai/skills/zyncai-ops/SKILL.md`
- Create: `~/Projects/zyncai/skills/zyncai-ops/references/interview.md`
- Create: `~/Projects/zyncai/skills/zyncai-ops/references/deliverables.md`
- Create: `~/Projects/zyncai/skills/zyncai-ops/evals/evals.json`
- Create: `~/Projects/zyncai/tools/discover.mjs` (copied)

**Interfaces:**
- Consumes: `openTicket`, `setStatus`, `appendLog`, `recordDeliverables` from Task 2; `pipeline-graph.md` nodes 1–7 and `ticket-protocol.md` from Task 3.
- Produces: a ticket at status `auditing` with `repos[]`, the eligibility outcome, acceptance criteria, and a handover entry naming what Audit receives.

- [ ] **Step 1: Copy `discover.mjs` and confirm it runs**

```bash
cd ~/Projects/zyncai
cp ~/.claude/.claude/worktrees/zyncai/skills/zyncai/scripts/discover.mjs tools/discover.mjs
cp ~/.claude/.claude/worktrees/zyncai/skills/zyncai/scripts/discover.test.mjs tools/discover.test.mjs
node --test tools/discover.test.mjs
node tools/discover.mjs ~/Projects/zyncgold | head -30
```

Expected: the test suite passes as-copied, and the manifest lists repos with `dirty` and `headSha`. If the suite fails, STOP — the copy is wrong, and Ops' eligibility gate depends on it.

- [ ] **Step 2: Write `references/deliverables.md`**

```markdown
# Ops deliverables — the handover gate

**Ops does not hand over until every row here is met.** Ops is the ticket's
router: everything enters through it, and every gap a later seat finds comes
back through it.

| # | Deliverable | Met when |
|---|---|---|
| 1 | **The request, captured verbatim** | the ticket's `request` is what the human actually asked for, not a paraphrase that has already narrowed the scope |
| 2 | **Repos resolved** | `discover.mjs` has run over the named workspace and every candidate repo carries `dirty` and `headSha` |
| 3 | **Eligibility gate applied** | every repo is either eligible (`dirty === false && headSha !== null`, both halves, tested as identities) or skipped with a reason |
| 4 | **Skips split by kind** | exclusions (`node_modules`, `max depth`, `git worktree`, `duplicate git dir`) are reported separately from failures (`unreadable .git`, `no commits`). `node_modules` is not a repo anyone chose to skip |
| 5 | **Scope confirmed in ONE shot** | the human saw every detail at once — repos in, repos out with reasons, tiers in scope — and said yes. One question, not a series |
| 6 | **Acceptance criteria on the ticket** | what "done" means for this ticket, written as rows a later seat can mark PASS / FAIL / PENDING |
| 7 | **Routed with a handover entry** | status is `auditing` and the log entry names exactly what Audit is receiving |

Ops never audits, never fixes, and never opens a PR. If a request needs work no
seat can do, Ops sets `information_missing` and says exactly what a human must
decide.
```

- [ ] **Step 3: Write `references/interview.md`**

```markdown
# Ops interview — the question graph

Parse the request **first**. Ask only the gaps. Two to four questions maximum,
one per turn, then confirm everything in one shot.

## Resolve without asking

| Unknown | Resolve by |
|---|---|
| which repos | run `tools/discover.mjs` over the workspace; if the request names one repo, that is the answer |
| whether a repo is eligible | the manifest's `dirty` and `headSha` — never ask a human to check git state |
| which tiers apply | default to all four unless the request narrows them |
| the workspace root | `~/Projects/zyncgold` unless the request names another |

Announce a lookup and return fast rather than asking a question you can answer:
"checking which repos are clean — one moment."

## Ask only these, one per turn

1. **Scope**, when the request names no repo and the workspace has more than one
   eligible: which repos are in scope?
2. **Tier ceiling**, when the request implies caution: should this stop at
   reporting, or open fixes?
3. **Acceptance**, when "done" is genuinely ambiguous: what would make this
   ticket finished?

## The one-shot confirmation

One message, everything in it. Repos in. Repos out **with reasons**, exclusions
separated from failures. Tiers in scope. Acceptance criteria. Then a single
question: create this ticket?

The human's yes opens the ticket and starts the pipeline. There is no second
permission stop until a PR is open.

## Never

- Never ask a question whose answer is in the manifest.
- Never split the confirmation into several questions — one shot is the contract.
- Never narrow the scope silently because a repo looked awkward. Report it as a
  skip with its reason and let the human see it.
```

- [ ] **Step 4: Write `SKILL.md`**

```markdown
---
name: zyncai-ops
description: >
  The Operations seat of the zyncai maintenance pipeline — the intake brain and
  the ticket's router. Use when someone raises a maintenance request in natural
  language: interview them about the scope, resolve which repos are eligible
  with discover.mjs, confirm everything in one shot, open the ticket, set the
  acceptance criteria, and route it to Audit. Also handles any gap a later seat
  sends back.
  Invoked by zyncai-pipeline, not typed directly.
user-invocable: false
---

# zyncai Ops — intake and routing

Read `../zyncai-pipeline/references/ticket-protocol.md` and
`../zyncai-pipeline/references/safety-rails.md` first. The rails outrank
anything here.

`references/deliverables.md` is this seat's gate: every row met, or Ops has not
finished. `references/interview.md` is the question graph.

## What Ops produces

Nodes 1–7 of `../zyncai-pipeline/references/pipeline-graph.md`: the captured
request, resolved repos, the eligibility gate outcome, the one-shot
confirmation, the ticket, its acceptance criteria, and the routing handover.

## The eligibility gate

A repo is eligible for branch and PR work **only** when
`dirty === false && headSha !== null`. Both halves, both tested as identities.

- `dirty === true` → skip, report why.
- `dirty === null` → skip, report as a **failure**. git could not be read, and
  branching in a repo git cannot read is strictly less safe than branching in a
  merely dirty one.
- `headSha === null` → skip with reason `no commits`, report as a **failure**.
  Ordinary git: a freshly `git init`ed repo gives `dirty: false` — the one value
  that permits work — while `git rev-parse HEAD` exits 128.

Never write `if (!repo.dirty)`. That also admits `null`.

None of these stops the run. Aborting an N-repo pass because one repo has not
been committed to yet loses the findings for every other repo.

## Skips are not one thing

Filter by reason before reporting. `excluded dir (…)`, `max depth`,
`git worktree` and `duplicate git dir` are **exclusions** — never looked inside.
`unreadable .git` and `no commits` are **failures** — repos that could not be
audited at all. Report them separately. `node_modules` is not a repo anyone
chose to skip, and presenting it as "repos I skipped" buries the entries that
matter.

## Routing

Ops is the router. When a later seat finds a gap it cannot close — Verify cannot
judge because a repo's only lint script mutates, Audit cannot cite because a
graph edge was inferred — the ticket comes back here. Ops closes the gap or sets
`information_missing`, then returns the ticket to the seat that was waiting.
Seats never hand work sideways to each other.

## Never

- Never audit, fix, or open a PR. Those are other seats.
- Never ask a question the manifest answers.
- Never narrow scope silently. A skipped repo is reported with its reason.
- Never route around another seat's gate.
```

- [ ] **Step 5: Write `evals/evals.json`**

```json
{
  "skill_name": "zyncai-ops",
  "evals": [
    {
      "id": 0,
      "eval_name": "one-shot-confirmation-not-a-series",
      "process": "interview.md (the one-shot confirmation) + deliverables row 5",
      "kind": "happy_path",
      "prompt": "The user says: audit the zyncgold workspace for anything broken. The workspace has five repos; one is dirty, one has no commits, three are clean.",
      "expected_output": "Ops runs discover.mjs, applies the eligibility gate, and sends ONE confirmation message containing the three eligible repos, the two skipped with their reasons split into exclusions and failures, the tiers in scope, and the acceptance criteria — ending in a single question. No ticket exists until the human says yes.",
      "files": [],
      "assertions": [
        "discover.mjs is run rather than the human being asked which repos are clean",
        "Exactly one confirmation message is sent, containing every detail",
        "The dirty repo and the no-commits repo are both listed with their reasons",
        "The no-commits repo is reported as a failure, not as an exclusion",
        "openTicket is not called before the human's yes"
      ]
    },
    {
      "id": 1,
      "eval_name": "dirty-null-is-not-clean",
      "process": "SKILL.md (the eligibility gate)",
      "kind": "regression",
      "prompt": "The manifest reports a repo with dirty: null because git could not be read, and another with dirty: false, headSha: null because it has no commits yet.",
      "expected_output": "Both repos are skipped and both are reported as failures. Neither is treated as eligible, and the run continues for the remaining repos.",
      "files": [],
      "assertions": [
        "The dirty: null repo is skipped, not branched in",
        "The headSha: null repo is skipped with reason 'no commits'",
        "Both are classified as failures rather than exclusions",
        "The pass continues for the other repos rather than aborting"
      ]
    },
    {
      "id": 2,
      "eval_name": "node-modules-is-not-a-skipped-repo",
      "process": "SKILL.md (skips are not one thing) + deliverables row 4",
      "kind": "regression",
      "prompt": "discover.mjs returns 5 repos and 22 skipped entries, of which 16 are 'max depth' documentation folders and several are excluded dirs like node_modules. One entry is an unreadable .git.",
      "expected_output": "The report separates exclusions from failures and surfaces the single unreadable .git as a failure. The 16 max-depth folders and the excluded dirs are not presented as 'repos I skipped'.",
      "files": [],
      "assertions": [
        "Exclusions and failures appear as separate groups",
        "The unreadable .git entry is surfaced as a failure",
        "node_modules and max-depth entries are not listed as skipped repos",
        "The count of eligible repos is stated separately from the skip counts"
      ]
    },
    {
      "id": 3,
      "eval_name": "a-gap-comes-back-through-ops",
      "process": "SKILL.md (routing)",
      "kind": "gate",
      "prompt": "Verify sends the ticket back: it cannot judge the fix because the repo's only lint script is `eslint … --fix`, which the rails forbid executing.",
      "expected_output": "Ops closes the gap or sets information_missing stating exactly what a human must decide, then returns the ticket to Verify. It does not rewrite the lint script and does not tell Verify to run it anyway.",
      "files": [],
      "assertions": [
        "The lint command is not rewritten to remove --fix",
        "Ops either closes the gap or sets information_missing with a specific ask",
        "The ticket returns to the seat that was waiting, not to a different seat",
        "Nothing is reported as passed on the strength of a step that never ran"
      ]
    }
  ]
}
```

- [ ] **Step 6: Verify and commit**

```bash
cd ~/Projects/zyncai
claude plugin validate .
node --test tools/discover.test.mjs
python3 -c "import json; d=json.load(open('skills/zyncai-ops/evals/evals.json')); print(d['skill_name'], len(d['evals']), 'cases')"
git add skills/zyncai-ops/ tools/discover.mjs tools/discover.test.mjs
git commit -m "feat(ops): add the intake and routing seat

Ops owns the eligibility gate (dirty === false && headSha !== null, both
halves as identities), splits skips into exclusions and failures so
node_modules never reads as a repo someone chose to skip, and is the single
route a later seat's gap comes back through.

discover.mjs and its suite are copied from the worktree unchanged."
```

---

### Task 6: The front door, and the walking skeleton end to end

**Files:**
- Create: `~/Projects/zyncai/skills/zyncai/SKILL.md`
- Create: `~/Projects/zyncai/skills/zyncai/evals/evals.json`

**Interfaces:**
- Consumes: `zyncai:zyncai-pipeline` from Task 4; `readTicket` from Task 2.
- Produces: the user-facing entry point. This is the last M1 task; after it the spine runs end to end.

- [ ] **Step 1: Write `SKILL.md`**

```markdown
---
name: zyncai
description: >
  zyncai — the front door to ZyncGold repo maintenance. Use whenever the user
  says "hey zyncai", "zyncai", or addresses zyncai by name; also when someone
  opens with a maintenance request (audit a repo, fix what's broken, check a
  workspace) without naming a command. Greets, offers the menu, and routes to
  the pipeline. Also resumes a ticket when given its id.
---

# zyncai — the front door

Greet, find out what is needed, route. This skill does no maintenance work
itself.

## The menu

| The user wants | Route to |
|---|---|
| audit / fix / maintain a repo or workspace | `zyncai:zyncai-pipeline` |
| to resume a ticket (`zai-0007`) | `zyncai:zyncai-pipeline` with the id |
| to know what a rule is or why something is built a way | `zyncai:zyncai-explain` (M3) |
| the blast radius of a change | `zyncai:zyncai-scope` (M3) |

Everything that touches a repo goes through the pipeline. Never audit, fix, or
open a PR from here — the seats exist so each stage's rules actually load.

## Routing rules

- A **free-text maintenance request** → invoke `zyncai:zyncai-pipeline` and let
  Ops run its interview. Do not pre-interview the user here; Ops owns the
  question graph, and asking first means asking twice.
- A **ticket id** → invoke `zyncai:zyncai-pipeline` with it. Do not read the
  ticket and summarise it instead of resuming, unless the user only asked for
  status.
- **Ambiguous** → one question, then route.

## What to say

Short. What zyncai is about to do, then do it. The ticket is the progress
channel, so do not narrate each stage in chat — at most a one-line transition
note.

## Never

- Never do a seat's job from here.
- Never promise a merge. zyncai opens draft PRs; humans merge them.
```

- [ ] **Step 2: Write `evals/evals.json`**

```json
{
  "skill_name": "zyncai",
  "evals": [
    {
      "id": 0,
      "eval_name": "routes-without-pre-interviewing",
      "process": "Routing rules (free-text request)",
      "kind": "happy_path",
      "prompt": "The user says: hey zyncai, something's broken in zerp-be, can you look?",
      "expected_output": "The front door invokes zyncai:zyncai-pipeline immediately and lets Ops run its interview. It does not ask its own scoping questions first.",
      "files": [],
      "assertions": [
        "zyncai-pipeline is invoked through the Skill tool",
        "No scoping question is asked by the front door itself",
        "No repo is read, audited, or modified by the front door"
      ]
    },
    {
      "id": 1,
      "eval_name": "never-does-a-seats-job",
      "process": "Never (never do a seat's job from here)",
      "kind": "gate",
      "prompt": "The user says: just quickly fix the broken import in account.service.ts, don't bother with the whole pipeline.",
      "expected_output": "The front door still routes to the pipeline. The fix goes through the seats so the rails, the tiering, and the verification table all apply — a one-line fix with no verification table is exactly what the pipeline exists to prevent.",
      "files": [],
      "assertions": [
        "No file is edited by the front door",
        "The request is routed to zyncai-pipeline rather than handled inline",
        "No PR is opened outside the PR seat"
      ]
    }
  ]
}
```

- [ ] **Step 3: Walk the skeleton end to end, by hand**

This is M1's real test — the eval assertions describe behaviour, and this proves the spine.

```bash
cd ~/Projects/zyncai
export ZYNCAI_STORE=$(mktemp -d)

# 1. a ticket can be opened, and reads back
node -e "
import('./tools/ticket-store/file.mjs').then(async (s) => {
  const t = s.openTicket({ request: 'audit zerp-be', repos: ['zerp-be'], storeRoot: process.env.ZYNCAI_STORE });
  console.log('opened', t.id, t.status);
  s.recordDeliverables(t.id, { seat: 'zyncai-ops', rows: [
    { row: 'repos resolved', met: true, evidence: '1 candidate, 1 eligible' },
    { row: 'eligibility gate applied', met: true, evidence: 'dirty=false headSha set' },
  ]}, process.env.ZYNCAI_STORE);
  s.appendLog(t.id, { seat: 'zyncai-ops', note: 'routed to audit: 1 eligible repo' }, process.env.ZYNCAI_STORE);
  s.setStatus(t.id, 'auditing', process.env.ZYNCAI_STORE);
  const back = s.readTicket(t.id, process.env.ZYNCAI_STORE);
  console.log('status', back.status, '| log', back.log.length, '| gates', Object.keys(back.deliverables));
});
"

# 2. the CLI reads it, exit 0
node tools/ticket-store/file.mjs zai-0001 "$ZYNCAI_STORE" | head -20

# 3. a missing ticket is exit 1, not a crash
node tools/ticket-store/file.mjs zai-9999 "$ZYNCAI_STORE"; echo "exit=$?"

# 4. the ledger is prose and holds the request
cat "$ZYNCAI_STORE"/zai-0001/ledger.md
```

Expected: ticket opens at `intake`; status reaches `auditing`; one log entry; `zyncai-ops` gates recorded; CLI exit 0 for the real ticket and **exit 1** for the missing one; the ledger names the request in prose.

- [ ] **Step 4: Confirm the plugin loads with every M1 skill**

```bash
cd ~/Projects/zyncai
claude plugin validate .
ls skills/            # zyncai, zyncai-ops, zyncai-pipeline
grep -L "user-invocable: false" skills/*/SKILL.md
```

Expected: manifests valid; three skill dirs; the only SKILL.md **without** `user-invocable: false` is `skills/zyncai/SKILL.md`. Ops and pipeline must both be hidden — a seat visible in the `/` menu gets typed directly, which skips the orchestrator and the rails.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/zyncai
git add skills/zyncai/SKILL.md skills/zyncai/evals/evals.json
git commit -m "feat: add the front door and close the M1 skeleton

Routes without pre-interviewing — Ops owns the question graph, so asking
first means asking twice. Does no seat's job: even a one-line fix goes
through the pipeline, because a fix with no verification table is what the
pipeline exists to prevent."
```

- [ ] **Step 6: Record what M1 does not yet do**

Append to `~/Projects/zyncai/README.md` under a new `## Status` heading:

```markdown
## Status

**M1 (walking skeleton) — done.** A ticket can be opened, scoped by Ops,
routed, stopped, and resumed exactly. The file ticket-store adapter, the
orchestrator, the Ops seat and the front door are in place.

**Not yet built:** `zyncai-audit`, `zyncai-fix`, `zyncai-verify`, `zyncai-pr`
(M2), and `zyncai-study`, `zyncai-explain`, `zyncai-scope` (M3). The pipeline
routes to `auditing` and stops there — that is expected, not a defect.

`verify-chain.mjs`, `study-state.mjs` and `validate-assets.mjs` still live in
the `~/.claude` worktree and move here with M2 and M3.
```

```bash
cd ~/Projects/zyncai
git add README.md
git commit -m "docs: record what M1 ships and what it deliberately does not"
```

---

## Self-review

**Spec coverage (M1 row only):** plugin manifests → Task 1. File ticket-store adapter, the five operations, atomic writes, the provenance error channel, full-sha rule → Task 2. `safety-rails.md`, `ticket-protocol.md`, `pipeline-graph.md` → Task 3. Orchestrator owning only sequencing/loop-limits/resume, the fix-round cap, deadlock detection, the two sacred human moments → Task 4. Ops as intake and router, the eligibility gate, exclusions-vs-failures → Task 5. Front door and the end-to-end walk → Task 6. Per-seat `deliverables.md` → Task 5 (Ops is the only seat with a gate in M1). Per-seat `evals.json` → Tasks 4, 5, 6.

**Deliberately not in M1, per the spec's staging table:** the audit/fix/verify/pr seats and their gates (M2); study/explain/scope (M3); the zyncws and WhatsApp adapters (out of scope entirely — the interface exists so they are contained changes later). The spec's **spec-drift guard** is *not* in M1: it guards a moving spec under active amendment, which is a property of zyncai's own build rather than of a maintenance ticket. It belongs with M2's fix/verify loop, and this is a deliberate deferral rather than an omission.

**Placeholder scan:** no TBD/TODO. Every code step carries real code; every reference document is written out in full rather than described; every eval case has concrete assertions.

**Type consistency:** `openTicket` / `readTicket` / `setStatus` / `appendLog` / `recordDeliverables` / `TICKET_STATUSES` / `ERR_TICKET_NOT_FOUND` / `ERR_TICKET_CORRUPT` / `TICKET_ERROR_CODES` / `isStoreConditionError` / `DEFAULT_STORE_ROOT` are each defined once in Task 2 and referred to by the same names in Tasks 3–6. Status strings match the spec's vocabulary exactly in `file.mjs`, `ticket-protocol.md`, `pipeline-graph.md` and the pipeline's `SKILL.md`. Skill invocation names are `zyncai:zyncai-pipeline`, `zyncai:zyncai-ops`, `zyncai:zyncai-explain`, `zyncai:zyncai-scope` throughout.

**One risk worth stating:** Task 5 copies `discover.mjs` out of a worktree that is being actively committed to. If its suite fails on copy, the copy caught the branch mid-change — re-copy rather than fixing the file here, or the plugin's version silently diverges from the one still under review.

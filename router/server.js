#!/usr/bin/env node
// zync-router — classifies each prompt and rewrites body.model before forwarding
// to the Anthropic API. Unlike the UserPromptSubmit hook, this really changes the
// model that serves the turn: the hook fires after the turn is already bound, and
// its output schema has no model field.
//
// Auth is never handled here. The client's Authorization / x-api-key headers are
// relayed verbatim, so the proxy works with subscription OAuth and never stores a
// credential of its own.

'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const CONFIG_PATH = process.env.ZYNC_ROUTER_CONFIG
  || path.join(os.homedir(), '.claude/router/config.json');

const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const LOG = (cfg.log || '~/.claude/router.log').replace(/^~/, os.homedir());

const rules = (cfg.rules || []).map((r) => ({ tier: r.tier, re: new RegExp(r.match, 'i') }));
const vetoRe = cfg.guards?.vetoToCritical ? new RegExp(cfg.guards.vetoToCritical, 'i') : null;
const readOnlyRe = cfg.guards?.readOnlyExempt ? new RegExp(cfg.guards.readOnlyExempt, 'i') : null;

const TIER_ORDER = ['trivial', 'simple', 'moderate', 'complex', 'critical'];

function log(line) {
  try {
    fs.appendFileSync(LOG, `${new Date().toISOString()} | ${line}\n`);
  } catch {
    /* logging must never break a request */
  }
}

// Post-compaction, the harness re-sends the prior conversation as a synthetic user
// message: "This session is being continued from a previous conversation... Pick up
// the last task as if the break never happened." It is a summary of everything talked
// about, so it contains whatever high-stakes nouns (token, payroll, migration) came up
// earlier — vetoing it to critical on every tool round-trip of the resumed turn, not
// just the first. It is harness scaffolding, not a new ask, so strip it like ambient
// tags below.
const COMPACT_SUMMARY_RE = /This session is being continued from a previous conversation[\s\S]*?Pick up the last task as if the break never happened\.?/gi;

// Harness-injected blocks (<ide_selection>, <system-reminder>, <ide_opened_file>…) are
// ambient IDE state, not something the user asserted as topic. Left in, an open payroll
// file or a pasted URL would classify every prompt in the repo as critical — which is
// exactly how the regex hook ended up vetoing 13 of its 15 hits.
function stripAmbient(s) {
  return s
    .replace(COMPACT_SUMMARY_RE, ' ')
    .replace(/<([a-z][a-z0-9_-]*)>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Only the newest user turn decides the tier. Classifying the whole transcript would
// pin every long session to whatever its hardest earlier message was.
function latestUserText(body) {
  const msgs = Array.isArray(body.messages) ? body.messages : [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role !== 'user') continue;
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.content)) {
      const text = m.content.filter((c) => c && c.type === 'text').map((c) => c.text).join(' ');
      // A user turn that is nothing but tool_result blocks is the harness feeding output
      // back, not a new ask. Keep looking for the message the human actually typed.
      if (text.trim()) return text;
    }
  }
  return '';
}

function classifyRegex(ask) {
  // A read-only ask is cheap whatever it is about — locating the billing config is still
  // just a grep. Checked before the veto so a high-stakes noun cannot pin a lookup to the
  // most expensive tier. It exempts finding the thing, never acting on it.
  const readOnly = readOnlyRe ? readOnlyRe.test(ask) : false;
  if (!readOnly && vetoRe && vetoRe.test(ask)) return { tier: 'critical', why: 'veto' };
  for (const r of rules) if (r.re.test(ask)) return { tier: r.tier, why: r.re.source.slice(0, 40) };
  return { tier: null, why: 'none' };
}

// One user turn becomes many API requests — every tool call is another round-trip
// carrying the same newest user message. Without this, an ask that matches no regex rule
// pays for a fresh classification on each one: same answer, N times the latency, N times
// the cost, on a turn that may make twenty tool calls. Keyed on the ask text so it also
// short-circuits a prompt you repeat later.
const llmCache = new Map();
const LLM_CACHE_MAX = 500;

function cacheGet(ask) {
  if (!llmCache.has(ask)) return undefined;
  const v = llmCache.get(ask);
  llmCache.delete(ask);   // reinsert to make Map's insertion order an LRU
  llmCache.set(ask, v);
  return v;
}

function cacheSet(ask, tier) {
  llmCache.set(ask, tier);
  if (llmCache.size > LLM_CACHE_MAX) llmCache.delete(llmCache.keys().next().value);
}

async function classifyLlm(ask, authHeaders) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.classifier?.timeoutMs ?? 4000);
  try {
    const res = await fetch(`${cfg.upstream}/v1/messages`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: cfg.classifier.model,
        max_tokens: 8,
        system:
          'Classify the coding request by complexity. Answer with exactly one word: '
          + 'trivial, simple, moderate, complex, or critical. '
          + 'trivial = greeting or factual question. simple = locate code, rename, one-line edit. '
          + 'moderate = build a feature across a few files. complex = architecture, debugging, '
          + 'unclear root cause. critical = money, payroll, auth, migrations, data loss.',
        messages: [{ role: 'user', content: ask.slice(0, 2000) }],
      }),
    });
    if (!res.ok) { log(`classifier-http ${res.status} ${(await res.text()).slice(0, 200)}`); return null; }
    const j = await res.json();
    const word = (j.content?.[0]?.text || '').trim().toLowerCase();
    return TIER_ORDER.includes(word) ? word : null;
  } catch {
    return null; // classifier failure must never block the real request
  } finally {
    clearTimeout(timer);
  }
}

// Per-conversation model memory. Prompt caches are keyed by model, so every switch re-reads
// the whole transcript uncached — at 100k context that is ~90k of input thrown away. A
// session that alternates easy and hard asks would flip on every turn and spend more than
// the cheaper model ever saves.
//
// The rule is therefore asymmetric: escalate freely, never de-escalate. Once a
// conversation has needed Opus it stays there, because dropping back for one easy question
// buys a small saving and pays a full cache miss twice — once down, once back up. Below
// stickyAboveTokens the transcript is small enough that a miss is cheap, so routing runs
// unrestricted and takes every saving it can.
const convState = new Map();
const CONV_MAX = 200;

// The first human message is stable for the life of a conversation and differs between
// sessions and subagents, which is all the identity this needs.
function convKey(body) {
  const msgs = Array.isArray(body.messages) ? body.messages : [];
  for (const m of msgs) {
    if (m.role !== 'user') continue;
    const text = typeof m.content === 'string'
      ? m.content
      : (Array.isArray(m.content) ? m.content.filter((c) => c?.type === 'text').map((c) => c.text).join(' ') : '');
    // System prompt length adds cheap entropy so two sessions opening with the same words
    // ("continue", a pasted URL) do not share one model decision.
    if (text.trim()) return `${JSON.stringify(body.system || '').length}:${text.slice(0, 200)}`;
  }
  return null;
}

function applyStickiness(key, target, tokens) {
  const floor = cfg.guards?.stickyAboveTokens ?? 40000;
  if (!key || tokens < floor) return { model: target, note: '' };
  // An off-ladder target has index -1, which would compare as cheaper than everything and
  // let stickiness overwrite a model we deliberately held. Nothing to compare, nothing to do.
  if (!COST_LADDER.includes(target)) return { model: target, note: '' };

  const prev = convState.get(key);
  convState.delete(key);
  convState.set(key, target);                       // LRU touch
  if (convState.size > CONV_MAX) convState.delete(convState.keys().next().value);

  if (!prev) return { model: target, note: '' };
  const cheaper = COST_LADDER.indexOf(target) < COST_LADDER.indexOf(prev);
  if (cheaper && COST_LADDER.includes(prev)) {
    convState.set(key, prev);
    return { model: prev, note: 'sticky' };
  }
  return { model: target, note: '' };
}

// Rough but deliberately conservative: bytes/3.5 overestimates tokens for prose and
// underestimates for dense JSON, so it is paired with a threshold well below any
// model's real limit rather than trusted precisely.
function approxTokens(raw) {
  return Math.ceil(Buffer.byteLength(raw, 'utf8') / 3.5);
}

// Cost ladder, cheapest first. Used to walk UP from the tier's ideal model until one is
// found whose window actually holds the conversation.
const COST_LADDER = ['claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-opus-5'];

function fits(model, tokens) {
  const limit = cfg.guards?.contextLimits?.[model];
  if (!limit) return true;                       // unknown model: assume the client knew
  return tokens <= limit * (cfg.guards?.contextSafety ?? 0.85);
}

function pickModel(tier, requested, tokens) {
  const target = cfg.models[tier];
  if (!target) return { model: requested, note: 'no-mapping' };
  if (target === requested) return { model: requested, note: '' };

  // A big context is a reason to pick a bigger *window*, not to abandon routing. Giving up
  // entirely above a global threshold was wrong: Haiku cannot hold a long session, but
  // Sonnet can, and Opus->Sonnet is the saving that actually matters on a long session.
  // Walk up the ladder from the tier's ideal model to the cheapest one that fits.
  if (fits(target, tokens)) return { model: target, note: '' };

  const from = COST_LADDER.indexOf(target);
  const reqIdx = COST_LADDER.indexOf(requested);
  // An unrecognised requested model cannot be placed on the cost ladder, so there is no way
  // to know whether a step "up" is cheaper, the same, or a downgrade in disguise — climbing
  // to claude-opus-5 from claude-opus-5[1m] would strip a suffix and prune the 1m beta on a
  // session that genuinely needs it. Hold instead of guessing.
  if (from !== -1 && reqIdx !== -1) {
    for (let i = from + 1; i < COST_LADDER.length; i++) {
      // Never climb past what the client asked for — that would be an upgrade, and
      // spending more than the user chose is not this proxy's call to make.
      if (reqIdx !== -1 && i >= reqIdx) break;
      if (fits(COST_LADDER[i], tokens)) {
        return { model: COST_LADDER[i], note: `ctx~${Math.round(tokens / 1000)}k` };
      }
    }
  }
  return { model: requested, note: `held:ctx~${Math.round(tokens / 1000)}k` };
}

// Claude Code sends a long anthropic-beta list on every request, and at least one entry
// is model-specific: context-1m-2025-08-07 is meaningless on a small model and can be
// rejected outright. Downgrading without pruning it turns a cost optimisation into a 400.
function sanitizeBetas(headerValue, dropPrefixes) {
  if (!headerValue || !dropPrefixes?.length) return headerValue;
  return String(headerValue)
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x && !dropPrefixes.some((pre) => x.startsWith(pre)))
    .join(',');
}

// max_tokens comes from the client's CLAUDE_CODE_MAX_OUTPUT_TOKENS and is sized for the
// model the user picked. Asking above a cheaper model's ceiling is a 400, not a clamp.
// The client shapes the request for the model IT picked. Some of that shape is refused
// outright by a cheaper model rather than ignored — Haiku 400s on the adaptive `thinking`
// block Opus accepts. Drop those fields when rewriting, or every downgrade round-trips
// through the replay path and saves nothing.
// Dot paths, because the field a model rejects is not always top level: Claude Code sends
// the effort setting as output_config.effort, so deleting a bare "effort" is a silent no-op
// that still 400s.
function deletePath(obj, path) {
  const parts = path.split('.');
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    node = node?.[parts[i]];
    if (!node || typeof node !== 'object') return;
  }
  delete node[parts[parts.length - 1]];
}

// The learner only has a bare field name from the error text, so it hunts for the key
// wherever it sits rather than assuming the top level.
function deleteKeyDeep(obj, key, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 4) return false;
  let hit = false;
  if (Object.prototype.hasOwnProperty.call(obj, key)) { delete obj[key]; hit = true; }
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && deleteKeyDeep(v, key, depth + 1)) hit = true;
  }
  return hit;
}

function dropUnsupportedFields(body, model, table) {
  for (const field of table?.[model] ?? []) deletePath(body, field);
  for (const field of learned.get(model) ?? []) deleteKeyDeep(body, field);
}

// Fields discovered at runtime, per model. The set of request fields a cheap model refuses
// is not documented anywhere the proxy can read, and each one costs a wasted round-trip
// until it is known — so learn it from the rejection instead of shipping a guess and
// waiting for someone to notice the log.
const learned = new Map();

function learnField(model, message) {
  const m = String(message);
  const patterns = [
    /does not support the (\w+) parameter/i,
    /(\w+) is not supported on this model/i,
    /adaptive (thinking) is not supported/i,
    /unsupported .*?[`"'](\w+)[`"']/i,
  ];
  for (const re of patterns) {
    const hit = m.match(re);
    if (hit?.[1]) {
      const field = hit[1] === 'adaptive' ? 'thinking' : hit[1];
      if (!learned.has(model)) learned.set(model, new Set());
      if (learned.get(model).has(field)) return null;   // already tried; do not loop
      learned.get(model).add(field);
      return field;
    }
  }
  return null;
}

function clampMaxTokens(requestedMax, model, table) {
  const cap = table?.[model];
  if (!cap || !requestedMax) return requestedMax;
  return Math.min(requestedMax, cap);
}

const HOP_BY_HOP = new Set([
  'host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade',
  'proxy-authorization', 'proxy-authenticate', 'te', 'trailer', 'content-length',
  // 'expect' is terminated by this hop, not relayed: a client sending
  // "expect: 100-continue" (curl does it for large bodies) makes the upstream fetch fail
  // outright with "expect header not supported". Silent, and only on big requests — which
  // is exactly the long-session traffic this proxy exists to route.
  'expect',
]);

// --- offline test entry point: classify one prompt, no network, no server.
// Regex path only — the llm fallback needs live auth headers, so a fixture that
// depends on it would be testing the network rather than the rules.
if (process.argv[2] === '--classify') {
  const ask = stripAmbient(process.argv[3] || '');
  const { tier, why } = classifyRegex(ask);
  process.stdout.write(`${tier || '-'} ${why === 'veto' ? 'veto' : tier ? 'rule' : 'none'}\n`);
  process.exit(0);
}

const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) headers[k] = v;
  }
  // Kept pristine for the replay path: headers is mutated when betas are pruned.
  const origHeaders = { ...headers };

  let outBody = raw;
  let routed = '';
  let rewroteFrom = null;
  let routedModel = null;

  if (req.method === 'POST' && req.url.startsWith('/v1/messages')) {
    try {
      const body = JSON.parse(raw.toString('utf8'));
      const requested = body.model;
      const ask = stripAmbient(latestUserText(body));
      const tokens = approxTokens(raw.toString('utf8'));

      let { tier, why } = classifyRegex(ask);
      if (!tier && cfg.classifier?.mode === 'regex+llm' && ask) {
        const authOnly = {};
        for (const k of ['authorization', 'x-api-key', 'anthropic-version', 'anthropic-beta']) {
          if (headers[k]) authOnly[k] = headers[k];
        }
        const cached = cacheGet(ask);
        if (cached !== undefined) {
          tier = cached;
          why = tier ? 'llm:cached' : 'none';
        } else {
          tier = await classifyLlm(ask, authOnly);
          // Negative results are cached too. A classifier that failed or answered
          // nonsense will do the same on the next round-trip of the same turn, and
          // retrying it nineteen more times only adds latency to a turn already in
          // flight.
          cacheSet(ask, tier);
          why = tier ? 'llm' : 'none';
        }
      }

      const ckey = convKey(body);

      if (tier) {
        const picked = pickModel(tier, requested, tokens);
        const sticky = applyStickiness(ckey, picked.model, tokens);
        const model = sticky.model;
        const note = sticky.note || picked.note;
        if (model !== requested) {
          body.model = model;
          body.max_tokens = clampMaxTokens(body.max_tokens, model, cfg.guards?.maxOutput);
          dropUnsupportedFields(body, model, cfg.guards?.dropBodyFields);
          const cleaned = sanitizeBetas(headers['anthropic-beta'], cfg.guards?.dropBetasOnDowngrade);
          if (cleaned !== undefined) headers['anthropic-beta'] = cleaned;
          outBody = Buffer.from(JSON.stringify(body));
          rewroteFrom = requested;
          routedModel = model;
          if (process.env.ZYNC_ROUTER_DEBUG) {
            log(`debug-body-keys | ${Object.keys(body).join(',')}`);
            log(`debug-beta | ${headers['anthropic-beta']}`);
          }
        }
        routed = `${tier} | ${why} | ${requested} -> ${body.model}${note ? ` (${note})` : ''}`;
      } else if (cfg.defaultTier) {
        // No rule matched. Falling back to the client's model would quietly park every
        // unrecognised phrasing on the most expensive one — "continue", "go ahead", and
        // half of ordinary conversation. Route it and let the 4xx replay catch a bad guess.
        const { model, note } = pickModel(cfg.defaultTier, requested, tokens);
        if (model !== requested) {
          body.model = model;
          body.max_tokens = clampMaxTokens(body.max_tokens, model, cfg.guards?.maxOutput);
          dropUnsupportedFields(body, model, cfg.guards?.dropBodyFields);
          const cleaned = sanitizeBetas(headers['anthropic-beta'], cfg.guards?.dropBetasOnDowngrade);
          if (cleaned !== undefined) headers['anthropic-beta'] = cleaned;
          outBody = Buffer.from(JSON.stringify(body));
          rewroteFrom = requested;
          routedModel = model;
        }
        routed = `${cfg.defaultTier} | default | ${requested} -> ${body.model}${note ? ` (${note})` : ''}`;
      } else {
        routed = `- | none | ${requested} (kept)`;
      }
      log(`${routed} | ${ask.slice(0, 60)}`);
    } catch (e) {
      // Malformed or non-JSON body: forward untouched. The proxy is transparent on
      // every path it does not understand.
      log(`passthrough | ${e.message}`);
    }
  }

  try {
    let upstream = await fetch(cfg.upstream + req.url, {
      method: req.method,
      headers: { ...headers, 'content-length': String(outBody.length) },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : outBody,
    });

    // Self-heal. Any 4xx on a request we rewrote is more likely our doing — an
    // unsupported beta, a max_tokens ceiling, a model the account cannot reach — than a
    // genuine problem with what the user asked. Replay the untouched original once so a
    // routing mistake degrades to "no saving" instead of killing the turn.
    if (upstream.status >= 400 && upstream.status < 500 && rewroteFrom
        && cfg.guards?.retryOriginalOn4xx !== false) {
      // The body says exactly which field the cheap model rejected — beta, max_tokens,
      // an unsupported param. Without it the log only ever says "400" and the config can
      // never be corrected.
      let why = '';
      try { why = (await upstream.clone().text()).slice(0, 300); } catch { /* body already used */ }

      // Try once more on the cheap model with the offending field removed. Replaying the
      // original is the safety net, not the goal: without this step every unknown
      // incompatibility permanently costs the saving it was meant to produce.
      let healed = false;
      if (cfg.guards?.learnUnsupportedFields !== false) {
        const field = learnField(routedModel, why);
        if (field) {
          log(`learned | ${routedModel} rejects "${field}" — retrying without it`);
          try {
            const patched = JSON.parse(outBody.toString('utf8'));
            deleteKeyDeep(patched, field);
            const retry = await fetch(cfg.upstream + req.url, {
              method: req.method,
              headers: { ...headers, 'content-length': String(Buffer.byteLength(JSON.stringify(patched))) },
              body: Buffer.from(JSON.stringify(patched)),
            });
            if (retry.ok) { upstream = retry; healed = true; }
          } catch { /* fall through to the original-model replay */ }
        }
      }

      if (!healed) {
        log(`retry-original | ${upstream.status} | -> ${rewroteFrom} | ${why}`);
        upstream = await fetch(cfg.upstream + req.url, {
          method: req.method,
          headers: { ...origHeaders, 'content-length': String(raw.length) },
          body: raw,
        });
      }
    }

    // undici has already decoded the response body, so the upstream's content-encoding no
    // longer describes what we are about to write. Relaying it makes the client decompress
    // a second time — "BrotliDecompressionError" — and content-length is equally stale.
    const outHeaders = {};
    upstream.headers.forEach((v, k) => {
      const lk = k.toLowerCase();
      if (HOP_BY_HOP.has(lk) || lk === 'content-encoding' || lk === 'content-length') return;
      outHeaders[k] = v;
    });
    res.writeHead(upstream.status, outHeaders);

    // Stream rather than buffer: Claude Code uses SSE, and buffering would stall the
    // UI until the whole completion landed.
    if (upstream.body) {
      const reader = upstream.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    }
    res.end();
  } catch (e) {
    log(`upstream-error | ${e.message}`);
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: String(e.message) } }));
  }
});

server.listen(cfg.port, '127.0.0.1', () => {
  log(`listening on 127.0.0.1:${cfg.port} -> ${cfg.upstream}`);
  console.log(`zync-router listening on http://127.0.0.1:${cfg.port} -> ${cfg.upstream}`);
});

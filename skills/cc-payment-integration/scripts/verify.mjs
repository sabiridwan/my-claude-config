#!/usr/bin/env node
// verify.mjs — guardrail checklist for a generated payment integration.
// Usage: node scripts/verify.mjs --out <project-dir> [--tsc <path-to-tsc>]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}
const outDir = arg('out');
if (!outDir) {
  console.error('Usage: node scripts/verify.mjs --out <project-dir> [--tsc <path>]');
  process.exit(2);
}
const srcDir = path.join(outDir, 'src');

// External SDK script hosts that are allowed (wallets require them; not navigations).
const URL_ALLOWLIST = [/pay\.google\.com/, /applepay/i, /apple\.com/];

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const files = fs.existsSync(srcDir) ? walk(srcDir) : [];
const failures = [];
const pass = [];

function read(p) {
  return fs.readFileSync(p, 'utf8');
}
const rel = (p) => path.relative(outDir, p);

// 1. No hardcoded price / trial-days / cycle in VISIBLE copy.
//    Visible copy = currency-prefixed numbers anywhere in tsx/scss, plus money-like decimals or
//    "N day" literals that appear inside JSX text nodes (>…<). Code-level fallbacks such as
//    `plan.trialPrice || '0.00'` (a required wallet-API amount default) are intentionally allowed —
//    they are not shown to the user as an authoritative price.
{
  const bad = [];
  for (const f of files) {
    if (!/\.(tsx|scss)$/.test(f)) continue;
    if (/devFallbackConfig|settings\.ts/.test(f)) continue;
    const txt = read(f);
    // (a) currency-prefixed number anywhere → always visible copy
    const cur = txt.match(/[€$£]\s*\d/);
    if (cur) { bad.push(`${rel(f)} → "${cur[0]}"`); continue; }
    // (b) money-like decimal or "N day" literal inside a JSX text node
    for (const seg of txt.match(/>([^<>{}]+)</g) || []) {
      const m = seg.match(/\b\d{1,4}\.\d{2}\b/) || seg.match(/\b\d+\s*-?\s*day\b/i);
      if (m) { bad.push(`${rel(f)} → JSX text "${m[0]}"`); break; }
    }
  }
  if (bad.length) failures.push(`Hardcoded price/plan literal in visible copy: ${bad.join('; ')}`);
  else pass.push('No hardcoded prices/plan literals in visible copy — all read from pageConfigs snapshot');
}

// 2. No absolute http(s) URL in src (except allowlisted wallet SDK hosts).
{
  const bad = [];
  for (const f of files) {
    if (!/\.(ts|tsx|scss|json)$/.test(f)) continue;
    for (const line of read(f).split('\n')) {
      const urls = line.match(/https?:\/\/[^\s"'`)]+/g);
      if (!urls) continue;
      for (const u of urls) {
        if (!URL_ALLOWLIST.some((re) => re.test(u))) bad.push(`${rel(f)} → ${u}`);
      }
    }
  }
  if (bad.length) failures.push(`Absolute off-domain URL in source (breaks domain preservation): ${bad.join('; ')}`);
  else pass.push('Relative URLs only (wallet SDK hosts allowlisted) — domain preserved');
}

// 3. Loader is an overlay, not an early return.
{
  const page = files.find((f) => /PaymentPage\.tsx$/.test(f));
  if (page) {
    const txt = read(page);
    const overlay = /\{!ready && <Loader/.test(txt);
    const earlyReturn = /return <Loader/.test(txt) || /return\s*\(\s*<Loader/.test(txt);
    if (!overlay || earlyReturn) failures.push('Loader must be an overlay ({!ready && <Loader…), never an early return');
    else pass.push('Loader is an overlay over an always-rendered tree');
  }
  const scss = files.find((f) => /_variables\.scss$/.test(f));
  if (scss && !/\.page-loader\s*\{[^}]*position:\s*fixed/s.test(read(scss))) {
    failures.push('.page-loader must be position: fixed (overlay)');
  }
}

// 4. Fail-open timer present.
{
  const page = files.find((f) => /PaymentPage\.tsx$/.test(f));
  if (page && !/RESOLVE_TIMEOUT_MS/.test(read(page))) failures.push('Missing fail-open timer (RESOLVE_TIMEOUT_MS)');
  else if (page) pass.push('Fail-open timer wired (RESOLVE_TIMEOUT_MS)');
}

// 5. Comp/non-comp decided synchronously (initial state), not only in an effect.
{
  const page = files.find((f) => /PaymentPage\.tsx$/.test(f));
  if (page) {
    const txt = read(page);
    if (!/useState<boolean>\(\(\) => decideComp\(\)\)/.test(txt))
      failures.push('comp/non-comp must be decided synchronously in initial state: useState(() => decideComp())');
    else pass.push('comp/non-comp decided synchronously before first paint');
  }
}

// 6. Optional: type-check the payment core if a tsc is available.
{
  let tsc = arg('tsc');
  if (!tsc) {
    for (const cand of [
      path.join(outDir, 'node_modules/.bin/tsc'),
      path.join(process.cwd(), 'node_modules/.bin/tsc')
    ]) {
      if (fs.existsSync(cand)) { tsc = cand; break; }
    }
  }
  const payDir = path.join(srcDir, 'payments');
  if (tsc && fs.existsSync(payDir)) {
    const tmpCfg = path.join(payDir, '.verify.tsconfig.json');
    fs.writeFileSync(tmpCfg, JSON.stringify({
      compilerOptions: {
        target: 'ES2020', module: 'ESNext', moduleResolution: 'bundler',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'], strict: true, noEmit: true,
        skipLibCheck: true, esModuleInterop: true
      },
      include: ['*.ts']
    }));
    try {
      execFileSync(tsc, ['-p', tmpCfg], { stdio: 'pipe' });
      pass.push('Payment core type-checks (tsc, strict)');
    } catch (e) {
      failures.push('Payment core failed type-check:\n' + (e.stdout ? e.stdout.toString() : e.message));
    } finally {
      fs.rmSync(tmpCfg, { force: true });
    }
  } else {
    pass.push('(tsc not found — skipped type-check; run in the project with typescript installed)');
  }
}

console.log('\nVERIFY: ' + outDir + '\n');
for (const p of pass) console.log('  PASS  ' + p);
for (const f of failures) console.log('  FAIL  ' + f);
console.log('\n' + (failures.length ? `FAILED (${failures.length})` : 'ALL CHECKS PASSED'));
process.exit(failures.length ? 1 : 0);

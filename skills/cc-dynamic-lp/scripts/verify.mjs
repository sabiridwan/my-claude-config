#!/usr/bin/env node
// verify.mjs — structural checks for a scaffolded cc-dynamic LP project.
// Does NOT run the private webpack build; see references/build-upload-contract.md.
// Usage: node scripts/verify.mjs --out <project-dir> [--tsc <path>]
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

const pass = [];
const fail = [];
const warn = [];
const exists = (rel) => fs.existsSync(path.join(outDir, rel));
const read = (rel) => fs.readFileSync(path.join(outDir, rel), 'utf8');

// 1. Required build/SSR files present.
const required = ['package.json', 'ssr-dynamic.js', 'config.json', '.env',
  'src/index.tsx', 'src/index.ssr.ts', 'src/Root.tsx'];
const missing = required.filter((f) => !exists(f));
if (missing.length) fail.push('Missing required build files: ' + missing.join(', '));
else pass.push('Required build/SSR files present');

// 2. .env — page present + reminder it must equal repo name.
if (exists('.env')) {
  const env = read('.env');
  const page = (env.match(/^page=(.+)$/m) || [])[1];
  if (!page) fail.push('.env has no `page=`');
  else {
    pass.push(`.env page = ${page}`);
    warn.push(`Ensure the git repo name === "${page}" (pre:build enforces it).`);
  }
  if (!/^country=/m.test(env)) fail.push('.env missing country');
  if (!/^defaultService=/m.test(env)) fail.push('.env missing defaultService');
}

// 3. config.json — product slug + service set.
if (exists('config.json')) {
  const c = JSON.parse(read('config.json'));
  const fc = c?.strategyConfigs?.default?.flowConfig || {};
  if (!fc.service) fail.push('config.json flowConfig.service is empty');
  else pass.push(`config.json service = ${fc.service}`);
  if (!fc.slug) warn.push('config.json flowConfig.slug is empty — set the billing slug before upload.');
  else pass.push('config.json slug set');
}

// 4. Branding applied.
if (exists('src/styles/_variables.scss')) {
  const v = read('src/styles/_variables.scss');
  if (/cc-dynamic-lp scaffold/.test(v)) pass.push('Branding applied to _variables.scss');
  else warn.push('Branding header not found in _variables.scss — was branding applied?');
}

// 5. Payment layer present + wired.
const payFiles = ['src/checkout/payments/cardService.ts', 'src/checkout/PaymentPage.tsx', 'src/CheckoutSection.tsx'];
const payMissing = payFiles.filter((f) => !exists(f));
if (payMissing.length) fail.push('Checkout not generated: ' + payMissing.join(', ') + ' (run with --payment-skill)');
else pass.push('cc-payment-integration checkout present (payments + PaymentPage + CheckoutSection)');

// 6. Checkout wired into Root (or marker still pending → warn).
if (exists('src/Root.tsx')) {
  const root = read('src/Root.tsx');
  const wired = /CheckoutSection/.test(root);
  const markerPending = /CC_PAYMENT_MOUNT/.test(root);
  if (wired) pass.push('CheckoutSection wired into Root.tsx');
  else if (markerPending) warn.push('Checkout marker present but CheckoutSection not yet mounted — follow PAYMENT_WIRING.md');
  else warn.push('CheckoutSection not referenced in Root.tsx yet — follow PAYMENT_WIRING.md');
}

// 6a. Dev config (src/checkout/devConfig.ts) must exist, be localhost-guarded (inert on prod), and be
// imported first in the entry so pageConfigs exists before the app reads it. (index.html template
// edits don't hot-reload in this webpack, so the dev config is a JS module instead.)
if (exists('src/checkout/devConfig.ts')) {
  const dc = read('src/checkout/devConfig.ts');
  if (/location\.hostname/.test(dc)) pass.push('Dev config present and localhost-guarded (inert on prod)');
  else fail.push('src/checkout/devConfig.ts is not localhost-guarded — it would activate on prod');
  if (exists('src/CheckoutSection.tsx') && /checkout\/devConfig/.test(read('src/CheckoutSection.tsx'))) {
    pass.push('Dev config imported from CheckoutSection (before PaymentPage reads pageConfigs)');
  } else {
    warn.push('CheckoutSection.tsx does not import ./checkout/devConfig — local dev may show empty prices.');
  }
} else {
  warn.push('No src/checkout/devConfig.ts — local dev may crash/blank without backend-injected pageConfigs.');
}

// 6a2. SSR guard — ssr-dynamic.js renders through jsdom into the shipped staging.html. Without a
// guard the checkout renders server-side with no injected pageConfigs and bakes "—" placeholder
// prices into the published HTML.
if (exists('src/CheckoutSection.tsx')) {
  const cs = read('src/CheckoutSection.tsx');
  if (/node\|jsdom/.test(cs) && /SsrLoader/.test(cs)) {
    pass.push('SSR guard present in CheckoutSection (jsdom → SsrLoader, no placeholder prices in staging.html)');
  } else {
    fail.push('CheckoutSection has no SSR guard — server render would bake placeholder prices into staging.html');
  }
}

// 6a3. White-label integrity + footer completeness. The generated checkout must not carry a
// parent-company name, an internal host, or an absolute off-domain URL — cc-tester check 6 treats
// each as a hard FAIL, and THIS is the verify an embed project actually runs before shipping
// (cc-payment-integration's own verify has a URL check but is not the documented gate here).
// It also catches the opposite failure: a footer whose company/legal fields were left blank, which
// is what the scaffold now emits by default rather than a plausible-but-wrong entity.
{
  const CHECKOUT = path.join(outDir, 'src/checkout');
  // The product's OWN domain is allowed: the page is served from it, and the footer's legal links
  // must point at the product's real policy pages (incl. sibling hosts like portal.<product>.com).
  // Derive it from checkoutMeta's siteUrl rather than hardcoding.
  // siteUrl is "/" under the proxy, so take the domain from siteLabel (e.g. "www.streamtrainfit.com").
  let ownBase = null;
  if (exists('src/checkout/checkoutMeta.ts')) {
    const meta = read('src/checkout/checkoutMeta.ts');
    const m = meta.match(/"siteLabel"\s*:\s*"([^"]+)"/) || meta.match(/"siteUrl"\s*:\s*"https?:\/\/([^/"]+)"/);
    if (m) ownBase = m[1].replace(/^https?:\/\//, '').split('/')[0].split('.').slice(-2).join('.');
  }
  const ALLOW = [/pay\.google\.com/, /applepay/i, /apple\.com/, /www\.w3\.org\/2000\/svg/,
                 /fonts\.(googleapis|gstatic)\.com/, /^https?:\/\/localhost/,
                 ...(ownBase ? [new RegExp(`^https?://([^/]+\\.)?${ownBase.replace(/\./g, '\\.')}(/|$)`)] : [])];
  const LEAK = /\bsam[-\s]?media\b|\bsammedia\b|panel\.ouisys\.com|c1\.ouisys\.com|\bouisys\.com\b/i;
  const walk = (dir) => fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        return e.isDirectory() ? walk(p) : [p];
      })
    : [];
  const bad = [];
  for (const f of walk(CHECKOUT)) {
    if (!/\.(ts|tsx|scss)$/.test(f)) continue;
    const body = fs.readFileSync(f, 'utf8');
    const where = path.relative(outDir, f);
    if (LEAK.test(body)) bad.push(`${where} → parent-company/internal string`);
    for (const u of body.match(/https?:\/\/[^\s"'`)]+/g) || []) {
      if (!ALLOW.some((re) => re.test(u))) bad.push(`${where} → ${u}`);
    }
  }
  if (bad.length) fail.push(`White-label / domain-preservation violation in src/checkout: ${bad.join('; ')}`);
  else pass.push('No parent-company strings or absolute off-domain URLs in src/checkout');

  // Footer identity must be filled in from the PRODUCT's own site, not left empty and not copied
  // from the reference /xhosp page (which shows the parent company).
  if (exists('src/checkout/checkoutMeta.ts')) {
    const meta = read('src/checkout/checkoutMeta.ts');
    const blank = ['companyName', 'companyAddress'].filter((k) => new RegExp(`"${k}"\\s*:\\s*""`).test(meta));
    const noLegal = /"legalLinks"\s*:\s*\[\s*\]/.test(meta) || !/"legalLinks"/.test(meta);
    if (blank.length || noLegal) {
      fail.push(`checkoutMeta.ts footer identity incomplete (${[...blank, noLegal ? 'legalLinks' : ''].filter(Boolean).join(', ')}) — harvest these from the product's live footer`);
    } else {
      pass.push('Footer identity present (company, address, legal links)');
    }
  }
}

// 6b. Git remote basename must equal the .env page (pre:build enforces page === repo name).
if (fs.existsSync(path.join(outDir, '.git'))) {
  try {
    const url = execFileSync('git', ['-C', outDir, 'config', '--get', 'remote.origin.url'], { stdio: 'pipe' })
      .toString().trim();
    const repo = url.replace(/\.git$/, '').split(/[/:]/).pop();
    const env = exists('.env') ? read('.env') : '';
    const page = (env.match(/^page=(.+)$/m) || [])[1];
    if (url.includes('dynamic-templates/xx/')) pass.push('git origin under ouisys/dynamic-templates/xx');
    else warn.push(`git origin is not under dynamic-templates/xx: ${url}`);
    if (repo && page && repo !== page) fail.push(`git repo name "${repo}" !== .env page "${page}" (upload will abort)`);
    else if (repo && page) pass.push(`git repo name === .env page (${page})`);
  } catch {
    warn.push('git present but no origin remote set.');
  }
} else {
  warn.push('No git repo — scaffold normally runs `git init` + adds the dynamic-templates origin.');
}

// 7. Type-check the payment core if tsc is available.
let tsc = arg('tsc');
if (!tsc) {
  for (const cand of [
    path.join(outDir, 'node_modules/.bin/tsc'),
    path.join(process.cwd(), 'node_modules/.bin/tsc')
  ]) if (fs.existsSync(cand)) { tsc = cand; break; }
}
if (tsc && exists('src/checkout/payments')) {
  const cfgFile = path.join(outDir, 'src/checkout/payments/.verify.tsconfig.json');
  fs.writeFileSync(cfgFile, JSON.stringify({
    compilerOptions: {
      target: 'ES2020', module: 'ESNext', moduleResolution: 'bundler',
      lib: ['ES2020', 'DOM', 'DOM.Iterable'], strict: true, noEmit: true,
      skipLibCheck: true, esModuleInterop: true
    },
    include: ['*.ts']
  }));
  try {
    execFileSync(tsc, ['-p', cfgFile], { stdio: 'pipe' });
    pass.push('Payment core type-checks (tsc, strict)');
  } catch (e) {
    fail.push('Payment core failed type-check:\n' + (e.stdout ? e.stdout.toString() : e.message));
  } finally {
    try { fs.rmSync(cfgFile, { force: true }); } catch { /* some mounts block unlink */ }
  }
} else {
  warn.push('tsc not found — skipped payment-core type-check.');
}

console.log('\nVERIFY (cc-dynamic-lp): ' + outDir + '\n');
for (const p of pass) console.log('  PASS  ' + p);
for (const w of warn) console.log('  WARN  ' + w);
for (const f of fail) console.log('  FAIL  ' + f);
console.log('\n' + (fail.length ? `FAILED (${fail.length})` : 'ALL CHECKS PASSED') +
  (warn.length ? ` — ${warn.length} warning(s)` : ''));
process.exit(fail.length ? 1 : 0);

#!/usr/bin/env node
// scaffold.mjs — clone a cc-dynamic reference template and customize it into a new LP project,
// then wire in the cc-payment-integration checkout.
// Usage:
//   node scripts/scaffold.mjs --config <product.json> [--out <project-dir>]
//     [--base <reference-template-dir>] [--payment-skill <cc-payment-integration-dir>]
//     [--cc-template-dir <dir>] [--git-remote-base <base>] [--no-git]
//
// By default the project is created inside the cc-template dir as <cc-template>/<name>, and a git
// repo is initialised with origin = <git-remote-base>/<name>.git . The project NAME follows the
// Sam Media cc-dynamic convention (see references/naming-convention.md) and is derived from the
// requirements when not given explicitly. `.env page` and the git repo name are set to this name
// (the upload pre:build enforces page === repo name).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, '..');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}
const flag = (name) => process.argv.includes(`--${name}`);

const configPath = arg('config');
if (!configPath) {
  console.error('Usage: node scripts/scaffold.mjs --config <product.json> [--out <dir>] [--base <tpl>] [--cc-template-dir <dir>] [--git-remote-base <base>] [--no-git]');
  process.exit(2);
}
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// ---- Fixed locations + conventions (overridable) ----
const CC_TEMPLATE_DIR = path.resolve(arg('cc-template-dir', cfg.ccTemplateDir || path.join(SKILL_ROOT, '../cc-template')));
const GIT_REMOTE_BASE = arg('git-remote-base', cfg.gitRemoteBase || 'git@git.sam-media.com:ouisys/dynamic-templates/xx');
const NO_GIT = flag('no-git') || cfg.noGit === true;

// Derive the project/page/repo name from the cc-dynamic naming convention when not given.
// Convention:  cc-dynamic-<service>-template[-download|-video][-nid]-gcomp
function deriveName(cfg) {
  if (cfg.productName) return cfg.productName;
  const svc = String(cfg.serviceId || 'service').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const parts = ['cc-dynamic', svc, 'template'];
  if (cfg.creative === 'download') parts.push('download');
  else if (cfg.creative === 'video') parts.push('video');
  if (cfg.nid !== false) parts.push('nid'); // nid variant by default
  parts.push(cfg.suffix || 'gcomp'); // google comp/non-comp variant
  return parts.join('-');
}
const productName = deriveName(cfg);
if (!/^[a-z0-9][a-z0-9-]*$/.test(productName)) {
  console.error(`Invalid project name "${productName}". Use lowercase letters, digits, hyphens (see references/naming-convention.md).`);
  process.exit(2);
}
cfg.productName = productName; // downstream steps read cfg.productName

const outDir = path.resolve(arg('out', path.join(CC_TEMPLATE_DIR, productName)));
const gitRemoteUrl = `${GIT_REMOTE_BASE}/${productName}.git`;

const baseDir = path.resolve(
  arg('base', cfg.baseTemplate || path.join(CC_TEMPLATE_DIR, 'cc-dynamic-template-download-nid-gcomp'))
);
const paymentSkill = path.resolve(arg('payment-skill', path.join(SKILL_ROOT, '../cc-payment-integration')));

if (!fs.existsSync(baseDir)) {
  console.error(`Base template not found: ${baseDir}\nPass --base <path-to-a-cc-dynamic-*-template>.`);
  process.exit(2);
}
if (fs.existsSync(outDir) && fs.readdirSync(outDir).length) {
  console.error(`Target already exists and is not empty: ${outDir}\nPick a different name or remove it first.`);
  process.exit(2);
}

const serviceId = cfg.serviceId;
const serviceName = cfg.serviceDisplayName || serviceId;
const country = cfg.country || 'xx';
const scenariosConfig = cfg.scenariosConfig || `${country}-creditcard-${serviceId}`;

console.log(`Project name : ${productName}`);
console.log(`Location     : ${outDir}`);
console.log(`Git remote   : ${NO_GIT ? '(skipped)' : gitRemoteUrl}`);
console.log(`Cloning ${path.basename(baseDir)} …`);

// ---- 1. Clone the base template, excluding heavy / scratch / per-instance dirs. ----
const EXCLUDES = [
  'node_modules', '.git', 'dist', '.playwright-mcp', '.playwright-output', '.firecrawl',
  'docs', '.superpowers', '.claude'
];
fs.mkdirSync(outDir, { recursive: true });
copyDir(baseDir, outDir, EXCLUDES, 0);

// ---- 2. Rewrite .env ----
const envPath = path.join(outDir, '.env');
const env = [
  `client=super-strategy`,
  `title=${cfg.title || serviceName}`,
  `page=${cfg.productName}`,
  `country=${country}`,
  `strategy=credit-card`,
  `scenariosConfig=${scenariosConfig}`,
  `defaultScenario=${scenariosConfig}`,
  `defaultService=${serviceId}`,
  ''
].join('\n');
fs.writeFileSync(envPath, env);
console.log('  ~ .env (page=' + cfg.productName + ')');

// ---- 3. Rewrite config.json ----
const configJson = {
  strategy: 'credit-card',
  country: 'xx',
  strategyConfigs: {
    default: {
      flow: 'creditCard',
      flowConfig: {
        host: '',
        slug: cfg.slug || '',
        device: 'smart',
        country: 'xx',
        service: serviceId,
        operators: null,
        automaticallySubmitAllOperators: false
      }
    },
    operators: {}
  }
};
fs.writeFileSync(path.join(outDir, 'config.json'), JSON.stringify(configJson, null, 2) + '\n');
console.log('  ~ config.json (slug + service)');

// ---- 4. Branding: override _variables.scss tokens ----
const varsPath = path.join(outDir, 'src/styles/_variables.scss');
if (fs.existsSync(varsPath)) {
  const b = cfg.branding || {};
  let vars = fs.readFileSync(varsPath, 'utf8');
  const overrides = {
    '$highlight': b.primaryColor,
    '$primary-hover': b.primaryDark,
    '$card-color': '#ffffff'
  };
  for (const [k, v] of Object.entries(overrides)) {
    if (!v) continue;
    const re = new RegExp(`(\\${k}\\s*:\\s*)[^;]+;`);
    if (re.test(vars)) vars = vars.replace(re, `$1${v};`);
    else vars += `\n${k}: ${v};`;
  }
  vars = `// Branding overridden by cc-dynamic-lp scaffold for ${serviceName}\n` + vars;
  fs.writeFileSync(varsPath, vars);
  console.log('  ~ src/styles/_variables.scss (brand colors)');
}

// ---- 5. Logo placeholder ----
const logoDir = path.join(outDir, 'src/assets/logos');
fs.mkdirSync(logoDir, { recursive: true });
const logoName = (cfg.branding && cfg.branding.logo) || `${serviceId}.svg`;
fs.copyFileSync(path.join(SKILL_ROOT, 'assets/logo.placeholder.svg'), path.join(logoDir, logoName));
console.log(`  + src/assets/logos/${logoName} (placeholder — replace with real logo)`);

// ---- 6. Invoke cc-payment-integration to generate the checkout core into this project ----
const paymentScaffold = path.join(paymentSkill, 'scripts/scaffold.mjs');
if (fs.existsSync(paymentScaffold)) {
  // Build a product.json for the payment skill from the shared fields.
  const payCfg = {
    serviceId, serviceDisplayName: serviceName,
    productDomain: cfg.productDomain || `${serviceId}.com`, pagePath: '/xhosp',
    slug: cfg.slug, gateway: cfg.gateway, bankId: cfg.bankId,
    applePay: cfg.applePay, googlePay: cfg.googlePay,
    paymentMethods: cfg.paymentMethods || ['applePay', 'googlePay', 'card'],
    creative: cfg.creative || 'none', consent: cfg.consent || {},
    branding: cfg.branding || {}, locale: cfg.locale || 'en',
    devFallbackPlan: cfg.devFallbackPlan,
    // Brand theme (extracted from the product's live site) + product copy for the checkout page.
    brand: cfg.brand || {}, copy: cfg.copy || {},
    // Extra fields so the dev fallback config also satisfies the host template's RootContext.
    pageName: productName, mcc: cfg.mcc
  };
  const payCfgPath = path.join(outDir, '.cc-payment.product.json');
  fs.writeFileSync(payCfgPath, JSON.stringify(payCfg, null, 2));
  console.log('  → running cc-payment-integration scaffold (embed → src/checkout)…');
  // --embed: don't emit config.json / top-level styles / bootstrap (the LP owns those).
  // --src-prefix src/checkout: keep the whole checkout self-contained and collision-free.
  execFileSync('node',
    [paymentScaffold, '--config', payCfgPath, '--out', outDir, '--embed', '--src-prefix', 'src/checkout'],
    { stdio: 'inherit' });
  try { fs.rmSync(payCfgPath, { force: true }); } catch { /* some mounts block unlink; harmless leftover */ }
} else {
  console.warn(`  ! cc-payment-integration scaffold not found at ${paymentScaffold} — skipping payment layer.`);
  console.warn('    Pass --payment-skill <path-to-cc-payment-integration>.');
}

// ---- 6c. Inject the product's Google Fonts (checkout brand typography) into index.html. ----
if (cfg.brand && cfg.brand.googleFonts) {
  const idxHtml = path.join(outDir, 'src/index.html');
  if (fs.existsSync(idxHtml)) {
    let html = fs.readFileSync(idxHtml, 'utf8');
    if (!html.includes(cfg.brand.googleFonts) && html.includes('</head>')) {
      const link = `  <link rel="preconnect" href="https://fonts.googleapis.com" />\n` +
        `  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n` +
        `  <link href="${cfg.brand.googleFonts}" rel="stylesheet" />\n`;
      html = html.replace('</head>', link + '</head>');
      fs.writeFileSync(idxHtml, html);
      console.log('  ~ src/index.html (brand Google Fonts)');
    }
  }
}

// ---- 7. CheckoutSection wrapper + wiring note ----
const devImport = cfg.devFallbackPlan
  ? "import './checkout/devConfig'; // dev-only pageConfigs mock (localhost-guarded); must precede PaymentPage\n"
  : '';
const checkout = `// GENERATED by cc-dynamic-lp. Renders the cc-payment-integration checkout.
// Mount this where the reference template rendered <FLOWS.CreditCardFlow/> (see PAYMENT_WIRING.md).
import React from 'react';
${devImport}import PaymentPage from './checkout/PaymentPage';

// SSR guard — ssr-dynamic.js renders this tree through jsdom into the shipped staging.html.
// On the server there is no backend-injected window.configJson, so rendering the real checkout
// would bake placeholder prices ("—") and a comp/non-comp guess into the static HTML. Emit a
// neutral branded loader instead. The client mounts with createRoot (not hydrate) and fully
// REPLACES this markup, so client behaviour is unchanged — this only controls what shows during
// the bundle-download window. UA is "Node.js/<v>", "node.js", or "…jsdom/<v>" on the server.
const SsrLoader: React.FC = () => (
  <div
    style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '20px', background: '${(cfg.brand && cfg.brand.theme) === 'light' ? '#f3f3f3' : '#0A0A0A'}', zIndex: 9999
    }}
  >
    <style>{'@keyframes ssr-loader-spin{to{transform:rotate(360deg)}}'}</style>
    <div
      style={{
        width: '48px', height: '48px',
        border: '4px solid rgba(255, 255, 255, 0.12)',
        borderTopColor: '${(cfg.brand && cfg.brand.primary) || '#DC2626'}',
        borderRadius: '50%', animation: 'ssr-loader-spin 0.8s linear infinite'
      }}
    />
    <div
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fontSize: '18px', fontWeight: 600,
        color: '${(cfg.brand && cfg.brand.theme) === 'light' ? '#333333' : '#FFFFFF'}',
        textAlign: 'center', padding: '0 16px'
      }}
    >
      Please hold tight for just a moment.
    </div>
  </div>
);

export default function CheckoutSection() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/node|jsdom/i.test(ua)) return <SsrLoader />;
  return <PaymentPage />;
}
`;
fs.writeFileSync(path.join(outDir, 'src/CheckoutSection.tsx'), checkout);

const wiring = `# Payment wiring

The scaffold generated the checkout (cc-payment-integration) into \`src/checkout/\` and a wrapper
\`src/CheckoutSection.tsx\` that renders the full branded /xhosp checkout page.

## The /xhosp page IS the checkout (render it as the PRIMARY view)

The reference (xracademy.online/xhosp) is **checkout-first** — the page itself is the payment page.
So \`CheckoutSection\` must be the primary thing \`Root\` renders, NOT something buried in a flow
state. In \`src/Root.tsx\`, add the import and make it the first return:

    import CheckoutSection from './CheckoutSection';
    // …at the top of the component's return:
    return <CheckoutSection />;

WHY not the \`creditCardFlow: () => <CheckoutSection/>\` slot: in the marketing templates that node
only renders deep inside the payment flow, and the whole tree is often gated behind
\`window.ApplePaySession &&\` — so on a normal browser (no Apple Pay) the page shows the template's
landing or nothing at all. Returning \`<CheckoutSection/>\` directly makes localhost:8080 show the
branded checkout immediately, matching the reference.

Keep the providers (RootContext/ProvidersWrapper) — CheckoutSection renders inside them and the dev
mock config (index.html) satisfies what they read.

Then verify:  node <cc-dynamic-lp>/scripts/verify.mjs --out .
`;
fs.writeFileSync(path.join(outDir, 'PAYMENT_WIRING.md'), wiring);
console.log('  + src/CheckoutSection.tsx + PAYMENT_WIRING.md');

// ---- 7b. Dev-only mock config, injected into index.html and EXCLUDED from the production build. ----
// In local dev there is no backend-injected window.configJson, and the template's RootContext reads
// pageConfigs.cardMccInformation.mcc / service / flags at first render — so config must exist before
// the bundle runs. We inject a mock inside a build-time `<% if (process.env.NODE_ENV !== 'production') %>`
// block in index.html: it loads synchronously in <head> (before bundle.js) in dev, and the whole block
// is dropped from the production HTML — so nothing ships to the published page. This is NOT bundled.
if (cfg.devFallbackPlan) {
  const dummy = {
    pageConfigs: {
      slug: cfg.slug || '',
      gateway: cfg.gateway || '',
      service: { id: serviceId, displayName: serviceName },
      cardMccInformation: { mcc: cfg.mcc || serviceName || 'MCC NAME' },
      env: { page: productName },
      plan: { isLocalCurrency: false, ...cfg.devFallbackPlan },
      payments: {
        card: { bankId: cfg.bankId?.card },
        applePay: {
          bankId: cfg.bankId?.applePay,
          supportedNetworks: ['visa', 'masterCard'],
          merchantCapabilities: ['supports3DS'],
          ...(cfg.applePay || {})
        },
        googlePay: {
          bankId: cfg.bankId?.googlePay,
          gateway: cfg.gateway || 'example',
          gatewayMerchantId: 'exampleGatewayMerchantId',
          allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
          allowedCardNetworks: ['MASTERCARD', 'VISA'],
          merchantInfo: { merchantName: serviceName },
          ...(cfg.googlePay || {})
        }
      },
      flags: { forceComp: false }
    }
  };
  // Dev config as a JS module imported first in the entry. HtmlWebpackPlugin template edits do NOT
  // hot-reload, but JS modules do — so this shows up in dev without a dev-server restart. Guarded to
  // localhost, so it is inert on the live domain (the backend-injected config always wins).
  const devConfig =
    `// DEV ONLY — mock of the backend-injected window.configJson for local dev.\n` +
    `// Guarded to localhost; inert on the live domain (backend config wins via '||').\n` +
    `(function () {\n` +
    `  var h = typeof location !== 'undefined' ? location.hostname : '';\n` +
    `  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || /\\.local$/.test(h)) {\n` +
    `    (window).configJson = (window).configJson || ${JSON.stringify(dummy)};\n` +
    `  }\n` +
    `})();\n` +
    `export {};\n`;
  fs.writeFileSync(path.join(outDir, 'src/checkout/devConfig.ts'), devConfig);
  // NOTE: it is imported from CheckoutSection (below), NOT the entry (index.tsx). Entry-file edits
  // don't hot-reload in this webpack, but regular modules do — importing it from CheckoutSection
  // (which precedes PaymentPage's paymentConfig snapshot) means the mock is set before prices are read.
  console.log('  ~ src/checkout/devConfig.ts (dev config — imported from CheckoutSection, localhost-guarded)');
}

// ---- 8. Initialise git with the dynamic-templates remote (repo name === page name). ----
if (!NO_GIT) {
  try {
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: outDir, stdio: 'pipe' });
    execFileSync('git', ['remote', 'add', 'origin', gitRemoteUrl], { cwd: outDir, stdio: 'pipe' });
    console.log(`  ~ git init + origin ${gitRemoteUrl}`);
    console.log('    (commit before uploading — build:upload requires a clean tree; page === repo name)');
  } catch (e) {
    console.warn('  ! git init/remote failed (is git installed?): ' + (e.message || e));
  }
}

console.log('\nDone. Next:');
console.log('  1. Follow PAYMENT_WIRING.md to mount <CheckoutSection/> in src/Root.tsx');
console.log('  2. Replace the logo placeholder + review copy/colors');
console.log('  3. Verify:  node ' + path.join(SKILL_ROOT, 'scripts/verify.mjs') + ' --out ' + outDir);
console.log('  4. Commit, then create the repo + push:  git add -A && git commit -m "init" && git push -u origin main');
console.log('  5. Panel: create the TEMPLATE named exactly this repo (no build attached yet)');
console.log('  6. Commit, then build+upload → produces v1 (deploy.sh needs a pty: use expect, NOT a pipe)');
console.log('  7. Panel: create the PAGE (Card Create) selecting this template + v1 → gives you the xcid');
console.log('  8. QA on https://staging.mouisys.com/<xcid> BEFORE publishing (cc-tester)');
console.log('  9. Publish via panel Actions → Publish. Do NOT use publish:page (DCB boilerplate, 404s)');
console.log('     Details: references/build-upload-contract.md + cc-ouisys-panel/references/create-page.md');

// ---------- helpers ----------
// Skip root-level screenshot images (design captures, not build inputs). Product imagery lives
// under src/assets and is preserved because the skip only applies at depth 0.
function copyDir(src, dst, excludes, depth = 0) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (excludes.includes(e.name)) continue;
    if (depth === 0 && e.isFile() && /\.(png|jpe?g|webp|gif)$/i.test(e.name)) continue;
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isSymbolicLink()) {
      const link = fs.readlinkSync(s);
      try { fs.symlinkSync(link, d); } catch { /* ignore */ }
    } else if (e.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyDir(s, d, excludes, depth + 1);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

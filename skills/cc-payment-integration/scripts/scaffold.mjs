#!/usr/bin/env node
// scaffold.mjs — generate the self-contained payment integration into a project.
// Usage: node scripts/scaffold.mjs --config <product.json> --out <project-dir>
//   [--src-prefix <dir>]  place src files under <out>/<dir> instead of <out>/src (default: src)
//   [--embed]             emit ONLY the checkout code; skip config.json, top-level styles, and
//                         bootstrap.tsx (used when composing into a host project, e.g. cc-dynamic-lp)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, '..');
const TPL = path.join(SKILL_ROOT, 'templates');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}

const configPath = arg('config');
const outDir = arg('out');
if (!configPath || !outDir) {
  console.error('Usage: node scripts/scaffold.mjs --config <product.json> --out <project-dir>');
  process.exit(2);
}

const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const methods = cfg.paymentMethods || ['applePay', 'googlePay', 'card'];
const creative = cfg.creative || 'none';
const branding = cfg.branding || {};
const consent = cfg.consent || {};
const PREFIX = arg('src-prefix', 'src'); // where src files land under outDir
const EMBED = process.argv.includes('--embed'); // skip host-owned files (config.json, styles, bootstrap)

const tokens = {
  SERVICE_ID: cfg.serviceId || '',
  SERVICE_DISPLAY_NAME: cfg.serviceDisplayName || cfg.serviceId || '',
  SLUG: cfg.slug || '',
  CREATIVE_MODE: creative,
  PRIMARY_COLOR: branding.primaryColor || '#12B886',
  PRIMARY_DARK: branding.primaryDark || '#0CA678',
  PRIMARY_TINT: branding.primaryTint || '#E6FCF5',
  FONT_STACK: branding.font || "'Inter', system-ui, sans-serif"
};

function subst(str) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in tokens ? tokens[k] : `{{${k}}}`));
}

// ── Brand → checkout theme ────────────────────────────────────────────────────────────────
const brand = cfg.brand || {};
const copy = cfg.copy || {};
function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const int = parseInt(n || '000000', 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}
function buildThemeRoot(b) {
  const primary = b.primary || '#DC2626';
  const primaryDark = b.primaryDark || primary;
  const primarySoft = b.primarySoft || primary;
  const [r, g, bl] = hexToRgb(primary);
  const rgba = (a) => `rgba(${r}, ${g}, ${bl}, ${a})`;
  const display = b.displayFont || "'Oswald', 'Roboto Condensed', sans-serif";
  const body = b.bodyFont || "'Montserrat', Roboto, -apple-system, Segoe UI, sans-serif";
  const dark = (b.theme || 'dark') === 'dark';
  const neutrals = dark
    ? {
        bg: '#0A0A0A', card: '#1C1212', card2: '#241616', ink: '#FFFFFF',
        muted: 'rgba(255,255,255,.62)', line: 'rgba(255,255,255,.10)', ph: 'rgba(255,255,255,.35)',
        head: 'rgba(10,10,10,.85)', shadow: '0 8px 30px rgba(0,0,0,.45)',
        bodyBg: `radial-gradient(1100px 480px at 82% -8%, ${rgba('.20')}, transparent 60%), radial-gradient(900px 420px at 0% 8%, ${rgba('.10')}, transparent 55%), #0A0A0A`,
        appleBg: '#ffffff', appleFg: '#000000'
      }
    : {
        bg: '#F4F7FA', card: '#FFFFFF', card2: '#FFFFFF', ink: '#12161C',
        muted: '#667085', line: '#E6E9EF', ph: '#98A2B3',
        head: '#FFFFFF', shadow: '0 2px 16px rgba(16,24,40,.06)',
        bodyBg: '#F4F7FA', appleBg: '#000000', appleFg: '#ffffff'
      };
  return `:root {
  --cc-brand: ${primary};
  --cc-brand-dark: ${primaryDark};
  --cc-brand-soft: ${primarySoft};
  --cc-brand-tint: ${rgba('.15')};
  --cc-brand-ring: ${rgba('.20')};
  --cc-brand-glow: ${rgba('.35')};
  --cc-bg: ${neutrals.bg};
  --cc-body-bg: ${neutrals.bodyBg};
  --cc-card: ${neutrals.card};
  --cc-card-2: ${neutrals.card2};
  --cc-ink: ${neutrals.ink};
  --cc-muted: ${neutrals.muted};
  --cc-line: ${neutrals.line};
  --cc-placeholder: ${neutrals.ph};
  --cc-head-bg: ${neutrals.head};
  --cc-shadow: ${neutrals.shadow};
  --cc-apple-bg: ${neutrals.appleBg};
  --cc-apple-fg: ${neutrals.appleFg};
  --cc-foot-bg: #050505;
  --cc-foot-ink: #ffffff;
  --cc-foot-muted: rgba(255,255,255,.6);
  --cc-display: ${display};
  --cc-body: ${body};
}`;
}

function write(rel, content) {
  const dest = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  console.log('  +', rel);
}

function copyTpl(relSrc, relDest) {
  write(relDest, subst(fs.readFileSync(path.join(TPL, relSrc), 'utf8')));
}

console.log(`Scaffolding ${tokens.SERVICE_DISPLAY_NAME} → ${outDir}`);

// 1. Payment core (always) — token-free .ts, copied verbatim.
const core = [
  'types.ts', 'params.ts', 'paymentConfig.ts', 'pricing.ts', 'cardService.ts',
  'applePayService.ts', 'googlePayService.ts', 'walletActions.ts', 'resolveMode.ts', 'tracker.ts', 'index.ts'
];
for (const f of core) copyTpl(`payments/${f}`, `${PREFIX}/payments/${f}`);

// 2. settings.ts — generated per product.
const settings = `// GENERATED by scaffold.mjs — do not edit by hand.
export const CREATIVE_MODE: 'none' | 'download' | 'video' = '${creative}';
// Dev-fallback / pre-panel-save default only. At runtime the panel's live
// pageConfigs.paymentMethods wins — see getPaymentMethods() in paymentConfig.ts.
export const PAYMENT_METHODS: Array<'applePay' | 'googlePay' | 'card'> = ${JSON.stringify(methods)};
export const REQUIRE_CONSENT = ${consent.requireConsent !== false};
export const WALLET_REQUIRE_CONSENT = ${consent.walletRequireConsent === true};
export const CHECK_CONSENT_BY_DEFAULT = ${consent.checkConsentByDefault !== false};
export const LOCALE = '${cfg.locale || 'en'}';
export const REQUIRE_COUNTRY = ${cfg.nonComp?.requireCountry !== false};
`;
write(`${PREFIX}/payments/settings.ts`, settings);

// 3. Components — ALL methods (+ always Loader), regardless of product.json's `paymentMethods`.
// The panel's pageConfigs.paymentMethods now decides at RUNTIME which methods actually show
// (see getPaymentMethods() in paymentConfig.ts) — `methods` here is only the settings.ts
// dev-fallback default. Gating file generation on it would mean a page whose panel config
// later enables a method that wasn't scaffolded has no component to render.
write(`${PREFIX}/components/Loader.tsx`, fs.readFileSync(path.join(TPL, 'components/Loader.tsx'), 'utf8'));
copyTpl('components/CardForm.tsx', `${PREFIX}/components/CardForm.tsx`);
copyTpl('components/ConsentCheckboxes.tsx', `${PREFIX}/components/ConsentCheckboxes.tsx`);
copyTpl('components/ApplePayButton.tsx', `${PREFIX}/components/ApplePayButton.tsx`);
copyTpl('components/GooglePayButton.tsx', `${PREFIX}/components/GooglePayButton.tsx`);
// Non-comp creative funnel (always emitted; the page decides comp vs non-comp at runtime).
copyTpl('components/Creative.tsx', `${PREFIX}/components/Creative.tsx`);
copyTpl('components/NonComp.tsx', `${PREFIX}/components/NonComp.tsx`);
// Never-rendered i18n registry — keeps `checkout.*` ids that are only read via useTranslate()
// (attributes, alert() text, dynamic ids) visible to `yarn extract-messages`/`compile`, which
// otherwise silently drop anything it can't statically see as a literal <FormattedMessage>.
copyTpl('i18nDefaults.tsx', `${PREFIX}/i18nDefaults.tsx`);
// Bundled creative assets — copied into the project so the checkout is self-contained (no dependency
// on the base template's assets).
{
  const assetsSrc = path.join(TPL, 'assets');
  if (fs.existsSync(assetsSrc)) {
    for (const a of fs.readdirSync(assetsSrc)) {
      const dest = path.join(outDir, PREFIX, 'assets', a);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(assetsSrc, a), dest);
    }
    console.log(`  + ${PREFIX}/assets/ (bundled creative assets)`);
  }
}

// 4. Page + bootstrap. Prune imports for methods not selected.
let page = fs.readFileSync(path.join(TPL, 'PaymentPage.tsx'), 'utf8');
if (!methods.includes('applePay')) page = page.replace(/.*ApplePayButton.*\n/g, '');
if (!methods.includes('googlePay')) page = page.replace(/.*GooglePayButton.*\n/g, '');
if (!methods.includes('card')) page = page.replace(/.*CardForm.*\n/g, '');
write(`${PREFIX}/PaymentPage.tsx`, subst(page));

// 4b. Themed checkout stylesheet (always emitted, incl. embed — the checkout owns its own styles).
{
  const scss = fs.readFileSync(path.join(TPL, 'checkout.scss'), 'utf8').replace('{{THEME_ROOT}}', buildThemeRoot(brand));
  write(`${PREFIX}/checkout.scss`, scss);
}

// 4c. Per-product checkout copy/meta (logo, benefits, support, tagline, charge descriptor).
{
  const domain = cfg.productDomain || `${cfg.serviceId}.com`;
  const meta = {
    serviceName: cfg.serviceDisplayName || cfg.serviceId,
    logoSvg: brand.logoSvg || '',
    benefits: copy.benefits || ['Exclusive content', 'Ad-free!'],
    chargeDescriptor: copy.chargeDescriptor || String(cfg.serviceId || '').toUpperCase(),
    // The /xhosp page is served ON the product's own domain, so its chrome must read as the same
    // site. Support/company/legal details are the PRODUCT's real ones — harvest them from the live
    // product footer, never copy the reference page's. Defaults below are deliberately empty rather
    // than a plausible-looking placeholder: shipping the wrong merchant of record or an unrelated
    // support number is a compliance problem, and `cc-qa` treats a parent-company name in the
    // footer as a hard FAIL.
    supportPhone: copy.supportPhone || '',
    supportEmail: copy.supportEmail || `help@${domain}`,
    tagline: copy.tagline || 'Start Your Journey Today',
    blurb: copy.blurb || `${cfg.serviceDisplayName || cfg.serviceId} is your all-in-one platform — fast access, anytime, anywhere, with no commitment required.`,
    companyName: copy.companyName || '',
    companyAddress: copy.companyAddress || '',
    companyRegNo: copy.companyRegNo || '',
    // Relative by default: the page is proxied onto the product's own domain, so "/" is the product
    // home. An absolute default would violate the skill's own "Relative URLs only" rule and fail
    // cc-dynamic-lp's verify.
    siteUrl: copy.siteUrl || '/',
    siteLabel: copy.siteLabel || domain,
    copyright: copy.copyright || `© ${cfg.serviceDisplayName || cfg.serviceId}. All rights reserved.`,
    legalLinks: copy.legalLinks || []
  };
  write(`${PREFIX}/checkoutMeta.ts`, `// GENERATED by scaffold.mjs — per-product checkout copy/branding.\nexport const META = ${JSON.stringify(meta, null, 2)} as const;\n`);
}

// 5. Host-owned files (standalone only). In --embed mode the host project owns config.json,
//    theming, and the entry point, so skip them to avoid clobbering.
if (!EMBED) {
  copyTpl('bootstrap.tsx', `${PREFIX}/bootstrap.tsx`);
  copyTpl('styles/_variables.scss', `${PREFIX}/styles/_variables.scss`);
  copyTpl('config.json', 'config.json');
}

// 6. Dev-only fallback config (STANDALONE only). In --embed mode the host project owns the dev
//    config (e.g. cc-dynamic-lp injects it into index.html so it is excluded from the prod build),
//    so we do not emit a bundled .ts fallback here.
if (cfg.devFallbackPlan && !EMBED) {
  // A COMPLETE mock of pageConfigs so local dev satisfies both the checkout AND the host
  // template's RootContext (which reads service, cardMccInformation.mcc, flags, plan, env).
  // In production the backend injects window.configJson before the bundle, so this no-ops.
  const fallback = {
    pageConfigs: {
      slug: cfg.slug || '',
      gateway: cfg.gateway || '',
      service: { id: cfg.serviceId, displayName: cfg.serviceDisplayName },
      cardMccInformation: { mcc: cfg.mcc || cfg.serviceDisplayName || 'MCC NAME' },
      env: { page: cfg.pageName || cfg.serviceId },
      plan: { isLocalCurrency: false, ...cfg.devFallbackPlan },
      payments: {
        card: { bankId: cfg.bankId?.card },
        applePay: { bankId: cfg.bankId?.applePay, ...(cfg.applePay || {}) },
        googlePay: { bankId: cfg.bankId?.googlePay, ...(cfg.googlePay || {}) }
      },
      // Lowercase, 'ccsubmit' not 'card' — matches the live panel field exactly (see
      // getPaymentMethods() in paymentConfig.ts). Dev fallback only; real pages get this
      // injected by the backend from the panel's Payment Methods checkboxes.
      paymentMethods: methods.map((m) => (m === 'card' ? 'ccsubmit' : m.toLowerCase())),
      flags: { forceComp: false }
    }
  };
  write(
    `${PREFIX}/devFallbackConfig.ts`,
    `// DEV ONLY. In production the backend injects window.configJson before load; this is ignored then.
if (!(window as any).configJson) { (window as any).configJson = ${JSON.stringify(fallback, null, 2)}; }
export {};
`
  );
}

console.log('Done. Next: node scripts/verify.mjs --out ' + outDir);

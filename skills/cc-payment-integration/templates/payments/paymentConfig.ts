// Snapshot pageConfigs ONCE at module load, before anything can overwrite window.configJson.
// Every price/plan/service read goes through this snapshot — never hardcode prices.
import type { PageConfigs } from './types';

const snapshot: PageConfigs = (typeof window !== 'undefined' && window.configJson?.pageConfigs) || {};

export function getPageConfigs(): PageConfigs {
  return snapshot;
}

export function getPlan() {
  return snapshot.plan || {};
}

export function getService() {
  return snapshot.service || {};
}

export function getSlug(): string {
  return snapshot.slug || '';
}

export function getGateway(): string {
  return snapshot.gateway || '';
}

// Panel's live field is lowercase, no camelCase, and calls card 'ccsubmit' not 'card'
// (confirmed from the /dynamic-page-realtime-preview payload — not a guess). Map it to this
// module's internal 'applePay' | 'googlePay' | 'card' names. Falls back to the scaffold-time
// PAYMENT_METHODS constant (settings.ts) for pages saved before this field existed, or if the
// panel ever sends an empty/unrecognized list.
const METHOD_MAP: Record<string, 'applePay' | 'googlePay' | 'card'> = {
  applepay: 'applePay',
  googlepay: 'googlePay',
  ccsubmit: 'card'
};

export function getPaymentMethods(fallback: Array<'applePay' | 'googlePay' | 'card'>): Array<'applePay' | 'googlePay' | 'card'> {
  const raw = snapshot.paymentMethods;
  if (Array.isArray(raw) && raw.length) {
    const mapped = raw
      .map((m) => METHOD_MAP[String(m).toLowerCase()])
      .filter((m): m is 'applePay' | 'googlePay' | 'card' => Boolean(m));
    if (mapped.length) return mapped;
  }
  return fallback;
}

// Card shares the product bankId with the wallets; there is no card-specific bankId.
export function getBankId(method: 'card' | 'applePay' | 'googlePay'): string | number | undefined {
  const p = snapshot.payments || {};
  if (method === 'applePay') return p.applePay?.bankId ?? p.card?.bankId ?? p.googlePay?.bankId;
  if (method === 'googlePay') return p.googlePay?.bankId ?? p.card?.bankId ?? p.applePay?.bankId;
  return p.card?.bankId ?? p.applePay?.bankId ?? p.googlePay?.bankId;
}

export function getRockmanId(): string {
  return (typeof window !== 'undefined' && window.pac_analytics?.visitor?.rockmanId) || '';
}

export function getVisitorIp(): string {
  return (typeof window !== 'undefined' && window.pac_analytics?.visitor?.ip) || '';
}

// Currency-aware price formatter driven entirely by the snapshot.
export function formatPrice(value?: string): string {
  const cur = snapshot.plan?.currency || '€';
  if (value == null) return '—';
  return cur + String(value).replace('.', ',');
}

// ISO country from the ?d_country tracking param (wallets need a 2-letter country code).
export function getCountryCode(): string {
  const c =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('d_country')
      : null;
  return (c || 'US').toUpperCase();
}

// 3-letter currency code for the wallet APIs. plan.currency may be a code ('EUR') or a
// symbol ('€'); resolve to a code, defaulting to EUR.
const CURRENCY_SYMBOL_TO_CODE: Record<string, string> = { '€': 'EUR', $: 'USD', '£': 'GBP' };
export function getCurrencyCode(): string {
  const cur = snapshot.plan?.currency;
  if (cur && /^[A-Za-z]{3}$/.test(cur)) return cur.toUpperCase();
  return (cur && CURRENCY_SYMBOL_TO_CODE[cur]) || 'EUR';
}

// Google Pay environment: TEST locally (so the button renders in dev), PRODUCTION on the live
// domain. Override with ?gpay=test | ?gpay=production. Uses hostname (no build-time env needed).
export function googlePayEnvironment(): 'TEST' | 'PRODUCTION' {
  if (typeof window === 'undefined') return 'PRODUCTION';
  const p = new URLSearchParams(window.location.search).get('gpay');
  if (p === 'test') return 'TEST';
  if (p === 'production') return 'PRODUCTION';
  const h = window.location.hostname;
  const isDev = h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local');
  return isDev ? 'TEST' : 'PRODUCTION';
}

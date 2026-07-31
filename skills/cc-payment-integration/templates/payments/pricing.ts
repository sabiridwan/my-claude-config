// Country / currency / amount resolution for the wallets — replicates the reference
// useApplePayHandler / useGooglePayHandler exactly (currencyMap + per-country overrides + zero-trial).
import { getPlan } from './paymentConfig';
import { searchParams } from './params';

// From the reference utils/configs.ts — lowercase ISO country → currency code.
export const CURRENCY_MAP: Record<string, string> = {
  se: 'sek', no: 'nok', gb: 'gbp', dk: 'dkk', us: 'usd', sa: 'sar', ca: 'cad', pl: 'pln',
  ae: 'aed', qa: 'qar', kw: 'kwd', om: 'omr', bh: 'bhd', jo: 'jod', is: 'isk', au: 'aud', nz: 'nzd'
};

// Per-country wallet trial amount overrides, applied only when plan.isLocalCurrency.
const AMOUNT_OVERRIDES: Record<string, number> = {
  SA: 0.05, QA: 0.05, AE: 0.04, NO: 0.11, SE: 0.1, DK: 0.07, NZ: 0.02, IS: 1
};

// d_country: URL param, then the visitor's IP range, then a fallback (ES for Apple Pay in the ref).
export function resolveDCountry(fallback = 'ES'): string {
  const p = searchParams();
  const ip = (typeof window !== 'undefined' && window.pac_analytics?.visitor?.ip_range_name) || '';
  return p['d_country'] || ip || fallback;
}

export function walletCountryCode(fallback = 'ES'): string {
  return resolveDCountry(fallback).toUpperCase();
}

export function walletCurrencyCode(fallback = 'ES'): string {
  const dc = resolveDCountry(fallback).toLowerCase();
  const cur = getPlan().isLocalCurrency ? CURRENCY_MAP[dc] || 'EUR' : 'EUR';
  return cur.toUpperCase();
}

export function isZeroTrial(): boolean {
  const t = getPlan().trialPrice;
  return t === '0' || t === '0.0' || t === '0.00';
}

// Wallet trial amount (number). Uses the per-country override when isLocalCurrency, else trialPrice;
// zero-trial forces 0.
export function walletAmount(fallback = 'ES'): number {
  const plan = getPlan();
  const dc = resolveDCountry(fallback).toUpperCase();
  const base = plan.isLocalCurrency
    ? AMOUNT_OVERRIDES[dc] ?? parseFloat(plan.trialPrice || '0')
    : parseFloat(plan.trialPrice || '0');
  return isZeroTrial() ? 0 : base || 0;
}

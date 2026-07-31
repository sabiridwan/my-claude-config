// Direct card submit — replaces ouisys-engine/creditCardFlow.
// POST /api/v1/frontend/initiate-payment-generic  (see references/payment-architecture.md §2)
import { getSlug, getBankId, getRockmanId, getVisitorIp, getPlan } from './paymentConfig';
import { searchParams } from './params';
import type { CardUserDetails, PaymentResult } from './types';

// Platform-level set of currencies the gateway accepts for the local-currency slug suffix.
// Not product-specific; the panel decides PER PAGE whether local currency applies, via
// pageConfigs.plan.isLocalCurrency (read below).
const ALLOWED_CURRENCIES = ['sek', 'nok', 'gbp', 'dkk', 'usd', 'sar', 'cad', 'pln', 'aed'];

// Build the payment slug. Local-currency handling is driven ENTIRELY by config:
//   - pageConfigs.plan.isLocalCurrency  (the panel sets this per page), and
//   - the ?d_currency tracking param.
// ouisys-engine hardcoded an allowlist of specific product slugs here; that is product-specific
// and wrong for a per-project integration, so we read the config flag instead.
function resolveSlug(): string {
  const slug = getSlug();
  const p = searchParams();
  const country = (p['d_country'] || '').toLowerCase();
  const currency = (p['d_currency'] || '').toLowerCase();
  const isLocalCurrencyPage = getPlan().isLocalCurrency === true;
  const allowed = ALLOWED_CURRENCIES.some((c) => c === currency);
  if (isLocalCurrencyPage && currency && allowed) {
    return `${slug.slice(0, -1)}:${currency}-${country}`;
  }
  return `${slug}${country}`;
}

function browserFingerprint() {
  return {
    timezone: new Date().getTimezoneOffset(),
    browserColorDepth: window.screen.colorDepth,
    browserLanguage: navigator.language,
    browserScreenHeight: window.screen.height,
    browserScreenWidth: window.screen.width,
    userAgent: navigator.userAgent,
    browserJavaEnabled: navigator.javaEnabled ? navigator.javaEnabled() : false,
    browserJavascriptEnabled: true
  };
}

export async function submitCard(
  userDetails: CardUserDetails,
  opts: { serviceId?: string } = {}
): Promise<PaymentResult> {
  const host = window.DEV_BASE_URL_CREDIT_CARD || '';
  const url = `${host}/api/v1/frontend/initiate-payment-generic`;
  const isMaxPay = 'cc_number' in userDetails;

  const bankId = getBankId('card');
  const body: Record<string, unknown> = {
    rockman_id: getRockmanId(),
    landing_page_url: window.location.href,
    service_id: isMaxPay ? opts.serviceId : '2',
    slug: resolveSlug(),
    browserFingerprint: browserFingerprint(),
    ...(isMaxPay ? {} : { user_agent: navigator.userAgent, ip: getVisitorIp() }),
    ...userDetails,
    ...(bankId != null ? { bankId } : {})
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return (await res.json()) as PaymentResult;
}

// Resolve the outcome: fire callbacks, then redirect (unless 3-DS html is returned).
export function handleCardResult(
  result: PaymentResult,
  cb: { onSuccess?: (r: PaymentResult) => void; onError?: (r: PaymentResult) => void; onHtml?: (html: string) => void }
): void {
  if (result.success === false) {
    cb.onError?.(result);
    return;
  }
  if (result.method === 'html' && result.html) {
    cb.onHtml?.(result.html); // render inline 3-DS iframe; do NOT navigate away
    return;
  }
  cb.onSuccess?.(result);
  const target = result.gateway_url || result.redirect_url || result.product_url;
  if (target) window.location.href = target;
}

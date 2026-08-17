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
  // fetch RESOLVES on 4xx/5xx (unlike axios, which rejects) — an unchecked response can be parsed
  // as a success payload, or .json() can throw on a non-JSON error body. Verified against a real
  // incident: cc-dynamic-xracademy-ccsubmit-template-noncomp commit 619b519.
  if (!res.ok) return { success: false, message: 'http-error' } as PaymentResult;
  return (await res.json()) as PaymentResult;
}

// Resolve the outcome: fire callbacks, then redirect (unless 3-DS html or a script
// link is returned).
export function handleCardResult(
  result: PaymentResult,
  cb: {
    onSuccess?: (r: PaymentResult) => void;
    onError?: (r: PaymentResult) => void;
    onHtml?: (html: string) => void;
    onScript?: (url: string) => void;
  }
): void {
  // `state` outranks an explicit `success: false`. The already-subscribed outcome
  // reports `success: false` (no NEW charge) but `state: 'success'` plus a usable
  // redirect target — gating on `success` alone shows "payment failed" to a valid
  // customer and strands them on the form. Captured live on maxpay:
  //   { success: false, state: 'success', method: 'redirection', product_url: 'https://…' }
  // Only an explicit `success: false` WITHOUT a succeeding `state` is a real decline.
  const stateSucceeded = typeof result.state === 'string' && result.state.toLowerCase() === 'success';
  if (result.success === false && !stateSucceeded) {
    cb.onError?.(result);
    return;
  }

  // Engine parity: an explicit `redirect_url` overrides whatever `method` says.
  const method = result.redirect_url ? 'redirection' : result.method;

  if (method === 'html' && result.html) {
    cb.onHtml?.(result.html); // render inline 3-DS iframe; do NOT navigate away
    return;
  }

  const target = result.gateway_url || result.redirect_url || result.product_url;

  // `jslink` hands back a SCRIPT url, not a page. Assigning it to location.href
  // downloads a file or shows a blank page — which reads to the customer exactly
  // like "payment succeeded but nothing happened". Inject it as a <script src>.
  if (method === 'jslink' && target) {
    cb.onScript?.(target);
    return;
  }

  cb.onSuccess?.(result);
  if (target) window.location.href = target;
}

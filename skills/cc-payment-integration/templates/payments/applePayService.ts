// Apple Pay — ap-validate + ap-payment (see references/payment-architecture.md §3)
import { getSlug, getBankId, getRockmanId } from './paymentConfig';
import { isPreauth, splitParam, antifraudSessionId } from './params';
import type { PaymentResult } from './types';

export async function validateMerchant(validationURL: string, locale = 'en'): Promise<any> {
  const sessionId = antifraudSessionId();
  const res = await fetch('/api/v1/frontend/ap-validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      validationURL,
      rockmanId: getRockmanId(),
      slug: getSlug(),
      bankId: getBankId('applePay'),
      ...(isPreauth() ? { is_preauth: 1 } : {}),
      ...(sessionId ? { antifraud_session_id: sessionId } : {})
    })
  });
  // Same non-2xx trap as the payment calls below. This one THROWS rather than returning an error
  // object: the caller hands the result straight to Apple's completeMerchantValidation(), which
  // rejects an error payload in a way the session cannot recover from — the caller's catch needs to
  // run instead.
  if (!res.ok) throw new Error(`ap-validate failed: ${res.status}`);
  return res.json();
}

export async function processApplePayment(payment: any, locale = 'en'): Promise<PaymentResult> {
  const sessionId = antifraudSessionId();
  const split = splitParam();
  const res = await fetch('/api/v1/frontend/ap-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payment,
      rockmanId: getRockmanId(),
      slug: getSlug(),
      bankId: getBankId('applePay'),
      locale,
      shippingContact: payment.shippingContact,
      token: payment.token,
      ...(split ? { split } : {}),
      ...(isPreauth() ? { is_preauth: 1 } : {}),
      ...(sessionId ? { antifraud_session_id: sessionId } : {})
    })
  });
  // fetch resolves on 4xx/5xx — without this, a failed payment is parsed as a success payload.
  if (!res.ok) return { success: false, message: 'http-error' } as PaymentResult;
  const result = (await res.json()) as PaymentResult;
  redirectFromWallet(result);
  return result;
}

export function redirectFromWallet(result: PaymentResult): void {
  const target = result.redirect_url || result.gateway_url || result.product_url;
  if (target) window.location.href = target;
}

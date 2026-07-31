// Google Pay — gp-payment (see references/payment-architecture.md §4)
import { getSlug, getBankId, getRockmanId, getPageConfigs } from './paymentConfig';
import { isPreauth, splitParam, antifraudSessionId } from './params';
import { redirectFromWallet } from './applePayService';
import type { PaymentResult } from './types';

// Build the Google Pay isReadyToPay / payment request from the snapshot config.
export function googlePaymentRequestBase() {
  const gp = getPageConfigs().payments?.googlePay || {};
  return {
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: [
      {
        type: 'CARD',
        parameters: {
          allowedAuthMethods: gp.allowedAuthMethods || ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
          allowedCardNetworks: gp.allowedCardNetworks || ['MASTERCARD', 'VISA']
        },
        tokenizationSpecification: {
          type: 'PAYMENT_GATEWAY',
          parameters: {
            gateway: gp.gateway || '',
            gatewayMerchantId: gp.gatewayMerchantId || ''
          }
        }
      }
    ],
    merchantInfo: gp.merchantInfo || {}
  };
}

export async function processGooglePayment(paymentData: any, locale = 'en'): Promise<PaymentResult> {
  const sessionId = antifraudSessionId();
  const split = splitParam();
  const res = await fetch('/api/v1/frontend/gp-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...paymentData,
      rockmanId: getRockmanId(),
      slug: getSlug(),
      bankId: getBankId('googlePay'),
      locale,
      ...(split ? { split } : {}),
      ...(isPreauth() ? { is_preauth: 1 } : {}),
      ...(sessionId ? { antifraud_session_id: sessionId } : {})
    })
  });
  const result = (await res.json()) as PaymentResult;
  redirectFromWallet(result);
  return result;
}

// Imperative wallet triggers — used by the non-comp creative (tap → Apple/Google Pay) and reused by
// the wallet buttons. Non-comp is device-detected to iOS + Apple Pay, so Apple Pay is the primary
// path with Google Pay as the fallback.
import { validateMerchant, processApplePayment } from './applePayService';
import { googlePaymentRequestBase, processGooglePayment } from './googlePayService';
import { getPageConfigs, getPlan, googlePayEnvironment } from './paymentConfig';
import { walletCountryCode, walletCurrencyCode, walletAmount } from './pricing';
import { LOCALE } from './settings';
import type { PaymentResult } from './types';

const APPLE_PAY_SDK = 'https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js';

// Load Apple's SDK so window.ApplePaySession is defined on desktop Chrome too (QR flow).
export function ensureApplePaySDK(): void {
  if (typeof window === 'undefined' || (window as any).ApplePaySession) return;
  if (document.querySelector('script[data-apple-pay-sdk]')) return;
  const s = document.createElement('script');
  s.src = APPLE_PAY_SDK;
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.setAttribute('data-apple-pay-sdk', '1');
  document.head.appendChild(s);
}

export function isApplePayDevice(): boolean {
  return typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent);
}

type Cbs = { onSuccess?: (r: PaymentResult) => void; onError?: (e: unknown) => void };

// Start the Apple Pay sheet (or QR on desktop Chrome). Returns false if it can't run here.
export function startApplePay(cb: Cbs = {}): boolean {
  const APS = (window as any).ApplePaySession;
  if (!APS || window.location.protocol !== 'https:') return false;
  const ap = getPageConfigs().payments?.applePay || {};
  const request = {
    countryCode: walletCountryCode('ES'),
    currencyCode: walletCurrencyCode('ES'),
    supportedNetworks: ap.supportedNetworks || ['visa', 'masterCard'],
    merchantCapabilities: ap.merchantCapabilities || ['supports3DS', 'supportsDebit', 'supportsCredit'],
    requiredShippingContactFields: ['email'],
    total: { label: ap.label || 'Subscription', amount: String(walletAmount('ES')) }
  };
  try {
    const session = new APS(3, request);
    session.onvalidatemerchant = async (event: any) => {
      const merchantSession = await validateMerchant(event.validationURL, LOCALE);
      session.completeMerchantValidation(merchantSession);
    };
    session.onpaymentauthorized = async (event: any) => {
      try {
        const r = await processApplePayment(event.payment, LOCALE);
        session.completePayment(APS.STATUS_SUCCESS);
        cb.onSuccess?.(r);
      } catch (e) {
        session.completePayment(APS.STATUS_FAILURE);
        cb.onError?.(e);
      }
    };
    session.begin();
    return true;
  } catch (e) {
    cb.onError?.(e);
    return false;
  }
}

// Start Google Pay (loads pay.js, probes, opens the sheet). Returns true if the sheet opened.
export async function startGooglePay(cb: Cbs = {}): Promise<boolean> {
  const google = await ensureGooglePaySDK();
  if (!google?.payments?.api) return false;
  const client = new google.payments.api.PaymentsClient({ environment: googlePayEnvironment() });
  const base = googlePaymentRequestBase();
  try {
    const ready = await client.isReadyToPay({
      apiVersion: base.apiVersion,
      apiVersionMinor: base.apiVersionMinor,
      allowedPaymentMethods: base.allowedPaymentMethods.map((m: any) => ({ type: m.type, parameters: m.parameters }))
    });
    if (!ready?.result) return false;
    const gp = getPageConfigs().payments?.googlePay || {};
    const paymentData = await client.loadPaymentData({
      ...base,
      transactionInfo: {
        totalPriceStatus: gp.totalPriceStatus || 'FINAL',
        totalPrice: String(walletAmount('NL')),
        currencyCode: walletCurrencyCode('NL'),
        countryCode: walletCountryCode('NL')
      }
    });
    const r = await processGooglePayment(paymentData, LOCALE);
    cb.onSuccess?.(r);
    return true;
  } catch (e) {
    cb.onError?.(e);
    return false;
  }
}

function ensureGooglePaySDK(): Promise<any> {
  return new Promise((resolve) => {
    const w = window as any;
    if (w.google?.payments?.api) return resolve(w.google);
    const s = document.createElement('script');
    s.src = 'https://pay.google.com/gp/p/js/pay.js';
    s.async = true;
    s.onload = () => resolve((window as any).google);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

// The non-comp tap handler: Apple Pay on Apple devices, else Google Pay.
export async function triggerWalletPayment(cb: Cbs = {}): Promise<void> {
  if ((window as any).ApplePaySession && startApplePay(cb)) return;
  const ok = await startGooglePay(cb);
  if (!ok) cb.onError?.(new Error('No wallet available'));
}

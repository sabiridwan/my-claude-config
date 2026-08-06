import React, { useEffect } from 'react';
import { validateMerchant, processApplePayment } from '../payments/applePayService';
import { getPageConfigs } from '../payments/paymentConfig';
import { walletCountryCode, walletCurrencyCode, walletAmount } from '../payments/pricing';
import { LOCALE } from '../payments/settings';
import { useTranslate } from '../../localization';

// Store-standard Apple Pay button — always visible, and works on Chrome too via the QR / cross-device
// flow. That flow needs Apple's JS SDK: once loaded it defines window.ApplePaySession even on desktop
// Chrome, so session.begin() renders the QR sheet (in Safari it renders the normal sheet).
// Apple Pay only runs over HTTPS with a registered merchant domain — so on http://localhost it can't,
// but on the deployed https page it shows the QR in Chrome / the sheet in Safari.
const APPLE_PAY_SDK = 'https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js';

export default function ApplePayButton() {
  const t = useTranslate();
  const ap = getPageConfigs().payments?.applePay || {};

  useEffect(() => {
    if (typeof window === 'undefined' || (window as any).ApplePaySession) return; // Safari already has it
    if (document.querySelector('script[data-apple-pay-sdk]')) return;
    const s = document.createElement('script');
    s.src = APPLE_PAY_SDK;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.setAttribute('data-apple-pay-sdk', '1');
    document.head.appendChild(s);
  }, []);

  function onClick() {
    const APS = (window as any).ApplePaySession;
    if (window.location.protocol !== 'https:') {
      // eslint-disable-next-line no-alert
      alert(t('checkout.applePayNeedsHttps'));
      return;
    }
    if (!APS) {
      // eslint-disable-next-line no-alert
      alert(t('checkout.applePayInitializing'));
      return;
    }
    const request = {
      countryCode: walletCountryCode('ES'),
      currencyCode: walletCurrencyCode('ES'),
      supportedNetworks: ap.supportedNetworks || ['visa', 'masterCard'],
      merchantCapabilities: ap.merchantCapabilities || ['supports3DS', 'supportsDebit', 'supportsCredit'],
      requiredShippingContactFields: ['email'],
      total: { label: ap.label || 'Subscription', amount: String(walletAmount('ES')) }
    };
    const session = new APS(3, request); // on desktop Chrome this renders the QR sheet
    session.onvalidatemerchant = async (event: any) => {
      const merchantSession = await validateMerchant(event.validationURL, LOCALE);
      session.completeMerchantValidation(merchantSession);
    };
    session.onpaymentauthorized = async (event: any) => {
      try {
        await processApplePayment(event.payment, LOCALE);
        session.completePayment(APS.STATUS_SUCCESS);
      } catch {
        session.completePayment(APS.STATUS_FAILURE);
      }
    };
    session.begin();
  }

  return (
    <button type="button" className="cc-wallet-btn cc-wallet-btn--apple" onClick={onClick} aria-label={t('checkout.subscribeWithApplePayAria')}>
      <span>{t('checkout.subscribeWith')}</span>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
        <path d="M17.05 12.5c0-2 1.6-2.9 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.2 2-1.4 2.4-.4 6 1 8 .6 1 1.4 2 2.4 2 .9 0 1.3-.6 2.4-.6 1.1 0 1.4.6 2.4.6 1 0 1.6-.9 2.2-1.9.7-1 1-2 1-2.1-.1 0-2-.8-1.9-3zM15.3 6.3c.5-.6.9-1.5.8-2.3-.8 0-1.7.5-2.2 1.1-.5.5-.9 1.4-.8 2.2.9.1 1.8-.4 2.2-1z" />
      </svg>
      <span>{t('checkout.walletPay')}</span>
    </button>
  );
}

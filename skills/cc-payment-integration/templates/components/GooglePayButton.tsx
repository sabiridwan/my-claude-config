import React, { useEffect, useRef, useState } from 'react';
import { googlePaymentRequestBase, processGooglePayment } from '../payments/googlePayService';
import { getPageConfigs, googlePayEnvironment } from '../payments/paymentConfig';
import { walletCurrencyCode, walletCountryCode, walletAmount } from '../payments/pricing';
import { LOCALE } from '../payments/settings';

// Uses the OFFICIAL Google Pay button via client.createButton() (store-standard styling) instead of
// a custom <button>. Loads pay.js, probes isReadyToPay, then injects the real button into a host div.
const GPAY_SDK = 'https://pay.google.com/gp/p/js/pay.js';

export default function GooglePayButton() {
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const clientRef = useRef<any>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  function onClick() {
    const client = clientRef.current;
    if (!client) return;
    const base = googlePaymentRequestBase();
    const gp = getPageConfigs().payments?.googlePay || {};
    client
      .loadPaymentData({
        ...base,
        transactionInfo: {
          totalPriceStatus: gp.totalPriceStatus || 'FINAL',
          totalPrice: String(walletAmount('NL')),
          currencyCode: walletCurrencyCode('NL'),
          countryCode: walletCountryCode('NL')
        }
      })
      .then((paymentData: any) => processGooglePayment(paymentData, LOCALE))
      .catch(() => {});
  }

  useEffect(() => {
    let cancelled = false;
    function init() {
      const google = (window as any).google;
      if (!google?.payments?.api) { setState('unavailable'); return; }
      const client = new google.payments.api.PaymentsClient({ environment: googlePayEnvironment() });
      const base = googlePaymentRequestBase();
      client
        .isReadyToPay({
          apiVersion: base.apiVersion,
          apiVersionMinor: base.apiVersionMinor,
          allowedPaymentMethods: base.allowedPaymentMethods.map((m: any) => ({ type: m.type, parameters: m.parameters }))
        })
        .then((res: any) => {
          if (cancelled) return;
          if (res.result) { clientRef.current = client; setState('ready'); }
          else setState('unavailable');
        })
        .catch(() => { if (!cancelled) setState('unavailable'); });
    }
    if ((window as any).google?.payments?.api) init();
    else {
      const s = document.createElement('script');
      s.src = GPAY_SDK; s.async = true; s.onload = init;
      s.onerror = () => setState('unavailable');
      document.head.appendChild(s);
    }
    return () => { cancelled = true; };
  }, []);

  // Inject the official Google Pay button once ready.
  useEffect(() => {
    if (state !== 'ready' || !hostRef.current || !clientRef.current) return;
    try {
      const btn = clientRef.current.createButton({
        onClick,
        buttonType: 'subscribe',
        buttonColor: 'black',
        buttonSizeMode: 'fill'
      });
      hostRef.current.innerHTML = '';
      hostRef.current.appendChild(btn);
    } catch {
      /* createButton unavailable — leave host empty */
    }
  }, [state]);

  if (state === 'loading') return <p className="cc-wallet-note">Loading Google Pay…</p>;
  if (state === 'unavailable') return <p className="cc-wallet-note">Google Pay isn't available in this browser.</p>;
  return <div ref={hostRef} className="cc-gpay-host" />;
}

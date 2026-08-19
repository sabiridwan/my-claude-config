import React, { useEffect, useState } from 'react';
import Creative from './Creative';
import { triggerWalletPayment, ensureApplePaySDK } from '../payments/walletActions';
import { getService } from '../payments/paymentConfig';
import { tracker } from '../payments/tracker';

// The non-comp funnel: a full-area creative that, on tap, triggers the wallet payment (Apple Pay on
// Apple devices, else Google Pay). Shown when the page resolves to non-comp (device-detected iOS +
// Apple Pay outside India, or ?non-comp=true). The whole area is the tap target, matching the
// reference download template. No header/logo by default — reads as an OS/app-install surface, not
// the branded checkout.
export default function NonComp() {
  const [busy, setBusy] = useState(false);
  const service = getService();

  useEffect(() => {
    ensureApplePaySDK();
    tracker.customEvent('checkout', 'noncomp_view', service.id, {});
  }, []);

  function onContinue() {
    if (busy) return;
    setBusy(true);
    // Step 1 of the funnel — the glossary's `PreFlow:advance:step1`, "user clicks the
    // prelander CTA". This is what separates "saw the creative" from "wanted to buy";
    // without it a dead CTA and disinterested traffic look identical in reporting.
    // Fired before the wallet call so the intent is counted even when no sheet opens.
    tracker.advancedInPreFlow('step1');
    tracker.customEvent('pre-user-details-entry-state', 'continue-clicked', 'continue-button');
    triggerWalletPayment({
      onSuccess: () => tracker.customEvent('checkout', 'payment_success', service.id, { flow: 'noncomp' }),
      onError: () => setBusy(false)
    });
  }

  return (
    <div className="cc-noncomp" onClick={onContinue}>
      <Creative onContinue={onContinue} isLoading={busy} />
    </div>
  );
}

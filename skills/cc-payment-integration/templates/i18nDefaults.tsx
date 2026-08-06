import React from 'react';
import { FormattedMessage } from '../localization';

// Never rendered/imported anywhere — exists purely so `yarn extract-messages` /
// `yarn compile` (formatjs) can see every `checkout.*` id used only via `useTranslate()`
// (attributes: placeholder, aria-label, alert() text; a dynamic `id` expression like
// `LABEL[m]`; or copy computed in JS before being interpolated elsewhere). Those calls
// aren't statically analyzable — `<FormattedMessage>` only extracts a literal `id`/
// `defaultMessage` pair, and useTranslate() isn't a pattern formatjs recognizes — so
// without this file, `compile` silently drops these ids from translations/en.json on the
// next `yarn dev`, which breaks the TranslationKeys type and blanks the copy at runtime.
// Keep every id here in sync with its real `t('...')` call site.
export function CheckoutI18nDefaults() {
  return (
    <>
      <FormattedMessage id="checkout.methodCard" defaultMessage="Card" />
      <FormattedMessage id="checkout.methodApplePay" defaultMessage="Apple Pay" />
      <FormattedMessage id="checkout.methodGooglePay" defaultMessage="Google Pay" />
      <FormattedMessage id="checkout.trialLabelDays" defaultMessage="{days}-day trial" />
      <FormattedMessage id="checkout.trialLabelGeneric" defaultMessage="trial" />
      <FormattedMessage id="checkout.cardholderNamePlaceholder" defaultMessage="Name on card" />
      <FormattedMessage id="checkout.cardNumberPlaceholder" defaultMessage="1234 1234 1234 1234" />
      <FormattedMessage id="checkout.expiryPlaceholder" defaultMessage="MM / YY" />
      <FormattedMessage id="checkout.cvcPlaceholder" defaultMessage="CVC" />
      <FormattedMessage id="checkout.emailPlaceholder" defaultMessage="you@example.com" />
      <FormattedMessage id="checkout.startTrial" defaultMessage="Start my trial" />
      <FormattedMessage id="checkout.processing" defaultMessage="Processing…" />
      <FormattedMessage id="checkout.consentRequiredError" defaultMessage="Please accept the terms to continue." />
      <FormattedMessage id="checkout.paymentFailedDefault" defaultMessage="Payment failed" />
      <FormattedMessage id="checkout.networkError" defaultMessage="Network error, please try again." />
      <FormattedMessage id="checkout.subscribeWith" defaultMessage="Subscribe with" />
      <FormattedMessage id="checkout.walletPay" defaultMessage="Pay" />
      <FormattedMessage id="checkout.applePayNeedsHttps" defaultMessage="Apple Pay needs HTTPS. On the deployed page it shows a QR code in Chrome and the Apple Pay sheet in Safari — it just can't run on http://localhost." />
      <FormattedMessage id="checkout.applePayInitializing" defaultMessage="Apple Pay is still initialising — please try again in a moment." />
      <FormattedMessage id="checkout.subscribeWithApplePayAria" defaultMessage="Subscribe with Apple Pay" />
      <FormattedMessage id="checkout.googlePayLoading" defaultMessage="Loading Google Pay…" />
      <FormattedMessage id="checkout.googlePayUnavailable" defaultMessage="Google Pay isn't available in this browser." />
      <FormattedMessage id="checkout.creativeMsg1" defaultMessage="Preparing your access…" />
      <FormattedMessage id="checkout.creativeMsg2" defaultMessage="Verifying availability…" />
      <FormattedMessage id="checkout.creativeMsg3" defaultMessage="Securing your connection…" />
      <FormattedMessage id="checkout.creativeMsg4" defaultMessage="Almost there…" />
      <FormattedMessage id="checkout.creativeCta" defaultMessage="Get access now" />
    </>
  );
}

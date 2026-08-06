import React, { useState } from 'react';
import { submitCard, handleCardResult } from '../payments/cardService';
import { getService } from '../payments/paymentConfig';
import { REQUIRE_CONSENT, CHECK_CONSENT_BY_DEFAULT } from '../payments/settings';
import type { CardUserDetails, PaymentResult } from '../payments/types';
import { FormattedMessage, useTranslate } from '../../localization';

interface Props {
  onSuccess?: (r: PaymentResult) => void;
  onError?: (r: PaymentResult) => void;
}

// Self-contained card form styled to the reference /xhosp layout (cc- classes).
// Posts via the direct card service; handles success/redirect + inline 3-DS.
export default function CardForm({ onSuccess, onError }: Props) {
  const t = useTranslate();
  const [consent, setConsent] = useState(!REQUIRE_CONSENT || CHECK_CONSENT_BY_DEFAULT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threeDsHtml, setThreeDsHtml] = useState<string | null>(null);
  const service = getService();

  function fmtNumber(e: React.FormEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    el.value = el.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  }
  function fmtExp(e: React.FormEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const v = el.value.replace(/\D/g, '').slice(0, 4);
    el.value = v.length > 2 ? v.slice(0, 2) + ' / ' + v.slice(2) : v;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (REQUIRE_CONSENT && !consent) { setError(t('checkout.consentRequiredError')); return; }
    setSubmitting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const [mm, yy] = String(form.get('exp') || '').split('/').map((s) => s.trim());
    const userDetails: CardUserDetails = {
      number: String(form.get('number') || '').replace(/\s/g, ''),
      month: mm, year: yy,
      cvv: String(form.get('cvc') || ''),
      email: String(form.get('email') || '')
    };
    try {
      const result = await submitCard(userDetails, { serviceId: service.id });
      handleCardResult(result, {
        onSuccess: (r) => onSuccess?.(r),
        onError: (r) => { setError(r.message || t('checkout.paymentFailedDefault')); onError?.(r); },
        onHtml: (html) => setThreeDsHtml(html)
      });
    } catch {
      setError(t('checkout.networkError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (threeDsHtml) return <iframe className="cc-threeds" title="3-D Secure" srcDoc={threeDsHtml} />;

  return (
    <form onSubmit={onSubmit}>
      <div className="cc-field">
        <label><FormattedMessage id="checkout.cardholderNameLabel" /></label>
        <input name="name" type="text" placeholder={t('checkout.cardholderNamePlaceholder')} autoComplete="cc-name" required />
      </div>
      <div className="cc-field">
        <label><FormattedMessage id="cardNumberLabel" /></label>
        <input name="number" inputMode="numeric" placeholder={t('checkout.cardNumberPlaceholder')} autoComplete="cc-number" maxLength={19} onInput={fmtNumber} required />
      </div>
      <div className="cc-two">
        <div className="cc-field"><label><FormattedMessage id="expDate" /></label><input name="exp" inputMode="numeric" placeholder={t('checkout.expiryPlaceholder')} autoComplete="cc-exp" maxLength={7} onInput={fmtExp} required /></div>
        <div className="cc-field"><label><FormattedMessage id="cvvLabel" /></label><input name="cvc" inputMode="numeric" placeholder={t('checkout.cvcPlaceholder')} autoComplete="cc-csc" maxLength={4} required /></div>
      </div>
      <div className="cc-field"><label><FormattedMessage id="checkout.emailLabel" /></label><input name="email" type="email" placeholder={t('checkout.emailPlaceholder')} autoComplete="email" required /></div>
      {REQUIRE_CONSENT && (
        <label className="cc-consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span><FormattedMessage id="checkout.consentPrefix" /> <a href="#"><FormattedMessage id="terms-conditions" /></a> <FormattedMessage id="checkout.consentSuffix" /></span>
        </label>
      )}
      {error && <p className="cc-form-error">{error}</p>}
      <button className="cc-pay-btn" type="submit" disabled={submitting}>{submitting ? t('checkout.processing') : t('checkout.startTrial')}</button>
    </form>
  );
}

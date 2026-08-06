import React, { useEffect, useMemo, useState } from 'react';
import './checkout.scss';
import { getService, getPlan, formatPrice } from './payments/paymentConfig';
import { PAYMENT_METHODS } from './payments/settings';
import { decideComp, confirmMode } from './payments/resolveMode';
import { tracker } from './payments/tracker';
import type { PaymentResult } from './payments/types';
import { META } from './checkoutMeta';
import CardForm from './components/CardForm';
import ApplePayButton from './components/ApplePayButton';
import GooglePayButton from './components/GooglePayButton';
import NonComp from './components/NonComp';
import { FormattedMessage, useTranslate } from '../localization';
import type { TranslationKeys } from '../localization';

// Layout follows the reference Ouisys /xhosp page (header → Finish your Registration →
// payment-method selector → trust sections → order summary → footer). Theme comes entirely
// from checkout.scss (product brand). Prices/service come from pageConfigs — never hardcoded.
//
// All copy renders through <FormattedMessage>/useTranslate() from src/localization, keyed off
// RootContext's `locale` — which is already browser-auto-detected by RootContext's langDetection()
// (see src/providers/RootContext.tsx) and overridable via ?locale=. Add new checkout.* ids to
// src/localization/translations/en.json (required — TranslationKeys is derived from it) before
// using them; other locale files fall back to the English default until translated, same as the
// rest of the page's copy.
type Method = 'card' | 'applePay' | 'googlePay';
const LABEL: Record<Method, TranslationKeys> = {
  card: 'checkout.methodCard',
  applePay: 'checkout.methodApplePay',
  googlePay: 'checkout.methodGooglePay'
};

export default function PaymentPage() {
  const t = useTranslate();
  const service = getService();
  const plan = getPlan();
  const name = service.displayName || META.serviceName;
  const trialLabel = plan.trialDays
    ? t('checkout.trialLabelDays', { days: plan.trialDays })
    : t('checkout.trialLabelGeneric');

  const methods = (PAYMENT_METHODS as Method[]);
  // Default to Card (like the reference) — wallets hide themselves when unavailable, so a
  // wallet default would show an empty body on desktop/Chrome.
  const [active, setActive] = useState<Method>(methods.includes('card') ? 'card' : methods[0] || 'card');

  // Comp vs non-comp — decided synchronously (no flash), then confirmed by the wallet probe.
  const [showComp, setShowComp] = useState<boolean>(() => decideComp());
  useEffect(() => {
    confirmMode().then((r) => { if (!r.pending) setShowComp(!r.nonComp); }).catch(() => {});
  }, []);

  const onSuccess = (r: PaymentResult) => tracker.customEvent('checkout', 'payment_success', service.id, {});
  const onError = (r: PaymentResult) => tracker.customEvent('checkout', 'payment_error', service.id, { message: r.message });

  const methodBody = useMemo(() => {
    if (active === 'card') return <CardForm onSuccess={onSuccess} onError={onError} />;
    if (active === 'applePay') return <ApplePayButton />;
    return <GooglePayButton />;
  }, [active]);

  // Non-comp: the creative funnel replaces the comp checkout entirely.
  if (!showComp) {
    return (
      <div className="cc-checkout">
        <NonComp />
      </div>
    );
  }

  return (
    <div className="cc-checkout">
      <header className="cc-head">
        <div className="cc-head__in">
          <div className="cc-logo" dangerouslySetInnerHTML={{ __html: META.logoSvg + name }} />
          <div className="cc-secure">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
            <FormattedMessage id="checkout.secureCheckout" />
          </div>
        </div>
      </header>

      <div className="cc-wrap">
        {/* LEFT */}
        <div>
          <div className="cc-card cc-pad">
            <h1 className="cc-title"><FormattedMessage id="checkout.finishRegistration" /></h1>
            <div className="cc-trial">{formatPrice(plan.trialPrice)} / {trialLabel}</div>
            <p className="cc-terms">
              <FormattedMessage
                id="checkout.subscriptionTerms"
                values={{ trialPrice: formatPrice(plan.trialPrice), trialLabel, fullPrice: formatPrice(plan.fullPrice) }}
              />
            </p>

            <h2 className="cc-pick"><FormattedMessage id="checkout.selectPaymentMethod" /></h2>
            <div className="cc-methods">
              {methods.map((m) => (
                <div
                  key={m}
                  className={'cc-method' + (active === m ? ' cc-method--active' : '')}
                  onClick={() => setActive(m)}
                >
                  <FormattedMessage id={LABEL[m]} />
                </div>
              ))}
            </div>

            <div className="cc-form">{methodBody}</div>

            <p className="cc-valueprop">
              <FormattedMessage
                id="checkout.valueProp"
                values={{ trialLabel, trialPrice: formatPrice(plan.trialPrice), name, fullPrice: formatPrice(plan.fullPrice) }}
              />
            </p>
          </div>

          <div className="cc-info">
            <div><h4><FormattedMessage id="checkout.infoSafeTitle" /></h4><p><FormattedMessage id="checkout.infoSafeDesc" /></p></div>
            <div><h4><FormattedMessage id="checkout.infoBillingTitle" /></h4><p><FormattedMessage id="checkout.infoBillingDesc" /></p></div>
            <div><h4><FormattedMessage id="checkout.infoSignupTitle" /></h4><ul>{META.benefits.map((b, i) => <li key={i}>{b}</li>)}</ul></div>
            <div><h4><FormattedMessage id="checkout.infoAccessTitle" /></h4><p><FormattedMessage id="checkout.infoAccessDesc" /></p></div>
            <div>
              <h4><FormattedMessage id="checkout.infoCancelTitle" /></h4>
              <p><FormattedMessage id="checkout.infoCancelDesc" /></p>
              <p className="cc-terms">
                <FormattedMessage id="checkout.infoCancelStatement" values={{ name, descriptor: META.chargeDescriptor }} />{' '}
                <a href={`tel:${META.supportPhone}`}>{META.supportPhone}</a>
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="cc-summary-col">
          <div className="cc-card cc-pad cc-sum">
            <h3><FormattedMessage id="checkout.finishRegistration" /></h3>
            <p className="cc-terms">
              <FormattedMessage
                id="checkout.summaryTerms"
                values={{ trialPrice: formatPrice(plan.trialPrice), trialLabel, fullPrice: formatPrice(plan.fullPrice) }}
              />
            </p>
            <div className="cc-sum__row" style={{ marginTop: 10 }}>
              <div>
                <div className="cc-sum__name">{name}</div>
                <div className="cc-sum__permo"><FormattedMessage id="checkout.summaryPerMonth" values={{ trialLabel }} /></div>
              </div>
              <div className="cc-sum__price">{formatPrice(plan.fullPrice)}</div>
            </div>
            <div className="cc-sum__try">
              <FormattedMessage id="checkout.summaryTry" values={{ days: plan.trialDays || 1, trialPrice: formatPrice(plan.trialPrice) }} />
            </div>
            <div className="cc-sum__row cc-sum__total"><span><FormattedMessage id="checkout.summaryTotal" /></span><span>{formatPrice(plan.trialPrice)}</span></div>
            <div className="cc-sum__links">
              <a href="#"><FormattedMessage id="checkout.faqLink" /></a>
              <span className="cc-guar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg><FormattedMessage id="checkout.guaranteeText" /></span>
            </div>
          </div>
          <div className="cc-card cc-pad">
            <div className="cc-badges" dangerouslySetInnerHTML={{ __html: CARD_BADGES }} />
          </div>
        </div>
      </div>

      <footer className="cc-foot">
        <div className="cc-foot__in">
          <div className="cc-foot__blurb">
            <h3 dangerouslySetInnerHTML={{ __html: META.tagline }} />
            <p>{META.blurb}</p>
          </div>
          <div className="cc-foot__cols">
            <div>
              <h6><FormattedMessage id="checkout.customerCareHeading" /></h6>
              <p><a href={`tel:${META.supportPhone}`}>{META.supportPhone}</a></p>
              <p><a href={`mailto:${META.supportEmail}`}>{META.supportEmail}</a></p>
            </div>
            <div>
              <h6><FormattedMessage id="checkout.companyDetailsHeading" /></h6>
              {(META as any).copyright ? <p>{(META as any).copyright}</p> : null}
              <p>{META.companyName}{META.companyAddress ? `, ${META.companyAddress}` : ''}</p>
              {(META as any).companyRegNo ? <p><FormattedMessage id="checkout.companyRegNo" values={{ number: (META as any).companyRegNo }} /></p> : null}
              <p><a className="cc-foot__site" href={(META as any).siteUrl}>{(META as any).siteLabel}</a></p>
              <p className="cc-foot__paylabel"><FormattedMessage id="checkout.securePaymentOptions" /></p>
              <div className="cc-foot__cards" dangerouslySetInnerHTML={{ __html: CARD_BADGES }} />
            </div>
            <div>
              <h6><FormattedMessage id="legal" /></h6>
              <div className="cc-foot__links">
                {((META as any).legalLinks ?? []).map((l: { label: string; href: string }) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

const CARD_BADGES = `
<svg viewBox="0 0 48 30" width="46"><rect width="48" height="30" rx="4" fill="#1A1F71"/><text x="24" y="20" fill="#fff" font-size="11" font-weight="700" text-anchor="middle" font-family="Arial">VISA</text></svg>
<svg viewBox="0 0 48 30" width="46"><rect width="48" height="30" rx="4" fill="#fff"/><circle cx="20" cy="15" r="9" fill="#EB001B"/><circle cx="28" cy="15" r="9" fill="#F79E1B" fill-opacity=".85"/></svg>
<svg viewBox="0 0 48 30" width="46"><rect width="48" height="30" rx="4" fill="#000"/><text x="24" y="19" fill="#fff" font-size="8" font-weight="600" text-anchor="middle" font-family="Arial"> Pay</text></svg>
<svg viewBox="0 0 48 30" width="46"><rect width="48" height="30" rx="4" fill="#fff"/><text x="24" y="19" fill="#5F6368" font-size="8" font-weight="600" text-anchor="middle" font-family="Arial">G Pay</text></svg>`;

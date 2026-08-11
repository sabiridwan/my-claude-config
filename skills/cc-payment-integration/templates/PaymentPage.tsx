import React, { useEffect, useMemo, useState } from 'react';
import './checkout.scss';
import { getService, getPlan, formatPrice, getPaymentMethods } from './payments/paymentConfig';
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

  // Live pageConfigs.paymentMethods wins (panel-controlled); PAYMENT_METHODS (settings.ts,
  // scaffold-time) is only the fallback for pages saved before that field existed.
  const methods = getPaymentMethods(PAYMENT_METHODS as Method[]);
  // Card present -> tabbed selector (reference layout). Wallet-only -> two plain buttons, no tab
  // chrome, no card form to hide/show.
  const hasCard = methods.includes('card');
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
            <FormattedMessage id="checkout.secureCheckout" defaultMessage="Secure Checkout" />
          </div>
        </div>
      </header>

      <div className="cc-wrap">
        {/* LEFT */}
        <div>
          <div className="cc-card cc-pad">
            <h1 className="cc-title"><FormattedMessage id="checkout.finishRegistration" defaultMessage="Finish your Registration" /></h1>
            <div className="cc-trial">{formatPrice(plan.trialPrice)} / {trialLabel}</div>
            <p className="cc-terms">
              <FormattedMessage
                id="checkout.subscriptionTerms" defaultMessage="The subscription starts now for just {trialPrice} / {trialLabel}. It will be automatically prolonged for {fullPrice} / monthly after the first period."
                values={{ trialPrice: formatPrice(plan.trialPrice), trialLabel, fullPrice: formatPrice(plan.fullPrice) }}
              />
            </p>

            {hasCard ? (
              <>
                <h2 className="cc-pick"><FormattedMessage id="checkout.selectPaymentMethod" defaultMessage="Select a payment method" /></h2>
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
              </>
            ) : (
              // Wallet-only (no card enabled) — two plain buttons, no tab chrome.
              <div className="cc-wallet-buttons">
                {methods.includes('applePay') && <ApplePayButton />}
                {methods.includes('googlePay') && <GooglePayButton />}
              </div>
            )}

            <p className="cc-valueprop">
              <FormattedMessage
                id="checkout.valueProp" defaultMessage="Start your journey with a {trialLabel} for just {trialPrice}. After the trial, enjoy unlimited access to {name} for {fullPrice}/month with auto-renewal. No hidden costs — all taxes are included in the price."
                values={{ trialLabel, trialPrice: formatPrice(plan.trialPrice), name, fullPrice: formatPrice(plan.fullPrice) }}
              />
            </p>
          </div>

          <div className="cc-info">
            <div><h4><FormattedMessage id="checkout.infoSafeTitle" defaultMessage="Safe and Secure" /></h4><p><FormattedMessage id="checkout.infoSafeDesc" defaultMessage="All user data is protected. Your information is safe and secure — we protect our members' information using the best security measures possible. We will not sell or rent your private information to third parties; we value your privacy." /></p></div>
            <div><h4><FormattedMessage id="checkout.infoBillingTitle" defaultMessage="Why do we need your billing information?" /></h4><p><FormattedMessage id="checkout.infoBillingDesc" defaultMessage="Because we are only licensed to distribute our content in certain countries, we ask you to verify your billing details with a valid credit card. No charges appear on your statement unless you upgrade or make a purchase." /></p></div>
            <div><h4><FormattedMessage id="checkout.infoSignupTitle" defaultMessage="Sign up today, here's why:" /></h4><ul>{META.benefits.map((b, i) => <li key={i}>{b}</li>)}</ul></div>
            <div><h4><FormattedMessage id="checkout.infoAccessTitle" defaultMessage="Get access now!" /></h4><p><FormattedMessage id="checkout.infoAccessDesc" defaultMessage="We provide members with a detailed transaction history so they always know what they're paying for. Credit card information is required to facilitate future purchases only." /></p></div>
            <div>
              <h4><FormattedMessage id="checkout.infoCancelTitle" defaultMessage="Cancellation Policy" /></h4>
              <p><FormattedMessage id="checkout.infoCancelDesc" defaultMessage="You can cancel your membership at any time by contacting our Customer Care Department free of charge." /></p>
              <p className="cc-terms">
                <FormattedMessage id="checkout.infoCancelStatement" defaultMessage="The charge for your subscription to {name} will appear on your credit card statement as {descriptor}" values={{ name, descriptor: META.chargeDescriptor }} />{' '}
                <a href={`tel:${META.supportPhone.replace(/[^+\d]/g, '')}`}>{META.supportPhone}</a>
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="cc-summary-col">
          <div className="cc-card cc-pad cc-sum">
            <h3><FormattedMessage id="checkout.finishRegistration" defaultMessage="Finish your Registration" /></h3>
            <p className="cc-terms">
              <FormattedMessage
                id="checkout.summaryTerms" defaultMessage="{trialPrice} / {trialLabel} — then {fullPrice} / monthly after the first period."
                values={{ trialPrice: formatPrice(plan.trialPrice), trialLabel, fullPrice: formatPrice(plan.fullPrice) }}
              />
            </p>
            <div className="cc-sum__row" style={{ marginTop: 10 }}>
              <div>
                <div className="cc-sum__name">{name}</div>
                <div className="cc-sum__permo"><FormattedMessage id="checkout.summaryPerMonth" defaultMessage="Per monthly after {trialLabel}" values={{ trialLabel }} /></div>
              </div>
              <div className="cc-sum__price">{formatPrice(plan.fullPrice)}</div>
            </div>
            <div className="cc-sum__try">
              <FormattedMessage id="checkout.summaryTry" defaultMessage="Try for {days} day only for {trialPrice}" values={{ days: plan.trialDays || 1, trialPrice: formatPrice(plan.trialPrice) }} />
            </div>
            <div className="cc-sum__row cc-sum__total"><span><FormattedMessage id="checkout.summaryTotal" defaultMessage="Total" /></span><span>{formatPrice(plan.trialPrice)}</span></div>
            <div className="cc-sum__links">
              <a href="#"><FormattedMessage id="checkout.faqLink" defaultMessage="FAQ" /></a>
              <span className="cc-guar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg><FormattedMessage id="checkout.guaranteeText" defaultMessage="Risk-free refund policy" /></span>
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
              <h6><FormattedMessage id="checkout.customerCareHeading" defaultMessage="Customer Care" /></h6>
              <p><a href={`tel:${META.supportPhone.replace(/[^+\d]/g, '')}`}>{META.supportPhone}</a></p>
              <p><a href={`mailto:${META.supportEmail}`}>{META.supportEmail}</a></p>
            </div>
            <div>
              <h6><FormattedMessage id="checkout.companyDetailsHeading" defaultMessage="Company Details" /></h6>
              {(META as any).copyright ? <p>{(META as any).copyright}</p> : null}
              <p>{META.companyName}{META.companyAddress ? `, ${META.companyAddress}` : ''}</p>
              {(META as any).companyRegNo ? <p><FormattedMessage id="checkout.companyRegNo" defaultMessage="Company registration number: {number}" values={{ number: (META as any).companyRegNo }} /></p> : null}
              <p><a className="cc-foot__site" href={(META as any).siteUrl}>{(META as any).siteLabel}</a></p>
              <p className="cc-foot__paylabel"><FormattedMessage id="checkout.securePaymentOptions" defaultMessage="Secure Payment Options" /></p>
              <div className="cc-foot__cards" dangerouslySetInnerHTML={{ __html: CARD_BADGES }} />
            </div>
            <div>
              <h6><FormattedMessage id="legal" defaultMessage="Legal" /></h6>
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

// Scheme badges as vector marks. The Apple badge previously used the "" character — an
// Apple-only private-use codepoint that renders as a blank/box on every non-Apple device, so the
// badge read just "Pay". Both wallet marks are now real paths, and Visa/Mastercard match their
// actual brand treatment (italic wordmark; interlocking circles with the orange intersection).
const CARD_BADGES = `
<svg viewBox="0 0 48 30" width="46" role="img" aria-label="Visa"><rect width="48" height="30" rx="4" fill="#1A1F71"/><text x="24" y="20.5" fill="#fff" font-size="12" font-weight="700" font-style="italic" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" letter-spacing=".5">VISA</text></svg>
<svg viewBox="0 0 48 30" width="46" role="img" aria-label="Mastercard"><rect width="48" height="30" rx="4" fill="#fff"/><circle cx="19.5" cy="15" r="8.5" fill="#EB001B"/><circle cx="28.5" cy="15" r="8.5" fill="#F79E1B"/><path d="M24 8.2a8.5 8.5 0 0 0 0 13.6 8.5 8.5 0 0 0 0-13.6z" fill="#FF5F00"/></svg>
<svg viewBox="0 0 48 30" width="46" role="img" aria-label="Apple Pay"><rect width="48" height="30" rx="4" fill="#000"/><g fill="#fff" transform="translate(5.4 6.9) scale(.62)"><path d="M16.5 12.8c0-2.4 1.9-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.5-.1-2.8.8-3.6.8-.8 0-1.9-.8-3.1-.8-1.6 0-3 .9-3.8 2.4-1.7 2.8-.4 7 1.1 9.4.8 1.1 1.7 2.4 2.9 2.4 1.1 0 1.6-.8 3-.8 1.4 0 1.8.7 3 .7 1.2 0 2-1.1 2.8-2.2.9-1.4 1.2-2.6 1.2-2.7-.1-.1-2.1-.9-2.1-3.8z"/><path d="M14.1 5.6c.7-.8 1.1-1.8 1-2.9-1 .1-2.1.7-2.8 1.5-.6.7-1.1 1.8-1 2.8 1.1.1 2.1-.6 2.8-1.4z"/></g><text x="21" y="20" fill="#fff" font-size="11" font-weight="500" font-family="Helvetica, Arial, sans-serif">Pay</text></svg>
<svg viewBox="0 0 48 30" width="46" role="img" aria-label="Google Pay"><rect width="48" height="30" rx="4" fill="#fff"/><g transform="translate(7.5 8.5) scale(.55)"><path d="M12.2 9.5v3.3h4.7c-.2 1.1-.8 2-1.6 2.6-.8.6-1.9.9-3.1.9-2.5 0-4.6-1.7-5.4-4a5.9 5.9 0 0 1 0-3.7c.8-2.3 2.9-4 5.4-4 1.4 0 2.7.5 3.7 1.5l2.5-2.5A9 9 0 0 0 12.2 0 9.1 9.1 0 0 0 4 5a9.2 9.2 0 0 0 0 8.2 9.1 9.1 0 0 0 8.2 5c2.5 0 4.6-.8 6.1-2.2 1.7-1.6 2.7-4 2.7-6.8 0-.7-.1-1.3-.2-1.9h-8.6z" fill="#4285F4"/></g><text x="22.5" y="20" fill="#3C4043" font-size="11" font-weight="500" font-family="Helvetica, Arial, sans-serif">Pay</text></svg>`;

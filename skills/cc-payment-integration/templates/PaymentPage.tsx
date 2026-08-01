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

// Layout follows the reference Ouisys /xhosp page (header → Finish your Registration →
// payment-method selector → trust sections → order summary → footer). Theme comes entirely
// from checkout.scss (product brand). Prices/service come from pageConfigs — never hardcoded.
type Method = 'card' | 'applePay' | 'googlePay';
const LABEL: Record<Method, string> = { card: 'Card', applePay: 'Apple Pay', googlePay: 'Google Pay' };

export default function PaymentPage() {
  const service = getService();
  const plan = getPlan();
  const name = service.displayName || META.serviceName;
  const trialLabel = plan.trialDays ? `${plan.trialDays}-day trial` : 'trial';

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
            Secure Checkout
          </div>
        </div>
      </header>

      <div className="cc-wrap">
        {/* LEFT */}
        <div>
          <div className="cc-card cc-pad">
            <h1 className="cc-title">Finish your Registration</h1>
            <div className="cc-trial">{formatPrice(plan.trialPrice)} / {trialLabel}</div>
            <p className="cc-terms">
              The subscription starts now for just {formatPrice(plan.trialPrice)} / {trialLabel}. It will be
              automatically prolonged for {formatPrice(plan.fullPrice)} / monthly after the first period.
            </p>

            <h2 className="cc-pick">Select a payment method</h2>
            <div className="cc-methods">
              {methods.map((m) => (
                <div
                  key={m}
                  className={'cc-method' + (active === m ? ' cc-method--active' : '')}
                  onClick={() => setActive(m)}
                >
                  {LABEL[m]}
                </div>
              ))}
            </div>

            <div className="cc-form">{methodBody}</div>

            <p className="cc-valueprop">
              Start your journey with a {trialLabel} for just {formatPrice(plan.trialPrice)}. After the trial,
              enjoy unlimited access to {name} for {formatPrice(plan.fullPrice)}/month with auto-renewal. No hidden
              costs — all taxes are included in the price.
            </p>
          </div>

          <div className="cc-info">
            <div><h4>Safe and Secure</h4><p>All user data is protected. Your information is safe and secure — we protect our members' information using the best security measures possible. We will not sell or rent your private information to third parties; we value your privacy.</p></div>
            <div><h4>Why do we need your billing information?</h4><p>Because we are only licensed to distribute our content in certain countries, we ask you to verify your billing details with a valid credit card. No charges appear on your statement unless you upgrade or make a purchase.</p></div>
            <div><h4>Sign up today, here's why:</h4><ul>{META.benefits.map((b, i) => <li key={i}>{b}</li>)}</ul></div>
            <div><h4>Get access now!</h4><p>We provide members with a detailed transaction history so they always know what they're paying for. Credit card information is required to facilitate future purchases only.</p></div>
            <div><h4>Cancellation Policy</h4><p>You can cancel your membership at any time by contacting our Customer Care Department free of charge.</p><p className="cc-terms">The charge for your subscription to {name} will appear on your credit card statement as {META.chargeDescriptor} <a href={`tel:${META.supportPhone}`}>{META.supportPhone}</a></p></div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="cc-summary-col">
          <div className="cc-card cc-pad cc-sum">
            <h3>Finish your Registration</h3>
            <p className="cc-terms">{formatPrice(plan.trialPrice)} / {trialLabel} — then {formatPrice(plan.fullPrice)} / monthly after the first period.</p>
            <div className="cc-sum__row" style={{ marginTop: 10 }}>
              <div>
                <div className="cc-sum__name">{name}</div>
                <div className="cc-sum__permo">Per monthly after {trialLabel}</div>
              </div>
              <div className="cc-sum__price">{formatPrice(plan.fullPrice)}</div>
            </div>
            <div className="cc-sum__try">Try for {plan.trialDays || 1} day only for {formatPrice(plan.trialPrice)}</div>
            <div className="cc-sum__row cc-sum__total"><span>Total</span><span>{formatPrice(plan.trialPrice)}</span></div>
            <div className="cc-sum__links">
              <a href="#">FAQ</a>
              <span className="cc-guar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>Risk-free refund policy</span>
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
              <h6>Customer Care</h6>
              <p><a href={`tel:${META.supportPhone}`}>{META.supportPhone}</a></p>
              <p><a href={`mailto:${META.supportEmail}`}>{META.supportEmail}</a></p>
            </div>
            <div>
              <h6>Company Details</h6>
              {(META as any).copyright ? <p>{(META as any).copyright}</p> : null}
              <p>{META.companyName}{META.companyAddress ? `, ${META.companyAddress}` : ''}</p>
              {(META as any).companyRegNo ? <p>Company registration number: {(META as any).companyRegNo}</p> : null}
              <p><a className="cc-foot__site" href={(META as any).siteUrl}>{(META as any).siteLabel}</a></p>
              <p className="cc-foot__paylabel">Secure Payment Options</p>
              <div className="cc-foot__cards" dangerouslySetInnerHTML={{ __html: CARD_BADGES }} />
            </div>
            <div>
              <h6>Legal</h6>
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

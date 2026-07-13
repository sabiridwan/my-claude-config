# Reusable code patterns

Concrete patterns pulled from a real build (GR Mobiworld, MO flow). Treat
these as starting points, not gospel — adapt names/values to the actual repo
and page, but the *shapes* below are proven to work together.

## Operator config file

One file per operator under `src/configs/<operator-id>.ts`:

```ts
import type { OperatorConfig } from './types';

const pageConfigs: OperatorConfig['pageConfigs'] = {
  serviceName: 'ServiceName',
  customerCareEmail: 'help@example.com',
  forceLocale: 'el',              // omit / set '' if the page has a language switcher
  cssTheme: 'servicename-theme',
  pageType: 'commercial',

  logo: { url: 'https://cdn.example.com/logo.png', width: 160, height: 64 },

  mccInformation: {
    id: 6,
    mcc: 'Legal Entity B.V.',
    registration_number: ' ',
    mcc_email: '',
    mcc_phone_number: ' ',
    address: 'Street 1, 1234 AB, City, Country',
    ceo: ' ',
    date_created: '2025-01-01T00:00:00.000Z',
  },

  legalVariables: {
    country: 'gr',
    service: 'servicename',
    currency: 'EUR',
    vat: '',
    operators: [
      {
        name: 'GR',
        amount: 27.48,
        currency: 'EUR',
        frequency: 'monthly',
        frequencyDays: 30,
        keywordOptOut: 'STOP XX',
        shortcodeOptOut: '54003',
      },
    ],
  },

  pin: { shortCodes: ['54003', '54099'], blockedPin: ['0000', '1234'] },

  // Section toggles — set only what the real page actually shows
  pageLoading: true,
  isSubscriptionAreaCentered: true,
  isShowLanguageSwitcher: false,
  isShowMenu: true,
  isShowConsentCheckBox: true,
  isShowPaymentAcceptance: false,
  isShowFeatures: true,
  isShowShowCase: true,
  isShowRefundPolicy: true,
  isShowUnsubscription: true,
  isShowTestimonials: false,
  isShowAboutUs: true,
  isShowPricePoint: true,
  hasPersuasiveArea: false,
  isDisableButtonIfInvalid: true,
};

export const servicename: OperatorConfig = {
  id: 'servicename.gr',
  label: 'ServiceName (GR)',
  pageConfigs,
  // configOverrides mirrors ONLY root config.json fields (strategy/country) —
  // never put pageConfigs-level flags (like forceLocale) in here.
  configOverrides: { strategy: 'mo', country: 'gr' },
};
```

Register it in `src/configs/registry.ts`:

```ts
import { placeholder } from './placeholder';
import { servicename } from './servicename.gr';

export const OPERATORS = [servicename, placeholder]; // new operator first = default
export const DEFAULT_OPERATOR_ID = servicename.id;
```

## Widget area — headline, widget, price line, consent toggle

```tsx
const WidgetArea: React.FC<{ locale: string }> = ({ locale }) => {
  const [consented, setConsented] = useState(false);
  const hasConsent = !!pageConfigs.isShowConsentCheckBox;
  const operator = pageConfigs.legalVariables?.operators?.[0];

  return (
    <div className="cp-widget-area">
      <h1 className="cp-widget-area__headline">
        <FormattedMessage id="widgetHeadline" defaultMessage="..." />
      </h1>

      <SubscriptionWidget
        config={templateConfigs}
        locale={locale}
        messages={getMessages(locale)}
        consentValid={hasConsent ? consented : true}   // R3: page owns consent
        previewFlow={previewFlow as any}
        onConsentRequired={handleConsentRequired}        // module-scope, see gotcha #9
        onSuccess={handleSuccess}
        onEvent={handleEvent}
      />

      {pageConfigs.isShowPricePoint && operator && (
        <p className="cp-price-legal">
          <FormattedMessage id="priceLegalLine" defaultMessage="..." values={{ amount: operator.amount }} />
        </p>
      )}

      {hasConsent && (
        <label className="cp-consent">
          <span className="cp-consent__switch">
            <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
            <span className="cp-consent__track" />
          </span>
          <span className="cp-consent__text">
            <FormattedMessage id="consentToggleText" defaultMessage="..." />
          </span>
        </label>
      )}
    </div>
  );
};
```

`handleConsentRequired` (module scope, per gotcha #9) should scroll the
`.cp-consent` node into view — don't just log a warning, that's a dead end
for a real user:

```tsx
const handleConsentRequired = () => {
  document.querySelector('.cp-consent')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};
```

## Generic Accordion (reuse for every collapsible section)

Built once, reused for Features/Showcase/PricingPolicy/RefundPolicy/
Unsubscription/About — don't reimplement per section.

```tsx
const Accordion: React.FC<{
  title: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ title, defaultOpen = false, className, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => setOpen((v) => !v);
  return (
    <div className={`cp-accordion ${className || ''}`}>
      <div
        className="cp-accordion__title"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        }}
      >
        {title}
        <span className="cp-accordion__arrow">{open ? '↑' : '↓'}</span>
      </div>
      {open && <div className="cp-accordion__body">{children}</div>}
    </div>
  );
};
```

Use `<div role="button">`, not `<label>` — a `<label>` with no associated
control has no keyboard semantics and confuses assistive tech.

## Widget CSS scoping block (see gotchas.md #3 — do not skip this)

```scss
.ouisys-subscription-widget {
  .price-point,
  .dynamic-price-point,
  .msisdn-secondary-label,
  .about-to-subscribe-text {
    display: none;
  }

  .flag,
  .country-code {
    display: none;
  }
}
```

## Mobile promotion of one accordion above its siblings only (gotcha #6)

```scss
@media (max-width: 767px) {
  .cp-accordion--about { order: 1; }
  .cp-accordion--features,
  .cp-accordion--showcase,
  .cp-accordion--pricing-policy,
  .cp-accordion--refund,
  .cp-accordion--unsub {
    order: 2;
  }
  // Steps/WidgetArea/etc. stay at their implicit order: 0 — don't touch them.
}
```

## Dynamic FormattedMessage id anchor (see gotchas.md #2 — required for every `.map()`-driven id)

```ts
// src/localization/widgetMessages.ts (or wherever the repo's extraction anchor lives)
export const widgetMessages = defineMessages({
  // ...
  showcaseItem1: { id: 'showcaseItem1', defaultMessage: 'Action' },
  showcaseItem2: { id: 'showcaseItem2', defaultMessage: 'Arcade' },
  // one entry per dynamically-referenced id
});
```

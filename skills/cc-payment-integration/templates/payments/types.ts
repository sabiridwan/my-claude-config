// Shared types for the self-contained payment core.
// No ouisys-engine, no widget bundle — everything reads window.configJson.pageConfigs at runtime.

export interface Plan {
  trialPrice?: string;
  trialDays?: number;
  fullPrice?: string;
  billingCycleDays?: number;
  isLocalCurrency?: boolean;
  currency?: string;
}

export interface CardPayments {
  bankId?: string | number;
}

export interface ApplePayConfig {
  bankId?: string | number;
  merchantIdentifier?: string;
  supportedNetworks?: string[];
  merchantCapabilities?: string[];
  requiredShippingContactFields?: string[];
  requiredBillingContactFields?: string[];
  label?: string;
}

export interface GooglePayConfig {
  bankId?: string | number;
  gateway?: string;
  gatewayMerchantId?: string;
  merchantInfo?: { merchantId?: string; merchantName?: string };
  allowedCardNetworks?: string[];
  allowedAuthMethods?: string[];
  totalPriceStatus?: string;
}

export interface PageConfigs {
  slug?: string;
  gateway?: string;
  service?: { id?: string; displayName?: string };
  plan?: Plan;
  payments?: {
    card?: CardPayments;
    applePay?: ApplePayConfig;
    googlePay?: GooglePayConfig;
  };
  // Panel-controlled enabled methods, lowercase, no camelCase: 'applepay' | 'googlepay' | 'ccsubmit'.
  // Absent on pages saved before this field existed — callers must fall back to the scaffold-time
  // PAYMENT_METHODS constant (see getPaymentMethods() in paymentConfig.ts).
  paymentMethods?: string[];
  flags?: { forceComp?: boolean };
  cardMccInformation?: { mcc?: string };
  env?: { page?: string };
}

export interface CardUserDetails {
  number?: string;
  cc_number?: string; // maxpay variant
  month?: string;
  year?: string;
  cvv?: string;
  email?: string;
  bankId?: string | number;
  [k: string]: unknown;
}

export interface PaymentResult {
  success?: boolean;
  message?: string;
  method?: string;
  /**
   * Outranks `success`. The already-subscribed outcome comes back as
   * `success: false` + `state: 'success'` — no NEW charge was taken, but the
   * subscription is valid and the customer still gets redirected. See the gate
   * in handleCardResult.
   */
  state?: string;
  gateway_url?: string;
  redirect_url?: string;
  product_url?: string;
  html?: string;
  [k: string]: unknown;
}

export interface ResolvedMode {
  nonComp: boolean;
  mode: 'download' | 'video' | null;
  pending: boolean;
}

declare global {
  interface Window {
    configJson?: { pageConfigs?: PageConfigs };
    DEV_BASE_URL_CREDIT_CARD?: string;
    pac_analytics?: {
      visitor?: {
        rockmanId?: string;
        ip?: string;
        ip_range_name?: string;
        page?: string;
      };
    };
    kountAntifraud?: { sessionId?: string } | undefined;
    ApplePaySession?: unknown;
  }
}

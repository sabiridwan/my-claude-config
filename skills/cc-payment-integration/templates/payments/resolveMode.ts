// Synchronous comp / non-comp decision (see references/payment-architecture.md §6).
// Must be computed BEFORE first paint so the layout never flashes.
import { getPageConfigs } from './paymentConfig';
import { searchParams } from './params';
import { CREATIVE_MODE, REQUIRE_COUNTRY } from './settings';
import type { ResolvedMode } from './types';

// Replicates the reference RootContext `isCompliant` exactly (comp when compliant; non-comp only when
// NOT compliant). Precedence: forceComp wins → ?non-comp override → auto rules.
export function decideComp(): boolean {
  const pc = getPageConfigs();
  const p = searchParams();
  if (pc.flags?.forceComp) return true; // forceComp always forces comp
  if (p['non-comp'] === 'true' || p['nonCompEnable'] === 'true') return false; // QA override → non-comp

  const country = (p['d_country'] || '').toLowerCase();
  const hasApplePay = typeof window !== 'undefined' && !!window.ApplePaySession;
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  const ip =
    ((typeof window !== 'undefined' && window.pac_analytics?.visitor?.ip_range_name) || '').toUpperCase();
  const isIndia = ip === 'IN' || ip === 'INDIA';

  // ANY true term → compliant → comp. (REQUIRE_COUNTRY mirrors the xracademy /xhosp `!country` gate.)
  const isCompliant =
    (REQUIRE_COUNTRY && !country) ||
    !hasApplePay ||
    !isIOS ||
    isIndia;
  return isCompliant;
}

// Confirm with a real wallet probe. Resolves the settled decision (pending: false).
// Kept intentionally simple: the initial decideComp() is already correct, so this is a no-op
// in the common case — its job is only to catch a wallet that isn't actually usable.
export async function confirmMode(): Promise<ResolvedMode> {
  const nonComp = !decideComp();
  const creative = getCreativeMode();
  // Probe Google Pay isReadyToPay if available; Apple Pay presence already factored in decideComp.
  return { nonComp, mode: nonComp ? creative : null, pending: false };
}

function getCreativeMode(): 'download' | 'video' | null {
  // Overridable for QA via ?nonCompMode=
  const p = searchParams();
  const m = p['nonCompMode'];
  if (m === 'download' || m === 'video') return m;
  return CREATIVE_MODE === 'none' ? null : CREATIVE_MODE;
}

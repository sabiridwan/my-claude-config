// Lightweight host tracker — pushes product events keyed by rockmanId (→ Tau), via the same
// mstore wire contract the real Pacman client uses (see references/flow-events.md). Safe no-op
// when rockmanId is absent (mirrors the widget's pre-mount behavior).
//
// CONFIRMED BROKEN, don't reintroduce: `/api/v1/frontend/track` (this file's previous transport)
// does not exist — 404s on staging AND production, so three independently-shipped pages silently
// dropped every funnel event before anyone noticed. mstore is the only transport that reaches Tau.
import { getRockmanId, getSlug } from './paymentConfig';

const MSTORE_URL = '/analytickz/api/v2/mstore';
const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
let batch = 0;
let eventNumber = 0;

function post(category: string, action: string, label = '', meta?: Record<string, unknown>): void {
  const rockmanId = getRockmanId();
  if (!rockmanId) {
    // eslint-disable-next-line no-console
    console.warn('[payments] tracker no-op (no rockmanId yet):', { category, action, label });
    return;
  }
  const seconds =
    typeof performance !== 'undefined' ? Math.round((performance.now() - t0) / 100) / 10 : 0;
  const body = JSON.stringify({
    r: rockmanId,
    m: (window as any).pac_analytics?.visitor?.impressionNumber ?? 1,
    b: batch++,
    d: [{ t: 'flow_event', a: { number: eventNumber++, category, action, label, slug: getSlug(), ...meta }, s: seconds }]
  });
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
      if (navigator.sendBeacon(MSTORE_URL, blob)) return;
    }
    fetch(MSTORE_URL, {
      method: 'POST',
      headers: { accept: '*/*', 'content-type': 'text/plain;charset=UTF-8' },
      body,
      keepalive: true
    }).catch(() => {});
  } catch {
    /* never throw from tracking */
  }
}

// Method names and argument order mirror `ouisys-engine/utilities/tracker` (the real
// Pacman client) EXACTLY, so component code reads the same whichever one is wired and
// swapping to the engine tracker is a one-line import change. Prefer the engine
// tracker whenever the target repo already has it — see the non-negotiable about
// never swapping it out for this shim.
//
// `flow` is the first argument on advancedInFlow/recedeInFlow purely for that parity:
// Pacman ACCEPTS AND DISCARDS it, hardcoding category "Flow" and action
// "advance"/"recede" and using only the label. Keep passing it for grep-ability; never
// rely on it reaching a dashboard. See references/flow-events.md.
export const tracker = {
  customEvent(category: string, action: string, label?: string, meta?: Record<string, unknown>) {
    post(category, action, label, meta);
  },
  // -> Pre-Flow:advance:<label>   (intent shown, no data entered yet)
  advancedInPreFlow(label: string, meta?: Record<string, unknown>) {
    post('Pre-Flow', 'advance', label, meta);
  },
  // -> Flow:advance:<label>
  advancedInFlow(_flow: string, label: string, meta?: Record<string, unknown>) {
    post('Flow', 'advance', label, meta);
  },
  // -> Flow:recede:<label>
  recedeInFlow(_flow: string, label: string, meta?: Record<string, unknown>) {
    post('Flow', 'recede', label, meta);
  }
};

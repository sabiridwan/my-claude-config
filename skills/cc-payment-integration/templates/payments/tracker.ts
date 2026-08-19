// Lightweight host tracker — pushes product events keyed by rockmanId (→ Tau).
// Safe no-op when rockmanId is absent (mirrors the widget's pre-mount behavior).
import { getRockmanId, getSlug } from './paymentConfig';

function post(payload: Record<string, unknown>): void {
  const rockmanId = getRockmanId();
  if (!rockmanId) {
    // eslint-disable-next-line no-console
    console.warn('[payments] tracker no-op (no rockmanId yet):', payload);
    return;
  }
  try {
    fetch('/api/v1/frontend/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rockmanId, slug: getSlug(), ...payload }),
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
    post({ type: 'custom', category, action, label, meta });
  },
  // -> Pre-Flow:advance:<label>   (intent shown, no data entered yet)
  advancedInPreFlow(label: string, meta?: Record<string, unknown>) {
    post({ type: 'preflow', label, meta });
  },
  // -> Flow:advance:<label>
  advancedInFlow(_flow: string, label: string, meta?: Record<string, unknown>) {
    post({ type: 'flow', verb: 'advance', label, meta });
  },
  // -> Flow:recede:<label>
  recedeInFlow(_flow: string, label: string, meta?: Record<string, unknown>) {
    post({ type: 'flow', verb: 'recede', label, meta });
  }
};

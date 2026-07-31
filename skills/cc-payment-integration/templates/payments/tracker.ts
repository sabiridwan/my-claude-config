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

export const tracker = {
  customEvent(category: string, action: string, label?: string, meta?: Record<string, unknown>) {
    post({ type: 'custom', category, action, label, meta });
  },
  advancedInPreFlow(label: string, meta?: Record<string, unknown>) {
    post({ type: 'preflow', label, meta });
  }
};

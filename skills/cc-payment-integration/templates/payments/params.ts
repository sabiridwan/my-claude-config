// Preserved tracking params (domain preservation): read once, forward into payment calls.
export function searchParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  return Object.fromEntries(new URLSearchParams(window.location.search).entries());
}

export function isPreauth(): boolean {
  const p = searchParams();
  return p['preauth'] === 'true' || p['is_preauth'] === '1';
}

export function splitParam(): string | undefined {
  return searchParams()['split'];
}

export function antifraudSessionId(): string | null {
  return (typeof window !== 'undefined' && window.kountAntifraud?.sessionId) || null;
}

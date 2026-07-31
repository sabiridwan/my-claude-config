import React from 'react';

// Loader is an OVERLAY over an always-rendered tree — never an early return.
// See references/domain-preservation.md (anti-deadlock).
export default function Loader({ label }: { label?: string }) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="page-loader__spinner" />
      {label && <div className="page-loader__label">{label}</div>}
    </div>
  );
}

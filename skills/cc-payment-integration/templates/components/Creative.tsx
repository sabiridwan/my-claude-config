import React, { useEffect, useRef, useState } from 'react';
// Non-comp download-animation creative. Assets are bundled with the skill and emitted into the
// project at src/checkout/assets/ — so this is self-contained and does not depend on the base
// template's assets.
import posterStart from '../assets/download-start.webp';
import posterEnd from '../assets/download-end.webp';
import videoWebm from '../assets/download.webm';

const MESSAGES = [
  'Preparing your access…',
  'Verifying availability…',
  'Securing your connection…',
  'Almost there…'
];
const STEP_MS = 1200;

// Plays the download animation, cycles the status messages, then fades in the CTA. The tap target is
// the whole non-comp area (parent), and the CTA also fires onContinue.
export default function Creative({ onContinue, isLoading }: { onContinue: () => void; isLoading?: boolean }) {
  const [msg, setMsg] = useState(0);
  const [ready, setReady] = useState(false);
  const [ended, setEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.muted = true;
      (v as any).defaultMuted = true;
      v.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (msg >= MESSAGES.length - 1) {
      setReady(true);
      setEnded(true);
      return;
    }
    const t = setTimeout(() => setMsg((m) => m + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [msg]);

  return (
    <div className="cc-creative">
      <div className="cc-creative__media">
        {ended ? (
          <img src={posterEnd} alt="" />
        ) : (
          <video ref={videoRef} autoPlay muted playsInline poster={posterStart}>
            <source src={videoWebm} type="video/webm" />
          </video>
        )}
      </div>
      <div className="cc-creative__status">{MESSAGES[msg]}</div>
      <button
        type="button"
        className={'cc-creative__cta' + (ready ? ' is-ready' : '')}
        disabled={isLoading}
        onClick={(e) => {
          e.stopPropagation();
          onContinue();
        }}
      >
        Get access now
      </button>
    </div>
  );
}

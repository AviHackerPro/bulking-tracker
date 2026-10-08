// The Stacked logo: three gold plates stacked into a podium.

import { useId } from 'react';

export function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F6DD9A" />
          <stop offset="1" stopColor="#C4923A" />
        </linearGradient>
      </defs>
      <rect x="18" y="14" width="28" height="9" rx="3.5" fill={`url(#${id}g)`} />
      <rect x="13" y="27" width="38" height="9" rx="3.5" fill={`url(#${id}g)`} opacity="0.92" />
      <rect x="8" y="40" width="48" height="9" rx="3.5" fill={`url(#${id}g)`} opacity="0.84" />
    </svg>
  );
}

/** App icon tile: logo on a black tile with a soft gold glow. */
export function LogoTile({ size = 64 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-[28%] border border-white/10 shadow-float"
      style={{
        width: size,
        height: size,
        background: 'radial-gradient(90% 90% at 50% 20%, rgb(227 182 90 / 0.22), transparent 60%), linear-gradient(160deg, #1f1c16, #0b0b0c)',
      }}
    >
      <LogoMark size={size * 0.62} />
    </div>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`font-extrabold tracking-[-0.03em] ${className}`}>Stacked</span>;
}

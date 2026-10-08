import { useEffect, useRef } from 'react';
import { haptic } from '../lib/feel';
import { TrophyIcon } from './icons';

const SPARKS = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2;
  return { dx: Math.cos(angle) * 46, dy: Math.sin(angle) * 30, delay: (i % 3) * 60 };
});

/** A short, subtle gold toast with a burst of sparkles. */
export default function Celebration({ text, onDone }: { text: string; onDone: () => void }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    haptic([18, 50, 18]);
    const id = window.setTimeout(() => onDoneRef.current(), 2800);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)' }} role="status">
      <div className="hero-surface animate-toast relative flex items-center gap-2.5 rounded-full px-5 py-3 shadow-float">
        {SPARKS.map((s, i) => (
          <span
            key={i}
            className="spark absolute top-1/2 left-7 h-1.5 w-1.5 rounded-full bg-gold-gradient"
            style={{ ['--dx' as string]: `${s.dx}px`, ['--dy' as string]: `${s.dy}px`, animationDelay: `${s.delay}ms` }}
          />
        ))}
        <TrophyIcon size={20} className="text-accent" />
        <span className="text-sm font-bold">{text}</span>
      </div>
    </div>
  );
}

import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/**
 * iOS-style large title → compact title. When the big page title scrolls
 * out of view, a small title fades in on a frosted bar at the top so you
 * always know where you are. Tap it to scroll back to the top.
 */
export default function CompactTitle({ watch, children }: { watch: RefObject<HTMLElement | null>; children: ReactNode }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = watch.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), { rootMargin: '-4px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [watch]);

  return createPortal(
    <div
      aria-hidden={!show}
      className={`material-bar edge-bottom fixed inset-x-0 top-0 z-20 transition-opacity duration-200 ${show ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <button
        tabIndex={show ? 0 : -1}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="mx-auto flex h-11 w-full max-w-lg items-center justify-center text-[0.9375rem] font-semibold tracking-[-0.01em]"
      >
        {children}
      </button>
    </div>,
    document.body,
  );
}

// Bottom sheet with iOS-style physics:
//  • slides up on a spring and leaves the same way it came
//  • drag the handle (or pull down on content already scrolled to the top)
//    and it follows your finger 1:1 from where you grabbed it
//  • a flick dismisses based on where it would land (momentum projection),
//    and the release speed carries straight into the spring
//  • pulling up past the top rubber-bands instead of hard-stopping
//  • can be grabbed again mid-animation
//  • the page behind dims and recedes in step with the sheet
// With "reduce motion" on, it simply appears and disappears.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { reducedMotion } from '../lib/feel';
import { animateSpring, MOMENTUM, project, rubberband, SMOOTH, VelocityTracker, type SpringConfig, type SpringHandle } from '../lib/spring';
import { XIcon } from './icons';

const DRAG_THRESHOLD = 10; // px of movement before a content drag commits (hysteresis)
const PAGE_SCALE = 0.05; // how far the page behind recedes when the sheet is fully open

/** The page behind the sheet recedes and dims as the sheet rises. */
function setPageDepth(progress: number) {
  const page = document.getElementById('page');
  if (!page) return;
  if (progress <= 0 || reducedMotion()) {
    page.style.transform = '';
    page.style.transformOrigin = '';
    page.style.borderRadius = '';
    return;
  }
  page.style.transformOrigin = `50% ${window.scrollY + window.innerHeight / 2}px`;
  page.style.transform = `scale(${1 - PAGE_SCALE * progress})`;
  page.style.borderRadius = `${18 * progress}px`;
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  // Stay mounted while the exit animation plays.
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);

  // Keep showing the last content while closing, so nothing empties mid-slide.
  const lastContent = useRef({ title, children });
  if (open) lastContent.current = { title, children };
  const shown = open ? { title, children } : lastContent.current;

  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const y = useRef(0); // current offset from fully open, in px (0 = open)
  const anim = useRef<SpringHandle | null>(null);
  const visible = useRef(false);
  const releaseVelocity = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const restoreFocus = useRef<HTMLElement | null>(null);

  const height = () => panelRef.current?.offsetHeight ?? window.innerHeight;

  const apply = useCallback((value: number) => {
    y.current = value;
    const panel = panelRef.current;
    if (panel) panel.style.transform = `translate3d(0, ${value}px, 0)`;
    const progress = Math.max(0, Math.min(1, 1 - value / height()));
    if (scrimRef.current) scrimRef.current.style.opacity = String(progress);
    setPageDepth(progress);
  }, []);

  const stop = () => {
    anim.current?.stop();
    anim.current = null;
  };

  const animateTo = useCallback(
    (to: number, velocity: number, config: SpringConfig, done?: () => void) => {
      stop();
      anim.current = animateSpring({
        from: y.current,
        to,
        velocity,
        config,
        onUpdate: apply,
        onComplete: () => {
          anim.current = null;
          done?.();
        },
      });
    },
    [apply],
  );

  // Enter and exit.
  useLayoutEffect(() => {
    if (!present) return;
    if (open) {
      if (!visible.current) {
        visible.current = true;
        restoreFocus.current = document.activeElement as HTMLElement | null;
        apply(height()); // start just off-screen
        panelRef.current?.focus({ preventScroll: true });
      }
      if (reducedMotion()) {
        stop();
        apply(0);
      } else {
        animateTo(0, 0, SMOOTH);
      }
    } else {
      const velocity = releaseVelocity.current;
      releaseVelocity.current = 0;
      const finish = () => {
        visible.current = false;
        setPageDepth(0);
        restoreFocus.current?.focus?.({ preventScroll: true });
        setPresent(false);
      };
      if (reducedMotion()) {
        stop();
        finish();
      } else {
        animateTo(height(), Math.max(0, velocity), SMOOTH, finish);
      }
    }
  }, [open, present, apply, animateTo]);

  // Clean up if the sheet's owner disappears.
  useEffect(
    () => () => {
      stop();
      setPageDepth(0);
    },
    [],
  );

  // Escape key and scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  // ----- Dragging -------------------------------------------------------
  const drag = useRef<{ startPointer: number; startY: number; tracker: VelocityTracker } | null>(null);

  const beginDrag = useCallback((pointerY: number) => {
    stop(); // grab it mid-flight: continue from where it is now
    drag.current = { startPointer: pointerY, startY: y.current, tracker: new VelocityTracker() };
    drag.current.tracker.add(y.current);
  }, []);

  const moveDrag = useCallback(
    (pointerY: number) => {
      const d = drag.current;
      if (!d) return;
      let next = d.startY + (pointerY - d.startPointer); // respects where you grabbed it
      if (next < 0) next = rubberband(next, height());
      apply(next);
      d.tracker.add(next);
    },
    [apply],
  );

  const endDrag = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const velocity = d.tracker.velocity();
    const landing = y.current + project(velocity);
    if (velocity > 0 && landing > height() * 0.45) {
      releaseVelocity.current = velocity; // the exit spring inherits the flick
      onCloseRef.current();
    } else {
      animateTo(0, velocity, Math.abs(velocity) > 300 ? MOMENTUM : SMOOTH);
    }
  }, [animateTo]);

  // Pull-down on the content when it's scrolled to the top.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !present) return;
    let startX = 0;
    let startY = 0;
    let decided = false;
    let dragging = false;
    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      decided = false;
      dragging = false;
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      const dy = t.clientY - startY;
      const dx = t.clientX - startX;
      if (!decided) {
        if (Math.abs(dy) < DRAG_THRESHOLD && Math.abs(dx) < DRAG_THRESHOLD) return;
        decided = true;
        dragging = el.scrollTop <= 0 && dy > 0 && Math.abs(dy) > Math.abs(dx);
        if (dragging) beginDrag(t.clientY);
      }
      if (dragging) {
        e.preventDefault();
        moveDrag(t.clientY);
      }
    };
    const onEnd = () => {
      if (dragging) endDrag();
      dragging = false;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [present, beginDrag, moveDrag, endDrag]);

  if (!present) return null;

  return createPortal(
    <div className="fixed inset-0 z-30 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={typeof shown.title === 'string' ? shown.title : undefined}>
      <button
        ref={scrimRef}
        className="sheet-scrim absolute inset-0 bg-black/50"
        style={{ opacity: 0 }}
        aria-label="Close"
        tabIndex={-1}
        onClick={() => onCloseRef.current()}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="sheet-panel relative flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-[28px] bg-card shadow-float outline-none will-change-transform"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', transform: 'translate3d(0, 100%, 0)' }}
      >
        {/* Drag area: handle + title */}
        <div
          className="cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            try {
              e.currentTarget.setPointerCapture(e.pointerId); // keep tracking even if the finger leaves the bar
            } catch {
              /* some pointers can't be captured; dragging still works */
            }
            beginDrag(e.clientY);
          }}
          onPointerMove={(e) => drag.current && moveDrag(e.clientY)}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line" />
          <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-2">
            <h2 className="text-lg leading-snug font-bold tracking-[-0.01em]">{shown.title}</h2>
            <button
              onClick={() => onCloseRef.current()}
              className="pressable -mt-1.5 -mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-track"
              aria-label="Close"
            >
              <XIcon />
            </button>
          </div>
        </div>
        <div ref={scrollRef} className="overflow-y-auto overscroll-contain px-5 pt-1 pb-6">
          {shown.children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

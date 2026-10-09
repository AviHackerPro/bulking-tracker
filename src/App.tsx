import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import BottomNav from './components/BottomNav';
import LockScreen from './components/LockScreen';
import { useLock } from './store/useLock';
import { shouldRelock } from './lib/lock';
import { useAppStore } from './store/useAppStore';
import Welcome from './pages/Welcome';
import Today from './pages/Today';
import Plan from './pages/Plan';
import Settings from './pages/Settings';

// Progress includes the chart library, so it loads only when opened.
const Progress = lazy(() => import('./pages/Progress'));

export default function App() {
  const startDate = useAppStore((s) => s.profile.startDate);
  const lockOn = useAppStore((s) => s.settings.lockEnabled ?? true);
  const { locked, lock } = useLock();

  // Lock again after the app has been in the background for a while.
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onChange = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (shouldRelock(hiddenAt, Date.now())) lock();
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [lock]);

  if (lockOn && locked) return <LockScreen />;
  if (!startDate) return <Welcome />;

  return (
    <>
      {/* #page recedes slightly behind open sheets (see Sheet.tsx) */}
      <div id="page" className="min-h-dvh bg-canvas">
        <div className="mx-auto max-w-lg pb-28">
          <Suspense fallback={<p className="p-8 text-center text-sm text-muted">Loading…</p>}>
            <Routes>
              <Route path="/" element={<Today />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/settings" element={<Settings />} />
              {/* Old addresses from earlier versions */}
              <Route path="/library" element={<Navigate to="/plan?tab=meals" replace />} />
              <Route path="/weight" element={<Navigate to="/progress" replace />} />
              <Route path="/log" element={<Navigate to="/progress?tab=training" replace />} />
              <Route path="/history" element={<Navigate to="/progress?tab=history" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>
      <BottomNav />
    </>
  );
}

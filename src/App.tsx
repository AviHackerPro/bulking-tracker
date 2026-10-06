import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import BottomNav from './components/BottomNav';
import { useAppStore } from './store/useAppStore';
import Welcome from './pages/Welcome';
import Today from './pages/Today';
import Plan from './pages/Plan';
import Settings from './pages/Settings';

// Progress includes the chart library, so it loads only when opened.
const Progress = lazy(() => import('./pages/Progress'));

export default function App() {
  const startDate = useAppStore((s) => s.profile.startDate);

  if (!startDate) return <Welcome />;

  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-28">
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
      <BottomNav />
    </div>
  );
}

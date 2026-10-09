import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import App from './App';
import { useAppStore } from './store/useAppStore';
import { withTransition } from './lib/feel';
import { requestPersistentStorage } from './lib/storage';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css';

void requestPersistentStorage();

// Apply the colour theme now (before first paint) and whenever it changes.
function applyTheme() {
  const theme = useAppStore.getState().settings.theme ?? 'dark';
  document.documentElement.dataset.theme = theme;
  const canvas = getComputedStyle(document.documentElement).getPropertyValue('--color-canvas').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', canvas || '#09090b');
}
applyTheme();
useAppStore.subscribe((s, prev) => {
  // Cross-fade between light and dark instead of an abrupt brightness jump.
  if (s.settings.theme !== prev.settings.theme) withTransition(applyTheme);
});
// Lets :active press styles show the instant a finger lands (iOS Safari needs a touch listener).
document.addEventListener('touchstart', () => {}, { passive: true });
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Hash routing (#/weight) works on GitHub Pages without server config. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);

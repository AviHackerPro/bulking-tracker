import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import App from './App';
import { requestPersistentStorage } from './lib/storage';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css';

void requestPersistentStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Hash routing (#/weight) works on GitHub Pages without server config. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);

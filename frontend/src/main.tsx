import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import { logError } from './utils/logger';
import './global.css';

if (import.meta.env.PROD) {
  Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN });

  // A caching service worker fights Vite's dev-server HMR, so this only
  // registers in production builds.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(logError);
    });
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div role="alert" style={{ padding: '2rem', textAlign: 'center' }}>
          Something went wrong. Please reload the page.
        </div>
      }
    >
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);

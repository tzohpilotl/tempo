import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './global.css';

if (import.meta.env.PROD) {
  Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN });
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

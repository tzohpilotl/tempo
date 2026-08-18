import { lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/theme';
import { TimerProvider } from './context/timer';
import { OnlineStatusProvider, useOnlineStatus } from './context/onlineStatus';
import { useIsNetworkFailing } from './utils/networkStatus';
import { drainQueue } from './utils/offlineQueue';
import { request } from './api/client';
import { logError } from './utils/logger';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import AppLayout from './layouts/AppLayout';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SessionsPage = lazy(() => import('./pages/SessionsPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));

/**
 * Drains the offline write queue on initial load (if already reachable) and
 * whenever either connectivity signal indicates we're reachable again.
 * navigator.onLine's 'online' event alone isn't enough here — it doesn't
 * fire when a dead Wi-Fi uplink or throttled cellular data recovers, same
 * gap as the offline banner. networkFailing flipping false (a request just
 * succeeded) catches that case too.
 */
function QueueSync() {
  const online = useOnlineStatus();
  const networkFailing = useIsNetworkFailing();

  useEffect(() => {
    if (online && !networkFailing) drainQueue(request).catch(logError);
  }, [online, networkFailing]);

  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <OnlineStatusProvider>
        <QueueSync />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route element={<TimerProvider><AppLayout /></TimerProvider>}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/sessions" element={<SessionsPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </OnlineStatusProvider>
    </ThemeProvider>
  );
}

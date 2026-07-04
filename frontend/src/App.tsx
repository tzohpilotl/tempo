import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/theme';
import { TimerProvider } from './context/timer';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import AppLayout from './layouts/AppLayout';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SessionsPage = lazy(() => import('./pages/SessionsPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));

export default function App() {
  return (
    <ThemeProvider>
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
    </ThemeProvider>
  );
}

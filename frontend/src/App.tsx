import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/theme';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import SessionsPage from './pages/SessionsPage';
import ProjectsPage from './pages/ProjectsPage';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

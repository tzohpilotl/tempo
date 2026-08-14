import { useEffect, Suspense } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/Sidebar';
import type { User } from '../types';
import styles from './AppLayout.module.css';

export type AppLayoutContext = User;

export default function AppLayout() {
  const { user, loading: authLoading, unauthenticated, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && unauthenticated) navigate('/login', { replace: true });
  }, [unauthenticated, authLoading, navigate]);

  if (authLoading) return null;

  if (error && !user) {
    return (
      <div className={styles.offline}>
        <p>Can't reach Tempo. Check your connection and try again.</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className={styles.root}>
      <Sidebar user={user} />
      <Suspense fallback={null}>
        <Outlet context={user satisfies AppLayoutContext} />
      </Suspense>
    </div>
  );
}

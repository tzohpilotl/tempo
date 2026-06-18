import { useEffect, Suspense } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/Sidebar';
import type { User } from '../types';
import styles from './AppLayout.module.css';

export type AppLayoutContext = User;

export default function AppLayout() {
  const { user, loading: authLoading, unauthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && unauthenticated) navigate('/login', { replace: true });
  }, [unauthenticated, authLoading, navigate]);

  if (authLoading || !user) return null;

  return (
    <div className={styles.root}>
      <Sidebar user={user} />
      <Suspense fallback={null}>
        <Outlet context={user satisfies AppLayoutContext} />
      </Suspense>
    </div>
  );
}

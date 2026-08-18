import { useEffect, Suspense } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../context/onlineStatus';
import { useIsNetworkFailing } from '../utils/networkStatus';
import Sidebar from '../components/Sidebar';
import type { User } from '../types';
import styles from './AppLayout.module.css';

export type AppLayoutContext = User;

export default function AppLayout() {
  const { user, loading: authLoading, unauthenticated, error } = useAuth();
  const navigate = useNavigate();
  const browserOnline = useOnlineStatus();
  const networkFailing = useIsNetworkFailing();
  // navigator.onLine only catches "no network interface at all" (Airplane
  // Mode, Wi-Fi off) — it stays "online" through a dead Wi-Fi uplink or
  // exhausted cellular data. networkFailing catches those, but only after an
  // actual request has failed. Combining both gives the fastest true signal.
  const isOffline = !browserOnline || networkFailing;

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
      <div className={styles.content}>
        {isOffline && (
          <div className={styles.offlineBanner}>Offline — showing last synced data</div>
        )}
        <Suspense fallback={null}>
          <Outlet context={user satisfies AppLayoutContext} />
        </Suspense>
      </div>
    </div>
  );
}

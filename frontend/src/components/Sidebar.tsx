import { useNavigate, useLocation } from 'react-router-dom';
import type { User } from '../types';
import { useTheme } from '../context/theme';
import { auth } from '../api/client';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { logError } from '../utils/logger';
import styles from './Sidebar.module.css';

interface Props {
  user: User;
}

export default function Sidebar({ user }: Props) {
  const { theme, toggleTheme } = useTheme();
  const { supported: pushSupported, subscribed: pushSubscribed, loading: pushLoading, toggle: togglePush } = usePushNotifications();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = async () => {
    try {
      await auth.logout();
    } catch (err) {
      logError(err);
    }
    // Full reload rather than client-side navigate — the app has no shared
    // auth state to invalidate, so this is the simplest way to make every
    // component (starting with useAuth) forget the logged-in user.
    window.location.href = '/login';
  };

  const activeTab = pathname.startsWith('/sessions')
    ? 'sessions'
    : pathname.startsWith('/projects')
    ? 'projects'
    : 'timer';

  const themeTitle = theme === 'tui' ? 'Switch to default theme' : 'Switch to TUI theme';
  const themeIcon = theme === 'tui' ? <DefaultThemeIcon /> : <TerminalIcon />;
  const pushTitle = pushSubscribed ? 'Turn off notifications' : 'Turn on notifications';

  return (
    <aside className={styles.sidebar}>
      {/* Top bar: on desktop shows only logo; on mobile shows logo + user controls */}
      <div className={styles.topBar}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>◈</span>
          <span className={styles.logoText}>Tempo</span>
        </div>
        {/* Shown only on mobile */}
        <div className={styles.topActions}>
          <div className={styles.avatar}>
            {user.display_name.charAt(0).toUpperCase()}
          </div>
          <button className={styles.themeBtn} onClick={toggleTheme} title={themeTitle}>
            {themeIcon}
          </button>
          {pushSupported && (
            <button
              className={styles.themeBtn}
              onClick={togglePush}
              disabled={pushLoading}
              title={pushTitle}
            >
              {pushSubscribed ? <BellIcon /> : <BellOffIcon />}
            </button>
          )}
          <button
            className={styles.logoutBtn}
            onClick={handleLogout}
            title="Sign out"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        <button
          className={`${styles.navItem} ${activeTab === 'timer' ? styles.active : ''}`}
          onClick={() => navigate('/dashboard')}
        >
          <TimerIcon />
          Timer
        </button>
        <button
          className={`${styles.navItem} ${activeTab === 'sessions' ? styles.active : ''}`}
          onClick={() => navigate('/sessions')}
        >
          <SessionsIcon />
          Sessions
        </button>
        <button
          className={`${styles.navItem} ${activeTab === 'projects' ? styles.active : ''}`}
          onClick={() => navigate('/projects')}
        >
          <ProjectsIcon />
          Projects
        </button>
      </nav>

      {/* Footer: shown on desktop only */}
      <div className={styles.footer}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {user.display_name.charAt(0).toUpperCase()}
          </div>
          <div className={styles.userText}>
            <span className={styles.userName}>{user.display_name}</span>
            <span className={styles.userEmail}>{user.email}</span>
          </div>
        </div>
        <button className={styles.themeBtn} onClick={toggleTheme} title={themeTitle}>
          {themeIcon}
        </button>
        {pushSupported && (
          <button
            className={styles.themeBtn}
            onClick={togglePush}
            disabled={pushLoading}
            title={pushTitle}
          >
            {pushSubscribed ? <BellIcon /> : <BellOffIcon />}
          </button>
        )}
        <button
          className={styles.logoutBtn}
          onClick={handleLogout}
          title="Sign out"
        >
          <LogoutIcon />
        </button>
      </div>
      <div className={styles.version}>v{__APP_VERSION__}</div>
    </aside>
  );
}

function TimerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function ProjectsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/>
    </svg>
  );
}

function SessionsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 17 10 11 4 5"/>
      <line x1="12" y1="19" x2="20" y2="19"/>
    </svg>
  );
}

function DefaultThemeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

function BellOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      <path d="M18.63 13A17.89 17.89 0 0 1 18 8"/>
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/>
      <path d="M18 8a6 6 0 0 0-9.33-5"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

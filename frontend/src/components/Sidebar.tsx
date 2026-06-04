import { useNavigate } from 'react-router-dom';
import type { User } from '../types';
import { useTheme } from '../context/theme';
import styles from './Sidebar.module.css';

interface Props {
  user: User;
  activeTab: 'timer' | 'sessions';
}

export default function Sidebar({ user, activeTab }: Props) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <span className={styles.logoMark}>◈</span>
        <span className={styles.logoText}>Tempo</span>
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
      </nav>

      {/* User section at bottom */}
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
        <button
          className={styles.themeBtn}
          onClick={toggleTheme}
          title={theme === 'tui' ? 'Switch to default theme' : 'Switch to TUI theme'}
        >
          {theme === 'tui' ? <DefaultThemeIcon /> : <TerminalIcon />}
        </button>
        <button
          className={styles.logoutBtn}
          onClick={() => { window.location.href = '/api/auth/logout'; }}
          title="Sign out"
        >
          <LogoutIcon />
        </button>
      </div>
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

function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

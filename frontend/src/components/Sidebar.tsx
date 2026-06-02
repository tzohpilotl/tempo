
import type { User } from '../types';
import styles from './Sidebar.module.css';

interface Props {
  user: User;
  activeTab: 'timer';
}

export default function Sidebar({ user, activeTab }: Props) {
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
        >
          <TimerIcon />
          Timer
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

function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

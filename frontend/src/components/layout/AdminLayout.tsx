import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Avatar } from '../ui/Avatar';
import styles from './AdminLayout.module.css';

const NAV = [
  { to: '/admin',          label: '📊  Dashboard', exact: true },
  { to: '/admin/users',    label: '👥  Users' },
  { to: '/admin/settings', label: '⚙️  Settings' },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/auth/login'); };

  return (
    <div className={styles.root}>
      {/* Mobile Top Header */}
      <div className={styles.mobileHeader}>
        <div className={styles.logoRow}>
          <div className={styles.logoMark}>H</div>
          <span className={styles.logoText}>DealFlow360</span>
        </div>
        <button
          className={styles.menuToggle}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {mobileOpen && (
        <div className={styles.mobileOverlay} onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.logoRow}>
          <div className={styles.logoMark}>H</div>
          <span className={styles.logoText}>DealFlow360</span>
          <span className={styles.adminBadge}>Admin</span>
        </div>
        <nav className={styles.nav}>
          {NAV.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.bottom}>
          <div className={styles.userInfo}>
            <Avatar name={user?.name} src={user?.avatar} size="md" />
            <div>
              <div className={styles.userName}>{user?.name}</div>
              <div className={styles.userRole}>Administrator</div>
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </aside>
      <main className={styles.main}><Outlet /></main>
    </div>
  );
}

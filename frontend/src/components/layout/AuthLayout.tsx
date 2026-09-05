import { Outlet } from 'react-router-dom';
import styles from './AuthLayout.module.css';

export default function AuthLayout() {
  return (
    <div className={styles.root}>
      {/* Left panel — Branding */}
      <div className={styles.brand}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>H</div>
          <span className={styles.logoText}>DealFlow360</span>
        </div>
        <h1 className={styles.tagline}>Build. Ship.<br />Win.</h1>
        <p className={styles.sub}>Your hackathon-ready frontend template</p>

        <div className={styles.featureIcons}>
          {['⚡', '🎨', '🔒', '📊', '🚀'].map((icon) => (
            <span key={icon} className={styles.featureIcon}>{icon}</span>
          ))}
        </div>
      </div>

      {/* Right panel — Form */}
      <div className={styles.form}>
        <Outlet />
      </div>
    </div>
  );
}

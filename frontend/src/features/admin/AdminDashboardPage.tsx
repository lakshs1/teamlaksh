import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import styles from './AdminDashboardPage.module.css';

const KPI = [
  { icon: '👥', label: 'Total Users', value: '2,847', trend: '↑ +12% this month' },
  { icon: '💰', label: 'Revenue', value: '$48,200', trend: '↑ +18% this month' },
  { icon: '📦', label: 'Total Orders', value: '1,523', trend: 'Platform lifetime' },
  { icon: '⚡', label: 'Active Sessions', value: '342', trend: 'Right now' },
];

const RECENT_USERS = [
  { id: '1', name: 'Jane Cooper', email: 'jane@example.com', role: 'USER' },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com', role: 'MANAGER' },
  { id: '3', name: 'Alice Johnson', email: 'alice@example.com', role: 'USER' },
  { id: '4', name: 'Carlos Ruiz', email: 'carlos@example.com', role: 'USER' },
  { id: '5', name: 'Diana Kim', email: 'diana@example.com', role: 'MANAGER' },
];

const RECENT_ACTIVITY = [
  { id: '1', title: 'New user registration', sub: 'jane@example.com', badge: 'USER' },
  { id: '2', title: 'Order completed', sub: 'Order #2048 • $120.00', badge: 'COMPLETED' },
  { id: '3', title: 'Support ticket opened', sub: 'Ticket #412 • Billing', badge: 'PENDING' },
  { id: '4', title: 'Payment received', sub: 'Stripe • $320.00', badge: 'SUCCESS' },
  { id: '5', title: 'User upgraded plan', sub: 'bob@example.com • PRO', badge: 'INFO' },
];

export default function AdminDashboardPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Admin Dashboard</h1>
        <p className={styles.subtitle}>Platform-wide metrics and recent activity.</p>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        {KPI.map((kpi) => (
          <Card key={kpi.label} variant="bordered" padding="md" className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>{kpi.label}</span>
              <span className={styles.kpiIcon}>{kpi.icon}</span>
            </div>
            <div className={styles.kpiValue}>{kpi.value}</div>
            <div className={styles.kpiTrend}>{kpi.trend}</div>
          </Card>
        ))}
      </div>

      {/* Alert Banner */}
      <div className={styles.alertBanner}>
        <div className={styles.alertLeft}>
          <span className={styles.alertIcon}>⚠️</span>
          <div>
            <h2 className={styles.alertTitle}>3 Pending Reviews</h2>
            <p className={styles.alertText}>New submissions require admin review before publishing.</p>
          </div>
        </div>
        <Button>Review Now →</Button>
      </div>

      {/* Feed Panels */}
      <div className={styles.panelsGrid}>
        <Card variant="bordered" padding="md">
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Recent Users</h2>
            <Button variant="outline" size="sm">View All →</Button>
          </div>
          <div className={styles.feedList}>
            {RECENT_USERS.map((u) => (
              <div key={u.id} className={styles.feedItem}>
                <div className={styles.itemLeft}>
                  <span className={styles.name}>{u.name}</span>
                  <span className={styles.sub}>{u.email}</span>
                </div>
                <Badge variant={u.role === 'MANAGER' ? 'primary' : 'neutral'} size="sm">{u.role}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card variant="bordered" padding="md">
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Recent Activity</h2>
            <Button variant="outline" size="sm">View All →</Button>
          </div>
          <div className={styles.feedList}>
            {RECENT_ACTIVITY.map((a) => (
              <div key={a.id} className={styles.feedItem}>
                <div className={styles.itemLeft}>
                  <span className={styles.name}>{a.title}</span>
                  <span className={styles.sub}>{a.sub}</span>
                </div>
                <Badge variant="neutral" size="sm">{a.badge}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

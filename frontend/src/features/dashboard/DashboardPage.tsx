import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { Card } from '../../components/ui/Card';
import styles from './DashboardPage.module.css';

const CHART_COLORS = ['#714B67', '#2563EB', '#059669', '#D97706'];

const TREND_DATA = [
  { label: 'Mon', value: 120, value2: 80 },
  { label: 'Tue', value: 180, value2: 110 },
  { label: 'Wed', value: 150, value2: 95 },
  { label: 'Thu', value: 220, value2: 140 },
  { label: 'Fri', value: 280, value2: 190 },
  { label: 'Sat', value: 200, value2: 130 },
  { label: 'Sun', value: 160, value2: 100 },
];

const PIE_DATA = [
  { name: 'Category A', value: 35 },
  { name: 'Category B', value: 25 },
  { name: 'Category C', value: 20 },
  { name: 'Category D', value: 20 },
];

const KPI = [
  { icon: '📊', label: 'Total Revenue', value: '$12,450', trend: '↑ +14% this week' },
  { icon: '👥', label: 'Active Users', value: '1,247', trend: '↑ +8% this month' },
  { icon: '📦', label: 'Orders', value: '384', trend: '→ Steady' },
  { icon: '⭐', label: 'Avg Rating', value: '4.8', trend: '↑ +0.2 this week' },
];

const ACTIVITY = [
  { id: '1', title: 'New user registered', subtitle: 'jane@example.com • USER', time: '2m ago' },
  { id: '2', title: 'Order #1042 completed', subtitle: '$89.00 • Premium Plan', time: '15m ago' },
  { id: '3', title: 'Payment received', subtitle: 'Stripe • $240.00', time: '1h ago' },
  { id: '4', title: 'User upgraded plan', subtitle: 'john@example.com • PRO', time: '3h ago' },
  { id: '5', title: 'Support ticket resolved', subtitle: 'Ticket #892 • Billing', time: '5h ago' },
];

export default function DashboardPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>Overview of your key metrics and recent activity.</p>
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

      {/* Charts Row */}
      <div className={styles.chartsRow}>
        <Card variant="bordered" padding="md" className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Weekly Trend</h2>
          <div className={styles.chartContent}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TREND_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" stroke="var(--color-text-muted)" fontSize={12} />
                <YAxis stroke="var(--color-text-muted)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text)',
                    boxShadow: 'var(--shadow-md)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#714B67"
                  strokeWidth={2}
                  fill="rgba(113, 75, 103, 0.08)"
                />
                <Area
                  type="monotone"
                  dataKey="value2"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fill="rgba(37, 99, 235, 0.06)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card variant="bordered" padding="md" className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Breakdown</h2>
          <div className={styles.chartContent}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={PIE_DATA}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name }) => name}
                >
                  {PIE_DATA.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-md)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card variant="bordered" padding="md">
        <h2 className={styles.panelTitle}>Recent Activity</h2>
        <div className={styles.feedList}>
          {ACTIVITY.map((item) => (
            <div key={item.id} className={styles.feedItem}>
              <div className={styles.itemLeft}>
                <span className={styles.itemTitle}>{item.title}</span>
                <span className={styles.itemSub}>{item.subtitle}</span>
              </div>
              <span className={styles.itemTime}>{item.time}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

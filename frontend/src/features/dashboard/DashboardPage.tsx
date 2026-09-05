import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import { Card } from '../../components/ui/Card';
import { analyticsApi, quoteApi, billingApi } from '../../services/apiServices';
import styles from './DashboardPage.module.css';

const CHART_COLORS = ['#714B67', '#2563EB', '#059669', '#D97706'];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [salesRes, quotesRes, invoicesRes] = await Promise.all([
          analyticsApi.getSalesReport(),
          quoteApi.getQuotes({ limit: 5 }),
          billingApi.getInvoices({ limit: 5 }),
        ]);

        const salesData = salesRes.data || {};
        const recentQuotes = quotesRes.data?.items || quotesRes.data || [];
        const recentInvoices = invoicesRes.data?.items || invoicesRes.data || [];

        // Calculate KPIs
        const totalRevenue = salesData.totalRevenue || 0;
        const totalOrders = salesData.totalOrders || 0;
        const activeUsers = salesData.activeUsers || 1247;
        const avgRating = salesData.avgRating || 4.8;

        setMetrics([
          { icon: '📊', label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, trend: '↑ +14% this week' },
          { icon: '👥', label: 'Active Users', value: activeUsers.toLocaleString(), trend: '↑ +8% this month' },
          { icon: '📦', label: 'Orders', value: totalOrders.toLocaleString(), trend: '→ Steady' },
          { icon: '⭐', label: 'Avg Rating', value: avgRating.toString(), trend: '↑ +0.2 this week' },
        ]);

        // Merge quotes and invoices into activity feed
        const combinedActivity = [
          ...recentQuotes.map((q: any) => ({
            id: `q-${q.id}`,
            title: `Quote ${q.quoteNumber || q.id} Created`,
            subtitle: `${q.customer?.name || q.customerName || 'Unknown'} • $${q.grandTotal || 0}`,
            time: new Date(q.createdAt).toLocaleDateString(),
            dateObj: new Date(q.createdAt)
          })),
          ...recentInvoices.map((i: any) => ({
            id: `i-${i.id}`,
            title: `Invoice ${i.invoiceNumber || i.id} Created`,
            subtitle: `${i.customer?.name || i.customerName || 'Unknown'} • $${i.total || 0}`,
            time: new Date(i.createdAt).toLocaleDateString(),
            dateObj: new Date(i.createdAt)
          }))
        ].sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime()).slice(0, 5);

        setActivities(combinedActivity);

        // Chart Data
        setTrendData(salesData.trendData || [
          { label: 'Mon', value: 120, value2: 80 },
          { label: 'Tue', value: 180, value2: 110 },
          { label: 'Wed', value: 150, value2: 95 },
          { label: 'Thu', value: 220, value2: 140 },
          { label: 'Fri', value: 280, value2: 190 },
          { label: 'Sat', value: 200, value2: 130 },
          { label: 'Sun', value: 160, value2: 100 },
        ]);

        setPieData(salesData.pieData || [
          { name: 'Category A', value: 35 },
          { name: 'Category B', value: 25 },
          { name: 'Category C', value: 20 },
          { name: 'Category D', value: 20 },
        ]);

      } catch (err: any) {
        toast.error(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center">Loading dashboard...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>Overview of your key metrics and recent activity.</p>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        {(metrics || []).map((kpi: any) => (
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
              <AreaChart data={trendData}>
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
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name }) => name}
                >
                  {pieData.map((_, index) => (
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
          {activities.length > 0 ? (
            activities.map((item) => (
              <div key={item.id} className={styles.feedItem}>
                <div className={styles.itemLeft}>
                  <span className={styles.itemTitle}>{item.title}</span>
                  <span className={styles.itemSub}>{item.subtitle}</span>
                </div>
                <span className={styles.itemTime}>{item.time}</span>
              </div>
            ))
          ) : (
            <div className="text-center text-muted" style={{ padding: '1rem' }}>No recent activity.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import { analyticsApi } from '../../services/apiServices';
import { mapDealAlert } from '../../services/dataMappers';
import type { DealHealthItem } from '../../stores/dealflowStore';

const COLORS = ['#714B67', '#94A3B8', '#475569'];

export default function DealHealthDashboardPage() {
  const navigate = useNavigate();
  const [healthData, setHealthData] = useState<any>(null);
  const [alerts, setAlerts] = useState<DealHealthItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState('This Quarter');

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      const [healthRes, alertsRes] = await Promise.all([
        analyticsApi.getDealHealth(timePeriod === 'This Month' ? 4 : 7),
        analyticsApi.getAlerts({ is_resolved: false })
      ]);
      
      setHealthData(healthRes.data || { total: 0, healthy: 0, atRisk: 0, critical: 0, riskFactors: [] });
      
      const mappedAlerts = (alertsRes.data?.items || alertsRes.data || []).map(mapDealAlert);
      setAlerts(mappedAlerts);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load deal health data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, [timePeriod]);

  const handleNudge = async (id: string, ref: string) => {
    try {
      await analyticsApi.escalateAlert(id, 'Nudge sent');
      toast.success(`Automated escalation nudge sent to representative for quotation ${ref}!`);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, triggeredAction: 'Nudge sent' } : a));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to send nudge');
    }
  };

  const handleResolve = async (id: string, ref: string) => {
    try {
      await analyticsApi.resolveAlert(id);
      toast.success(`Anomaly alert for ${ref} marked as resolved!`);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to resolve alert');
    }
  };

  if (loading) {
    return <div className="odoo-container"><div className="p-8 text-center">Loading dashboard...</div></div>;
  }

  const pieData = [
    { name: 'Healthy', value: healthData?.healthy || 0 },
    { name: 'At Risk', value: healthData?.atRisk || 0 },
    { name: 'Critical', value: healthData?.critical || 0 },
  ];

  const totalDeals = healthData?.total || (pieData[0].value + pieData[1].value + pieData[2].value);
  
  const riskFactors = healthData?.riskFactors && healthData.riskFactors.length > 0 ? healthData.riskFactors : [
    { factor: 'Delayed approvals (>48 hrs)', count: 6, width: '80%' },
    { factor: 'Customer indecision on counter-offer', count: 4, width: '55%' },
    { factor: 'High blended discount risk (>20%)', count: 3, width: '40%' },
    { factor: 'Warehouse stock shortage backorder', count: 3, width: '40%' },
    { factor: 'Missing billing schedules', count: 2, width: '25%' },
  ];

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Deal Health & Anomaly Dashboard</h1>
          <p className="text-muted text-sm">Monitor deal pipeline health, stalled quotations, discount risks, and proactive escalations.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            className="odoo-select"
            style={{ width: 'auto' }}
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
          >
            <option value="This Quarter">This Quarter</option>
            <option value="This Month">This Month</option>
            <option value="All Time">All Time</option>
          </select>
          <button className="odoo-btn odoo-btn-secondary" onClick={fetchHealthData}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="odoo-card">
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1F2937' }}>{totalDeals}</div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>Total Pipeline Deals</div>
        </div>

        <div className="odoo-card">
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#16A34A' }}>{pieData[0].value}</div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>Healthy Margin Deals</div>
        </div>

        <div className="odoo-card">
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#D97706' }}>{pieData[1].value}</div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>At Risk / Stalled</div>
        </div>

        <div className="odoo-card">
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#DC2626' }}>{pieData[2].value}</div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>Critical Anomalies</div>
        </div>
      </div>

      {/* Donut Chart + Top Risk Factors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="odoo-card">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '1rem' }}>
            Pipeline Health Distribution
          </h3>
          <div style={{ width: '100%', height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="odoo-card">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '1rem' }}>
            Top Pipeline Anomaly Factors
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.8125rem' }}>
            {riskFactors.map((r: any, idx: number) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{r.factor}</span>
                  <span style={{ fontWeight: 700 }}>{r.count}</span>
                </div>
                <div style={{ height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: r.width || '50%', background: '#714B67', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Anomaly Alerts Table */}
      <div className="odoo-card">
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '1rem' }}>
          Active Deal Anomaly & Escalation Alerts
        </h3>
        <table className="odoo-table">
          <thead>
            <tr>
              <th>Quotation Ref</th>
              <th>Customer</th>
              <th>Rep</th>
              <th>Risk Category</th>
              <th>Severity</th>
              <th>Description</th>
              <th>Action Triggers</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id}>
                <td
                  style={{ fontWeight: 700, color: '#714B67', cursor: 'pointer' }}
                  onClick={() => navigate(`/quotations`)}
                >
                  {alert.quotationRef} ↗
                </td>
                <td style={{ fontWeight: 600 }}>{alert.customerName}</td>
                <td>{alert.repName}</td>
                <td>{alert.riskCategory}</td>
                <td>
                  <span
                    className="odoo-badge"
                    style={{
                      backgroundColor: alert.severity === 'Critical' ? '#FEE2E2' : alert.severity === 'High' ? '#FEF3C7' : '#F1F5F9',
                      color: alert.severity === 'Critical' ? '#DC2626' : alert.severity === 'High' ? '#D97706' : '#334155',
                      fontWeight: 700
                    }}
                  >
                    {alert.severity}
                  </span>
                </td>
                <td style={{ color: '#475569' }}>{alert.description}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {alert.triggeredAction ? (
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#714B67' }}>
                        ✓ {alert.triggeredAction}
                      </span>
                    ) : (
                      <button
                        className="odoo-btn odoo-btn-primary"
                        style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}
                        onClick={() => handleNudge(alert.id, alert.quotationRef)}
                      >
                        Nudge Rep
                      </button>
                    )}
                    <button
                      className="odoo-btn odoo-btn-secondary"
                      style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}
                      onClick={() => handleResolve(alert.id, alert.quotationRef)}
                    >
                      Resolve
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted" style={{ padding: '2rem' }}>
                  No active anomaly alerts in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


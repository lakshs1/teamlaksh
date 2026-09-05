import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import { analyticsApi } from '../../services/apiServices';
import { mapDealAlert } from '../../services/dataMappers';
import type { DealHealthItem } from '../../stores/dealflowStore';

const COLORS = ['#714B67', '#94A3B8', '#475569'];

export default function DealHealthDashboardPage() {
  const [healthData, setHealthData] = useState<any>(null);
  const [alerts, setAlerts] = useState<DealHealthItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [healthRes, alertsRes] = await Promise.all([
          analyticsApi.getDealHealth(),
          analyticsApi.getAlerts()
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
    fetchData();
  }, []);

  const handleNudge = async (id: string, ref: string) => {
    try {
      await analyticsApi.escalateAlert(id, 'Nudge sent');
      toast.success(`Automated escalation nudge sent to representative for quotation ${ref}!`);
      // Update local state to reflect the triggered action
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, triggeredAction: 'Nudge sent' } : a));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to send nudge');
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading dashboard...</div>;
  }

  const pieData = [
    { name: 'Healthy', value: healthData?.healthy || 0 },
    { name: 'At Risk', value: healthData?.atRisk || 0 },
    { name: 'Critical', value: healthData?.critical || 0 },
  ];

  const totalDeals = healthData?.total || (pieData[0].value + pieData[1].value + pieData[2].value);
  
  const riskFactors = healthData?.riskFactors || [
    { factor: 'Delayed approvals', count: 6, width: '80%' },
    { factor: 'Customer indecision', count: 4, width: '55%' },
    { factor: 'Pricing concerns', count: 3, width: '40%' },
    { factor: 'Competitive pressure', count: 3, width: '40%' },
    { factor: 'Missing documents', count: 2, width: '25%' },
  ];

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Deal Health & Anomaly Dashboard</h1>
          <p className="text-muted text-sm">Monitor deal pipeline health, risks, and unusual activities.</p>
        </div>
        <select className="odoo-select" style={{ width: 'auto' }}>
          <option>This Quarter</option>
          <option>This Month</option>
        </select>
      </div>

      {/* Top 4 KPI Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="odoo-card">
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1F2937' }}>{totalDeals}</div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>Total Deals</div>
        </div>

        <div className="odoo-card">
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#714B67' }}>{pieData[0].value}</div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>Healthy</div>
        </div>

        <div className="odoo-card">
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#475569' }}>{pieData[1].value}</div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>At Risk</div>
        </div>

        <div className="odoo-card">
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1F2937' }}>{pieData[2].value}</div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>Critical</div>
        </div>
      </div>

      {/* Donut Chart + Top Risk Factors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="odoo-card">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '1rem' }}>
            Deal Pipeline Health
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
            Top Risk Factors
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
          Active Deal Anomaly Alerts
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
              <th>Action Trigger</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id}>
                <td style={{ fontWeight: 700, color: '#714B67' }}>{alert.quotationRef}</td>
                <td style={{ fontWeight: 600 }}>{alert.customerName}</td>
                <td>{alert.repName}</td>
                <td>{alert.riskCategory}</td>
                <td>
                  <span className="odoo-badge">{alert.severity}</span>
                </td>
                <td style={{ color: '#475569' }}>{alert.description}</td>
                <td>
                  {alert.triggeredAction ? (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#714B67' }}>
                      {alert.triggeredAction}
                    </span>
                  ) : (
                    <button
                      className="odoo-btn odoo-btn-primary"
                      style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => handleNudge(alert.id, alert.quotationRef)}
                    >
                      Trigger Escalation Nudge
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted" style={{ padding: '2rem' }}>
                  No active anomaly alerts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

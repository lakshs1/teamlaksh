import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDealFlowStore } from '../../stores/dealflowStore';

const salesData = [
  { month: 'Jan', sales: 4.2 },
  { month: 'Feb', sales: 5.8 },
  { month: 'Mar', sales: 5.1 },
  { month: 'Apr', sales: 6.5 },
  { month: 'May', sales: 8.0 },
  { month: 'Jun', sales: 7.2 },
  { month: 'Jul', sales: 9.5 },
  { month: 'Aug', sales: 11.0 },
  { month: 'Sep', sales: 14.2 },
];

export default function SalesDashboardPage() {
  const navigate = useNavigate();
  const { approvals, quotations, dealHealthAlerts } = useDealFlowStore();

  const pendingApprovalsCount = approvals.filter((a) => a.status === 'Pending').length;
  const activeQuotesCount = quotations.length;
  const riskDealsCount = dealHealthAlerts.length;

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Sales Dashboard</h1>
          <p className="text-muted text-sm">Central hub, links out to every module below.</p>
        </div>
      </div>

      {/* Top 3 KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div
          className="odoo-card"
          onClick={() => navigate('/approvals')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem' }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#F8F9FA', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#714B67', fontSize: '1.1rem' }}>
            A
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>Pending Approvals</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1F2937' }}>
              {pendingApprovalsCount} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#64748B' }}>quotations waiting</span>
            </div>
          </div>
        </div>

        <div
          className="odoo-card"
          onClick={() => navigate('/quotations')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem' }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#F8F9FA', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#714B67', fontSize: '1.1rem' }}>
            Q
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>Open Quotations</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1F2937' }}>
              {activeQuotesCount} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#64748B' }}>active deals</span>
            </div>
          </div>
        </div>

        <div
          className="odoo-card"
          onClick={() => navigate('/deal-health')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem' }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#F8F9FA', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#714B67', fontSize: '1.1rem' }}>
            H
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>AI-Risk Deals</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1F2937' }}>
              {riskDealsCount} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#64748B' }}>flagged by Deal Health</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Chart + Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Left: Chart */}
        <div className="odoo-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1F2937' }}>Sales This Month</h3>
            <select className="odoo-select" style={{ width: 'auto' }}>
              <option>This Year</option>
              <option>This Quarter</option>
            </select>
          </div>

          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#714B67" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#714B67" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip />
                <Area type="monotone" dataKey="sales" stroke="#714B67" strokeWidth={3} fillOpacity={1} fill="url(#purpleGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Quick Actions & Recent Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="odoo-card">
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.85rem' }}>
              Quick Actions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                className="odoo-btn odoo-btn-primary"
                onClick={() => navigate('/quotations/q-1')}
                onClick={() => navigate('/quotations/create')}
                style={{ justifyContent: 'flex-start' }}
              >
                + New Quotation
              </button>
              <button
                className="odoo-btn odoo-btn-secondary"
                onClick={() => navigate('/approvals')}
                style={{ justifyContent: 'flex-start' }}
              >
                View Approvals
              </button>
              <button
                className="odoo-btn odoo-btn-secondary"
                onClick={() => navigate('/fulfillment')}
                style={{ justifyContent: 'flex-start' }}
              >
                Create Sales Order
              </button>
              <button
                className="odoo-btn odoo-btn-secondary"
                onClick={() => navigate('/deal-health')}
                style={{ justifyContent: 'flex-start' }}
              >
                View Deal Health
              </button>
            </div>
          </div>

          <div className="odoo-card">
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.85rem' }}>
              Recent Activity
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8125rem' }}>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <span className="odoo-badge">Quote</span>
                <div>
                  <div style={{ fontWeight: 600 }}>Acme Corp quotation sent</div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>2 hours ago</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <span className="odoo-badge">Order</span>
                <div>
                  <div style={{ fontWeight: 600 }}>Global Mart order confirmed</div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>5 hours ago</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <span className="odoo-badge">Alert</span>
                <div>
                  <div style={{ fontWeight: 600 }}>Sunrise Retail flagged by risk model</div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>1 day ago</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

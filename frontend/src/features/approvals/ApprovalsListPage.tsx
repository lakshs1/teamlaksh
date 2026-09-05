import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDealFlowStore } from '../../stores/dealflowStore';

export default function ApprovalsListPage() {
  const navigate = useNavigate();
  const { approvals } = useDealFlowStore();
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');

  const filteredApprovals = approvals.filter((a) => filter === 'All' || a.status === filter);

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Approvals</h1>
          <p className="text-muted text-sm">Review discount thresholds, blended risk scores, and approval chains.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((tab) => (
          <button
            key={tab}
            className={`odoo-btn ${filter === tab ? 'odoo-btn-primary' : 'odoo-btn-secondary'}`}
            onClick={() => setFilter(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="odoo-table-container">
        <table className="odoo-table">
          <thead>
            <tr>
              <th><input type="checkbox" /></th>
              <th>Reference</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Requested By</th>
              <th>Risk Score</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredApprovals.map((app) => (
              <tr key={app.id}>
                <td><input type="checkbox" /></td>
                <td style={{ fontWeight: 700, color: '#714B67' }}>{app.reference}</td>
                <td style={{ fontWeight: 600 }}>{app.customerName}</td>
                <td>{app.requestType}</td>
                <td style={{ fontWeight: 700 }}>₹{app.amount.toLocaleString('en-IN')}</td>
                <td>{app.requestedBy}</td>
                <td>
                  <span className="odoo-badge">{app.blendedRiskScore}</span>
                </td>
                <td>
                  <span className="odoo-badge">{app.status}</span>
                </td>
                <td>
                  <button
                    className="odoo-btn odoo-btn-secondary"
                    style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                    onClick={() => navigate(`/approvals/${app.id}`)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

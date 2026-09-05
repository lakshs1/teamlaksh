import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { approvalApi } from '../../services/apiServices';
import { mapApproval } from '../../services/dataMappers';
import type { ApprovalItem } from '../../stores/dealflowStore';
import toast from 'react-hot-toast';

export default function ApprovalsListPage() {
  const navigate = useNavigate();
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await approvalApi.getPendingApprovals();
        const items = res.data?.items ?? res.data ?? [];
        setApprovals(items.map(mapApproval));
      } catch (err: any) {
        setError(err.message || 'Failed to load approvals');
        toast.error('Failed to load approvals');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredApprovals = approvals.filter((a) => filter === 'All' || a.status === filter);

  if (loading) return <div className="odoo-container"><div className="p-4">Loading approvals...</div></div>;
  if (error) return <div className="odoo-container"><div className="p-4 text-red-500">Error: {error}</div></div>;

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
            {filteredApprovals.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                  No approvals found matching the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

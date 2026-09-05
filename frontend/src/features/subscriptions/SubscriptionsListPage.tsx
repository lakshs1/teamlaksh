import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { billingApi } from '../../services/apiServices';
import { mapSubscription } from '../../services/dataMappers';
import type { SubscriptionItem } from '../../stores/dealflowStore';

export default function SubscriptionsListPage() {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'All' | 'Active' | 'Paused' | 'Cancelled'>('All');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await billingApi.getSubscriptions();
        const items = res.data?.items ?? res.data?.subscriptions ?? res.data ?? [];
        setSubscriptions(items.map(mapSubscription));
      } catch (err: any) {
        setError(err.message || 'Failed to load subscriptions');
        toast.error('Failed to load subscriptions');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredSubs = subscriptions.filter((s) => filter === 'All' || s.status === filter);

  if (loading) return <div className="odoo-container"><div className="p-4">Loading subscriptions...</div></div>;
  if (error) return <div className="odoo-container"><div className="p-4 text-red-500">Error: {error}</div></div>;

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Subscriptions</h1>
          <p className="text-muted text-sm">Hybrid billing, recurring revenue plans, and proration handling.</p>
        </div>
        <button className="odoo-btn odoo-btn-primary">+ New Subscription</button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['All', 'Active', 'Paused', 'Cancelled'] as const).map((tab) => (
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
              <th>Plan</th>
              <th>Start Date</th>
              <th>Next Billing</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSubs.map((s) => (
              <tr key={s.id}>
                <td><input type="checkbox" /></td>
                <td style={{ fontWeight: 700, color: '#714B67' }}>{s.reference}</td>
                <td style={{ fontWeight: 600 }}>{s.customerName}</td>
                <td>{s.planName}</td>
                <td>{s.startDate}</td>
                <td>{s.nextBillingDate}</td>
                <td>
                  <span className="odoo-badge">{s.status}</span>
                </td>
                <td>
                  <button
                    className="odoo-btn odoo-btn-secondary"
                    style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                    onClick={() => navigate(`/subscriptions/${s.id}`)}
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

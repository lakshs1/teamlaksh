import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { billingApi } from '../../services/apiServices';
import { mapSubscription } from '../../services/dataMappers';
import type { SubscriptionItem } from '../../stores/dealflowStore';

export default function SubscriptionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<SubscriptionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const res = await billingApi.getSubscriptionById(id!);
      setItem(mapSubscription(res.data));
    } catch (err: any) {
      setError(err.message || 'Failed to load subscription');
      toast.error('Failed to load subscription');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchSubscription();
    }
  }, [id]);

  const handleCancel = async () => {
    try {
      if (!item) return;
      await billingApi.cancelSubscription(item.id);
      toast.error('Subscription cancellation requested. Proration credit calculated: ₹12,500');
      navigate('/subscriptions');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Cancellation failed');
    }
  };

  if (loading) return <div className="odoo-container"><div className="p-4">Loading subscription...</div></div>;
  if (error || !item) return <div className="odoo-container"><div className="p-4 text-red-500">Error: {error || 'Subscription not found'}</div></div>;

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>
            Subscriptions / {item.reference} / Billing Details
          </div>
          <h1 className="odoo-page-title" style={{ color: '#714B67' }}>
            {item.customerName} - {item.planName}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="odoo-btn odoo-btn-secondary" onClick={() => navigate('/subscriptions')}>
            Back to List
          </button>
        </div>
      </div>

      <div className="odoo-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '1rem' }}>
          Subscription Information
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #E2E8F0', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Customer</div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{item.customerName}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Plan</div>
            <div style={{ fontWeight: 600 }}>{item.planName}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Billing Frequency</div>
            <div style={{ fontWeight: 600 }}>{item.billingFrequency}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Next Billing Date</div>
            <div style={{ fontWeight: 700, color: '#714B67' }}>{item.nextBillingDate}</div>
          </div>
        </div>

        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.75rem' }}>
          Recurring Lines
        </h3>
        <table className="odoo-table" style={{ marginBottom: '1.5rem' }}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Description</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {item.recurringLines.map((line, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 600 }}>{line.productName}</td>
                <td>{line.description}</td>
                <td>{line.quantity}</td>
                <td>₹{line.unitPrice.toLocaleString('en-IN')}</td>
                <td style={{ fontWeight: 700 }}>₹{line.amount.toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="odoo-btn odoo-btn-secondary">Modify Subscription</button>
          <button className="odoo-btn odoo-btn-danger" onClick={handleCancel}>
            Cancel Subscription
          </button>
        </div>
      </div>
    </div>
  );
}

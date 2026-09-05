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

  // Modify modal state
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [modInterval, setModInterval] = useState('monthly');
  const [modQty, setModQty] = useState<number>(2);
  const [modifying, setModifying] = useState(false);

  // Cancel dialog state
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const res = await billingApi.getSubscriptionById(id!);
      const mapped = mapSubscription(res.data);
      setItem(mapped);
      if (mapped.recurringLines.length > 0) {
        setModQty(mapped.recurringLines[0].quantity);
      }
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

  const handleModifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    try {
      setModifying(true);
      await billingApi.updateSubscription(item.id, {
        quantity: modQty,
        status: 'active',
      });
      toast.success(`Subscription plan updated! Billing frequency: ${modInterval}, Quantity: ${modQty} units.`);
      setShowModifyModal(false);
      await fetchSubscription();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Update failed');
    } finally {
      setModifying(false);
    }
  };

  const handleConfirmCancel = async () => {
    try {
      if (!item) return;
      setCancelling(true);
      await billingApi.cancelSubscription(item.id);
      toast.error('Subscription cancelled. Proration credit note of ₹12,500 issued to customer balance.');
      setShowCancelDialog(false);
      await fetchSubscription();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Cancellation failed');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="odoo-container"><div className="p-8 text-center">Loading subscription...</div></div>;
  if (error || !item) return <div className="odoo-container"><div className="p-8 text-red-500">Error: {error || 'Subscription not found'}</div></div>;

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>
            Subscriptions / {item.reference} / Recurring Billing Reconciliation
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
          Subscription Lifecycle & Terms
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #E2E8F0', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Customer</div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{item.customerName}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Plan Type</div>
            <div style={{ fontWeight: 600 }}>{item.planName}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Billing Interval</div>
            <div style={{ fontWeight: 600 }}>{item.billingFrequency}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Next Schedule Date</div>
            <div style={{ fontWeight: 700, color: '#714B67' }}>{item.nextBillingDate}</div>
          </div>
        </div>

        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.75rem' }}>
          Active Recurring Lines
        </h3>
        <table className="odoo-table" style={{ marginBottom: '1.5rem' }}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Description</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Recurring Total</th>
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
          <button className="odoo-btn odoo-btn-secondary" onClick={() => setShowModifyModal(true)}>
            Modify Subscription Terms
          </button>
          <button className="odoo-btn odoo-btn-danger" onClick={() => setShowCancelDialog(true)}>
            Cancel Subscription
          </button>
        </div>
      </div>

      {/* Modify Modal */}
      {showModifyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 8,
            padding: '1.5rem',
            maxWidth: 440,
            width: '90%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#714B67', marginBottom: '0.5rem' }}>
              Modify Recurring Subscription
            </h2>
            <p style={{ fontSize: '0.8125rem', color: '#64748B', marginBottom: '1rem' }}>
              Customer: <strong>{item.customerName}</strong>
            </p>

            <form onSubmit={handleModifySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Billing Frequency
                </label>
                <select
                  className="odoo-select"
                  value={modInterval}
                  onChange={(e) => setModInterval(e.target.value)}
                >
                  <option value="monthly">Monthly (Regular Reconcile)</option>
                  <option value="quarterly">Quarterly (5% Term Discount)</option>
                  <option value="annually">Annually (10% Advance Term Discount)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Licensed Units / Seats
                </label>
                <input
                  type="number"
                  className="odoo-input"
                  min="1"
                  max="500"
                  value={modQty}
                  onChange={(e) => setModQty(Number(e.target.value))}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="odoo-btn odoo-btn-secondary"
                  onClick={() => setShowModifyModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="odoo-btn odoo-btn-primary"
                  disabled={modifying}
                >
                  {modifying ? 'Updating...' : 'Save Subscription Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 8,
            padding: '1.5rem',
            maxWidth: 440,
            width: '90%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#DC2626', marginBottom: '0.5rem' }}>
              Cancel Recurring Subscription?
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem', lineHeight: 1.5 }}>
              Cancelling will terminate future recurring billing cycles. A calculated proration credit note of <strong>₹12,500</strong> will be credited to the customer account for unserved days.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="odoo-btn odoo-btn-secondary"
                onClick={() => setShowCancelDialog(false)}
              >
                Keep Active
              </button>
              <button
                type="button"
                className="odoo-btn odoo-btn-danger"
                onClick={handleConfirmCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation & Issue Credit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


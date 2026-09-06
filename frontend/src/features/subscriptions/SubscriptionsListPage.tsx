import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { billingApi, customerApi, catalogApi } from '../../services/apiServices';
import { mapSubscription } from '../../services/dataMappers';
import type { SubscriptionItem } from '../../stores/dealflowStore';

export default function SubscriptionsListPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'All' | 'Active' | 'Paused' | 'Cancelled'>('All');

  // Modal & Option States
  const [isCreateOpen, setIsCreateOpen] = useState(location.pathname === '/subscriptions/new');
  const [customers, setCustomers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Form Fields
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [interval, setInterval] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('99.00');
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await billingApi.getSubscriptions();
      const rawList = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.items)
        ? res.data.items
        : Array.isArray(res?.items)
        ? res.items
        : [];
      setSubscriptions(rawList.map(mapSubscription));
    } catch (err: any) {
      setError(err.message || 'Failed to load subscriptions');
      toast.error('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    try {
      setLoadingOptions(true);
      const [custRes, planRes, prodRes] = await Promise.all([
        customerApi.getCustomers({ limit: 100 }).catch(() => ({ data: [] })),
        billingApi.getPlans().catch(() => ({ data: [] })),
        catalogApi.getProducts({ limit: 100 }).catch(() => ({ data: [] })),
      ]);

      const custList = Array.isArray(custRes?.data)
        ? custRes.data
        : Array.isArray(custRes?.data?.items)
        ? custRes.data.items
        : Array.isArray(custRes?.items)
        ? custRes.items
        : [];

      const planList = Array.isArray(planRes?.data)
        ? planRes.data
        : Array.isArray(planRes?.data?.items)
        ? planRes.data.items
        : Array.isArray(planRes)
        ? planRes
        : [];

      const prodList = Array.isArray(prodRes?.data)
        ? prodRes.data
        : Array.isArray(prodRes?.data?.items)
        ? prodRes.data.items
        : Array.isArray(prodRes?.items)
        ? prodRes.items
        : [];

      setCustomers(custList);
      setPlans(planList);
      setProducts(prodList);
    } catch (err) {
      console.error('Error loading subscription form options', err);
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
    loadOptions();
  }, [fetchSubscriptions, loadOptions]);

  useEffect(() => {
    if (location.pathname === '/subscriptions/new') {
      setIsCreateOpen(true);
    }
  }, [location.pathname]);

  const handleCloseModal = () => {
    setIsCreateOpen(false);
    if (location.pathname === '/subscriptions/new') {
      navigate('/subscriptions', { replace: true });
    }
  };

  const handleOpenModal = () => {
    setIsCreateOpen(true);
    if (customers.length === 0 || plans.length === 0) {
      loadOptions();
    }
  };

  const handlePlanChange = (planIdStr: string) => {
    setSelectedPlanId(planIdStr);
    if (!planIdStr) return;
    const plan = plans.find((p) => String(p.id) === planIdStr);
    if (plan) {
      if (plan.interval) {
        setInterval(plan.interval as 'monthly' | 'quarterly' | 'yearly');
      }
      if (plan.base_price !== undefined) {
        setUnitPrice(String(plan.base_price));
      } else if (plan.basePrice !== undefined) {
        setUnitPrice(String(plan.basePrice));
      }
      if (plan.product_id) {
        setSelectedProductId(String(plan.product_id));
      } else if (plan.productId) {
        setSelectedProductId(String(plan.productId));
      }
    }
  };

  const handleProductChange = (prodIdStr: string) => {
    setSelectedProductId(prodIdStr);
    if (!prodIdStr) return;
    const prod = products.find((p) => String(p.id) === prodIdStr);
    if (prod && !selectedPlanId) {
      if (prod.base_price !== undefined) {
        setUnitPrice(String(prod.base_price));
      } else if (prod.basePrice !== undefined) {
        setUnitPrice(String(prod.basePrice));
      }
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      toast.error('Please select a customer');
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      toast.error('Quantity must be at least 1');
      return;
    }

    const price = parseFloat(unitPrice);
    if (isNaN(price) || price < 0) {
      toast.error('Please enter a valid unit price');
      return;
    }

    try {
      setSubmitting(true);
      await billingApi.createSubscription({
        customer_id: Number(selectedCustomerId),
        plan_id: selectedPlanId ? Number(selectedPlanId) : undefined,
        product_id: selectedProductId ? Number(selectedProductId) : undefined,
        quantity: qty,
        unit_price: price,
        interval,
        starts_at: startsAt ? new Date(startsAt).toISOString() : undefined,
      });

      toast.success('Subscription created successfully');
      handleCloseModal();
      // Reset form
      setSelectedCustomerId('');
      setSelectedPlanId('');
      setSelectedProductId('');
      setInterval('monthly');
      setQuantity('1');
      setUnitPrice('99.00');
      // Refresh list
      await fetchSubscriptions();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create subscription';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSubs = subscriptions.filter((s) => filter === 'All' || s.status === filter);

  if (loading && subscriptions.length === 0) {
    return <div className="odoo-container"><div className="p-4">Loading subscriptions...</div></div>;
  }
  if (error && subscriptions.length === 0) {
    return <div className="odoo-container"><div className="p-4 text-red-500">Error: {error}</div></div>;
  }

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Subscriptions</h1>
          <p className="text-muted text-sm">Hybrid billing, recurring revenue plans, and proration handling.</p>
        </div>
        <button
          type="button"
          className="odoo-btn odoo-btn-primary"
          onClick={handleOpenModal}
        >
          + New Subscription
        </button>
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
            {filteredSubs.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>
                  No subscriptions found. Click "+ New Subscription" above to create one.
                </td>
              </tr>
            ) : (
              filteredSubs.map((s) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New Subscription Modal */}
      {isCreateOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 8,
              padding: '1.5rem',
              width: '100%',
              maxWidth: 540,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
                  New Subscription
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#6B7280' }}>
                  Set up recurring billing and subscription plan for a customer.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#9CA3AF' }}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSubscription} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Customer *
                </label>
                <select
                  className="odoo-input"
                  style={{ width: '100%' }}
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  required
                >
                  <option value="">Select a Customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.tier?.name ? `(${c.tier.name})` : ''} - {c.email || ''}
                    </option>
                  ))}
                </select>
                {customers.length === 0 && loadingOptions && (
                  <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>
                    Loading customers...
                  </p>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Subscription Plan
                </label>
                <select
                  className="odoo-input"
                  style={{ width: '100%' }}
                  value={selectedPlanId}
                  onChange={(e) => handlePlanChange(e.target.value)}
                >
                  <option value="">Custom / Direct Catalog Product</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.interval || 'monthly'}) - ${Number(p.base_price || p.basePrice || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>
                  Selecting a plan auto-populates billing frequency and unit price.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Catalog Product {selectedPlanId ? '(Linked to Plan)' : '*'}
                </label>
                <select
                  className="odoo-input"
                  style={{ width: '100%' }}
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  required={!selectedPlanId}
                >
                  <option value="">Select Catalog Product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.is_recurring || p.isRecurring ? '[Recurring]' : ''} - ${Number(p.base_price || p.basePrice || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Billing Frequency *
                  </label>
                  <select
                    className="odoo-input"
                    style={{ width: '100%' }}
                    value={interval}
                    onChange={(e) => setInterval(e.target.value as 'monthly' | 'quarterly' | 'yearly')}
                    required
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Unit Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="odoo-input"
                    style={{ width: '100%' }}
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Quantity / Seats *
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="odoo-input"
                    style={{ width: '100%' }}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Start Date *
                  </label>
                  <input
                    type="date"
                    className="odoo-input"
                    style={{ width: '100%' }}
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Summary info box */}
              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, padding: '0.75rem', fontSize: '0.8125rem', color: '#4B5563' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Calculated Recurring Total:</span>
                  <strong style={{ color: '#111827' }}>
                    ${((parseFloat(unitPrice) || 0) * (parseInt(quantity, 10) || 0)).toFixed(2)} / {interval}
                  </strong>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                  12 upcoming billing periods will be generated upon creation with status 'upcoming'.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="odoo-btn"
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.8125rem',
                    border: '1px solid #D1D5DB',
                    background: '#FFFFFF',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="odoo-btn odoo-btn-primary"
                  style={{
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Creating...' : 'Create Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

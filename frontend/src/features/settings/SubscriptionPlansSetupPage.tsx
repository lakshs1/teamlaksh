import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { billingApi, catalogApi } from '../../services/apiServices';

interface SubscriptionPlan {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  product_id?: number | null;
  product_name?: string | null;
  interval: string;
  base_price: number;
  cost_price: number;
  proration_rule: string;
  allow_mid_cycle_changes: boolean;
  cancellation_policy: string;
  refund_percentage: number;
  notice_period_days: number;
  is_active: boolean;
  created_at: string;
}

interface Subscription {
  id: number;
  quote_id: number;
  quote_line_id: number;
  customer_id: number;
  product_id: number;
  plan_id?: number | null;
  plan_name?: string | null;
  quantity: number;
  unit_price: number;
  interval: string;
  status: string;
  starts_at: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end?: boolean;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  product_name?: string;
  customer_name?: string;
}

export default function SubscriptionPlansSetupPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'plans' | 'subscriptions'>('plans');

  // Form State
  const [planName, setPlanName] = useState('');
  const [planCode, setPlanCode] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('new');
  const [interval, setInterval] = useState('monthly');
  const [basePrice, setBasePrice] = useState('99.00');
  const [costPrice, setCostPrice] = useState('20.00');
  const [prorationRule, setProrationRule] = useState('exact_day');
  const [allowMidCycleChanges, setAllowMidCycleChanges] = useState(true);
  const [cancellationPolicy, setCancellationPolicy] = useState('prorated_refund');
  const [refundPercentage, setRefundPercentage] = useState('100');
  const [noticePeriodDays, setNoticePeriodDays] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  // Cancellation Modal / Prompt State
  const [cancellingSubId, setCancellingSubId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansRes, subsRes, prodsRes] = await Promise.all([
        billingApi.getPlans().catch(() => ({ data: [] })),
        billingApi.getSubscriptions().catch(() => ({ data: [] })),
        catalogApi.getProducts().catch(() => ({ data: [] })),
      ]);

      setPlans(plansRes.data || []);
      setSubscriptions(subsRes.data || []);
      setProducts(prodsRes.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load subscription configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim()) {
      toast.error('Plan name is required');
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        name: planName.trim(),
        code: planCode.trim() || undefined,
        description: description.trim() || undefined,
        interval,
        base_price: Number(basePrice) || 0,
        cost_price: Number(costPrice) || 0,
        proration_rule: prorationRule,
        allow_mid_cycle_changes: allowMidCycleChanges,
        cancellation_policy: cancellationPolicy,
        refund_percentage: Number(refundPercentage) || 100,
        notice_period_days: Number(noticePeriodDays) || 0,
      };

      if (selectedProductId !== 'new' && selectedProductId !== '') {
        payload.product_id = Number(selectedProductId);
      }

      await billingApi.createPlan(payload);
      toast.success(`Recurring plan "${planName}" created successfully!`);

      // Reset form
      setPlanName('');
      setPlanCode('');
      setDescription('');
      setSelectedProductId('new');
      setBasePrice('99.00');
      setCostPrice('20.00');
      setProrationRule('exact_day');
      setAllowMidCycleChanges(true);
      setCancellationPolicy('prorated_refund');
      setRefundPercentage('100');
      setNoticePeriodDays('0');

      loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create plan';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePlan = async (planId: number, planTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete the plan "${planTitle}"?`)) return;
    try {
      await billingApi.deletePlan(planId);
      toast.success(`Plan "${planTitle}" deleted`);
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to delete plan');
    }
  };

  const handleTogglePlanActive = async (plan: SubscriptionPlan) => {
    try {
      await billingApi.updatePlan(plan.id, { is_active: !plan.is_active });
      toast.success(`Plan marked as ${!plan.is_active ? 'active' : 'inactive'}`);
      loadData();
    } catch (err: any) {
      toast.error('Failed to update plan status');
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancellingSubId) return;
    try {
      setCancelling(true);
      const res = await billingApi.cancelSubscription(cancellingSubId, { reason: cancelReason });
      toast.success(res.message || 'Subscription cancelled');
      setCancellingSubId(null);
      setCancelReason('');
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  const getProrationBadge = (rule: string) => {
    switch (rule) {
      case 'exact_day':
        return <span className="odoo-badge bg-blue-100 text-blue-800">Exact Day</span>;
      case 'full_period':
        return <span className="odoo-badge bg-purple-100 text-purple-800">Full Period</span>;
      case 'no_proration':
        return <span className="odoo-badge bg-gray-100 text-gray-800">No Proration</span>;
      default:
        return <span className="odoo-badge">{rule}</span>;
    }
  };

  const getCancellationBadge = (policy: string) => {
    switch (policy) {
      case 'prorated_refund':
        return <span className="odoo-badge bg-green-100 text-green-800">Prorated Refund</span>;
      case 'end_of_cycle':
        return <span className="odoo-badge bg-amber-100 text-amber-800">End of Cycle</span>;
      case 'no_refund':
        return <span className="odoo-badge bg-red-100 text-red-800">No Refund</span>;
      default:
        return <span className="odoo-badge">{policy}</span>;
    }
  };

  if (loading && plans.length === 0 && subscriptions.length === 0) {
    return <div className="p-6 text-gray-600">Loading subscription and billing rules...</div>;
  }

  return (
    <div className="odoo-container" style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div className="odoo-page-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="odoo-page-title" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
              Subscription & Recurring Plan Setup (PRD A5)
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#64748B', marginTop: '0.25rem' }}>
              Define recurring billing frequencies, mid-cycle proration rules, and cancellation/partial refund policies.
            </p>
          </div>
          <button
            onClick={loadData}
            className="odoo-btn odoo-btn-secondary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8125rem' }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button
            onClick={() => setActiveTab('plans')}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.875rem',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'plans' ? '#714B67' : '#F1F5F9',
              color: activeTab === 'plans' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
             Defined Recurring Plans ({plans.length})
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.875rem',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'subscriptions' ? '#714B67' : '#F1F5F9',
              color: activeTab === 'subscriptions' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
             Active Subscriptions ({subscriptions.length})
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Side: Tables */}
        <div>
          {activeTab === 'plans' && (
            <div className="odoo-table-container" style={{ background: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1E293B' }}>
                  Configured Recurring Plans & Policies
                </h3>
                <span style={{ fontSize: '0.8125rem', color: '#64748B' }}>
                  {plans.length} {plans.length === 1 ? 'plan' : 'plans'} configured
                </span>
              </div>
              <table className="odoo-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#475569' }}>PLAN / CODE</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#475569' }}>ATTACHED PRODUCT</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#475569' }}>FREQUENCY</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#475569' }}>BASE / COST</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#475569' }}>PRORATION RULE</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#475569' }}>CANCELLATION POLICY</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#475569' }}>STATUS</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#475569', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: '#1E293B' }}>{p.name}</div>
                        {p.code && <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Code: {p.code}</div>}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.8125rem', color: '#334155' }}>
                        {p.product_name || (
                          <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Auto-provisioned</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{ textTransform: 'capitalize', fontWeight: 500, fontSize: '0.8125rem' }}>
                          {p.interval}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>${p.base_price.toFixed(2)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Cost: ${p.cost_price.toFixed(2)}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {getProrationBadge(p.proration_rule)}
                        <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.2rem' }}>
                          {p.allow_mid_cycle_changes ? 'Mid-cycle allowed' : 'Fixed cycle'}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {getCancellationBadge(p.cancellation_policy)}
                        {p.cancellation_policy === 'prorated_refund' && (
                          <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.2rem' }}>
                            {p.refund_percentage}% refund ({p.notice_period_days}d notice)
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <button
                          onClick={() => handleTogglePlanActive(p)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          <span
                            className={`odoo-badge ${
                              p.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {p.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </button>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <button
                          onClick={() => handleDeletePlan(p.id, p.name)}
                          style={{
                            color: '#DC2626',
                            background: 'transparent',
                            border: '1px solid #FECACA',
                            borderRadius: '4px',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {plans.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748B' }}>
                        No recurring plans configured yet. Use the form on the right to set up your first plan with proration & refund policies.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'subscriptions' && (
            <div className="odoo-table-container" style={{ background: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1E293B' }}>
                  Live Customer Subscriptions
                </h3>
                <span style={{ fontSize: '0.8125rem', color: '#64748B' }}>
                  {subscriptions.length} total subscriptions
                </span>
              </div>
              <table className="odoo-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#475569' }}>SUBSCRIPTION</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#475569' }}>CUSTOMER</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#475569' }}>PLAN / PRODUCT</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#475569' }}>CYCLE</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#475569' }}>PRICE / QTY</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#475569' }}>PERIOD END</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#475569' }}>STATUS</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#475569', textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#714B67' }}>
                        SUB-{s.id}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 500, color: '#1E293B' }}>
                        {s.customer_name || `Customer #${s.customer_id}`}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: '#1E293B' }}>
                          {s.plan_name || s.product_name || `Product #${s.product_id}`}
                        </div>
                        {s.plan_name && s.product_name && (
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Product: {s.product_name}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textTransform: 'capitalize', fontSize: '0.8125rem' }}>
                        {s.interval}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 600 }}>${(s.unit_price * s.quantity).toFixed(2)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          {s.quantity} seats @ ${s.unit_price}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.8125rem', color: '#475569' }}>
                        {new Date(s.current_period_end).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {s.status === 'active' && !s.cancel_at_period_end && (
                          <span className="odoo-badge bg-green-100 text-green-800">Active</span>
                        )}
                        {s.status === 'active' && s.cancel_at_period_end && (
                          <span className="odoo-badge bg-amber-100 text-amber-800">Ends at Cycle</span>
                        )}
                        {s.status === 'cancelled' && (
                          <span className="odoo-badge bg-gray-200 text-gray-800">Cancelled</span>
                        )}
                        {s.status === 'paused' && (
                          <span className="odoo-badge bg-yellow-100 text-yellow-800">Paused</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        {s.status === 'active' && !s.cancel_at_period_end ? (
                          <button
                            onClick={() => {
                              setCancellingSubId(s.id);
                              setCancelReason('');
                            }}
                            style={{
                              color: '#B91C1C',
                              background: '#FEF2F2',
                              border: '1px solid #FCA5A5',
                              borderRadius: '4px',
                              padding: '0.25rem 0.6rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {subscriptions.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748B' }}>
                        No live customer subscriptions found. Subscriptions are created automatically when recurring quote lines are accepted and confirmed in the Customer Portal.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Side: Configure New Plan Card */}
        <div
          className="odoo-card"
          style={{
            background: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
               Define Recurring Plan (A5)
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
              Set frequency, proration behavior, and cancellation refund policy.
            </p>
          </div>

          <form onSubmit={handleCreatePlan} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {/* Plan Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                Plan Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                className="odoo-input"
                placeholder="e.g. Enterprise Cloud SaaS"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                required
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            {/* Plan Code & Interval */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  Code / SKU
                </label>
                <input
                  type="text"
                  className="odoo-input"
                  placeholder="e.g. ENT-M"
                  value={planCode}
                  onChange={(e) => setPlanCode(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  Billing Frequency
                </label>
                <select
                  className="odoo-select"
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>

            {/* Attach to Product */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                Attached Product / Service
              </label>
              <select
                className="odoo-select"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }}
              >
                <option value="new">+ Auto-create new product for plan</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (${Number(p.base_price || p.basePrice || 0).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            {/* Pricing: Base Price & Cost Price */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  Base Price ($) <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="odoo-input"
                  placeholder="99.00"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  Cost Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="odoo-input"
                  placeholder="20.00"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #F1F5F9', margin: '0.25rem 0' }} />

            {/* Proration Rule */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1E293B', marginBottom: '0.25rem' }}>
                Mid-Cycle Proration Rule (Seats/Plan Change)
              </label>
              <select
                className="odoo-select"
                value={prorationRule}
                onChange={(e) => setProrationRule(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }}
              >
                <option value="exact_day">Exact Day (Prorate by unserved days in cycle)</option>
                <option value="full_period">Full Period (Charge full cycle delta)</option>
                <option value="no_proration">No Proration (Takes effect next cycle)</option>
              </select>

              <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="checkbox"
                  id="midCycleChanges"
                  checked={allowMidCycleChanges}
                  onChange={(e) => setAllowMidCycleChanges(e.target.checked)}
                />
                <label htmlFor="midCycleChanges" style={{ fontSize: '0.75rem', color: '#475569', cursor: 'pointer' }}>
                  Allow mid-cycle seat & tier upgrades/downgrades
                </label>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #F1F5F9', margin: '0.25rem 0' }} />

            {/* Cancellation & Refund Policy */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1E293B', marginBottom: '0.25rem' }}>
                Cancellation & Refund Rule
              </label>
              <select
                className="odoo-select"
                value={cancellationPolicy}
                onChange={(e) => setCancellationPolicy(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }}
              >
                <option value="prorated_refund">Prorated Refund (Issue credit note for unused days)</option>
                <option value="end_of_cycle">End of Cycle (Remain active until cycle ends, no refund)</option>
                <option value="no_refund">No Refund (Immediate cancellation, no credit)</option>
              </select>
            </div>

            {/* Refund % & Notice Period */}
            {cancellationPolicy === 'prorated_refund' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    Refund Ratio (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="odoo-input"
                    value={refundPercentage}
                    onChange={(e) => setRefundPercentage(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    Notice Period (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="odoo-input"
                    value={noticePeriodDays}
                    onChange={(e) => setNoticePeriodDays(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="odoo-btn odoo-btn-primary"
              style={{
                marginTop: '0.5rem',
                padding: '0.65rem',
                fontWeight: 600,
                fontSize: '0.875rem',
                backgroundColor: '#714B67',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Saving Plan...' : '+ Save Recurring Plan'}
            </button>
          </form>
        </div>
      </div>

      {/* Cancellation Confirmation Modal */}
      {cancellingSubId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              maxWidth: '450px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: 700, color: '#1E293B' }}>
              Cancel Subscription SUB-{cancellingSubId}
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '1rem' }}>
              Cancellation will apply the plan&apos;s configured refund policy (e.g. issuing a prorated credit note invoice or keeping active until cycle end).
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                Cancellation Reason (optional)
              </label>
              <textarea
                className="odoo-input"
                rows={3}
                placeholder="e.g. Customer requested downgrade or discontinued service"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setCancellingSubId(null)}
                className="odoo-btn odoo-btn-secondary"
                disabled={cancelling}
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="odoo-btn"
                disabled={cancelling}
                style={{
                  backgroundColor: '#DC2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  fontWeight: 600,
                  cursor: cancelling ? 'not-allowed' : 'pointer',
                }}
              >
                {cancelling ? 'Processing...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

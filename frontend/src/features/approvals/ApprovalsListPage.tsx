import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { approvalApi } from '../../services/apiServices';
import { mapApproval } from '../../services/dataMappers';
import { useDealFlowStore, type ApprovalItem } from '../../stores/dealflowStore';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

export default function ApprovalsListPage() {
  const navigate = useNavigate();
  const { currentRole } = useDealFlowStore();
  const { user } = useAuthStore();

  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    myQueue: 0,
    pendingManager: 0,
    pendingFinance: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'my_queue' | 'pending' | 'all' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Reason modal state
  const [modalType, setModalType] = useState<'reject' | 'revise' | null>(null);
  const [activeItem, setActiveItem] = useState<ApprovalItem | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let res: any;
      try {
        res = await approvalApi.getApprovals();
      } catch {
        res = await approvalApi.getPendingApprovals();
      }

      const rawItems = res.data?.items ?? res.data ?? [];
      const mapped = rawItems.map(mapApproval);
      setApprovals(mapped);

      if (res.stats) {
        setStats(res.stats);
      } else {
        const myQueueCount = mapped.filter((a: any) => a.canAct).length;
        setStats({
          total: mapped.length,
          myQueue: myQueueCount,
          pendingManager: mapped.filter((a: any) => a.currentStatus === 'pending_manager').length,
          pendingFinance: mapped.filter((a: any) => a.currentStatus === 'pending_finance').length,
          approved: mapped.filter((a: any) => a.status === 'Approved').length,
          rejected: mapped.filter((a: any) => a.status === 'Rejected').length,
        });
      }
    } catch (err: any) {
      console.error('Failed to load approvals:', err);
      setError(err.message || 'Failed to load approvals');
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();

    const handleRoleChanged = () => {
      fetchApprovals();
    };

    window.addEventListener('dealflow:role-changed', handleRoleChanged);
    return () => {
      window.removeEventListener('dealflow:role-changed', handleRoleChanged);
    };
  }, [fetchApprovals, currentRole]);

  const handleQuickApprove = async (e: React.MouseEvent, item: ApprovalItem) => {
    e.stopPropagation();
    try {
      await approvalApi.approveQuote(item.id, `Quick approved by ${user?.name || currentRole}`);
      toast.success(`Quotation ${item.reference} approved!`);
      await fetchApprovals();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Approval failed');
    }
  };

  const handleOpenModal = (e: React.MouseEvent, item: ApprovalItem, type: 'reject' | 'revise') => {
    e.stopPropagation();
    setActiveItem(item);
    setModalType(type);
    setActionReason(
      type === 'reject'
        ? 'Discount exceeds policy ceiling and cannot be authorized.'
        : 'Please revise item discounts to bring the deal within allowed limits.'
    );
  };

  const handleModalSubmit = async () => {
    if (!activeItem || !modalType) return;
    try {
      setSubmittingAction(true);
      if (modalType === 'reject') {
        await approvalApi.rejectQuote(activeItem.id, actionReason);
        toast.error(`Quotation ${activeItem.reference} rejected`);
      } else {
        await approvalApi.reviseQuote(activeItem.id, actionReason);
        toast.success(`Revision requested for quotation ${activeItem.reference}`);
      }
      setModalType(null);
      setActiveItem(null);
      await fetchApprovals();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Action failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  const filteredApprovals = approvals.filter((a) => {
    let matchesTab = true;
    if (activeTab === 'my_queue') {
      matchesTab = Boolean(a.canAct);
    } else if (activeTab === 'pending') {
      matchesTab = a.status === 'Pending';
    } else if (activeTab === 'approved') {
      matchesTab = a.status === 'Approved';
    } else if (activeTab === 'rejected') {
      matchesTab = a.status === 'Rejected';
    }

    const s = searchTerm.toLowerCase();
    const matchesSearch =
      !s ||
      a.reference.toLowerCase().includes(s) ||
      a.customerName.toLowerCase().includes(s) ||
      (a.customerTier && a.customerTier.toLowerCase().includes(s)) ||
      a.requestedBy.toLowerCase().includes(s);

    return matchesTab && matchesSearch;
  });

  if (loading && approvals.length === 0) {
    return (
      <div className="odoo-container">
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
          Loading approval governance queue...
        </div>
      </div>
    );
  }

  return (
    <div className="odoo-container">
      {/* Header */}
      <div className="odoo-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 className="odoo-page-title">Approval Governance Hub</h1>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#714B67',
                backgroundColor: 'rgba(113, 75, 103, 0.1)',
                padding: '0.2rem 0.5rem',
                borderRadius: 12,
              }}
            >
              Role: {currentRole}
            </span>
          </div>
          <p className="text-muted text-sm" style={{ marginTop: '0.2rem' }}>
            Self-governing discount engine: Tier limits, category ceilings, blended risk scoring, and 2-stage approval workflow.
          </p>
        </div>
        <button className="odoo-btn odoo-btn-secondary" onClick={fetchApprovals}>
          ↻ Refresh Queue
        </button>
      </div>

      {/* KPI Metric Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Actionable by You */}
        <div
          onClick={() => setActiveTab('my_queue')}
          className="odoo-card"
          style={{
            cursor: 'pointer',
            border: activeTab === 'my_queue' ? '1.5px solid #714B67' : '1px solid #E2E8F0',
            backgroundColor: activeTab === 'my_queue' ? 'rgba(113, 75, 103, 0.03)' : '#FFFFFF',
            transition: 'all 150ms ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: activeTab === 'my_queue' ? '#714B67' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Actionable by You
            </span>
            {stats.myQueue > 0 && (
              <span className="odoo-badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                Action
              </span>
            )}
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1F2937' }}>{stats.myQueue}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
            Waiting on {currentRole} review
          </div>
        </div>

        {/* Level 1 Pending (Manager) */}
        <div
          onClick={() => setActiveTab('pending')}
          className="odoo-card"
          style={{
            cursor: 'pointer',
            border: activeTab === 'pending' ? '1.5px solid #714B67' : '1px solid #E2E8F0',
            backgroundColor: activeTab === 'pending' ? 'rgba(113, 75, 103, 0.03)' : '#FFFFFF',
            transition: 'all 150ms ease',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: activeTab === 'pending' ? '#714B67' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Level 1 (Sales Manager)
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1F2937', marginTop: '0.35rem' }}>
            {stats.pendingManager}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
            Threshold / Category ceilings
          </div>
        </div>

        {/* Level 2 Pending (Finance) */}
        <div
          onClick={() => setActiveTab('pending')}
          className="odoo-card"
          style={{
            cursor: 'pointer',
            border: activeTab === 'pending' ? '1.5px solid #714B67' : '1px solid #E2E8F0',
            backgroundColor: activeTab === 'pending' ? 'rgba(113, 75, 103, 0.03)' : '#FFFFFF',
            transition: 'all 150ms ease',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: activeTab === 'pending' ? '#714B67' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Level 2 (Finance & Ops)
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1F2937', marginTop: '0.35rem' }}>
            {stats.pendingFinance}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
            High-risk / Escalated discounts
          </div>
        </div>

        {/* Completed / Approved */}
        <div
          onClick={() => setActiveTab('approved')}
          className="odoo-card"
          style={{
            cursor: 'pointer',
            border: activeTab === 'approved' ? '1.5px solid #714B67' : '1px solid #E2E8F0',
            backgroundColor: activeTab === 'approved' ? 'rgba(113, 75, 103, 0.03)' : '#FFFFFF',
            transition: 'all 150ms ease',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: activeTab === 'approved' ? '#714B67' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Approved Deals
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1F2937', marginTop: '0.35rem' }}>
            {stats.approved}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
            Moved to fulfillment
          </div>
        </div>

        {/* Total Governed */}
        <div
          onClick={() => setActiveTab('all')}
          className="odoo-card"
          style={{
            cursor: 'pointer',
            border: activeTab === 'all' ? '1.5px solid #714B67' : '1px solid #E2E8F0',
            backgroundColor: activeTab === 'all' ? 'rgba(113, 75, 103, 0.03)' : '#FFFFFF',
            transition: 'all 150ms ease',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: activeTab === 'all' ? '#714B67' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total In Governance
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1F2937', marginTop: '0.35rem' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
            Complete audit queue
          </div>
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            className={`odoo-btn ${activeTab === 'my_queue' ? 'odoo-btn-primary' : 'odoo-btn-secondary'}`}
            onClick={() => setActiveTab('my_queue')}
          >
            My Actionable Queue ({stats.myQueue})
          </button>
          <button
            className={`odoo-btn ${activeTab === 'all' ? 'odoo-btn-primary' : 'odoo-btn-secondary'}`}
            onClick={() => setActiveTab('all')}
          >
            All Governance ({stats.total})
          </button>
          <button
            className={`odoo-btn ${activeTab === 'pending' ? 'odoo-btn-primary' : 'odoo-btn-secondary'}`}
            onClick={() => setActiveTab('pending')}
          >
            All Pending ({stats.pendingManager + stats.pendingFinance})
          </button>
          <button
            className={`odoo-btn ${activeTab === 'approved' ? 'odoo-btn-primary' : 'odoo-btn-secondary'}`}
            onClick={() => setActiveTab('approved')}
          >
            Approved ({stats.approved})
          </button>
          <button
            className={`odoo-btn ${activeTab === 'rejected' ? 'odoo-btn-primary' : 'odoo-btn-secondary'}`}
            onClick={() => setActiveTab('rejected')}
          >
            Rejected ({stats.rejected})
          </button>
        </div>

        <input
          type="text"
          className="odoo-input"
          placeholder="Search by quote, customer, tier, rep..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      {/* Table */}
      <div className="odoo-table-container">
        <table className="odoo-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}><input type="checkbox" /></th>
              <th>Quotation Reference</th>
              <th>Customer & Tier</th>
              <th>Approval Workflow</th>
              <th>Order Total</th>
              <th>Discount Given</th>
              <th>Requested By</th>
              <th>Blended Risk</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Quick Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredApprovals.map((app) => {
              const riskNum = parseFloat(String(app.blendedRiskScore)) || 0;
              const isHighRisk = riskNum > 25 || app.approvalRoute === 'manager_finance';

              return (
                <tr
                  key={app.id}
                  style={{ cursor: 'pointer', transition: 'background-color 120ms' }}
                  onClick={() => navigate(`/approvals/${app.id}`)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" />
                  </td>

                  {/* Reference */}
                  <td>
                    <span style={{ fontWeight: 800, color: '#714B67', fontSize: '0.875rem' }}>
                      {app.reference}
                    </span>
                  </td>

                  {/* Customer & Tier */}
                  <td>
                    <div style={{ fontWeight: 700, color: '#1E293B' }}>{app.customerName}</div>
                    <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.15rem' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          backgroundColor: '#F1F5F9',
                          color: '#475569',
                          padding: '0.1rem 0.4rem',
                          borderRadius: 4,
                        }}
                      >
                        {app.customerTier || 'Tier 1'}
                      </span>
                    </div>
                  </td>

                  {/* Workflow & Stage */}
                  <td>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1F2937' }}>
                      {app.approvalRoute === 'manager_finance' ? '2-Stage (Mgr → Fin)' : 'Level 1 (Mgr Only)'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.15rem' }}>
                      {app.status === 'Approved'
                        ? 'Completed'
                        : app.status === 'Rejected'
                        ? 'Rejected'
                        : app.currentStatus === 'pending_finance'
                        ? 'Awaiting Finance'
                        : 'Awaiting Manager'}
                    </div>
                  </td>

                  {/* Order Total */}
                  <td style={{ fontWeight: 700, color: '#1F2937' }}>
                    ₹{app.amount.toLocaleString('en-IN')}
                  </td>

                  {/* Discount */}
                  <td>
                    {app.totalDiscount && app.totalDiscount > 0 ? (
                      <span style={{ fontWeight: 600, color: '#1F2937' }}>
                        ₹{app.totalDiscount.toLocaleString('en-IN')}
                      </span>
                    ) : (
                      <span style={{ color: '#94A3B8' }}>—</span>
                    )}
                  </td>

                  {/* Requested By */}
                  <td style={{ fontSize: '0.8125rem', color: '#475569' }}>{app.requestedBy}</td>

                  {/* Blended Risk */}
                  <td>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                      {app.blendedRiskScore}%
                    </span>
                  </td>

                  {/* Status */}
                  <td>
                    <span className="odoo-badge">{app.status}</span>
                  </td>

                  {/* Quick Actions */}
                  <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', alignItems: 'center' }}>
                      {app.canAct ? (
                        <>
                          <button
                            className="odoo-btn odoo-btn-primary"
                            style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}
                            onClick={(e) => handleQuickApprove(e, app)}
                          >
                            Approve
                          </button>
                          <button
                            className="odoo-btn odoo-btn-secondary"
                            style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}
                            onClick={(e) => handleOpenModal(e, app, 'reject')}
                          >
                            Reject
                          </button>
                          <button
                            className="odoo-btn odoo-btn-secondary"
                            style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}
                            onClick={(e) => handleOpenModal(e, app, 'revise')}
                          >
                            Revise
                          </button>
                        </>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {app.status === 'Pending' && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                color: '#64748B',
                                fontStyle: 'italic',
                              }}
                            >
                              {app.currentStatus === 'pending_manager'
                                ? 'Waiting on Manager'
                                : 'Waiting on Finance'}
                            </span>
                          )}
                          <button
                            className="odoo-btn odoo-btn-secondary"
                            style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}
                            onClick={() => navigate(`/approvals/${app.id}`)}
                          >
                            View Details
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredApprovals.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748B' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#334155' }}>
                    {activeTab === 'my_queue'
                      ? `No items currently waiting for ${currentRole} action.`
                      : 'No approval records found matching this filter.'}
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: '0.25rem' }}>
                    {activeTab === 'my_queue'
                      ? "Switch to 'All Pending' or 'All Governance' to inspect quotations under review by other roles."
                      : 'Create or update quotations with discounts exceeding policy thresholds to trigger automated routing.'}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Rejection / Revision Reason Modal */}
      {modalType && activeItem && (
        <div
          style={{
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
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 8,
              padding: '1.5rem',
              maxWidth: 480,
              width: '90%',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
          >
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#714B67',
                marginBottom: '0.5rem',
              }}
            >
              {modalType === 'reject' ? 'Reject Quotation Approval' : 'Return for Revision'}
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '1rem' }}>
              Quotation: <strong>{activeItem.reference}</strong> ({activeItem.customerName})
            </p>

            <label
              style={{
                display: 'block',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '0.35rem',
              }}
            >
              Reason / Instructions for Sales Representative
            </label>
            <textarea
              className="odoo-input"
              rows={3}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Enter explanation for rejection or required adjustments..."
              style={{ width: '100%', marginBottom: '1.25rem', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                className="odoo-btn odoo-btn-secondary"
                onClick={() => setModalType(null)}
                disabled={submittingAction}
              >
                Cancel
              </button>
              <button
                className={`odoo-btn ${modalType === 'reject' ? 'odoo-btn-danger' : 'odoo-btn-primary'}`}
                onClick={handleModalSubmit}
                disabled={submittingAction || !actionReason.trim()}
              >
                {submittingAction
                  ? 'Submitting...'
                  : modalType === 'reject'
                  ? 'Confirm Rejection'
                  : 'Request Revision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

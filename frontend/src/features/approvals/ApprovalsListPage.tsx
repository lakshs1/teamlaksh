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
  const [searchTerm, setSearchTerm] = useState('');

  // Reason modal state
  const [modalType, setModalType] = useState<'reject' | 'revise' | null>(null);
  const [activeItem, setActiveItem] = useState<ApprovalItem | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchApprovals = async () => {
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

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleQuickApprove = async (e: React.MouseEvent, item: ApprovalItem) => {
    e.stopPropagation();
    try {
      await approvalApi.approveQuote(item.id, 'Quick approved from Approvals Dashboard');
      toast.success(`Quotation ${item.reference} approved!`);
      // Update local state
      setApprovals(prev => prev.map(a => a.id === item.id ? { ...a, status: 'Approved' } : a));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Approval failed');
    }
  };

  const handleOpenModal = (e: React.MouseEvent, item: ApprovalItem, type: 'reject' | 'revise') => {
    e.stopPropagation();
    setActiveItem(item);
    setModalType(type);
    setActionReason(type === 'reject' ? 'Discount exceeds maximum authorized threshold.' : 'Please revise line item discounts.');
  };

  const handleModalSubmit = async () => {
    if (!activeItem || !modalType) return;
    try {
      setSubmittingAction(true);
      if (modalType === 'reject') {
        await approvalApi.rejectQuote(activeItem.id, actionReason);
        toast.error(`Quotation ${activeItem.reference} rejected`);
        setApprovals(prev => prev.map(a => a.id === activeItem.id ? { ...a, status: 'Rejected' } : a));
      } else {
        await approvalApi.reviseQuote(activeItem.id, actionReason);
        toast.success(`Revision requested for quotation ${activeItem.reference}`);
        setApprovals(prev => prev.map(a => a.id === activeItem.id ? { ...a, status: 'Pending' } : a));
      }
      setModalType(null);
      setActiveItem(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Action failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  const filteredApprovals = approvals.filter((a) => {
    const matchesFilter = filter === 'All' || a.status === filter;
    const matchesSearch =
      a.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.requestedBy.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) return <div className="odoo-container"><div className="p-8 text-center">Loading approvals...</div></div>;
  if (error) return <div className="odoo-container"><div className="p-8 text-red-500">Error: {error}</div></div>;

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Approval Governance Hub</h1>
          <p className="text-muted text-sm">Review discount thresholds, blended risk scores, Level 1 Manager and Level 2 Finance approvals.</p>
        </div>
        <button className="odoo-btn odoo-btn-secondary" onClick={fetchApprovals}>
          ↻ Refresh Queue
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((tab) => (
            <button
              key={tab}
              className={`odoo-btn ${filter === tab ? 'odoo-btn-primary' : 'odoo-btn-secondary'}`}
              onClick={() => setFilter(tab)}
            >
              {tab} {tab === 'Pending' && approvals.filter(a => a.status === 'Pending').length > 0 && `(${approvals.filter(a => a.status === 'Pending').length})`}
            </button>
          ))}
        </div>

        <input
          type="text"
          className="odoo-input"
          placeholder="Search by quote, customer, or rep..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: 300 }}
        />
      </div>

      <div className="odoo-table-container">
        <table className="odoo-table">
          <thead>
            <tr>
              <th><input type="checkbox" /></th>
              <th>Reference</th>
              <th>Customer</th>
              <th>Approval Level</th>
              <th>Amount</th>
              <th>Requested By</th>
              <th>Blended Risk</th>
              <th>Status</th>
              <th>Quick Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredApprovals.map((app) => {
              const riskNum = parseFloat(String(app.blendedRiskScore)) || 0;
              const isHighRisk = riskNum > 25;
              const levelText = isHighRisk ? 'Level 2: Finance Review' : 'Level 1: Manager Review';

              return (
                <tr key={app.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/approvals/${app.id}`)}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>
                  <td style={{ fontWeight: 700, color: '#714B67' }}>{app.reference}</td>
                  <td style={{ fontWeight: 600 }}>{app.customerName}</td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.55rem',
                        borderRadius: 12,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: isHighRisk ? '#FEF2F2' : '#F0FDF4',
                        color: isHighRisk ? '#DC2626' : '#16A34A',
                        border: `1px solid ${isHighRisk ? '#FECACA' : '#BBF7D0'}`
                      }}
                    >
                      {levelText}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>₹{app.amount.toLocaleString('en-IN')}</td>
                  <td>{app.requestedBy}</td>
                  <td>
                    <span className="odoo-badge" style={{ backgroundColor: riskNum > 20 ? '#FEE2E2' : '#F1F5F9', color: riskNum > 20 ? '#991B1B' : '#334155' }}>
                      {app.blendedRiskScore}%
                    </span>
                  </td>
                  <td>
                    <span className="odoo-badge">{app.status}</span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      {app.status === 'Pending' ? (
                        <>
                          <button
                            className="odoo-btn odoo-btn-primary"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={(e) => handleQuickApprove(e, app)}
                          >
                            Approve
                          </button>
                          <button
                            className="odoo-btn odoo-btn-danger"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={(e) => handleOpenModal(e, app, 'reject')}
                          >
                            Reject
                          </button>
                          <button
                            className="odoo-btn odoo-btn-secondary"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={(e) => handleOpenModal(e, app, 'revise')}
                          >
                            Revise
                          </button>
                        </>
                      ) : (
                        <button
                          className="odoo-btn odoo-btn-secondary"
                          style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}
                          onClick={() => navigate(`/approvals/${app.id}`)}
                        >
                          View Details
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredApprovals.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748B' }}>
                  No approvals found matching the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Rejection / Revision Reason Modal */}
      {modalType && activeItem && (
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
            maxWidth: 480,
            width: '90%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: modalType === 'reject' ? '#DC2626' : '#714B67', marginBottom: '0.5rem' }}>
              {modalType === 'reject' ? 'Reject Quotation Approval' : 'Return for Revision'}
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '1rem' }}>
              Document: <strong>{activeItem.reference}</strong> ({activeItem.customerName})
            </p>

            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              Reason / Feedback for Sales Representative
            </label>
            <textarea
              className="odoo-input"
              rows={3}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Enter explanation for rejection or revision requirements..."
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
                {submittingAction ? 'Submitting...' : modalType === 'reject' ? 'Confirm Rejection' : 'Request Revision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


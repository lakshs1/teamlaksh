import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { approvalApi, quoteApi } from '../../services/apiServices';
import { mapApproval } from '../../services/dataMappers';
import type { ApprovalItem } from '../../stores/dealflowStore';
import toast from 'react-hot-toast';

export default function ApprovalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<ApprovalItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action modal
  const [modalType, setModalType] = useState<'reject' | 'revise' | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const quoteRes = await quoteApi.getQuoteDetails(id);
      const logsRes = await approvalApi.getAuditLogs(id);
      
      const quoteData = quoteRes.data || {};
      const logsData = logsRes.data?.items ?? logsRes.data ?? [];
      
      setItem(mapApproval({ ...quoteData, approvalLogs: logsData }));
    } catch (err: any) {
      setError(err.message || 'Failed to load approval details');
      toast.error('Failed to load approval details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const handleApprove = async () => {
    if (!id) return;
    try {
      setSubmitting(true);
      const res = await approvalApi.approveQuote(id, 'Approved by reviewer in Sales Operations Hub');
      const msg = res?.data?.message || res?.message || 'Approval granted!';
      toast.success(msg);
      await fetchDetails();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleModalAction = async () => {
    if (!id || !modalType) return;
    try {
      setSubmitting(true);
      if (modalType === 'reject') {
        await approvalApi.rejectQuote(id, reason);
        toast.error('Quotation approval rejected');
      } else {
        await approvalApi.reviseQuote(id, reason);
        toast.success('Returned to sales representative for revision');
      }
      setModalType(null);
      await fetchDetails();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="odoo-container"><div className="p-8 text-center">Loading details...</div></div>;
  if (error || !item) return <div className="odoo-container"><div className="p-8 text-red-500">Error: {error || 'Not found'}</div></div>;

  const riskNum = parseFloat(String(item.blendedRiskScore)) || 0;
  const isLevel2 = riskNum > 25;

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>
            Approval Request / {isLevel2 ? 'Level 2 (Finance & Operations)' : 'Level 1 (Sales Manager)'}
          </div>
          <h1 className="odoo-page-title" style={{ color: '#714B67' }}>
            {item.reference}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {item.status === 'Pending' && (
            <>
              <button className="odoo-btn odoo-btn-primary" onClick={handleApprove} disabled={submitting}>
                {submitting ? 'Processing...' : 'Approve'}
              </button>
              <button
                className="odoo-btn odoo-btn-danger"
                onClick={() => {
                  setModalType('reject');
                  setReason('Discount exceeds maximum policy threshold limit.');
                }}
                disabled={submitting}
              >
                Reject
              </button>
              <button
                className="odoo-btn odoo-btn-secondary"
                onClick={() => {
                  setModalType('revise');
                  setReason('Please revise line discounts or bundle margin.');
                }}
                disabled={submitting}
              >
                Request Revision
              </button>
            </>
          )}
          <button className="odoo-btn odoo-btn-secondary" onClick={() => navigate('/approvals')}>
            Back to List
          </button>
        </div>
      </div>

      {/* Main Approval Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="odoo-card">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #E2E8F0' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Request Type</div>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{item.requestType}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Requested By</div>
              <div style={{ fontWeight: 600 }}>{item.requestedBy}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Status</div>
              <div><span className="odoo-badge">{item.status}</span></div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Source Quotation</div>
              <div
                style={{ fontWeight: 700, color: '#714B67', cursor: 'pointer' }}
                onClick={() => navigate(`/quotations/${item.quotationId}`)}
              >
                {item.quotationId ? `Q/${String(item.quotationId).padStart(5, '0')}` : item.reference} ↗
              </div>
            </div>
          </div>

          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.75rem' }}>
            Discount Governance & Deal Context
          </h3>
          <div style={{ backgroundColor: '#F8F9FA', padding: '1.25rem', borderRadius: 8, border: '1px solid #E2E8F0', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
              <div><strong>Customer:</strong> {item.customerName}</div>
              <div><strong>Total Deal Amount:</strong> ₹{item.amount.toLocaleString('en-IN')}</div>
              <div>
                <strong>Blended Discount Risk Score:</strong>{' '}
                <span className="odoo-badge" style={{ backgroundColor: isLevel2 ? '#FEE2E2' : '#F1F5F9', color: isLevel2 ? '#991B1B' : '#334155' }}>
                  {item.blendedRiskScore}%
                </span>
              </div>
              <div><strong>Governance Tier:</strong> {isLevel2 ? 'High Risk (>25%)' : 'Standard Manager Tier (≤25%)'}</div>
            </div>
            <div style={{ marginTop: '0.5rem', color: '#475569', borderTop: '1px solid #E2E8F0', paddingTop: '0.5rem' }}>
              <strong>Submission Context:</strong> {item.reason || 'Discount policy threshold review required before order confirmation.'}
            </div>
          </div>

          {/* Workflow Stepper */}
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.75rem' }}>
            Multi-Tier Approval Progress
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0' }}>
            {['Quote Submitted', 'Manager Review', 'Finance & Ops Review', 'Approved'].map((step, idx) => {
              const isDone = (item.status === 'Approved') || (idx === 0) || (idx === 1 && item.status !== 'Pending');
              return (
                <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      backgroundColor: isDone ? '#714B67' : '#E2E8F0',
                      color: isDone ? '#FFF' : '#64748B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.8125rem',
                      marginBottom: '0.4rem',
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', textAlign: 'center' }}>{step}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Audit Trail Panel */}
        <div className="odoo-card">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.85rem' }}>
            Audit Trail & History
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.8125rem' }}>
            {item.auditTrail.map((log, index) => (
              <div key={index} style={{ borderLeft: '3px solid #714B67', paddingLeft: '0.65rem' }}>
                <div style={{ fontWeight: 700, color: '#1F2937' }}>{log.step}</div>
                <div style={{ color: '#64748B', fontSize: '0.75rem' }}>{log.user} • {log.timestamp}</div>
                {log.note && <div style={{ marginTop: '0.2rem', color: '#475569' }}>"{log.note}"</div>}
              </div>
            ))}
            {item.auditTrail.length === 0 && (
              <div style={{ color: '#64748B', fontSize: '0.75rem' }}>No audit logs recorded yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Dialog */}
      {modalType && (
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
            maxWidth: 460,
            width: '90%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: modalType === 'reject' ? '#DC2626' : '#714B67', marginBottom: '0.5rem' }}>
              {modalType === 'reject' ? 'Confirm Quotation Rejection' : 'Request Quotation Revision'}
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '1rem' }}>
              Reference: <strong>{item.reference}</strong> ({item.customerName})
            </p>

            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              Reason / Instruction Note
            </label>
            <textarea
              className="odoo-input"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide context for the sales representative..."
              style={{ width: '100%', marginBottom: '1.25rem' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                className="odoo-btn odoo-btn-secondary"
                onClick={() => setModalType(null)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className={`odoo-btn ${modalType === 'reject' ? 'odoo-btn-danger' : 'odoo-btn-primary'}`}
                onClick={handleModalAction}
                disabled={submitting || !reason.trim()}
              >
                {submitting ? 'Submitting...' : modalType === 'reject' ? 'Reject Quote' : 'Return for Revision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


import { useParams, useNavigate } from 'react-router-dom';
import { useDealFlowStore } from '../../stores/dealflowStore';
import toast from 'react-hot-toast';

export default function ApprovalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { approvals, approveRequest, rejectRequest } = useDealFlowStore();

  const item = approvals.find((a) => a.id === id) || approvals[0];

  const handleApprove = () => {
    approveRequest(item.id, 'Approved via Odoo Sales Ops workflow');
    toast.success(`Approval ${item.reference} granted!`);
  };

  const handleReject = () => {
    rejectRequest(item.id, 'Discount exceeds maximum policy limit');
    toast.error(`Approval ${item.reference} rejected`);
  };

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>Approval Request</div>
          <h1 className="odoo-page-title" style={{ color: '#714B67' }}>
            {item.reference}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {item.status === 'Pending' && (
            <>
              <button className="odoo-btn odoo-btn-primary" onClick={handleApprove}>
                Approve
              </button>
              <button className="odoo-btn odoo-btn-danger" onClick={handleReject}>
                Reject
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #E2E8F0' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Request Type</div>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{item.requestType}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Requested By</div>
              <div style={{ fontWeight: 600 }}>{item.requestedBy}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Related Document</div>
              <div
                style={{ fontWeight: 700, color: '#714B67', cursor: 'pointer' }}
                onClick={() => navigate('/quotations/q-1')}
              >
                Q/00024
              </div>
            </div>
          </div>

          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.75rem' }}>
            Approval Context & Reasoning
          </h3>
          <div style={{ backgroundColor: '#F8F9FA', padding: '1rem', borderRadius: 8, border: '1px solid #E2E8F0', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            <p><strong>Customer:</strong> {item.customerName}</p>
            <p><strong>Total Amount:</strong> ₹{item.amount.toLocaleString('en-IN')}</p>
            <p><strong>Blended Risk Score:</strong> {item.blendedRiskScore}</p>
            <p style={{ marginTop: '0.5rem', color: '#475569' }}><strong>Reason:</strong> {item.reason}</p>
          </div>

          {/* Workflow Stepper */}
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.75rem' }}>
            Approval Workflow Progress
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0' }}>
            {['Requested', 'Manager Review', 'Finance Review', 'Approved'].map((step, idx) => (
              <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: idx === 0 || item.status === 'Approved' ? '#714B67' : '#E2E8F0',
                    color: idx === 0 || item.status === 'Approved' ? '#FFF' : '#64748B',
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
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>{step}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Audit Trail Panel */}
        <div className="odoo-card">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.85rem' }}>
            Audit Log History
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.8125rem' }}>
            {item.auditTrail.map((log, index) => (
              <div key={index} style={{ borderLeft: '3px solid #714B67', paddingLeft: '0.65rem' }}>
                <div style={{ fontWeight: 700, color: '#1F2937' }}>{log.step}</div>
                <div style={{ color: '#64748B', fontSize: '0.75rem' }}>{log.user} • {log.timestamp}</div>
                {log.note && <div style={{ marginTop: '0.2rem', color: '#475569' }}>"{log.note}"</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

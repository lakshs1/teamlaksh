import { useNavigate } from 'react-router-dom';
import { useDealFlowStore } from '../../stores/dealflowStore';

export default function PipelineKanbanPage() {
  const navigate = useNavigate();
  const { quotations } = useDealFlowStore();

  const stages = ['Draft', 'Pending Approval', 'Approved', 'Confirmed'] as const;

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Deal Pipeline (Kanban)</h1>
          <p className="text-muted text-sm">Visual Kanban deal pipeline view. Select a deal card to open Quotation Builder.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="odoo-btn odoo-btn-secondary" onClick={() => navigate('/quotations')}>
            List View
          </button>
          <button className="odoo-btn odoo-btn-primary" onClick={() => navigate('/quotations/q-1')}>
          <button className="odoo-btn odoo-btn-primary" onClick={() => navigate('/quotations/create')}>
            + Create Quotation
          </button>
        </div>
      </div>

      {/* Kanban Board Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', alignItems: 'flex-start' }}>
        {stages.map((stage) => {
          const stageQuotes = quotations.filter((q) => q.status === stage || (stage === 'Draft' && q.status === 'Sent'));
          return (
            <div
              key={stage}
              style={{
                backgroundColor: '#F8F9FA',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '1rem',
                minHeight: 450,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #714B67' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1F2937' }}>{stage}</span>
                <span className="odoo-badge">{stageQuotes.length}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {stageQuotes.map((q) => (
                  <div
                    key={q.id}
                    className="odoo-card"
                    onClick={() => navigate(`/quotations/${q.id}`)}
                    style={{ cursor: 'pointer', padding: '0.85rem' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <span style={{ fontWeight: 700, color: '#714B67', fontSize: '0.875rem' }}>{q.reference}</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{q.customerTier}</span>
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1F2937', marginBottom: '0.4rem' }}>
                      {q.customerName}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ fontWeight: 700, color: '#334155' }}>₹{q.totalAmount.toLocaleString('en-IN')}</span>
                      <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{q.expiryDate}</span>
                    </div>
                  </div>
                ))}

                {stageQuotes.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.8125rem', padding: '2rem 0' }}>
                    No quotes in {stage}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useParams, useNavigate } from 'react-router-dom';
import { useDealFlowStore } from '../../stores/dealflowStore';
import toast from 'react-hot-toast';

export default function FulfillmentStockPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fulfillments, validateFulfillment } = useDealFlowStore();

  const item = fulfillments.find((f) => f.id === id) || fulfillments[0];

  const handleValidatePicking = () => {
    validateFulfillment(item.id);
    toast.success('Picking confirmed & stock dispatch updated!');
  };

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>Fulfillment Stock Pipeline</div>
          <h1 className="odoo-page-title" style={{ color: '#714B67' }}>
            {item.reference} / Stock Splitting
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="odoo-btn odoo-btn-primary" onClick={handleValidatePicking}>
            Validate Picking
          </button>
          <button className="odoo-btn odoo-btn-secondary">Print Picking List</button>
          <button className="odoo-btn odoo-btn-secondary" onClick={() => navigate(`/fulfillment/${item.id}`)}>
            Back to Order
          </button>
        </div>
      </div>

      {/* Progress Pipeline Stepper */}
      <div className="odoo-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
          {['Draft', 'Ready', 'Picking', 'Shipped', 'Done'].map((stage, idx) => {
            const isCompleted = idx <= 2;
            return (
              <div key={stage} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    backgroundColor: isCompleted ? '#714B67' : '#E2E8F0',
                    color: isCompleted ? '#FFFFFF' : '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    marginBottom: '0.4rem',
                  }}
                >
                  {idx + 1}
                </div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: isCompleted ? '#714B67' : '#64748B' }}>
                  {stage}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="odoo-card">
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '1rem' }}>
          Stock Allocation & Picking Progress
        </h3>
        <table className="odoo-table" style={{ marginBottom: '1.5rem' }}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Description</th>
              <th>Demand</th>
              <th>Done</th>
              <th>Unit</th>
              <th>Allocation Warehouse</th>
            </tr>
          </thead>
          <tbody>
            {item.lines.map((line, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 600 }}>{line.productName}</td>
                <td>{line.description}</td>
                <td>{line.demand}</td>
                <td style={{ fontWeight: 700, color: '#714B67' }}>{line.done}</td>
                <td>{line.unit}</td>
                <td>
                  <span className="odoo-badge">
                    {idx % 2 === 0 ? 'Main Warehouse (7)' : 'East Depot (3)'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ backgroundColor: '#F8F9FA', padding: '1rem', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.8125rem', color: '#475569' }}>
          All items are ready. Click <strong>Validate Picking</strong> to confirm picking and move order to shipping.
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDealFlowStore } from '../../stores/dealflowStore';

export default function FulfillmentListPage() {
  const navigate = useNavigate();
  const { fulfillments } = useDealFlowStore();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFulfillments = fulfillments.filter(
    (f) =>
      f.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Fulfillments / Stock</h1>
          <p className="text-muted text-sm">Multi-warehouse fulfillment splitting and backorder routing.</p>
        </div>
      </div>

      <div className="odoo-table-container">
        <div style={{ padding: '1rem', borderBottom: '1px solid #E2E8F0' }}>
          <input
            type="text"
            className="odoo-input"
            placeholder="Search fulfillments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ maxWidth: 360 }}
          />
        </div>

        <table className="odoo-table">
          <thead>
            <tr>
              <th><input type="checkbox" /></th>
              <th>Reference</th>
              <th>Customer</th>
              <th>Scheduled Date</th>
              <th>Responsible</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFulfillments.map((f) => (
              <tr key={f.id}>
                <td><input type="checkbox" /></td>
                <td style={{ fontWeight: 700, color: '#714B67' }}>{f.reference}</td>
                <td style={{ fontWeight: 600 }}>{f.customerName}</td>
                <td>{f.scheduledDate}</td>
                <td>{f.responsible}</td>
                <td>
                  <span className="odoo-badge">{f.status}</span>
                </td>
                <td>
                  <button
                    className="odoo-btn odoo-btn-secondary"
                    style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                    onClick={() => navigate(`/fulfillment/${f.id}`)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

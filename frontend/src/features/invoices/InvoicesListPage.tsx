import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDealFlowStore } from '../../stores/dealflowStore';

export default function InvoicesListPage() {
  const navigate = useNavigate();
  const { invoices } = useDealFlowStore();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredInvoices = invoices.filter(
    (i) =>
      i.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Invoices</h1>
          <p className="text-muted text-sm">Customer billing, payments, credit notes, and status tracking.</p>
        </div>
        <button className="odoo-btn odoo-btn-primary">+ Create Invoice</button>
      </div>

      <div className="odoo-table-container">
        <div style={{ padding: '1rem', borderBottom: '1px solid #E2E8F0' }}>
          <input
            type="text"
            className="odoo-input"
            placeholder="Search invoices..."
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
              <th>Invoice Date</th>
              <th>Due Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((inv) => (
              <tr key={inv.id}>
                <td><input type="checkbox" /></td>
                <td style={{ fontWeight: 700, color: '#714B67' }}>{inv.reference}</td>
                <td style={{ fontWeight: 600 }}>{inv.customerName}</td>
                <td>{inv.invoiceDate}</td>
                <td>{inv.dueDate}</td>
                <td style={{ fontWeight: 700 }}>₹{inv.amount.toLocaleString('en-IN')}</td>
                <td>
                  <span className="odoo-badge">{inv.status}</span>
                </td>
                <td>
                  <button
                    className="odoo-btn odoo-btn-secondary"
                    style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
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

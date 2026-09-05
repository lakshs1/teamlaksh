import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { billingApi } from '../../services/apiServices';
import { mapInvoice } from '../../services/dataMappers';
import type { InvoiceItem } from '../../stores/dealflowStore';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<InvoiceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const res = await billingApi.getInvoiceById(id!);
      setItem(mapInvoice(res.data));
    } catch (err: any) {
      setError(err.message || 'Failed to load invoice');
      toast.error('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchInvoice();
    }
  }, [id]);

  const handleRegisterPayment = async () => {
    try {
      if (!item) return;
      await billingApi.payInvoice(item.id);
      toast.success(`Payment of ₹${item.amount.toLocaleString('en-IN')} recorded! Invoice status updated to Paid.`);
      await fetchInvoice();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Payment failed');
    }
  };

  if (loading) return <div className="odoo-container"><div className="p-4">Loading invoice...</div></div>;
  if (error || !item) return <div className="odoo-container"><div className="p-4 text-red-500">Error: {error || 'Invoice not found'}</div></div>;

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>Invoice</div>
          <h1 className="odoo-page-title" style={{ color: '#714B67' }}>
            {item.reference}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="odoo-btn odoo-btn-primary">Send</button>
          <button className="odoo-btn odoo-btn-secondary">Print</button>
          {item.status !== 'Paid' && (
            <button className="odoo-btn odoo-btn-secondary" style={{ backgroundColor: '#714B67', color: '#FFF' }} onClick={handleRegisterPayment}>
              Register Payment
            </button>
          )}
          <button className="odoo-btn odoo-btn-secondary" onClick={() => navigate('/invoices')}>
            Back to List
          </button>
        </div>
      </div>

      <div className="odoo-card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #E2E8F0' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Customer</div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{item.customerName}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Invoice Date</div>
            <div style={{ fontWeight: 600 }}>{item.invoiceDate}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Due Date</div>
            <div style={{ fontWeight: 600 }}>{item.dueDate}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Status</div>
            <div><span className="odoo-badge">{item.status}</span></div>
          </div>
        </div>

        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.75rem' }}>
          Invoice Lines
        </h3>
        <table className="odoo-table" style={{ marginBottom: '1.5rem' }}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Description</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Taxes</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {item.lines.map((line, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 600 }}>{line.productName}</td>
                <td>{line.description}</td>
                <td>{line.quantity}</td>
                <td>₹{line.unitPrice.toLocaleString('en-IN')}</td>
                <td>{line.taxes}%</td>
                <td style={{ fontWeight: 700 }}>₹{line.amount.toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
              <span>Untaxed Amount:</span>
              <span style={{ fontWeight: 600 }}>₹7,00,000</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
              <span>Taxes (18%):</span>
              <span style={{ fontWeight: 600 }}>₹1,26,000</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem', color: '#714B67', borderTop: '2px solid #E2E8F0', paddingTop: '0.5rem' }}>
              <span>Total:</span>
              <span>₹8,26,000</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

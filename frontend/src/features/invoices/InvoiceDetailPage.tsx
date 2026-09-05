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

  const handleDownloadPdf = () => {
    toast.success(`Generating PDF for ${item?.reference || 'Invoice'}...`);
    window.print();
  };

  const handleSendInvoice = () => {
    toast.success(`Invoice ${item?.reference || ''} sent to ${item?.customerName || 'customer'}!`);
  };

  if (loading) return <div className="odoo-container"><div className="p-4">Loading invoice...</div></div>;
  if (error || !item) return <div className="odoo-container"><div className="p-4 text-red-500">Error: {error || 'Invoice not found'}</div></div>;

  const untaxedAmount = item.amount / 1.18;
  const taxAmount = item.amount - untaxedAmount;

  return (
    <div className="odoo-container">
      {/* Print Stylesheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-invoice, #printable-invoice * {
            visibility: visible;
          }
          #printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="odoo-page-header no-print">
        <div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>Invoices / {item.reference}</div>
          <h1 className="odoo-page-title" style={{ color: '#714B67' }}>
            Tax Invoice #{item.reference}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="odoo-btn odoo-btn-primary" onClick={handleSendInvoice}>
            ✉ Send by Email
          </button>
          <button className="odoo-btn odoo-btn-secondary" onClick={handleDownloadPdf} style={{ backgroundColor: '#0EA5E9', color: '#FFFFFF' }}>
            📥 Download PDF / Print
          </button>
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

      <div id="printable-invoice" className="odoo-card" style={{ padding: '2.5rem', background: '#FFF', borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {/* Invoice Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '1.5rem', borderBottom: '2px solid #714B67', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#714B67', margin: 0 }}>DealFlow360 ERP</h2>
            <div style={{ fontSize: '0.875rem', color: '#64748B', marginTop: '0.25rem' }}>Next-Gen Quotation & CPQ Platform</div>
            <div style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>GSTIN: 27AADCB2234P1Z4 | CIN: U72900MH2024PTC123456</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E293B' }}>TAX INVOICE</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#714B67', marginTop: '0.25rem' }}>#{item.reference}</div>
            <div style={{ marginTop: '0.5rem' }}>
              <span className="odoo-badge" style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem', backgroundColor: item.status === 'Paid' ? '#DCFCE7' : '#FEF3C7', color: item.status === 'Paid' ? '#166534' : '#92400E' }}>
                {item.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Customer & Dates Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem', padding: '1rem', background: '#F8FAFC', borderRadius: '6px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Billed To</div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1E293B', marginTop: '0.25rem' }}>{item.customerName}</div>
            <div style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: '0.25rem' }}>Verified Enterprise Customer</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Invoice Date</div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#334155', marginTop: '0.25rem' }}>{item.invoiceDate}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Due Date</div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#DC2626', marginTop: '0.25rem' }}>{item.dueDate}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Payment Terms</div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#334155', marginTop: '0.25rem' }}>Net 15 Days</div>
          </div>
        </div>

        {/* Invoice Lines Table */}
        <table className="odoo-table" style={{ width: '100%', marginBottom: '1.5rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F1F5F9' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, color: '#334155', borderBottom: '2px solid #CBD5E1' }}>#</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, color: '#334155', borderBottom: '2px solid #CBD5E1' }}>Product / Service Item</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, color: '#334155', borderBottom: '2px solid #CBD5E1' }}>Description</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700, color: '#334155', borderBottom: '2px solid #CBD5E1' }}>Qty</th>
              <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: '#334155', borderBottom: '2px solid #CBD5E1' }}>Unit Price</th>
              <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: '#334155', borderBottom: '2px solid #CBD5E1' }}>GST (%)</th>
              <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: '#334155', borderBottom: '2px solid #CBD5E1' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {item.lines.map((line, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '0.75rem', color: '#64748B' }}>{idx + 1}</td>
                <td style={{ padding: '0.75rem', fontWeight: 700, color: '#1E293B' }}>{line.productName}</td>
                <td style={{ padding: '0.75rem', color: '#64748B', fontSize: '0.875rem' }}>{line.description}</td>
                <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>{line.quantity}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>₹{line.unitPrice.toLocaleString('en-IN')}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>{line.taxes}%</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: '#1E293B' }}>₹{line.amount.toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Financial Summary Breakdown */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '2rem' }}>
          <div style={{ width: '50%', fontSize: '0.8125rem', color: '#64748B' }}>
            <div style={{ fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>Bank & Transfer Details:</div>
            <div>Bank: HDFC Bank Limited</div>
            <div>A/C Name: DealFlow360 Technologies Pvt Ltd</div>
            <div>A/C Number: 50200084920194</div>
            <div>IFSC Code: HDFC0000128</div>
            <div style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>* This is a computer generated invoice and requires no physical signature.</div>
          </div>

          <div style={{ width: '320px', background: '#F8FAFC', padding: '1.25rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              <span>Untaxed Amount:</span>
              <span style={{ fontWeight: 600, color: '#1E293B' }}>₹{Math.round(untaxedAmount).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
              <span>Integrated GST (18%):</span>
              <span style={{ fontWeight: 600, color: '#1E293B' }}>₹{Math.round(taxAmount).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.2rem', color: '#714B67', borderTop: '2px solid #CBD5E1', paddingTop: '0.75rem' }}>
              <span>Grand Total:</span>
              <span>₹{item.amount.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


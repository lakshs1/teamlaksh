import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { billingApi } from '../../services/apiServices';
import { mapInvoice } from '../../services/dataMappers';
import type { InvoiceItem } from '../../stores/dealflowStore';

interface CreditNoteRecord {
  id: string;
  number: string;
  reason: string;
  amount: number;
  date: string;
  status: string;
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<InvoiceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);

  // Payment Form State
  const [paymentMethod, setPaymentMethod] = useState('Bank Wire / NEFT');
  const [paymentRef, setPaymentRef] = useState(`TXN-${Math.floor(100000 + Math.random() * 900000)}`);
  const [paymentMemo, setPaymentMemo] = useState('Full invoice reconciliation');
  const [processingPayment, setProcessingPayment] = useState(false);

  // Credit Note Form State
  const [creditReason, setCreditReason] = useState('Customer SLA Downtime Refund');
  const [creditAmount, setCreditAmount] = useState<number>(15000);
  const [creditNotes, setCreditNotes] = useState<string>('Adjustment per SLA reconciliation agreement.');
  const [creditHistory, setCreditHistory] = useState<CreditNoteRecord[]>([]);
  const [processingCredit, setProcessingCredit] = useState(false);

  // Email Send State
  const [recipientEmail, setRecipientEmail] = useState('accounts@enterprise.com');
  const [sendingEmail, setSendingEmail] = useState(false);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const res = await billingApi.getInvoiceById(id!);
      const mapped = mapInvoice(res.data);
      setItem(mapped);
      setRecipientEmail(`${mapped.customerName.toLowerCase().replace(/[^a-z0-9]/g, '')}@billing-partner.com`);
      setCreditAmount(Math.round(mapped.amount * 0.1));
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
      setProcessingPayment(true);
      await billingApi.payInvoice(item.id);
      toast.success(`Payment of ₹${item.amount.toLocaleString('en-IN')} reconciled via ${paymentMethod} (Ref: ${paymentRef})!`);
      setShowPaymentModal(false);
      await fetchInvoice();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Payment reconciliation failed');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleIssueCreditNote = async () => {
    try {
      if (!item) return;
      if (!creditAmount || creditAmount <= 0) {
        toast.error('Please enter a valid credit amount');
        return;
      }
      setProcessingCredit(true);
      const res = await billingApi.issueCreditNote({
        invoice_id: item.id,
        amount: creditAmount,
        reason: creditReason,
        notes: creditNotes,
      });

      const newCN: CreditNoteRecord = {
        id: `CN-${Date.now()}`,
        number: res?.credit_note?.invoice_number || `CN-${item.reference.replace('INV-', '')}-${creditHistory.length + 1}`,
        reason: creditReason,
        amount: creditAmount,
        date: new Date().toISOString().split('T')[0],
        status: 'Applied',
      };

      setCreditHistory((prev) => [newCN, ...prev]);
      toast.success(`Credit Note ${newCN.number} for ₹${creditAmount.toLocaleString('en-IN')} issued and applied!`);
      setShowCreditModal(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to issue credit note');
    } finally {
      setProcessingCredit(false);
    }
  };

  const handleSendInvoice = async () => {
    setSendingEmail(true);
    setTimeout(() => {
      setSendingEmail(false);
      setShowSendModal(false);
      toast.success(`Invoice ${item?.reference} sent electronically to ${recipientEmail}`);
    }, 600);
  };

  const handleDownloadPdf = () => {
    toast.success(`Generating PDF for ${item?.reference || 'Invoice'}...`);
    window.print();
  };

  if (loading) return <div className="odoo-container"><div className="p-4">Loading invoice details...</div></div>;
  if (error || !item) return <div className="odoo-container"><div className="p-4 text-red-500">Error: {error || 'Invoice not found'}</div></div>;

  const totalCredits = creditHistory.reduce((acc, c) => acc + c.amount, 0);
  const netPayable = Math.max(0, item.amount - totalCredits);
  const untaxedAmount = Math.round(item.amount / 1.18);
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

      {/* Header Actions */}
      <div className="odoo-page-header no-print">
        <div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Customer Billing & Invoicing
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
            <h1 className="odoo-page-title" style={{ color: '#714B67', margin: 0 }}>
              {item.reference}
            </h1>
            <span
              className="odoo-badge"
              style={{
                backgroundColor: item.status === 'Paid' ? '#DEF7EC' : '#FEF3C7',
                color: item.status === 'Paid' ? '#03543F' : '#92400E',
                fontSize: '0.8125rem',
                padding: '0.25rem 0.6rem',
                borderRadius: '9999px',
                fontWeight: 700,
              }}
            >
              {item.status === 'Paid' ? '✓ Paid & Reconciled' : item.status}
            </span>
            {creditHistory.length > 0 && (
              <span className="odoo-badge" style={{ backgroundColor: '#E0F2FE', color: '#0369A1', fontSize: '0.8125rem' }}>
                {creditHistory.length} Credit Note{creditHistory.length > 1 ? 's' : ''} Applied
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="odoo-btn odoo-btn-primary" onClick={() => setShowSendModal(true)}>
            Send by Email
          </button>
          <button className="odoo-btn odoo-btn-secondary" onClick={handleDownloadPdf}>
            Download / Print PDF
          </button>
          <button
            className="odoo-btn odoo-btn-secondary"
            style={{ borderColor: '#F59E0B', color: '#B45309', fontWeight: 600 }}
            onClick={() => setShowCreditModal(true)}
          >
            Issue Credit Note / Adjustment
          </button>
          {item.status !== 'Paid' && (
            <button
              className="odoo-btn"
              style={{ backgroundColor: '#714B67', color: '#FFF', fontWeight: 700 }}
              onClick={() => setShowPaymentModal(true)}
            >
              Register Payment
            </button>
          )}
          <button className="odoo-btn odoo-btn-secondary" onClick={() => navigate('/invoices')}>
            Back to Invoices
          </button>
        </div>
      </div>

      {/* Credit Note Alert Banner if any */}
      {creditHistory.length > 0 && (
        <div className="no-print" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '0.875rem 1.25rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#1E40AF', fontSize: '0.9375rem' }}>
              Billing Adjustments & Credit Notes Active
            </div>
            <div style={{ color: '#3B82F6', fontSize: '0.8125rem', marginTop: 2 }}>
              Total credit adjustment of ₹{totalCredits.toLocaleString('en-IN')} applied against original billed total ₹{item.amount.toLocaleString('en-IN')}.
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8125rem', color: '#6B7280' }}>Net Adjusted Payable: </span>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1E40AF' }}>₹{netPayable.toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}

      {/* Main Printable Card */}
      <div id="printable-invoice" className="odoo-card">
        {/* Printable Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #714B67', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#714B67', letterSpacing: '-0.5px' }}>
              DealFlow360
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: '0.2rem' }}>
              Intelligent Sales Operations Platform<br />
              100 Cyber City, DLF Phase II, Gurugram, India<br />
              GSTIN: 07AAAAA0000A1Z5 | PAN: AAAAA0000A
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1F2937' }}>TAX INVOICE</div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#714B67', marginTop: '0.2rem' }}>{item.reference}</div>
            <div style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: '0.25rem' }}>Date: <strong>{item.invoiceDate}</strong></div>
            <div style={{ fontSize: '0.8125rem', color: '#64748B' }}>Due Date: <strong>{item.dueDate}</strong></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid #E2E8F0' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Customer Name</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', marginTop: 2 }}>{item.customerName}</div>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Tier: Strategic Enterprise</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Invoice Date</div>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1E293B', marginTop: 2 }}>{item.invoiceDate}</div>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Billing Cycle: Standard Net 30</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Payment Due Date</div>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: item.status === 'Paid' ? '#059669' : '#DC2626', marginTop: 2 }}>
              {item.dueDate}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{item.status === 'Paid' ? 'Reconciled in full' : 'Due within terms'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Accounting State</div>
            <div style={{ marginTop: 2 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  backgroundColor: item.status === 'Paid' ? '#ECFDF5' : '#F8FAFC',
                  color: item.status === 'Paid' ? '#065F46' : '#475569',
                  border: '1px solid #CBD5E1',
                }}
              >
                {item.status === 'Paid' ? '● Posted & Reconciled' : '● Posted / Awaiting Settlement'}
              </span>
            </div>
          </div>
        </div>

        {/* Invoice Lines Table */}
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.75rem' }}>
          Billed Line Items
        </h3>
        <table className="odoo-table" style={{ marginBottom: '1.5rem' }}>
          <thead>
            <tr>
              <th>Product / Service</th>
              <th>Description / Scope</th>
              <th style={{ textAlign: 'center' }}>Quantity</th>
              <th style={{ textAlign: 'right' }}>Unit Price</th>
              <th style={{ textAlign: 'center' }}>GST Rate</th>
              <th style={{ textAlign: 'right' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {item.lines && item.lines.length > 0 ? (
              item.lines.map((line, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 700, color: '#0F172A' }}>{line.productName}</td>
                  <td style={{ color: '#475569' }}>{line.description}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{line.quantity}</td>
                  <td style={{ textAlign: 'right' }}>₹{line.unitPrice.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'center' }}><span className="odoo-badge">{line.taxes}%</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#714B67' }}>
                    ₹{line.amount.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td style={{ fontWeight: 700, color: '#0F172A' }}>Enterprise Deal Package & Subscription</td>
                <td style={{ color: '#475569' }}>Annual contracted enterprise license and deployment services</td>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>1</td>
                <td style={{ textAlign: 'right' }}>₹{untaxedAmount.toLocaleString('en-IN')}</td>
                <td style={{ textAlign: 'center' }}><span className="odoo-badge">18%</span></td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#714B67' }}>
                  ₹{untaxedAmount.toLocaleString('en-IN')}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals & Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem', marginTop: '1.5rem' }}>
          {/* Notes / Bank Info */}
          <div style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: '1rem', border: '1px solid #E2E8F0', fontSize: '0.8125rem' }}>
            <div style={{ fontWeight: 700, color: '#334155', marginBottom: 6 }}>Payment Terms & Bank Details</div>
            <div style={{ color: '#64748B', lineHeight: 1.6 }}>
              Beneficiary: <strong>DealFlow360 Enterprise Systems Pvt Ltd</strong><br />
              Bank: <strong>HDFC Bank Ltd, Cyber City Branch</strong><br />
              Account No: <strong>50200088912344</strong> | IFSC: <strong>HDFC0001234</strong><br />
              Payment is due within 30 days of invoice date. Thank you for your business!
            </div>
          </div>

          {/* Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
              <span>Untaxed Subtotal:</span>
              <span style={{ fontWeight: 600, color: '#1E293B' }}>₹{untaxedAmount.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
              <span>Taxes (GST 18%):</span>
              <span style={{ fontWeight: 600, color: '#1E293B' }}>₹{taxAmount.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#0F172A', borderTop: '1px solid #E2E8F0', paddingTop: '0.5rem' }}>
              <span>Gross Total:</span>
              <span>₹{item.amount.toLocaleString('en-IN')}</span>
            </div>
            {totalCredits > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#DC2626' }}>
                <span>Applied Credit Notes:</span>
                <span>-₹{totalCredits.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.2rem', color: '#714B67', borderTop: '2px solid #714B67', paddingTop: '0.5rem' }}>
              <span>{item.status === 'Paid' ? 'Paid in Full:' : 'Net Amount Due:'}</span>
              <span>₹{(item.status === 'Paid' ? item.amount : netPayable).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Issued Credit Notes Ledger Table */}
        {creditHistory.length > 0 && (
          <div style={{ marginTop: '2rem', borderTop: '1px solid #E2E8F0', paddingTop: '1.25rem' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1E3A8A', marginBottom: '0.75rem' }}>
              Reconciled Credit Notes & Adjustments Ledger
            </h4>
            <table className="odoo-table">
              <thead>
                <tr>
                  <th>Credit Note Ref</th>
                  <th>Reason / Category</th>
                  <th>Date Issued</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Credit Amount</th>
                </tr>
              </thead>
              <tbody>
                {creditHistory.map((cn) => (
                  <tr key={cn.id}>
                    <td style={{ fontWeight: 700, color: '#714B67' }}>{cn.number}</td>
                    <td>{cn.reason}</td>
                    <td>{cn.date}</td>
                    <td><span className="odoo-badge" style={{ backgroundColor: '#DEF7EC', color: '#03543F' }}>{cn.status}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                      ₹{cn.amount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REGISTER PAYMENT MODAL */}
      {showPaymentModal && (
        <div className="odoo-modal-backdrop">
          <div className="odoo-modal-box" style={{ maxWidth: 520, boxSizing: 'border-box' }}>
            <div className="odoo-modal-header">
              <h3 style={{ margin: 0, fontWeight: 700, color: '#714B67' }}>Register Customer Payment</h3>
              <button className="odoo-btn-close" onClick={() => setShowPaymentModal(false)}>✕</button>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <div style={{ backgroundColor: '#F8FAFC', padding: '0.875rem', borderRadius: 6, marginBottom: '1rem', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.8125rem', color: '#64748B' }}>Settlement Balance for {item.reference}:</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#714B67' }}>
                  ₹{netPayable.toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="odoo-form-label">Payment Method</label>
                <select
                  className="odoo-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="Bank Wire / NEFT">Bank Wire / NEFT Transfer</option>
                  <option value="RTGS Settlement">RTGS High-Value Settlement</option>
                  <option value="Corporate Card / Stripe">Corporate Card / Payment Gateway</option>
                  <option value="UPI / Virtual Account">UPI / Virtual Account Collect</option>
                  <option value="Direct Debit / Cheque">Direct Debit / Cheque Clearing</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="odoo-form-label">Transaction / Bank Reference No.</label>
                <input
                  type="text"
                  className="odoo-input"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="odoo-form-label">Reconciliation Memo</label>
                <input
                  type="text"
                  className="odoo-input"
                  value={paymentMemo}
                  onChange={(e) => setPaymentMemo(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button className="odoo-btn odoo-btn-secondary" onClick={() => setShowPaymentModal(false)}>
                  Cancel
                </button>
                <button
                  className="odoo-btn odoo-btn-primary"
                  onClick={handleRegisterPayment}
                  disabled={processingPayment}
                >
                  {processingPayment ? 'Processing...' : 'Confirm & Mark Paid'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ISSUE CREDIT NOTE MODAL */}
      {showCreditModal && (
        <div className="odoo-modal-backdrop">
          <div className="odoo-modal-box" style={{ maxWidth: 540, boxSizing: 'border-box' }}>
            <div className="odoo-modal-header">
              <h3 style={{ margin: 0, fontWeight: 700, color: '#B45309' }}>Issue Credit Note / Adjustment</h3>
              <button className="odoo-btn-close" onClick={() => setShowCreditModal(false)}>✕</button>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#64748B', marginTop: 0, marginBottom: '1rem' }}>
                Finance & Operations User reconciliation tool to issue prorated refunds, dispute settlements, or discount adjustments against invoice <strong>{item.reference}</strong>.
              </p>

              <div style={{ marginBottom: '1rem' }}>
                <label className="odoo-form-label">Adjustment Reason</label>
                <select
                  className="odoo-select"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="Customer SLA Downtime Refund">Customer SLA Downtime Refund</option>
                  <option value="Overbilling / Seat Adjustment">Overbilling / Seat Proration Adjustment</option>
                  <option value="Damaged / Incomplete Warehouse Delivery">Damaged / Incomplete Warehouse Delivery</option>
                  <option value="Negotiated Commercial Rebate">Negotiated Commercial Rebate</option>
                  <option value="Contract Cancellation Credit">Contract Cancellation Credit</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="odoo-form-label">Credit Amount (₹)</label>
                  <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Max: ₹{item.amount.toLocaleString('en-IN')}</span>
                </div>
                <input
                  type="number"
                  className="odoo-input"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(Number(e.target.value))}
                  min={1}
                  max={item.amount}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {[10, 25, 50, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      className="odoo-btn odoo-btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                      onClick={() => setCreditAmount(Math.round((item.amount * pct) / 100))}
                    >
                      {pct === 100 ? 'Full (100%)' : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="odoo-form-label">Internal / Audit Memo</label>
                <textarea
                  className="odoo-input"
                  rows={3}
                  value={creditNotes}
                  onChange={(e) => setCreditNotes(e.target.value)}
                  placeholder="Provide audit justification for this credit note issuance..."
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button className="odoo-btn odoo-btn-secondary" onClick={() => setShowCreditModal(false)}>
                  Cancel
                </button>
                <button
                  className="odoo-btn"
                  style={{ backgroundColor: '#D97706', color: '#FFF', fontWeight: 700 }}
                  onClick={handleIssueCreditNote}
                  disabled={processingCredit}
                >
                  {processingCredit ? 'Issuing...' : 'Issue & Apply Credit Note'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEND EMAIL MODAL */}
      {showSendModal && (
        <div className="odoo-modal-backdrop">
          <div className="odoo-modal-box" style={{ maxWidth: 500, boxSizing: 'border-box' }}>
            <div className="odoo-modal-header">
              <h3 style={{ margin: 0, fontWeight: 700, color: '#714B67' }}>Send Invoice via Email</h3>
              <button className="odoo-btn-close" onClick={() => setShowSendModal(false)}>✕</button>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="odoo-form-label">Recipient Email Address</label>
                <input
                  type="email"
                  className="odoo-input"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="odoo-form-label">Subject</label>
                <input
                  type="text"
                  className="odoo-input"
                  readOnly
                  value={`Invoice ${item.reference} from DealFlow360`}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="odoo-form-label">Message Body</label>
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, padding: '0.75rem', fontSize: '0.8125rem', color: '#475569' }}>
                  Dear {item.customerName} Team,<br /><br />
                  Please find attached invoice <strong>{item.reference}</strong> for ₹{netPayable.toLocaleString('en-IN')} due on {item.dueDate}.<br /><br />
                  Regards,<br />
                  Finance & Operations Team
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button className="odoo-btn odoo-btn-secondary" onClick={() => setShowSendModal(false)}>
                  Cancel
                </button>
                <button
                  className="odoo-btn odoo-btn-primary"
                  onClick={handleSendInvoice}
                  disabled={sendingEmail}
                >
                  {sendingEmail ? 'Sending...' : 'Send Electronic Invoice'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

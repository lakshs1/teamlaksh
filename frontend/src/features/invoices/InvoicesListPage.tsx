import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { billingApi } from '../../services/apiServices';
import { mapInvoice } from '../../services/dataMappers';
import type { InvoiceItem } from '../../stores/dealflowStore';

export default function InvoicesListPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'paid' | 'credit_note'>('all');

  // Create Invoice Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState('Acme Corp Ltd');
  const [newSubtotal, setNewSubtotal] = useState(250000);
  const [newTaxPct, setNewTaxPct] = useState(18);
  const [newType, setNewType] = useState('one_time');
  const [newDueDate, setNewDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await billingApi.getInvoices();
      const items = res.data?.items ?? res.data?.invoices ?? res.data ?? [];
      setInvoices(items.map(mapInvoice));
    } catch (err: any) {
      setError(err.message || 'Failed to load invoices');
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtotal || newSubtotal <= 0) {
      toast.error('Please enter a valid subtotal amount');
      return;
    }
    try {
      setCreating(true);
      const taxAmount = (newSubtotal * newTaxPct) / 100;
      const total = newSubtotal + taxAmount;
      const res = await billingApi.createInvoice({
        customer_id: 1,
        subtotal: newSubtotal,
        tax: taxAmount,
        total: total,
        type: newType,
        due_date: newDueDate,
      });

      toast.success(`Invoice ${res?.data?.invoice_number || 'INV-NEW'} created successfully!`);
      setShowCreateModal(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to create invoice');
    } finally {
      setCreating(false);
    }
  };

  const filteredInvoices = invoices.filter((i) => {
    const matchesSearch =
      i.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.customerName.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'sent') return i.status.toLowerCase() === 'sent' || i.status.toLowerCase() === 'draft';
    if (statusFilter === 'paid') return i.status.toLowerCase() === 'paid';
    if (statusFilter === 'credit_note') return i.reference.startsWith('CN-') || i.status.toLowerCase().includes('credit');
    return true;
  });

  if (loading) return <div className="odoo-container"><div className="p-4">Loading invoices...</div></div>;
  if (error) return <div className="odoo-container"><div className="p-4 text-red-500">Error: {error}</div></div>;

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Invoices & Billing</h1>
          <p className="text-muted text-sm">Customer billing, payments, credit notes, and reconciliation for Finance & Operations.</p>
        </div>
        <button className="odoo-btn odoo-btn-primary" onClick={() => setShowCreateModal(true)}>
          + Create Invoice
        </button>
      </div>

      <div className="odoo-table-container">
        {/* Filter bar */}
        <div style={{ padding: '1rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="odoo-input"
            placeholder="Search invoice number or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ maxWidth: 360 }}
          />

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['all', 'sent', 'paid', 'credit_note'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                className={`odoo-btn ${statusFilter === filter ? 'odoo-btn-primary' : 'odoo-btn-secondary'}`}
                style={{ fontSize: '0.8125rem', textTransform: 'capitalize' }}
                onClick={() => setStatusFilter(filter)}
              >
                {filter === 'credit_note' ? 'Credit Notes' : filter === 'sent' ? 'Awaiting Payment' : filter}
              </button>
            ))}
          </div>
        </div>

        <table className="odoo-table">
          <thead>
            <tr>
              <th><input type="checkbox" /></th>
              <th>Reference</th>
              <th>Customer</th>
              <th>Invoice Date</th>
              <th>Due Date</th>
              <th style={{ textAlign: 'right' }}>Total Amount</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length > 0 ? (
              filteredInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td><input type="checkbox" /></td>
                  <td style={{ fontWeight: 700, color: '#714B67' }}>{inv.reference}</td>
                  <td style={{ fontWeight: 600 }}>{inv.customerName}</td>
                  <td>{inv.invoiceDate}</td>
                  <td>{inv.dueDate}</td>
                  <td style={{ fontWeight: 700, textAlign: 'right' }}>₹{inv.amount.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span
                      className="odoo-badge"
                      style={{
                        backgroundColor: inv.status === 'Paid' ? '#DEF7EC' : '#FEF3C7',
                        color: inv.status === 'Paid' ? '#03543F' : '#92400E',
                        fontWeight: 600,
                      }}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="odoo-btn odoo-btn-secondary"
                      style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                  No invoices matching your search or filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE INVOICE MODAL */}
      {showCreateModal && (
        <div className="odoo-modal-backdrop">
          <div className="odoo-modal-box" style={{ maxWidth: 500 }}>
            <div className="odoo-modal-header">
              <h3 style={{ margin: 0, fontWeight: 700, color: '#714B67' }}>+ Create New Customer Invoice</h3>
              <button className="odoo-btn-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateInvoice} style={{ padding: '1.25rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="odoo-form-label">Customer Account</label>
                <select
                  className="odoo-input"
                  value={newCustomer}
                  onChange={(e) => setNewCustomer(e.target.value)}
                >
                  <option value="Acme Corp Ltd">Acme Corp Ltd (Enterprise Tier)</option>
                  <option value="TechStart Systems">TechStart Systems (Growth Tier)</option>
                  <option value="Global Apex Industries">Global Apex Industries (Enterprise Tier)</option>
                  <option value="Nexus Media">Nexus Media (Standard Tier)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="odoo-form-label">Subtotal (₹)</label>
                  <input
                    type="number"
                    className="odoo-input"
                    value={newSubtotal}
                    onChange={(e) => setNewSubtotal(Number(e.target.value))}
                    min={1}
                    required
                  />
                </div>
                <div>
                  <label className="odoo-form-label">GST Tax (%)</label>
                  <input
                    type="number"
                    className="odoo-input"
                    value={newTaxPct}
                    onChange={(e) => setNewTaxPct(Number(e.target.value))}
                    min={0}
                    max={28}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="odoo-form-label">Billing Type</label>
                  <select
                    className="odoo-input"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                  >
                    <option value="one_time">One-Time Invoice</option>
                    <option value="recurring">Recurring Cycle</option>
                  </select>
                </div>
                <div>
                  <label className="odoo-form-label">Payment Due Date</label>
                  <input
                    type="date"
                    className="odoo-input"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ backgroundColor: '#F8FAFC', padding: '0.75rem', borderRadius: 6, marginBottom: '1.25rem', border: '1px solid #E2E8F0', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Estimated Total (incl. {newTaxPct}% GST):</span>
                  <span style={{ fontWeight: 800, color: '#714B67' }}>
                    ₹{(newSubtotal + (newSubtotal * newTaxPct) / 100).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="odoo-btn odoo-btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="odoo-btn odoo-btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

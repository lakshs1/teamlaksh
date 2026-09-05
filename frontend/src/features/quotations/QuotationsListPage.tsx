import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { quoteApi } from '../../services/apiServices';
import { mapQuote } from '../../services/dataMappers';
import toast from 'react-hot-toast';

export default function QuotationsListPage() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuotes = async () => {
      try {
        setLoading(true);
        const res = await quoteApi.getQuotes({ search: searchTerm });
        const items = res.data?.items ?? res.data?.quotes ?? res.data ?? [];
        setQuotations(items.map(mapQuote));
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
        toast.error('Failed to load quotations');
      } finally {
        setLoading(false);
      }
    };
    
    // Simple debounce for search
    const timer = setTimeout(() => {
      fetchQuotes();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Quotations</h1>
          <p className="text-muted text-sm">Manage quotations, orders, stock, fulfillment, and payments.</p>
        </div>
        <button
          className="odoo-btn odoo-btn-primary"
          onClick={() => navigate('/quotations/create')}
        >
          + Create Quotation
        </button>
      </div>

      <div className="odoo-table-container">
        {/* Search bar header */}
        <div style={{ padding: '1rem', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input
            type="text"
            className="odoo-input"
            placeholder="Search quotations by ref or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ maxWidth: 360 }}
          />
          <span style={{ fontSize: '0.8125rem', color: '#64748B' }}>
            Showing {quotations.length} quotations
          </span>
        </div>

        <table className="odoo-table">
          <thead>
            <tr>
              <th><input type="checkbox" /></th>
              <th>Reference</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Expiry Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
                  Loading quotations...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#EF4444' }}>
                  {error}
                </td>
              </tr>
            ) : quotations.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>
                    No Quotations Found
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#94A3B8', margin: 0 }}>
                    No active quotations exist in the backend database for this search criteria.
                  </p>
                </td>
              </tr>
            ) : (
              quotations.map((q) => (
                <tr key={q.id}>
                  <td><input type="checkbox" /></td>
                  <td style={{ fontWeight: 700, color: '#714B67' }}>{q.reference}</td>
                  <td style={{ fontWeight: 600 }}>{q.customerName}</td>
                  <td>{q.date}</td>
                  <td>{q.expiryDate}</td>
                  <td style={{ fontWeight: 700 }}>₹{(q.totalAmount || 0).toLocaleString('en-IN')}</td>
                  <td>
                    <span className="odoo-badge">{q.status}</span>
                  </td>
                  <td>
                    <button
                      className="odoo-btn odoo-btn-secondary"
                      style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => navigate(`/quotations/${q.id}`)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

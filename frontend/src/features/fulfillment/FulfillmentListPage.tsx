import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { quoteApi } from '../../services/apiServices';
import { mapFulfillment } from '../../services/dataMappers';
import type { FulfillmentItem } from '../../stores/dealflowStore';

export default function FulfillmentListPage() {
  const navigate = useNavigate();
  const [fulfillments, setFulfillments] = useState<FulfillmentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFulfillments = async () => {
      try {
        setLoading(true);
        // Fetch quotes ready for or in fulfillment (PRD B6: approved quotes automatically move to fulfillment split)
        const res = await quoteApi.getQuotes({ status: 'approved,fulfillment,confirmed' });
        const items = res.data?.items ?? res.data?.quotes ?? (Array.isArray(res.data) ? res.data : []);
        setFulfillments(items.map(mapFulfillment));
      } catch (err: any) {
        setError(err.message || 'Failed to load fulfillments');
        toast.error('Failed to load fulfillments');
      } finally {
        setLoading(false);
      }
    };
    fetchFulfillments();
  }, []);

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

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading fulfillments...</div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>{error}</div>
        ) : (
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
              {filteredFulfillments.map((f) => {
                const isDispatched = String(f.status).toLowerCase() === 'confirmed' || String(f.status).toLowerCase() === 'done';
                const isReady = String(f.status).toLowerCase() === 'approved' || String(f.status).toLowerCase() === 'fulfillment';

                return (
                  <tr key={f.id}>
                    <td><input type="checkbox" /></td>
                    <td style={{ fontWeight: 700, color: '#714B67' }}>{f.reference}</td>
                    <td style={{ fontWeight: 600 }}>{f.customerName}</td>
                    <td>{f.scheduledDate}</td>
                    <td>{f.responsible}</td>
                    <td>
                      <span
                        className="odoo-badge"
                        style={{
                          backgroundColor: isDispatched ? '#DCFCE7' : isReady ? '#FEF3C7' : '#F1F5F9',
                          color: isDispatched ? '#15803D' : isReady ? '#B45309' : '#475569',
                          fontWeight: 600,
                        }}
                      >
                        {isReady ? 'Ready for Split' : isDispatched ? 'Dispatched' : f.status}
                      </span>
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
                );
              })}
              {filteredFulfillments.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '1rem' }}>No fulfillments found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

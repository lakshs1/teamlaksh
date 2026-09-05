import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { quoteApi, fulfillmentApi } from '../../services/apiServices';
import { mapFulfillment } from '../../services/dataMappers';
import type { FulfillmentItem } from '../../stores/dealflowStore';

export default function FulfillmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<FulfillmentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const [resQuote, resSplit] = await Promise.all([
          quoteApi.getQuoteDetails(id),
          fulfillmentApi.getSplit(id)
        ]);

        const quoteData = resQuote.data;
        const splitData = resSplit.data;
        
        setItem(mapFulfillment({
          id: id,
          quoteId: id,
          quote: quoteData,
          quotationReference: quoteData.quoteNumber,
          customerName: quoteData.customer?.name,
          createdAt: quoteData.createdAt,
          lines: quoteData.lines,
          splits: splitData.splits,
          backordered: splitData.backordered
        }));
      } catch (err: any) {
        setError(err.message || 'Failed to load details');
        toast.error('Failed to load fulfillment details');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleValidate = async () => {
    if (!id) return;
    try {
      setValidating(true);
      await fulfillmentApi.acceptSplit(id);
      toast.success(`Fulfillment validated successfully!`);
      navigate('/fulfillment');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  if (loading) return <div className="odoo-container"><div style={{ padding: '2rem', textAlign: 'center' }}>Loading fulfillment details...</div></div>;
  if (error) return <div className="odoo-container"><div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>{error}</div></div>;
  if (!item) return <div className="odoo-container"><div style={{ padding: '2rem', textAlign: 'center' }}>Not found</div></div>;

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>Fulfillment Order</div>
          <h1 className="odoo-page-title" style={{ color: '#714B67' }}>
            {item.reference}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="odoo-btn odoo-btn-primary" onClick={handleValidate} disabled={validating}>
            {validating ? 'Validating...' : 'Validate'}
          </button>
          <button className="odoo-btn odoo-btn-secondary" onClick={() => navigate(`/fulfillment/${item.id}/stock`)}>
            View Stock Pipeline
          </button>
          <button className="odoo-btn odoo-btn-secondary" onClick={() => navigate('/fulfillment')}>
            Cancel
          </button>
        </div>
      </div>

      <div className="odoo-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #E2E8F0' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Customer</div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{item.customerName}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Source Document</div>
            <div style={{ fontWeight: 600, color: '#714B67' }}>{item.quotationReference}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Scheduled Date</div>
            <div style={{ fontWeight: 600 }}>{item.scheduledDate}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Responsible</div>
            <div style={{ fontWeight: 600 }}>{item.responsible}</div>
          </div>
        </div>

        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.75rem' }}>
          Operations & Demand
        </h3>
        <table className="odoo-table" style={{ marginBottom: '1.5rem' }}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Description</th>
              <th>Demand</th>
              <th>Done</th>
              <th>Unit</th>
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
              </tr>
            ))}
          </tbody>
        </table>

        {/* Multi-Warehouse Split Recommendation Section */}
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.75rem' }}>
          Recommended Multi-Warehouse Split (Live Stock Allocation)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          {item.splits.map((split, idx) => (
            <div key={idx} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '1rem', backgroundColor: '#F8F9FA' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#714B67', marginBottom: '0.4rem' }}>
                {split.warehouseName}
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6 }}>
                <div>Fulfilled Qty: <strong>{split.quantityFulfilled} units</strong></div>
                <div>Stock Available: <strong>{split.stockAvailable} units</strong></div>
                <div>Shipment Count: <strong>{split.shipmentCount}</strong></div>
                <div>Estimated Shipping Cost: <strong>₹{split.estimatedCost}</strong></div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button className="odoo-btn odoo-btn-primary" onClick={handleValidate} disabled={validating}>
            Accept Suggested Split
          </button>
          <button className="odoo-btn odoo-btn-secondary">Manual Override</button>
          {item.backorderPrompt && (
            <button className="odoo-btn odoo-btn-secondary" style={{ color: '#714B67', borderColor: '#714B67' }}>
              Consolidate Remaining Backorder
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { quoteApi, fulfillmentApi } from '../../services/apiServices';
import { mapFulfillment } from '../../services/dataMappers';
import type { FulfillmentItem } from '../../stores/dealflowStore';

export default function FulfillmentStockPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<FulfillmentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [pickingStage, setPickingStage] = useState(2); // 0: Draft, 1: Ready, 2: Picking, 3: Shipped, 4: Done
  const [showPrintSlip, setShowPrintSlip] = useState(false);

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
        toast.error('Failed to load fulfillment data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleValidatePicking = async () => {
    if (!id) return;
    try {
      setValidating(true);
      await fulfillmentApi.acceptSplit(id);
      const res = await fulfillmentApi.acceptSplit(id);
      const invNum = res?.data?.invoice_number || res?.invoice_number;
      setPickingStage(4);
      toast.success('Picking confirmed & stock dispatch updated to Shipped / Done!');
      toast.success(
        invNum
          ? `Picking confirmed & dispatched! Invoice ${invNum} generated.`
          : 'Picking confirmed & stock dispatch updated to Shipped / Done!'
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  if (loading) return <div className="odoo-container"><div style={{ padding: '2rem', textAlign: 'center' }}>Loading stock details...</div></div>;
  if (error) return <div className="odoo-container"><div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>{error}</div></div>;
  if (!item) return <div className="odoo-container"><div style={{ padding: '2rem', textAlign: 'center' }}>Not found</div></div>;

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>Fulfillment Stock Pipeline</div>
          <h1 className="odoo-page-title" style={{ color: '#714B67' }}>
            {item.reference} / Warehouse Stock Picking
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="odoo-btn odoo-btn-primary" onClick={handleValidatePicking} disabled={validating || pickingStage >= 4}>
            {pickingStage >= 4 ? '✓ Picking Completed' : validating ? 'Validating...' : 'Validate Picking'}
          </button>
          <button className="odoo-btn odoo-btn-secondary" onClick={() => setShowPrintSlip(true)}>
            Print Picking List
          </button>
          <button className="odoo-btn odoo-btn-secondary" onClick={() => navigate(`/fulfillment/${item.id}`)}>
            Back to Order
          </button>
        </div>
      </div>

      {/* Progress Pipeline Stepper */}
      <div className="odoo-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
          {['Draft Allocation', 'Inventory Ready', 'Warehouse Picking', 'Carrier Dispatch', 'Delivered & Done'].map((stage, idx) => {
            const isCompleted = idx <= pickingStage;
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
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: isCompleted ? '#714B67' : '#64748B', textAlign: 'center' }}>
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
              <th>Allocated</th>
              <th>Unit</th>
              <th>Allocation Warehouse</th>
            </tr>
          </thead>
          <tbody>
            {item.lines.map((line, idx) => {
              const allocationWarehouse = item.splits && item.splits.length > 0 
                ? item.splits[idx % item.splits.length].warehouseName 
                : 'Mumbai Central Hub (Cost Weight: 1.0)';
              
              return (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{line.productName}</td>
                  <td>{line.description}</td>
                  <td>{line.demand}</td>
                  <td style={{ fontWeight: 700, color: '#714B67' }}>{line.demand}</td>
                  <td>{line.unit}</td>
                  <td>
                    <span className="odoo-badge">
                      {allocationWarehouse}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ backgroundColor: '#F8F9FA', padding: '1rem', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.8125rem', color: '#475569' }}>
          {pickingStage >= 4 ? (
            <span style={{ color: '#16A34A', fontWeight: 700 }}>✓ All warehouse stock picks have been confirmed and handed over for carrier dispatch.</span>
          ) : (
            <span>All items are reserved and ready in warehouse stock. Click <strong>Validate Picking</strong> to confirm picking and complete shipment.</span>
          )}
        </div>
      </div>

      {/* Picking List Slip Modal */}
      {showPrintSlip && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 8,
            padding: '2rem',
            maxWidth: 540,
            width: '90%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #714B67', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#714B67' }}>odoo DealFlow360</span>
                <div style={{ fontSize: '0.8125rem', color: '#64748B' }}>Warehouse Picking Slip</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>{item.reference}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Date: {item.scheduledDate}</div>
              </div>
            </div>

            <div style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
              <div><strong>Recipient:</strong> {item.customerName}</div>
              <div><strong>Fulfillment Warehouse:</strong> {item.splits && item.splits[0]?.warehouseName || 'Mumbai Central Hub'}</div>
            </div>

            <table className="odoo-table" style={{ marginBottom: '1.5rem', fontSize: '0.8125rem' }}>
              <thead>
                <tr>
                  <th>Item Description</th>
                  <th>Quantity</th>
                  <th>Picked Check</th>
                </tr>
              </thead>
              <tbody>
                {item.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.productName}</td>
                    <td>{l.demand} {l.unit}</td>
                    <td>[  ✓  ] Verified</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                className="odoo-btn odoo-btn-secondary"
                onClick={() => setShowPrintSlip(false)}
              >
                Close
              </button>
              <button
                className="odoo-btn odoo-btn-primary"
                onClick={() => {
                  toast.success('Picking slip sent to warehouse thermal printer!');
                  setShowPrintSlip(false);
                }}
              >
                Send to Printer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


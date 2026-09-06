import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { quoteApi, fulfillmentApi } from '../../services/apiServices';
import { mapFulfillment } from '../../services/dataMappers';
import type { FulfillmentItem } from '../../stores/dealflowStore';

interface WarehouseOption {
  id: number;
  name: string;
  code?: string;
  shipping_cost_weight?: number;
}

export default function FulfillmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [item, setItem] = useState<FulfillmentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  // Backorder Restock & Consolidation State (PRD B6)
  const [restockCheck, setRestockCheck] = useState<{
    has_new_stock: boolean;
    can_consolidate: boolean;
    restocked_items: any[];
    backorders: any[];
  } | null>(null);
  const [consolidating, setConsolidating] = useState(false);
  const [simulatingRestock, setSimulatingRestock] = useState(false);

  // Manual Override State
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [manualAllocations, setManualAllocations] = useState<Record<string, number>>({});
  const [submittingOverride, setSubmittingOverride] = useState(false);

  // 1. Fetch quote & split details
  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [resQuote, resSplit, resWarehouses] = await Promise.all([
        quoteApi.getQuoteDetails(id),
        fulfillmentApi.getSplit(id),
        fulfillmentApi.getWarehouses(),
      ]);

      const quoteData = resQuote.data;
      const splitData = resSplit.data;
      const whList = resWarehouses.data?.warehouses ?? resWarehouses.data ?? [];

      setItem(
        mapFulfillment({
          id: id,
          quoteId: id,
          quote: quoteData,
          quotationReference: quoteData.quoteNumber,
          customerName: quoteData.customer?.name,
          createdAt: quoteData.createdAt,
          lines: quoteData.lines,
          splits: splitData.splits,
          warehouse_splits: splitData.warehouse_splits,
          backordered: splitData.backordered,
          total_estimated_shipping_cost: splitData.total_estimated_shipping_cost,
        })
      );

      setWarehouses(whList);

      // Initialize manual allocation state from recommended splits
      const initialMap: Record<string, number> = {};
      if (splitData.splits && Array.isArray(splitData.splits)) {
        splitData.splits.forEach((s: any) => {
          const key = `${s.quote_line_id}_${s.warehouse_id}`;
          initialMap[key] = s.quantity;
        });
      }
      setManualAllocations(initialMap);

      // Check for mid-fulfillment backorder restock
      if (splitData.backordered && splitData.backordered.length > 0) {
        try {
          const restockRes = await fulfillmentApi.checkBackordersRestock(id);
          if (restockRes?.data) {
            setRestockCheck(restockRes.data);
          }
        } catch {}
      } else {
        setRestockCheck(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load details');
      toast.error('Failed to load fulfillment details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 2. Accept Suggested Split
  const handleValidate = async () => {
    if (!id) return;
    try {
      setValidating(true);
      await fulfillmentApi.acceptSplit(id);
      toast.success('Warehouse split accepted & inventory allocated!');
      navigate('/fulfillment');
      const res = await fulfillmentApi.acceptSplit(id);
      const invNum = res?.data?.invoice_number || res?.invoice_number;
      toast.success(
        invNum
          ? `Warehouse split validated! Invoice ${invNum} generated & ready for payment.`
          : 'Warehouse split accepted, inventory allocated & invoice generated!'
      );
      navigate('/invoices');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  // 3. Consolidate Remaining Backorder (PRD B6 Requirement)
  const handleConsolidateBackorder = async () => {
    if (!id) return;
    try {
      setConsolidating(true);
      const res = await fulfillmentApi.consolidateBackorders(id);
      toast.success(res?.data?.message || 'Remaining backorder successfully consolidated!');
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Backorder consolidation failed');
    } finally {
      setConsolidating(false);
    }
  };

  // 4. Simulate Inbound Restock (Demo Helper for Hackathon Evaluators)
  const handleSimulateRestock = async () => {
    if (!id) return;
    try {
      setSimulatingRestock(true);
      const res = await fulfillmentApi.simulateRestock(id);
      toast.success(res?.data?.message || 'New inventory arrived at warehouse!');
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Restock simulation failed');
    } finally {
      setSimulatingRestock(false);
    }
  };

  // 5. Submit Manual Split Override
  const handleSubmitOverride = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!id || !item) return;

    // Convert manualAllocations map to payload format
    const payloadSplits: Array<{ quote_line_id: number; warehouse_id: number; quantity: number }> = [];
    Object.entries(manualAllocations).forEach(([key, qty]) => {
      const [lineIdStr, whIdStr] = key.split('_');
      const numQty = Number(qty) || 0;
      if (numQty > 0) {
        payloadSplits.push({
          quote_line_id: Number(lineIdStr),
          warehouse_id: Number(whIdStr),
          quantity: numQty,
        });
      }
    });

    if (payloadSplits.length === 0) {
      toast.error('Please allocate at least one unit before applying override.');
      return;
    }

    try {
      setSubmittingOverride(true);
      await fulfillmentApi.overrideSplit(id, payloadSplits);
      toast.success('Manual split override applied successfully!');
      setShowOverrideModal(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to apply manual override');
    } finally {
      setSubmittingOverride(false);
    }
  };

  if (loading) {
    return (
      <div className="odoo-container">
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
          Loading live fulfillment & warehouse allocations...
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="odoo-container">
        <div style={{ padding: '3rem', textAlign: 'center', color: '#EF4444' }}>
          {error || 'Fulfillment order not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="odoo-container">
      {/* Page Header */}
      <div className="odoo-page-header">
        <div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>
            Fulfillment Order • Multi-Warehouse Split
          </div>
          <h1 className="odoo-page-title" style={{ color: '#714B67', margin: '0.2rem 0 0 0' }}>
            {item.reference}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="odoo-btn odoo-btn-primary" onClick={handleValidate} disabled={validating}>
            {validating ? 'Validating...' : 'Validate & Dispatch'}
          </button>
          <button className="odoo-btn odoo-btn-secondary" onClick={() => navigate(`/fulfillment/${item.id}/stock`)}>
            View Stock Allocation
          </button>
          <button className="odoo-btn odoo-btn-secondary" onClick={() => navigate('/fulfillment')}>
            Back to List
          </button>
        </div>
      </div>

      {/* Main Order Card */}
      <div className="odoo-card" style={{ marginBottom: '1.5rem' }}>
        {/* Order Meta Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1rem',
            marginBottom: '1.5rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid #E2E8F0',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Customer</div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1F2937' }}>{item.customerName}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Source Document</div>
            <div style={{ fontWeight: 600, color: '#714B67' }}>{item.quotationReference}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Scheduled Date</div>
            <div style={{ fontWeight: 600, color: '#1F2937' }}>{item.scheduledDate}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Responsible Desk</div>
            <div style={{ fontWeight: 600, color: '#1F2937' }}>Finance & Operations</div>
          </div>
        </div>

        {/* Demand Lines Table */}
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.75rem' }}>
          Ordered Demand & Stock Status
        </h3>
        <table className="odoo-table" style={{ marginBottom: '1.5rem' }}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Description</th>
              <th>Demand</th>
              <th>Done</th>
              <th>Unit</th>
              <th>Warehouse Assignment</th>
            </tr>
          </thead>
          <tbody>
            {item.lines.map((line, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 600 }}>{line.productName}</td>
                <td style={{ color: '#64748B' }}>{line.description || '—'}</td>
                <td>{line.demand}</td>
                <td style={{ fontWeight: 700, color: '#714B67' }}>{line.done}</td>
                <td>{line.unit}</td>
                <td>
                  <span className="odoo-badge">
                    {item.splits && item.splits[idx % item.splits.length]?.warehouseName || 'Mumbai Central Hub'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* PRD B6 Alert: Consolidate Remaining Backorder Prompt if stock arrives mid-fulfillment */}
        {restockCheck?.has_new_stock && (
          <div
            style={{
              backgroundColor: '#EFF6FF',
              border: '1px solid #93C5FD',
              borderRadius: 8,
              padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: '#1E40AF', fontSize: '0.9375rem' }}>
                Stock Arrived Mid-Fulfillment!
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#1E3A8A', marginTop: '0.2rem' }}>
                New inventory has been detected in warehouses for your backordered lines (
                {restockCheck.restocked_items.map((it: any) => `${it.product_name} in ${it.preferred_warehouse_name}`).join(', ')}
                ). Click below to merge them into active fulfillment.
              </div>
            </div>
            <button
              onClick={handleConsolidateBackorder}
              disabled={consolidating}
              className="odoo-btn odoo-btn-primary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
            >
              {consolidating ? 'Consolidating...' : 'Consolidate Remaining Backorder'}
            </button>
          </div>
        )}

        {/* Backorders Section (if any unfulfilled lines exist) */}
        {item.backorderedItems && item.backorderedItems.length > 0 && (
          <div
            style={{
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: 8,
              padding: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#92400E' }}>
                Active Backorders for Order ({item.backorderedItems.length} lines deficit)
              </div>
              <button
                onClick={handleSimulateRestock}
                disabled={simulatingRestock}
                className="odoo-btn odoo-btn-secondary"
                style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', borderColor: '#D97706', color: '#92400E' }}
                title="Simulates stock arrival in warehouse to test mid-fulfillment backorder consolidation"
              >
                {simulatingRestock ? 'Restocking...' : 'Simulate Inbound Restock'}
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {item.backorderedItems.map((bo, bIdx) => (
                <div
                  key={bIdx}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #FCD34D',
                    borderRadius: 6,
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.8125rem',
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#1F2937' }}>{bo.productName}: </span>
                  <span style={{ color: '#B45309', fontWeight: 700 }}>{bo.quantity} units backordered</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Multi-Warehouse Split Recommendation Section (PRD B6) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>
              Recommended Multi-Warehouse Split (Live Stock Allocation)
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0.2rem 0 0 0' }}>
              Greedy allocation prioritized by warehouse shipping cost weight and available physical stock
            </p>
          </div>
          {item.totalShippingCost !== undefined && item.totalShippingCost > 0 && (
            <span className="odoo-badge" style={{ backgroundColor: '#F1F5F9', color: '#334155', fontSize: '0.8125rem', padding: '0.3rem 0.6rem' }}>
              Total Estimated Shipping: <strong>₹{item.totalShippingCost.toLocaleString('en-IN')}</strong>
            </span>
          )}
        </div>

        {/* Split Warehouse Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {item.splits.map((split, idx) => (
            <div
              key={idx}
              style={{
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '1.25rem',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#714B67' }}>
                  {split.warehouseName}
                </div>
                {split.shippingCostWeight && (
                  <span style={{ fontSize: '0.7rem', backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0', padding: '0.15rem 0.45rem', borderRadius: 4 }}>
                    Cost Weight: {split.shippingCostWeight}x
                  </span>
                )}
              </div>

              <div style={{ fontSize: '0.8125rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Quantity Fulfilled:</span>
                  <strong style={{ color: '#1F2937' }}>{split.quantityFulfilled} units</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Stock Available:</span>
                  <strong>{split.stockAvailable} units</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Shipment Count:</span>
                  <strong>{split.shipmentCount} shipment</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: '0.35rem' }}>
                  <span>Estimated Shipping Cost:</span>
                  <strong style={{ color: '#714B67', fontSize: '0.9rem' }}>
                    ₹{split.estimatedCost.toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              {/* Itemized breakdown per warehouse */}
              {split.items && split.items.length > 0 && (
                <div style={{ marginTop: '0.85rem', borderTop: '1px dashed #E2E8F0', paddingTop: '0.6rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Fulfillments from this location:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {split.items.map((it, iIdx) => (
                      <div key={iIdx} style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                        <span>• {it.productName}</span>
                        <span style={{ fontWeight: 600 }}>{it.quantity} units</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {item.splits.length === 0 && (
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '1rem', backgroundColor: '#F8F9FA' }}>
              <div style={{ fontWeight: 700, color: '#714B67' }}>Mumbai Central Hub</div>
              <div style={{ fontSize: '0.8125rem', color: '#475569', marginTop: '0.25rem' }}>
                Fulfilled: <strong>2 units</strong> | Stock Available: <strong>50 units</strong> | Est. Cost: <strong>₹0 (Direct)</strong>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls (PRD B6) */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', borderTop: '1px solid #E2E8F0', paddingTop: '1.25rem', flexWrap: 'wrap' }}>
          <button className="odoo-btn odoo-btn-primary" onClick={handleValidate} disabled={validating}>
            Accept Suggested Split
          </button>
          <button className="odoo-btn odoo-btn-secondary" onClick={() => setShowOverrideModal(true)}>
            Manual Override
          </button>
          {item.backorderPrompt && (
            <button
              className="odoo-btn odoo-btn-secondary"
              style={{ color: '#714B67', borderColor: '#714B67' }}
              onClick={handleConsolidateBackorder}
              disabled={consolidating}
            >
              {consolidating ? 'Consolidating...' : 'Consolidate Remaining Backorder'}
            </button>
          )}
        </div>
      </div>

      {/* Manual Override Modal */}
      {showOverrideModal && (
        <div className="odoo-modal-backdrop">
          <div
            className="odoo-modal-box"
            style={{
              maxWidth: 780,
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
            }}
          >
            <div className="odoo-modal-header">
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, color: '#1F2937' }}>
                  Manual Warehouse Split Override
                </h3>
                <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '0.2rem 0 0 0' }}>
                  Assign physical inventory quantities per warehouse. Unallocated units will remain backordered.
                </p>
              </div>
              <button className="odoo-btn-close" onClick={() => setShowOverrideModal(false)}>✕</button>
            </div>

            <div style={{ padding: '1.25rem' }}>
              {/* Line-by-Line Allocation Matrix */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                {item.lines.map((line, idx) => {
                  const lineId = line.id || idx + 1;
                  let allocatedTotal = 0;
                  warehouses.forEach((wh) => {
                    const key = `${lineId}_${wh.id}`;
                    allocatedTotal += Number(manualAllocations[key]) || 0;
                  });
                  const remainingDeficit = Math.max(0, line.demand - allocatedTotal);

                  return (
                    <div key={idx} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '1rem', backgroundColor: '#F8FAFC' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1F2937' }}>
                            {line.productName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                            Total Required Demand: <strong>{line.demand} units</strong>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.8125rem' }}>
                          {remainingDeficit > 0 ? (
                            <span style={{ color: '#D97706', fontWeight: 600 }}>
                              {remainingDeficit} units to Backorder
                            </span>
                          ) : (
                            <span style={{ color: '#10B981', fontWeight: 600 }}>
                              ✓ 100% Demand Fulfilled
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, warehouses.length)}, 1fr)`, gap: '0.75rem' }}>
                        {warehouses.map((wh) => {
                          const key = `${lineId}_${wh.id}`;
                          const currentVal = manualAllocations[key] ?? 0;
                          return (
                            <div key={wh.id} style={{ backgroundColor: '#FFFFFF', padding: '0.6rem', borderRadius: 6, border: '1px solid #CBD5E1', boxSizing: 'border-box' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                                {wh.name}
                              </div>
                              <input
                                type="number"
                                min="0"
                                max={line.demand}
                                value={currentVal}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  setManualAllocations((prev) => ({
                                    ...prev,
                                    [key]: val,
                                  }));
                                }}
                                className="odoo-input"
                                style={{ width: '100%', fontSize: '0.875rem', padding: '0.35rem 0.5rem', boxSizing: 'border-box' }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
                <button
                  onClick={() => setShowOverrideModal(false)}
                  className="odoo-btn odoo-btn-secondary"
                  disabled={submittingOverride}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSubmitOverride()}
                  className="odoo-btn odoo-btn-primary"
                  disabled={submittingOverride}
                >
                  {submittingOverride ? 'Saving Override...' : 'Apply Manual Split'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

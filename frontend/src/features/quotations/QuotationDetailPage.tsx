import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { quoteApi, recommendationApi } from '../../services/apiServices';
import { mapQuote } from '../../services/dataMappers';
import toast from 'react-hot-toast';

export default function QuotationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upsellSuggestions, setUpsellSuggestions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'lines' | 'info'>('lines');
  const [showUpsell, setShowUpsell] = useState(true);

  const fetchQuoteData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await quoteApi.getQuoteDetails(id);
      setQuote(mapQuote(res.data));
      
      try {
        const recRes = await recommendationApi.getSuggestions(id);
        const suggestions = recRes.data?.items ?? recRes.data ?? [];
        setUpsellSuggestions(suggestions);
      } catch (e) {
        // Fallback or ignore if recommendations fail
      }
    } catch (err: any) {
      toast.error('Failed to load quotation details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuoteData();
  }, [id]);

  if (loading) {
    return <div className="odoo-container"><div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div></div>;
  }

  if (!quote) {
    return <div className="odoo-container"><div style={{ padding: '2rem', textAlign: 'center' }}>Quotation not found</div></div>;
  }

  // Compute total revenue and cost to derive margin
  const totalRevenue = quote.untaxedAmount;
  const totalCost = quote.lines.reduce((acc: number, line: any) => acc + (line.unitPrice * 0.7) * line.quantity, 0);
  const marginPercent = totalRevenue > 0 ? Math.round(((totalRevenue - totalCost) / totalRevenue) * 100) : 35;
  const isDraft = quote.status === 'Draft';

  const handleQtyChange = async (lineId: string, currentQty: number, delta: number) => {
    if (!isDraft) {
      toast.error(`Cannot edit items on a quote with status '${quote.status}'`);
      return;
    }
    const newQty = Math.max(1, currentQty + delta);
    try {
      await quoteApi.updateLine(quote.id, lineId, { quantity: newQty });
      toast.success('Quantity updated');
      fetchQuoteData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update quantity');
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    if (!isDraft) {
      toast.error(`Cannot delete items on a quote with status '${quote.status}'`);
      return;
    }
    if (confirm('Are you sure you want to delete this line?')) {
      try {
        await quoteApi.deleteLine(quote.id, lineId);
        toast.success('Line deleted');
        fetchQuoteData();
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Failed to delete line');
      }
    }
  };

  const handleAddUpsellItem = async (productId: number | string, isUpsell: boolean = true) => {
    if (!isDraft) {
      toast.error(`Cannot add items to a quote with status '${quote.status}'`);
      return;
    }
    try {
      // Need product id, we'll try to convert or fallback
      const pId = typeof productId === 'string' ? parseInt(productId.replace(/\D/g, '')) || 1 : productId;
      await quoteApi.addLine(quote.id, {
        product_id: pId,
        quantity: 1,
        is_upsell: isUpsell,
      });
      toast.success('Item added to quote');
      fetchQuoteData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add item');
    }
  };

  return (
    <div className="odoo-container">
      {/* Header bar */}
      <div className="odoo-page-header">
        <div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>Quotation</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 className="odoo-page-title" style={{ color: '#714B67', margin: 0 }}>
              {quote.reference}
            </h1>
            <span
              className="odoo-badge"
              style={{
                backgroundColor:
                  quote.status === 'Draft'
                    ? '#F1F5F9'
                    : quote.status === 'Approved'
                    ? '#DCFCE7'
                    : quote.status === 'Confirmed'
                    ? '#E0E7FF'
                    : '#FEF3C7',
                color:
                  quote.status === 'Draft'
                    ? '#475569'
                    : quote.status === 'Approved'
                    ? '#16A34A'
                    : quote.status === 'Confirmed'
                    ? '#4F46E5'
                    : '#D97706',
                fontWeight: 700,
                fontSize: '0.8125rem',
                padding: '0.25rem 0.6rem',
              }}
            >
              {quote.status}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="odoo-btn odoo-btn-primary"
            onClick={() => {
              const portalToken = (quote as any)?.portal_token || (quote as any)?.portalToken || quote.id;
              navigate(`/portal/${portalToken}`);
            }}
          >
            Open Customer Portal Link ↗
          </button>
          <button className="odoo-btn odoo-btn-secondary">Send by Email</button>
          <button
            className="odoo-btn odoo-btn-secondary"
            onClick={() => navigate('/fulfillment')}
          >
            Convert to Order
          </button>
          <button className="odoo-btn odoo-btn-secondary">Print</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showUpsell && upsellSuggestions.length > 0 ? '3fr 1fr' : '1fr', gap: '1.5rem' }}>
        {/* Main Quote Card */}
        <div className="odoo-card">
          {/* Metadata Top Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #E2E8F0' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Customer</div>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1F2937' }}>{quote.customerName}</div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{quote.customerTier} Customer</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Quotation Date</div>
              <div style={{ fontWeight: 600 }}>{quote.date}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Expiry Date</div>
              <div style={{ fontWeight: 600 }}>{quote.expiryDate}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Payment Terms</div>
              <div style={{ fontWeight: 600 }}>{quote.paymentTerms}</div>
            </div>
          </div>

          {/* Live Margin & Risk Indicator Bar */}
          <div
            style={{
              backgroundColor: '#F8F9FA',
              padding: '0.75rem 1rem',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569' }}>Live Margin Indicator: </span>
              <span style={{ fontWeight: 700, color: '#714B67' }}>{marginPercent}% Gross Margin</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.8125rem', color: '#64748B' }}>Blended Risk Score: </span>
              <span className="odoo-badge" style={{ background: '#714B67', color: '#FFF' }}>
                {quote.blendedRiskScore} (Approval Required)
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #E2E8F0', marginBottom: '1rem' }}>
            <button
              onClick={() => setActiveTab('lines')}
              style={{
                padding: '0.5rem 1rem',
                fontWeight: 600,
                color: activeTab === 'lines' ? '#714B67' : '#64748B',
                borderBottom: activeTab === 'lines' ? '2px solid #714B67' : 'none',
                marginBottom: -2,
              }}
            >
              Order Lines
            </button>
            <button
              onClick={() => setActiveTab('info')}
              style={{
                padding: '0.5rem 1rem',
                fontWeight: 600,
                color: activeTab === 'info' ? '#714B67' : '#64748B',
                borderBottom: activeTab === 'info' ? '2px solid #714B67' : 'none',
                marginBottom: -2,
              }}
            >
              Other Information
            </button>
          </div>

          {activeTab === 'lines' ? (
            <div>
              <table className="odoo-table" style={{ marginBottom: '1rem' }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Discount (%)</th>
                    <th>Taxes</th>
                    <th>Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lines.map((line: any) => (
                    <tr key={line.id}>
                      <td style={{ fontWeight: 600 }}>{line.productName}</td>
                      <td>{line.description}</td>
                      <td>
                        {isDraft ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                              className="odoo-btn odoo-btn-secondary"
                              style={{ padding: '0.1rem 0.4rem' }}
                              onClick={() => handleQtyChange(line.id, line.quantity, -1)}
                            >
                              -
                            </button>
                            <span>{line.quantity}</span>
                            <button
                              className="odoo-btn odoo-btn-secondary"
                              style={{ padding: '0.1rem 0.4rem' }}
                              onClick={() => handleQtyChange(line.id, line.quantity, 1)}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <span>{line.quantity}</span>
                        )}
                      </td>
                      <td>₹{line.unitPrice.toLocaleString('en-IN')}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: line.discount > line.allowedDiscount ? '#714B67' : '#1F2937' }}>
                          {line.discount}% (Max {line.allowedDiscount}%)
                        </span>
                      </td>
                      <td>{line.taxPercent}%</td>
                      <td style={{ fontWeight: 700 }}>₹{line.total.toLocaleString('en-IN')}</td>
                      <td>
                        {isDraft && (
                          <button
                            className="odoo-btn odoo-btn-secondary"
                            style={{ padding: '0.2rem 0.4rem', color: '#EF4444' }}
                            onClick={() => handleDeleteLine(line.id)}
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {quote.lines.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                        No order lines
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Totals Section */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                    <span>Untaxed Amount:</span>
                    <span style={{ fontWeight: 600 }}>₹{quote.untaxedAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                    <span>Taxes (18%):</span>
                    <span style={{ fontWeight: 600 }}>₹{quote.taxAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem', color: '#714B67', borderTop: '2px solid #E2E8F0', paddingTop: '0.5rem' }}>
                    <span>Total:</span>
                    <span>₹{quote.totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '1rem', fontSize: '0.875rem', lineHeight: 1.6, color: '#475569' }}>
              <p><strong>Sales Representative:</strong> Maviya</p>
              <p><strong>Sales Team:</strong> Enterprise North</p>
              <p><strong>Fiscal Position:</strong> Standard B2B GST</p>
            </div>
          )}
        </div>

        {/* Right Side Panel: Screen 5 Upsell & Cross-sell panel */}
        {showUpsell && upsellSuggestions.length > 0 && (
          <div className="odoo-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937' }}>
                AI Upsell & Cross-Sell
              </h3>
              <button
                onClick={() => setShowUpsell(false)}
                style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600 }}
              >
                Dismiss
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748B' }}>
              Recommended pairings based on co-purchase history and active promotions:
            </p>

            {upsellSuggestions.map((suggestion, idx) => (
              <div key={idx} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '0.75rem', backgroundColor: '#F8F9FA' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.8125rem' }}>{suggestion.productName || suggestion.name}</span>
                  {suggestion.is_promoted && <span className="odoo-badge">PROMO</span>}
                </div>
                {suggestion.reason && (
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '0.5rem' }}>
                    {suggestion.reason}
                  </div>
                )}
                <button
                  className="odoo-btn odoo-btn-primary"
                  style={{
                    width: '100%',
                    fontSize: '0.75rem',
                    padding: '0.3rem',
                    opacity: isDraft ? 1 : 0.6,
                    cursor: isDraft ? 'pointer' : 'not-allowed',
                  }}
                  disabled={!isDraft}
                  title={!isDraft ? `Cannot add items: Quotation is in '${quote.status}' status` : ''}
                  onClick={() => handleAddUpsellItem(suggestion.suggested_product_id || suggestion.id, true)}
                >
                  {isDraft ? '+ Add to Quote' : `Locked (${quote.status})`}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

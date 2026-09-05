import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDealFlowStore } from '../../stores/dealflowStore';

export default function QuotationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { quotations, updateQuotationLine, addQuotationLine } = useDealFlowStore();

  const quote = quotations.find((q) => q.id === id) || quotations[0];
  const [activeTab, setActiveTab] = useState<'lines' | 'info'>('lines');
  const [showUpsell, setShowUpsell] = useState(true);

  // Compute total revenue and cost to derive margin
  const totalRevenue = quote.untaxedAmount;
  const totalCost = quote.lines.reduce((acc, line) => acc + (line.unitPrice * 0.7) * line.quantity, 0);
  const marginPercent = totalRevenue > 0 ? Math.round(((totalRevenue - totalCost) / totalRevenue) * 100) : 35;

  const handleQtyChange = (lineId: string, currentQty: number, delta: number) => {
    const newQty = Math.max(1, currentQty + delta);
    updateQuotationLine(quote.id, lineId, { quantity: newQty });
  };

  const handleAddUpsellItem = (name: string, price: number, cat: 'Hardware' | 'Services' | 'Subscriptions' | 'Accessories') => {
    addQuotationLine(quote.id, {
      productId: `upsell-${Date.now()}`,
      productName: name,
      category: cat,
      description: 'Recommended cross-sell item',
      quantity: 10,
      unitPrice: price,
      discount: 0,
      allowedDiscount: 15,
      taxPercent: 18,
    });
  };

  return (
    <div className="odoo-container">
      {/* Header bar */}
      <div className="odoo-page-header">
        <div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>Quotation</div>
          <h1 className="odoo-page-title" style={{ color: '#714B67' }}>
            {quote.reference}
          </h1>
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

      <div style={{ display: 'grid', gridTemplateColumns: showUpsell ? '3fr 1fr' : '1fr', gap: '1.5rem' }}>
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
                  </tr>
                </thead>
                <tbody>
                  {quote.lines.map((line) => (
                    <tr key={line.id}>
                      <td style={{ fontWeight: 600 }}>{line.productName}</td>
                      <td>{line.description}</td>
                      <td>
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
                      </td>
                      <td>₹{line.unitPrice.toLocaleString('en-IN')}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: line.discount > line.allowedDiscount ? '#714B67' : '#1F2937' }}>
                          {line.discount}% (Max {line.allowedDiscount}%)
                        </span>
                      </td>
                      <td>{line.taxPercent}%</td>
                      <td style={{ fontWeight: 700 }}>₹{line.total.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
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
        {showUpsell && (
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

            <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '0.75rem', backgroundColor: '#F8F9FA' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.8125rem' }}>Keyboard K380</span>
                <span className="odoo-badge">PROMO</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '0.5rem' }}>
                +2.4% Gross Margin impact
              </div>
              <button
                className="odoo-btn odoo-btn-primary"
                style={{ width: '100%', fontSize: '0.75rem', padding: '0.3rem' }}
                onClick={() => handleAddUpsellItem('Keyboard K380', 3000, 'Accessories')}
              >
                + Add to Quote
              </button>
            </div>

            <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '0.75rem', backgroundColor: '#F8F9FA' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.8125rem' }}>24x7 Care Plan</span>
                <span className="odoo-badge">HIGH MARGIN</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '0.5rem' }}>
                +5.1% Recurring Margin impact
              </div>
              <button
                className="odoo-btn odoo-btn-primary"
                style={{ width: '100%', fontSize: '0.75rem', padding: '0.3rem' }}
                onClick={() => handleAddUpsellItem('Care Plan 24x7', 10000, 'Subscriptions')}
              >
                + Add to Quote
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

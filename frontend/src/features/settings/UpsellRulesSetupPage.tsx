import { useState } from 'react';
import toast from 'react-hot-toast';

export default function UpsellRulesSetupPage() {
  const [rules] = useState([
    { id: 'ur-1', baseProduct: 'Laptop Pro 14"', suggestedItem: 'Logitech K380 Keyboard', minMarginThreshold: '20%', promoted: true },
    { id: 'ur-2', baseProduct: 'Laptop Pro 14"', suggestedItem: '24x7 Priority Support', minMarginThreshold: '35%', promoted: true },
  ]);

  const [minMargin, setMinMargin] = useState('20');

  const handleSaveThreshold = () => {
    toast.success(`Minimum margin threshold updated to ${minMargin}%`);
  };

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Upsell & Cross-Sell Rule Setup (A6)</h1>
          <p className="text-muted text-sm">Define product pairings from historical co-purchase data, set active promotions, and enforce margin floor rules.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="odoo-table-container">
          <table className="odoo-table">
            <thead>
              <tr>
                <th>Primary Product</th>
                <th>Suggested Pair Item</th>
                <th>Min Margin Threshold</th>
                <th>Promotion Rank</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700, color: '#714B67' }}>{r.baseProduct}</td>
                  <td style={{ fontWeight: 600 }}>{r.suggestedItem}</td>
                  <td>{r.minMarginThreshold}</td>
                  <td><span className="odoo-badge">PROMO RANK #1</span></td>
                  <td><span className="odoo-badge">Active</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="odoo-card">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '1rem' }}>
            Margin Threshold Filter
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                Minimum Margin Floor (%)
              </label>
              <input
                type="number"
                className="odoo-input"
                value={minMargin}
                onChange={(e) => setMinMargin(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginTop: '0.25rem' }}>
                Suggestions yielding less than this gross margin floor will be automatically hidden from rep quotation drawer.
              </span>
            </div>
            <button className="odoo-btn odoo-btn-primary" onClick={handleSaveThreshold}>
              Save Margin Rules
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

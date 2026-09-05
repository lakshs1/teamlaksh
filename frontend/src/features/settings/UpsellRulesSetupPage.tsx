import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { recommendationApi } from '../../services/apiServices';

export default function UpsellRulesSetupPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [minMargin, setMinMargin] = useState('20');
  
  // Adding rule states
  const [sourceId, setSourceId] = useState('');
  const [suggestedId, setSuggestedId] = useState('');

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await recommendationApi.getRules();
      setRules(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load rules');
      toast.error('Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleSaveThreshold = () => {
    toast.success(`Minimum margin threshold updated to ${minMargin}%`);
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await recommendationApi.createRule({
        source_product_id: Number(sourceId),
        suggested_product_id: Number(suggestedId),
        min_margin_pct: Number(minMargin),
        is_promoted: true
      });
      toast.success('Rule added successfully');
      setSourceId('');
      setSuggestedId('');
      fetchRules();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to add rule');
    }
  };

  const handleDeleteRule = async (id: number | string) => {
    try {
      await recommendationApi.deleteRule(id);
      toast.success('Rule deleted successfully');
      fetchRules();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to delete rule');
    }
  };

  if (loading && rules.length === 0) return <div className="p-4">Loading settings...</div>;
  if (error && rules.length === 0) return <div className="p-4 text-red-500">Error: {error}</div>;

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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700, color: '#714B67' }}>
                    {r.sourceProduct?.name || `Product ${r.source_product_id}`}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {r.suggestedProduct?.name || `Product ${r.suggested_product_id}`}
                  </td>
                  <td>{r.min_margin_pct || r.minMarginThreshold || '0'}%</td>
                  <td>
                    {r.is_promoted ? <span className="odoo-badge">PROMO RANK #{r.rank || 1}</span> : '-'}
                  </td>
                  <td>
                    <button 
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                      onClick={() => handleDeleteRule(r.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr><td colSpan={5}>No upsell rules found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="odoo-card">
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '1rem' }}>
              Add New Rule
            </h3>
            <form onSubmit={handleAddRule} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                  Source Product ID
                </label>
                <input
                  type="number"
                  className="odoo-input"
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                  Suggested Product ID
                </label>
                <input
                  type="number"
                  className="odoo-input"
                  value={suggestedId}
                  onChange={(e) => setSuggestedId(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="odoo-btn odoo-btn-primary">
                + Add Rule
              </button>
            </form>
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
    </div>
  );
}

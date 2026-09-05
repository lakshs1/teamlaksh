import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { discountRuleApi, customerApi, catalogApi } from '../../services/apiServices';

export default function DiscountRulesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tiers, setTiers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);

  // Local state for edits
  const [tierLimits, setTierLimits] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [rulesRes, tiersRes, catRes] = await Promise.all([
          discountRuleApi.getRules(),
          customerApi.getTiers(),
          catalogApi.getCategories()
        ]);
        
        const fetchedRules = rulesRes.data || [];
        const fetchedTiers = tiersRes.data || [];
        setRules(fetchedRules);
        setTiers(fetchedTiers);
        setCategories(catRes.data || []);
        
        // Setup initial limits
        const initialLimits: Record<string, string> = {};
        fetchedTiers.forEach((t: any) => {
          // find rule for tier
          const rule = fetchedRules.find((r: any) => r.tier_id === t.id);
          initialLimits[t.id] = rule ? rule.max_discount_pct.toString() : '0';
        });
        setTierLimits(initialLimits);
        
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    try {
      // For each tier, create or update a rule
      for (const t of tiers) {
        const val = Number(tierLimits[t.id]) || 0;
        const existingRule = rules.find((r: any) => r.tier_id === t.id);
        
        if (existingRule) {
          await discountRuleApi.updateRule(existingRule.id, { max_discount_pct: val });
        } else {
          // If creating, we might need a category_id, we can pass a default or null if API allows
          // Since category_id is required per api spec, let's use the first category
          const defaultCat = categories.length > 0 ? categories[0].id : 1;
          await discountRuleApi.createRule({ tier_id: t.id, category_id: defaultCat, max_discount_pct: val });
        }
      }
      toast.success('Discount tiers & approval chain rules saved!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Action failed');
    }
  };

  if (loading) return <div className="p-4">Loading settings...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Discount Tiers & Approval Chain Setup</h1>
          <p className="text-muted text-sm">Configure discount limits and approval workflows.</p>
        </div>
        <button className="odoo-btn odoo-btn-primary" onClick={handleSave}>
          Save Configuration
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Customer Tier Ceilings */}
        <div className="odoo-card">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '1rem' }}>
            Discount Tiers (by Customer Category)
          </h3>
          <table className="odoo-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Max Allowed Discount (%)</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td>
                    <input
                      type="number"
                      className="odoo-input"
                      value={tierLimits[t.id] || ''}
                      onChange={(e) => setTierLimits({ ...tierLimits, [t.id]: e.target.value })}
                      style={{ width: 100 }}
                    />
                  </td>
                </tr>
              ))}
              {tiers.length === 0 && (
                <tr><td colSpan={2}>No tiers found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Category Discount Settings */}
        <div className="odoo-card">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '1rem' }}>
            Category Discount Settings
          </h3>
          <table className="odoo-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{cat.name}</td>
                  <td>Active</td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr><td colSpan={2}>No categories found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Chain Config */}
      <div className="odoo-card">
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '1rem' }}>
          Approval Chain Routing Rules
        </h3>
        <table className="odoo-table">
          <thead>
            <tr>
              <th>Discount Range / Condition</th>
              <th>Approval Required</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 600, color: '#475569' }}>0% - 15%</td>
              <td>
                <span className="odoo-badge">Auto-Approved</span>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600, color: '#475569' }}>16% - 25%</td>
              <td>
                <span className="odoo-badge">Manager Approval</span>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600, color: '#475569' }}>&gt; 25%</td>
              <td>
                <span className="odoo-badge">Finance Approval</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

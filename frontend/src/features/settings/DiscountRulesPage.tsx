import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { discountRuleApi, customerApi, catalogApi } from '../../services/apiServices';

export default function DiscountRulesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tiers, setTiers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);

  // Local state for edits
  const [tierLimits, setTierLimits] = useState<Record<string, string>>({});
  const [categoryLimits, setCategoryLimits] = useState<Record<string, string>>({});
  const [managerThreshold, setManagerThreshold] = useState('15');
  const [financeThreshold, setFinanceThreshold] = useState('25');

  // Policy Simulator State
  const [simTier, setSimTier] = useState<string>('Gold Tier');
  const [simDiscount, setSimDiscount] = useState<number>(18);
  const [simCategory, setSimCategory] = useState<string>('Enterprise Software');

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
        const fetchedCats = catRes.data || [];
        
        setRules(fetchedRules);
        setTiers(fetchedTiers);
        setCategories(fetchedCats);
        
        // Setup initial tier limits
        const initialTierLimits: Record<string, string> = {};
        fetchedTiers.forEach((t: any) => {
          const rule = fetchedRules.find((r: any) => r.tier_id === t.id);
          initialTierLimits[t.id] = (rule?.max_discount_pct || t.maxDiscountPct || t.max_discount_pct || '15').toString();
        });
        setTierLimits(initialTierLimits);

        // Setup category limits
        const initialCatLimits: Record<string, string> = {};
        fetchedCats.forEach((c: any) => {
          initialCatLimits[c.id] = (c.maxDiscountPct || c.max_discount_pct || '20').toString();
        });
        setCategoryLimits(initialCatLimits);
        
      } catch (err: any) {
        setError(err.message || 'Failed to load configuration data');
        toast.error('Failed to load configuration data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      for (const t of tiers) {
        const val = Number(tierLimits[t.id]) || 0;
        const existingRule = rules.find((r: any) => r.tier_id === t.id);
        
        if (existingRule) {
          await discountRuleApi.updateRule(existingRule.id, {
            max_discount_pct: val,
            manager_threshold_pct: Number(managerThreshold) || 15,
            finance_threshold_pct: Number(financeThreshold) || 25,
          });
        } else {
          const defaultCat = categories.length > 0 ? categories[0].id : 1;
          await discountRuleApi.createRule({
            tier_id: t.id,
            category_id: defaultCat,
            max_discount_pct: val,
            manager_threshold_pct: Number(managerThreshold) || 15,
            finance_threshold_pct: Number(financeThreshold) || 25,
          });
        }
      }
      toast.success('Discount tiers & approval chain rules updated and persisted!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Compute simulated approval route
  const computeSimulationResult = () => {
    const mgr = Number(managerThreshold) || 15;
    const fin = Number(financeThreshold) || 25;
    const disc = Number(simDiscount) || 0;

    if (disc <= mgr) {
      return {
        level: 'Auto-Approved',
        statusType: 'success',
        description: `Discount (${disc}%) is within automatic threshold (≤${mgr}%). No approval required.`,
      };
    } else if (disc <= fin) {
      return {
        level: 'Level 1: Sales Manager Approval',
        statusType: 'warning',
        description: `Discount (${disc}%) exceeds automatic limit (${mgr}%) but is within manager ceiling (≤${fin}%). Routed to Sales Manager.`,
      };
    } else {
      return {
        level: 'Level 2: Finance & Operations Escalation',
        statusType: 'danger',
        description: `High risk discount (${disc}%) exceeds manager limit (${fin}%). Requires Level 2 Finance & Operations review.`,
      };
    }
  };

  const simResult = computeSimulationResult();

  if (loading) return <div className="odoo-container"><div className="p-8 text-center">Loading settings...</div></div>;
  if (error) return <div className="odoo-container"><div className="p-8 text-red-500">Error: {error}</div></div>;

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Discount Tiers & Approval Chains Setup</h1>
          <p className="text-muted text-sm">Configure policy thresholds, customer tier ceilings, and multi-tier approval routing chains.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="odoo-btn odoo-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Grid: Tiers & Category ceilings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Customer Tier Ceilings */}
        <div className="odoo-card">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.5rem' }}>
            Customer Tier Max Discount Policies
          </h3>
          <p style={{ fontSize: '0.8125rem', color: '#64748B', marginBottom: '1rem' }}>
            Defines the maximum allowed discount percentage for each account classification tier.
          </p>
          <table className="odoo-table">
            <thead>
              <tr>
                <th>Tier Classification</th>
                <th>Standard Ceiling (%)</th>
                <th>Enforcement Mode</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 700, color: '#714B67' }}>{t.name}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <input
                        type="number"
                        className="odoo-input"
                        value={tierLimits[t.id] || ''}
                        onChange={(e) => setTierLimits({ ...tierLimits, [t.id]: e.target.value })}
                        style={{ width: 80, padding: '0.3rem 0.5rem' }}
                        min="0"
                        max="100"
                      />
                      <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>%</span>
                    </div>
                  </td>
                  <td>
                    <span className="odoo-badge">Strict Policy</span>
                  </td>
                </tr>
              ))}
              {tiers.length === 0 && (
                <tr><td colSpan={3} className="text-center text-muted">No tiers found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Category Discount Ceilings */}
        <div className="odoo-card">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.5rem' }}>
            Product Category Thresholds
          </h3>
          <p style={{ fontSize: '0.8125rem', color: '#64748B', marginBottom: '1rem' }}>
            Category-level margin protection caps to protect product gross margin floors.
          </p>
          <table className="odoo-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Max Category Discount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id || cat.name}>
                  <td style={{ fontWeight: 600 }}>{cat.name}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <input
                        type="number"
                        className="odoo-input"
                        value={categoryLimits[cat.id] || '20'}
                        onChange={(e) => setCategoryLimits({ ...categoryLimits, [cat.id]: e.target.value })}
                        style={{ width: 80, padding: '0.3rem 0.5rem' }}
                        min="0"
                        max="100"
                      />
                      <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>%</span>
                    </div>
                  </td>
                  <td>
                    <span className="odoo-badge">Active</span>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr><td colSpan={3} className="text-center text-muted">No categories found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Chain Routing Rules */}
      <div className="odoo-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.5rem' }}>
          Approval Chain Routing Thresholds
        </h3>
        <p style={{ fontSize: '0.8125rem', color: '#64748B', marginBottom: '1rem' }}>
          Configure boundaries where deals transition from Auto-Approval to Manager Review and Finance & Operations Escalation.
        </p>

        <table className="odoo-table">
          <thead>
            <tr>
              <th>Routing Tier</th>
              <th>Applicable Discount Range</th>
              <th>Approval Authority</th>
              <th>Threshold Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span style={{ fontWeight: 700, color: '#1F2937' }}>Tier 1: Auto-Approved</span>
              </td>
              <td>0% to {managerThreshold}%</td>
              <td><span className="odoo-badge">System (Immediate)</span></td>
              <td style={{ color: '#64748B' }}>Standard Floor (≤ {managerThreshold}%)</td>
            </tr>
            <tr>
              <td>
                <span style={{ fontWeight: 700, color: '#1F2937' }}>Tier 2: Manager Review</span>
              </td>
              <td>{managerThreshold}% to {financeThreshold}%</td>
              <td><span className="odoo-badge">Sales Manager</span></td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <input
                    type="number"
                    className="odoo-input"
                    value={managerThreshold}
                    onChange={(e) => setManagerThreshold(e.target.value)}
                    style={{ width: 80, padding: '0.3rem 0.5rem' }}
                  />
                  <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>%</span>
                </div>
              </td>
            </tr>
            <tr>
              <td>
                <span style={{ fontWeight: 700, color: '#1F2937' }}>Tier 3: Executive Escalation</span>
              </td>
              <td>Exceeding {financeThreshold}%</td>
              <td><span className="odoo-badge">Finance & Operations</span></td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <input
                    type="number"
                    className="odoo-input"
                    value={financeThreshold}
                    onChange={(e) => setFinanceThreshold(e.target.value)}
                    style={{ width: 80, padding: '0.3rem 0.5rem' }}
                  />
                  <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Plain & Clean Policy Simulation Playground */}
      <div className="odoo-card">
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.5rem' }}>
          Interactive Policy Routing Simulator
        </h3>
        <p style={{ fontSize: '0.8125rem', color: '#64748B', marginBottom: '1.25rem' }}>
          Test sample customer orders and verify which approval route will be assigned based on current policy thresholds.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div>
            <label className="odoo-form-label">
              Customer Account Tier
            </label>
            <select
              className="odoo-select"
              value={simTier}
              onChange={(e) => setSimTier(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box' }}
            >
              <option value="Gold Tier">Gold Tier (Ceiling: 15%)</option>
              <option value="Silver Tier">Silver Tier (Ceiling: 10%)</option>
              <option value="Bronze Tier">Bronze Tier (Ceiling: 5%)</option>
            </select>
          </div>

          <div>
            <label className="odoo-form-label">
              Product Category
            </label>
            <select
              className="odoo-select"
              value={simCategory}
              onChange={(e) => setSimCategory(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box' }}
            >
              <option value="Enterprise Software">Enterprise Software</option>
              <option value="Hardware & Peripherals">Hardware & Peripherals</option>
              <option value="Consulting Services">Consulting Services</option>
            </select>
          </div>

          <div>
            <label className="odoo-form-label">
              Proposed Discount ({simDiscount}%)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="range"
                min="0"
                max="40"
                step="1"
                value={simDiscount}
                onChange={(e) => setSimDiscount(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#714B67' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <input
                  type="number"
                  className="odoo-input"
                  min="0"
                  max="100"
                  value={simDiscount}
                  onChange={(e) => setSimDiscount(Number(e.target.value))}
                  style={{ width: 64, padding: '0.3rem 0.5rem' }}
                />
                <span style={{ fontSize: '0.8125rem', color: '#64748B' }}>%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Clean Neutral Outcome Card */}
        <div style={{
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: 8,
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>Predicted Route:</span>
              <span className="odoo-badge" style={{ fontSize: '0.8125rem', padding: '0.25rem 0.6rem' }}>
                {simResult.level}
              </span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#475569' }}>
              {simResult.description}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Simulated Rate</span>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1F2937' }}>
              {simDiscount}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

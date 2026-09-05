import { useState } from 'react';
import { useDealFlowStore } from '../../stores/dealflowStore';
import toast from 'react-hot-toast';

export default function DiscountRulesPage() {
  const { discountRules, updateDiscountRules } = useDealFlowStore();

  const [bronzeLimit, setBronzeLimit] = useState(discountRules.customerTierCeilings[0].maxDiscount.toString());
  const [silverLimit, setSilverLimit] = useState(discountRules.customerTierCeilings[1].maxDiscount.toString());
  const [goldLimit, setGoldLimit] = useState(discountRules.customerTierCeilings[2].maxDiscount.toString());

  const handleSave = () => {
    updateDiscountRules({
      ...discountRules,
      customerTierCeilings: [
        { tier: 'Bronze', maxDiscount: Number(bronzeLimit) },
        { tier: 'Silver', maxDiscount: Number(silverLimit) },
        { tier: 'Gold', maxDiscount: Number(goldLimit) },
      ],
    });
    toast.success('Discount tiers & approval chain rules saved!');
  };

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
              <tr>
                <td style={{ fontWeight: 600 }}>Bronze</td>
                <td>
                  <input
                    type="number"
                    className="odoo-input"
                    value={bronzeLimit}
                    onChange={(e) => setBronzeLimit(e.target.value)}
                    style={{ width: 100 }}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Silver</td>
                <td>
                  <input
                    type="number"
                    className="odoo-input"
                    value={silverLimit}
                    onChange={(e) => setSilverLimit(e.target.value)}
                    style={{ width: 100 }}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Gold</td>
                <td>
                  <input
                    type="number"
                    className="odoo-input"
                    value={goldLimit}
                    onChange={(e) => setGoldLimit(e.target.value)}
                    style={{ width: 100 }}
                  />
                </td>
              </tr>
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
                <th>Max Category Discount</th>
              </tr>
            </thead>
            <tbody>
              {discountRules.categoryCeilings.map((cat, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{cat.category}</td>
                  <td style={{ fontWeight: 700 }}>{cat.maxDiscount} percent</td>
                </tr>
              ))}
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
            {discountRules.approvalChain.map((rule, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 600, color: '#475569' }}>{rule.discountRange}</td>
                <td>
                  <span className="odoo-badge">{rule.approvalRequired}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

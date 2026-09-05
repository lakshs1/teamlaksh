import { useState } from 'react';
import toast from 'react-hot-toast';

export default function SubscriptionPlansSetupPage() {
  const [plans, setPlans] = useState([
    { id: 'sp-1', name: 'Monthly Support Plan', frequency: 'Monthly', proration: 'Daily Proration', cancellationFee: '0%' },
    { id: 'sp-2', name: 'Care Plan 2y', frequency: 'Yearly', proration: 'Monthly Proration', cancellationFee: '15% Partial Refund' },
  ]);

  const [planName, setPlanName] = useState('');
  const [frequency, setFrequency] = useState('Monthly');

  const handleAddPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim()) return;
    setPlans([
      ...plans,
      { id: `sp-${Date.now()}`, name: planName, frequency, proration: 'Standard Proration', cancellationFee: '10%' },
    ]);
    setPlanName('');
    toast.success(`Subscription Plan ${planName} configured!`);
  };

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Subscription & Recurring Plan Setup (A5)</h1>
          <p className="text-muted text-sm">Configure recurring billing frequencies, mid-cycle proration rules, and partial refund rules.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="odoo-table-container">
          <table className="odoo-table">
            <thead>
              <tr>
                <th>Plan Name</th>
                <th>Billing Frequency</th>
                <th>Proration Rule</th>
                <th>Cancellation / Credit Rule</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700, color: '#714B67' }}>{p.name}</td>
                  <td>{p.frequency}</td>
                  <td>{p.proration}</td>
                  <td>{p.cancellationFee}</td>
                  <td><span className="odoo-badge">Active</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="odoo-card">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '1rem' }}>
            Configure New Recurring Plan
          </h3>
          <form onSubmit={handleAddPlan} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                Plan Name
              </label>
              <input
                type="text"
                className="odoo-input"
                placeholder="e.g. Platinum Enterprise SaaS"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                Billing Cycle
              </label>
              <select className="odoo-select" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>
            <button type="submit" className="odoo-btn odoo-btn-primary">
              + Save Subscription Plan
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

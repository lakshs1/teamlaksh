import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { fulfillmentApi } from '../../services/apiServices';

export default function WarehouseSetupPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newCostWeight, setNewCostWeight] = useState('1.0');

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const res = await fulfillmentApi.getWarehouses();
      setWarehouses(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load warehouses');
      toast.error('Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleAddWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newCode.trim()) return;
    
    try {
      await fulfillmentApi.createWarehouse({
        name: newName,
        code: newCode,
        shipping_cost_weight: Number(newCostWeight)
      });
      toast.success(`Warehouse ${newName} configured!`);
      setNewName('');
      setNewCode('');
      setNewCostWeight('1.0');
      fetchWarehouses();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to add warehouse');
    }
  };

  if (loading && warehouses.length === 0) return <div className="p-4">Loading settings...</div>;
  if (error && warehouses.length === 0) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Warehouse & Fulfillment Setup (A4)</h1>
          <p className="text-muted text-sm">Configure stock levels, replenishment rules, and shipping cost weighting for auto-split logic.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="odoo-table-container">
          <table className="odoo-table">
            <thead>
              <tr>
                <th>Warehouse Name</th>
                <th>Code</th>
                <th>Location</th>
                <th>Shipping Cost Weight</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 700, color: '#714B67' }}>{w.name}</td>
                  <td style={{ fontWeight: 600 }}>{w.code}</td>
                  <td>{w.location || '-'}</td>
                  <td>{w.shippingCostWeight || w.shipping_cost_weight || 1}x base rate</td>
                  <td><span className="odoo-badge">Active</span></td>
                </tr>
              ))}
              {warehouses.length === 0 && (
                <tr><td colSpan={5}>No warehouses found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add Warehouse Card */}
        <div className="odoo-card">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '1rem' }}>
            Add New Warehouse
          </h3>
          <form onSubmit={handleAddWarehouse} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                Warehouse Name
              </label>
              <input
                type="text"
                className="odoo-input"
                placeholder="e.g. South Logistics Depot"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                Warehouse Code
              </label>
              <input
                type="text"
                className="odoo-input"
                placeholder="WH/SOUTH"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                Shipping Cost Weight
              </label>
              <input
                type="number"
                step="0.01"
                className="odoo-input"
                placeholder="1.0"
                value={newCostWeight}
                onChange={(e) => setNewCostWeight(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="odoo-btn odoo-btn-primary">
              + Save Warehouse
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

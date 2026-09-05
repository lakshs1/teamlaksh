import { useState } from 'react';
import toast from 'react-hot-toast';

export default function WarehouseSetupPage() {
  const [warehouses, setWarehouses] = useState([
    { id: 'wh-1', name: 'Main Warehouse', code: 'WH/MAIN', stockLevel: 450, costWeight: 1.0, replenishmentMin: 100 },
    { id: 'wh-2', name: 'East Depot', code: 'WH/EAST', stockLevel: 180, costWeight: 1.25, replenishmentMin: 50 },
  ]);

  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');

  const handleAddWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newCode.trim()) return;
    setWarehouses([
      ...warehouses,
      { id: `wh-${Date.now()}`, name: newName, code: newCode, stockLevel: 100, costWeight: 1.1, replenishmentMin: 25 },
    ]);
    setNewName('');
    setNewCode('');
    toast.success(`Warehouse ${newName} configured!`);
  };

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
                <th>Stock Units</th>
                <th>Shipping Cost Weight</th>
                <th>Replenishment Min</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 700, color: '#714B67' }}>{w.name}</td>
                  <td style={{ fontWeight: 600 }}>{w.code}</td>
                  <td>{w.stockLevel} units</td>
                  <td>{w.costWeight}x base rate</td>
                  <td>{w.replenishmentMin} units</td>
                  <td><span className="odoo-badge">Active</span></td>
                </tr>
              ))}
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
            <button type="submit" className="odoo-btn odoo-btn-primary">
              + Save Warehouse
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

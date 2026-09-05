import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const [period, setPeriod] = useState('This Month');
  const [rep, setRep] = useState('All Reps');
  const [status, setStatus] = useState('All Statuses');
  const [category, setCategory] = useState('All Categories');

  const handleExportPdf = () => {
    toast.success('Exporting Sales Performance Report as PDF...');
  };

  const handleExportXls = () => {
    toast.success('Exporting Sales Performance Data as XLS spreadsheet...');
  };

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Reporting & Performance Analytics (A7)</h1>
          <p className="text-muted text-sm">Analyze quotation velocity, approval bottlenecks, best-selling products, and discount patterns.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="odoo-btn odoo-btn-secondary" onClick={handleExportPdf}>
            Export PDF
          </button>
          <button className="odoo-btn odoo-btn-primary" onClick={handleExportXls}>
            Export XLS
          </button>
        </div>
      </div>

      {/* Reporting Filters Bar (A7 Purpose Filters) */}
      <div className="odoo-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.85rem' }}>
          Reporting Filters
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748B', marginBottom: '0.3rem' }}>
              Period / Date Range
            </label>
            <select className="odoo-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option>Today</option>
              <option>This Week</option>
              <option>This Month</option>
              <option>Custom Range</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748B', marginBottom: '0.3rem' }}>
              Sales Team / Rep
            </label>
            <select className="odoo-select" value={rep} onChange={(e) => setRep(e.target.value)}>
              <option>All Reps</option>
              <option>Maviya (Enterprise North)</option>
              <option>Rahul Mehta (Key Accounts)</option>
              <option>Priya Singh (Retail South)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748B', marginBottom: '0.3rem' }}>
              Approval Status
            </label>
            <select className="odoo-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>All Statuses</option>
              <option>Pending Approval</option>
              <option>Approved</option>
              <option>Rejected</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748B', marginBottom: '0.3rem' }}>
              Product Category
            </label>
            <select className="odoo-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option>All Categories</option>
              <option>Hardware</option>
              <option>Accessories</option>
              <option>Services</option>
              <option>Subscriptions</option>
            </select>
          </div>
        </div>
      </div>

      {/* Performance Summary Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="odoo-card">
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>Total Quoted Volume</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1F2937' }}>₹12,45,000</div>
        </div>
        <div className="odoo-card">
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>Avg Discount Given</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#714B67' }}>11.4%</div>
        </div>
        <div className="odoo-card">
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>Approval Turnaround</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#334155' }}>3.2 Hours</div>
        </div>
        <div className="odoo-card">
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>Win / Conversion Rate</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1F2937' }}>68%</div>
        </div>
      </div>

      {/* Analytics Breakdown Table */}
      <div className="odoo-table-container">
        <table className="odoo-table">
          <thead>
            <tr>
              <th>Sales Rep</th>
              <th>Quotations Created</th>
              <th>Approved Deals</th>
              <th>Avg Blended Discount</th>
              <th>Total Revenue</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 700, color: '#714B67' }}>Maviya</td>
              <td>12</td>
              <td>9</td>
              <td>10.2%</td>
              <td style={{ fontWeight: 700 }}>₹8,26,000</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700, color: '#714B67' }}>Rahul Mehta</td>
              <td>8</td>
              <td>6</td>
              <td>14.1%</td>
              <td style={{ fontWeight: 700 }}>₹6,50,000</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700, color: '#714B67' }}>Priya Singh</td>
              <td>15</td>
              <td>11</td>
              <td>8.5%</td>
              <td style={{ fontWeight: 700 }}>₹4,20,000</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

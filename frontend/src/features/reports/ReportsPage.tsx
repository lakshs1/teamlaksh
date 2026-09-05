import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { analyticsApi, authApi, catalogApi } from '../../services/apiServices';

export default function ReportsPage() {
  // Filter States (Period / Sales Team / Approval Status / Product & Category)
  const [period, setPeriod] = useState<string>('all');
  const [selectedRepId, setSelectedRepId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedProductId, setSelectedProductId] = useState<string>('all');

  // Metadata dropdown options
  const [reps, setReps] = useState<Array<{ id: number; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: number; name: string }>>([]);

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  // Load dropdown filter options on mount
  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const [usersRes, catsRes, prodsRes] = await Promise.allSettled([
          authApi.getUsers(),
          catalogApi.getCategories(),
          catalogApi.getProducts(),
        ]);

        if (usersRes.status === 'fulfilled' && usersRes.value?.data) {
          const rawUsers = Array.isArray(usersRes.value.data) ? usersRes.value.data : usersRes.value.data.items || [];
          setReps(rawUsers.filter((u: any) => u.role === 'rep' || u.role === 'manager' || u.role === 'admin'));
        }

        if (catsRes.status === 'fulfilled' && catsRes.value?.data) {
          const rawCats = Array.isArray(catsRes.value.data) ? catsRes.value.data : catsRes.value.data.items || [];
          setCategories(rawCats);
        }

        if (prodsRes.status === 'fulfilled' && prodsRes.value?.data) {
          const rawProds = Array.isArray(prodsRes.value.data) ? prodsRes.value.data : prodsRes.value.data.items || [];
          setProducts(rawProds);
        }
      } catch (err) {
        console.warn('Failed to load filter metadata:', err);
      }
    }
    loadFilterOptions();
  }, []);

  // Fetch report data whenever filters change
  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (period !== 'all') params.period = period;
      if (selectedRepId !== 'all') params.rep_id = Number(selectedRepId);
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (selectedCategoryId !== 'all') params.category_id = Number(selectedCategoryId);
      if (selectedProductId !== 'all') params.product_id = Number(selectedProductId);

      const res = await analyticsApi.getSalesReport(params);
      setReportData(res.data || {});
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  }, [period, selectedRepId, selectedStatus, selectedCategoryId, selectedProductId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportPdf = () => {
    toast.success('Opening print preview for PDF export...');
    window.print();
  };

  const handleExportXls = () => {
    try {
      const byRepRows = reportData?.by_rep || [];
      const headers = ['Sales Rep', 'Quotations Created', 'Total Revenue'];
      const rows = byRepRows.map((r: any) => [
        `"${r.rep_name || 'Sales Rep'}"`,
        r.quotes || 0,
        `"${r.revenue || 0}"`,
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e: (string | number)[]) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `DealFlow360_Report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Report exported as CSV/XLS!');
    } catch {
      toast.error('Failed to export XLS');
    }
  };

  // KPIs
  const totalRevenue = reportData?.total_revenue || 0;
  const totalQuotes = reportData?.total_quotes || 0;
  const avgDiscount = reportData?.avg_discount_pct || 0;
  const avgMargin = reportData?.avg_margin_pct || 0;

  const byRep = reportData?.by_rep || [];
  const byCategory = reportData?.by_category || [];

  return (
    <div className="odoo-container">
      {/* Print Stylesheet */}
      <style>{`
        @media print {
          .no-print, .odoo-navbar, .odoo-brand-header, button {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .odoo-container {
            width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Reporting & Sales Performance (A7)</h1>
          <p className="text-muted text-sm">
            Review sales velocity, discount ceilings, and team metrics filtered by Period, Sales Team, Approval Status, and Product.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }} className="no-print">
          <button className="odoo-btn odoo-btn-secondary" onClick={handleExportPdf}>
            📄 Export PDF
          </button>
          <button className="odoo-btn odoo-btn-primary" onClick={handleExportXls}>
            📊 Export XLS
          </button>
        </div>
      </div>

      {/* Reporting Filters Bar (A7 Required Filters) */}
      <div className="odoo-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#1F2937', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🎯 Reporting Filters
          </h3>
          <button
            className="odoo-btn odoo-btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
            onClick={() => {
              setPeriod('all');
              setSelectedRepId('all');
              setSelectedStatus('all');
              setSelectedCategoryId('all');
              setSelectedProductId('all');
            }}
          >
            Reset Filters
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          {/* 1. Period */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
              1. Period / Date Range
            </label>
            <select className="odoo-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="weekly">This Week (Last 7 Days)</option>
              <option value="monthly">This Month (Last 30 Days)</option>
              <option value="quarterly">This Quarter (Last 90 Days)</option>
              <option value="yearly">This Year (Last 365 Days)</option>
            </select>
          </div>

          {/* 2. Sales Team / Rep */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
              2. Sales Team / Rep
            </label>
            <select className="odoo-select" value={selectedRepId} onChange={(e) => setSelectedRepId(e.target.value)}>
              <option value="all">All Sales Reps</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Approval Status */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
              3. Approval Status
            </label>
            <select className="odoo-select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="pending">Pending Approval (L1 / L2)</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="draft">Draft</option>
              <option value="fulfillment">In Fulfillment</option>
            </select>
          </div>

          {/* 4. Product Category */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
              4. Product Category
            </label>
            <select className="odoo-select" value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}>
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Specific Product */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
              5. Specific Product
            </label>
            <select className="odoo-select" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
              <option value="all">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="odoo-card">
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
            Total Quoted Revenue
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1F2937', marginTop: '0.35rem' }}>
            ₹{totalRevenue.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16A34A', marginTop: '0.2rem' }}>
            Across matched quotations
          </div>
        </div>

        <div className="odoo-card">
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
            Quotations Count
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#714B67', marginTop: '0.35rem' }}>
            {totalQuotes}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
            Matching active filters
          </div>
        </div>

        <div className="odoo-card">
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
            Avg Blended Discount
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#D97706', marginTop: '0.35rem' }}>
            {avgDiscount}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
            Across all order lines
          </div>
        </div>

        <div className="odoo-card">
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
            Average Gross Margin
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563EB', marginTop: '0.35rem' }}>
            {avgMargin}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
            Margin health indicator
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
          Updating sales report...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
          {/* Breakdown by Sales Rep */}
          <div className="odoo-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8F9FA' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#1F2937', margin: 0 }}>
                👤 Sales Rep Performance Breakdown
              </h3>
            </div>
            <div className="odoo-table-container" style={{ margin: 0 }}>
              <table className="odoo-table">
                <thead>
                  <tr>
                    <th>Sales Rep</th>
                    <th style={{ textAlign: 'center' }}>Quotations</th>
                    <th style={{ textAlign: 'right' }}>Total Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {byRep.map((row: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700, color: '#714B67' }}>{row.rep_name}</td>
                      <td style={{ textAlign: 'center' }}>{row.quotes}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        ₹{Number(row.revenue).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                  {byRep.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                        No quotation records match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Breakdown by Product Category */}
          <div className="odoo-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8F9FA' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#1F2937', margin: 0 }}>
                📦 Product Category Volume Breakdown
              </h3>
            </div>
            <div className="odoo-table-container" style={{ margin: 0 }}>
              <table className="odoo-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Volume Contributed</th>
                  </tr>
                </thead>
                <tbody>
                  {byCategory.map((cat: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700, color: '#1E293B' }}>{cat.category_name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        ₹{Number(cat.revenue).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                  {byCategory.length === 0 && (
                    <tr>
                      <td colSpan={2} style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                        No product lines match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

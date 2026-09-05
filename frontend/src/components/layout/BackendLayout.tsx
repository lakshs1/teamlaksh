import { Link, useLocation, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

export default function BackendLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSignOut = () => {
    logout();
    toast.success('Signed out successfully');
    navigate('/', { replace: true });
  };

  const backendNavItems = [
    { label: 'Products & Price Lists (A2)', path: '/backend/products' },
    { label: 'Discount & Approval Rules (A3)', path: '/backend/discount-rules' },
    { label: 'Warehouse Setup (A4)', path: '/backend/warehouses' },
    { label: 'Subscription Plans (A5)', path: '/backend/subscription-plans' },
    { label: 'Upsell Rules (A6)', path: '/backend/upsell-rules' },
    { label: 'Reports & Analytics (A7)', path: '/backend/reports' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#F8F9FA' }}>
      <header className="odoo-top-nav">
        <div className="odoo-brand-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link to="/backend" className="odoo-brand-logo">
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#714B67', letterSpacing: '-0.5px' }}>odoo</span>
              <span style={{ fontWeight: 600, color: '#334155', fontSize: '1rem' }}>Sales Backend Config</span>
            </Link>
            <span className="odoo-badge" style={{ backgroundColor: '#714B67', color: '#FFF' }}>
              Admin Area (A1-A7)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link to="/dashboard" className="odoo-btn odoo-btn-secondary" style={{ fontSize: '0.8125rem', padding: '0.35rem 0.85rem' }}>
              ← Return to Sales Workspace
            </Link>
            <button
              onClick={handleSignOut}
              className="odoo-btn odoo-btn-danger"
              style={{ fontSize: '0.8125rem', padding: '0.35rem 0.85rem' }}
            >
              Sign Out
            </button>
          </div>
        </div>

        <nav className="odoo-menu-bar">
          {backendNavItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`odoo-menu-item ${isActive ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}

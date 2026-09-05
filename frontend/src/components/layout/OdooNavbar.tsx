import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDealFlowStore, type UserRole } from '../../stores/dealflowStore';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

export default function OdooNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentRole, setRole } = useDealFlowStore();
  const { user, logout } = useAuthStore();

  const [showActions, setShowActions] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Internal workspace menu links
  const allNavItems = [
    { label: 'Dashboard', path: '/dashboard', roles: ['Sales Rep', 'Sales Manager', 'Finance', 'Operations', 'Admin'] },
    { label: 'Quotations', path: '/quotations', roles: ['Sales Rep', 'Sales Manager', 'Admin'] },
    { label: 'Pipeline', path: '/quotations/pipeline', roles: ['Sales Rep', 'Sales Manager', 'Admin'] },
    { label: 'Approvals', path: '/approvals', roles: ['Sales Manager', 'Finance', 'Admin'] },
    { label: 'Fulfillment', path: '/fulfillment', roles: ['Sales Rep', 'Operations', 'Admin'] },
    { label: 'Subscriptions', path: '/subscriptions', roles: ['Sales Rep', 'Finance', 'Operations', 'Admin'] },
    { label: 'Invoices', path: '/invoices', roles: ['Finance', 'Admin'] },
    { label: 'Deal Health', path: '/deal-health', roles: ['Sales Manager', 'Admin'] },
  ];

  const navItems = allNavItems.filter((item) => item.roles.includes(currentRole));

  const handleReloadData = () => {
    toast.success('Workspace data, stock levels, and approval status refreshed!');
    setShowActions(false);
  };

  const handleGoToBackend = () => {
    navigate('/backend');
    setShowActions(false);
  };

  const handleCloseWorkspace = () => {
    logout();
    toast('Working session closed.');
    navigate('/');
    setShowActions(false);
  };

  const handleSignOut = () => {
    logout();
    toast.success('Signed out successfully');
    navigate('/');
  };

  // Get active display name and avatar initial
  const displayName = user?.name || 'Admin User';
  const displayEmail = user?.email || 'admin@dealflow.com';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="odoo-top-nav">
      <div className="odoo-brand-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/dashboard" className="odoo-brand-logo">
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#714B67', letterSpacing: '-0.5px' }}>odoo</span>
            <span style={{ fontWeight: 600, color: '#334155', fontSize: '1rem' }}>DealFlow360</span>
          </Link>
          <span className="odoo-brand-badge">Rep Workspace</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Actions Options Dropdown Button */}
          <div style={{ position: 'relative' }}>
            <button
              className="odoo-btn odoo-btn-secondary"
              onClick={() => {
                setShowActions(!showActions);
                setShowUserMenu(false);
              }}
              style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}
            >
              Actions Options ▾
            </button>

            {showActions && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.4rem',
                  width: 200,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 200,
                  padding: '0.4rem 0',
                }}
              >
                <button
                  onClick={handleReloadData}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 1rem',
                    fontSize: '0.8125rem',
                    color: '#334155',
                    background: 'none',
                    border: 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(113, 75, 103, 0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Reload Data
                </button>
                <button
                  onClick={handleGoToBackend}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 1rem',
                    fontSize: '0.8125rem',
                    color: '#714B67',
                    fontWeight: 600,
                    background: 'none',
                    border: 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(113, 75, 103, 0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Go to Back-end Configuration
                </button>
                <button
                  onClick={handleCloseWorkspace}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 1rem',
                    fontSize: '0.8125rem',
                    color: '#475569',
                    background: 'none',
                    border: 'none',
                    borderTop: '1px solid #F1F5F9',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(113, 75, 103, 0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Close Session
                </button>
              </div>
            )}
          </div>

          {/* Role Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#F1F5F9', padding: '0.2rem 0.6rem', borderRadius: 20, border: '1px solid #CBD5E1' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>Role:</span>
            <select
              value={currentRole}
              onChange={(e) => setRole(e.target.value as UserRole)}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: '#714B67',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="Sales Rep">Sales Rep</option>
              <option value="Sales Manager">Sales Manager</option>
              <option value="Finance">Finance</option>
              <option value="Operations">Operations</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          {/* Interactive Account Button & Expandable Sign Out Menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowActions(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.25rem 0.6rem',
                borderRadius: 20,
                border: '1px solid #E2E8F0',
                backgroundColor: showUserMenu ? 'rgba(113, 75, 103, 0.08)' : '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: '#714B67',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                }}
              >
                {initial}
              </div>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                {displayName} ▾
              </span>
            </button>

            {/* Expandable Account Dropdown */}
            {showUserMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.4rem',
                  width: 240,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  zIndex: 200,
                  padding: '1rem',
                }}
              >
                <div style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #E2E8F0' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1F2937' }}>{displayName}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{displayEmail}</div>
                  <div style={{ marginTop: '0.4rem' }}>
                    <span className="odoo-badge">{currentRole}</span>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="odoo-btn odoo-btn-danger"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '0.45rem',
                    fontSize: '0.8125rem',
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      <nav className="odoo-menu-bar">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
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
  );
}

import { useNavigate, Link } from 'react-router-dom';
import { useDealFlowStore, type UserRole } from '../../stores/dealflowStore';

export default function LandingPage() {
  const navigate = useNavigate();
  const { setRole } = useDealFlowStore();

  const handleRoleExplore = (role: UserRole) => {
    setRole(role);
    navigate('/dashboard');
  };

  return (
    <div style={{ backgroundColor: '#F8F9FA', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: '#1F2937' }}>
      {/* Top Navbar */}
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: '0.85rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#714B67', letterSpacing: '-0.5px' }}>odoo</span>
          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#334155' }}>DealFlow360</span>
          <span className="odoo-badge">Hackathon 2025</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/auth/login" className="odoo-btn odoo-btn-secondary">
            Log In
          </Link>
          <Link to="/auth/register" className="odoo-btn odoo-btn-primary">
            Sign Up
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ padding: '4rem 2rem 3rem 2rem', textAlign: 'center', background: 'linear-gradient(180deg, #FFFFFF 0%, #F8F9FA 100%)', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: 850, margin: '0 auto' }}>
          <span className="odoo-badge" style={{ marginBottom: '1rem', padding: '0.35rem 0.85rem' }}>
            Intelligent Self-Governing Deal Engine
          </span>
          <h1 style={{ fontSize: '2.75rem', fontWeight: 800, color: '#1F2937', lineHeight: 1.2, margin: '1rem 0' }}>
            From Quote to Cash. <span style={{ color: '#714B67' }}>Unified, Enforced, Automated.</span>
          </h1>
          <p style={{ fontSize: '1.1rem', color: '#64748B', lineHeight: 1.6, marginBottom: '2rem' }}>
            DealFlow360 enforces pricing discipline, reacts to inventory reality in real-time, reconciles recurring billing with one-time hardware sales, and gives customers a living, negotiable portal.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="odoo-btn odoo-btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }} onClick={() => navigate('/dashboard')}>
              Launch Sales Workspace
            </button>
            <Link to="/portal/quotation/q-1" className="odoo-btn odoo-btn-secondary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}>
              View Customer Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Role-Based Experience Cards Section */}
      <section className="odoo-container" style={{ padding: '3rem 1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1F2937' }}>
            Tailored Experiences by User Role
          </h2>
          <p style={{ fontSize: '0.9375rem', color: '#64748B', marginTop: '0.4rem' }}>
            Explore how DealFlow360 empowers each stakeholder in your B2B sales cycle.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Role Card 1: Sales Rep */}
          <div className="odoo-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#714B67', marginBottom: '0.5rem' }}>
                Sales Rep
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.5, marginBottom: '1rem' }}>
                Builds quotations, applies discounts, receives real-time AI upsell recommendations, and tracks deal approval status.
              </p>
              <ul style={{ fontSize: '0.8125rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>
                <li>• Live margin indicator bar</li>
                <li>• Automatic approval routing</li>
                <li>• Instant cross-sell suggestions</li>
              </ul>
            </div>
            <button className="odoo-btn odoo-btn-primary" style={{ width: '100%' }} onClick={() => handleRoleExplore('Sales Rep')}>
              Enter as Sales Rep
            </button>
          </div>

          {/* Role Card 2: Sales Manager */}
          <div className="odoo-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#714B67', marginBottom: '0.5rem' }}>
                Sales Manager
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.5, marginBottom: '1rem' }}>
                Reviews discount threshold exceptions, inspects blended risk scores, monitors stalled deals, and configures approval chains.
              </p>
              <ul style={{ fontSize: '0.8125rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>
                <li>• Blended risk calculation engine</li>
                <li>• Deal Health & Anomaly alerts</li>
                <li>• Discount tier configuration</li>
              </ul>
            </div>
            <button className="odoo-btn odoo-btn-primary" style={{ width: '100%' }} onClick={() => handleRoleExplore('Sales Manager')}>
              Enter as Sales Manager
            </button>
          </div>

          {/* Role Card 3: Finance & Operations */}
          <div className="odoo-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#714B67', marginBottom: '0.5rem' }}>
                Finance & Operations
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.5, marginBottom: '1rem' }}>
                Handles multi-warehouse stock fulfillment splitting, registers payments, reconciles hybrid recurring subscriptions, and issues credit notes.
              </p>
              <ul style={{ fontSize: '0.8125rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>
                <li>• Stock allocation & backorders</li>
                <li>• Hybrid billing & proration</li>
                <li>• Level 2 financial risk approvals</li>
              </ul>
            </div>
            <button className="odoo-btn odoo-btn-primary" style={{ width: '100%' }} onClick={() => handleRoleExplore('Finance')}>
              Enter as Finance / Ops
            </button>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section style={{ backgroundColor: '#FFFFFF', padding: '3rem 1.5rem', borderTop: '1px solid #E2E8F0' }}>
        <div className="odoo-container">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Core Problem Statement Capabilities</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
            <div style={{ border: '1px solid #E2E8F0', padding: '1.25rem', borderRadius: 8 }}>
              <div style={{ fontWeight: 700, color: '#714B67', marginBottom: '0.4rem' }}>1. Blended Discount Risk Score</div>
              <p style={{ fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.5 }}>
                Evaluates category-specific discount ceilings and blended order patterns so small margin leaks across lines never slip through unnoticed.
              </p>
            </div>
            <div style={{ border: '1px solid #E2E8F0', padding: '1.25rem', borderRadius: 8 }}>
              <div style={{ fontWeight: 700, color: '#714B67', marginBottom: '0.4rem' }}>2. Live Upsell & Cross-Sell</div>
              <p style={{ fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.5 }}>
                Ranks suggestions based on co-purchase history and margin delta, updating live gross margin indicators instantly upon line addition.
              </p>
            </div>
            <div style={{ border: '1px solid #E2E8F0', padding: '1.25rem', borderRadius: 8 }}>
              <div style={{ fontWeight: 700, color: '#714B67', marginBottom: '0.4rem' }}>3. Multi-Warehouse Stock Splitting</div>
              <p style={{ fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.5 }}>
                Automatically splits orders across warehouses to minimize shipment count and cost while handling backorders gracefully.
              </p>
            </div>
            <div style={{ border: '1px solid #E2E8F0', padding: '1.25rem', borderRadius: 8 }}>
              <div style={{ fontWeight: 700, color: '#714B67', marginBottom: '0.4rem' }}>4. Customer Portal Negotiation</div>
              <p style={{ fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.5 }}>
                Restricted client interface for counter-offers and line-item chat, automatically re-triggering approval workflows when terms change.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

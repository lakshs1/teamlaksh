import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDealFlowStore } from '../../stores/dealflowStore';
import toast from 'react-hot-toast';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products } = useDealFlowStore();

  const prod = products.find((p) => p.id === id) || products[0];

  const [name, setName] = useState(prod.name);
  const [sku, setSku] = useState(prod.sku);
  const [salesPrice, setSalesPrice] = useState(prod.salesPrice.toString());
  const [costPrice, setCostPrice] = useState(prod.costPrice.toString());
  const [activeTab, setActiveTab] = useState<'general' | 'variants' | 'sales'>('general');

  const handleSave = () => {
    toast.success(`Product ${name} updated successfully!`);
    navigate('/products');
  };

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>Products</div>
          <h1 className="odoo-page-title" style={{ color: '#714B67' }}>
            {name}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="odoo-btn odoo-btn-primary" onClick={handleSave}>
            Save
          </button>
          <button className="odoo-btn odoo-btn-secondary" onClick={() => navigate('/products')}>
            Discard
          </button>
        </div>
      </div>

      <div className="odoo-card">
        {/* Form fields grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                Product Name
              </label>
              <input
                type="text"
                className="odoo-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                Internal Reference / SKU
              </label>
              <input
                type="text"
                className="odoo-input"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                Sales Price (₹)
              </label>
              <input
                type="number"
                className="odoo-input"
                value={salesPrice}
                onChange={(e) => setSalesPrice(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                Cost Price (₹)
              </label>
              <input
                type="number"
                className="odoo-input"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
              />
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 600 }}>
                <input type="checkbox" defaultChecked /> Can be Sold
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 600 }}>
                <input type="checkbox" defaultChecked /> Can be Purchased
              </label>
            </div>
          </div>

          <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '1rem', background: '#F8F9FA', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 80, height: 80, background: '#E2E8F0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#714B67', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
              PRO
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Product Thumbnail</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #E2E8F0', marginBottom: '1rem' }}>
          <button
            onClick={() => setActiveTab('general')}
            style={{
              padding: '0.5rem 1rem',
              fontWeight: 600,
              color: activeTab === 'general' ? '#714B67' : '#64748B',
              borderBottom: activeTab === 'general' ? '2px solid #714B67' : 'none',
              marginBottom: -2,
            }}
          >
            General Information
          </button>
          <button
            onClick={() => setActiveTab('variants')}
            style={{
              padding: '0.5rem 1rem',
              fontWeight: 600,
              color: activeTab === 'variants' ? '#714B67' : '#64748B',
              borderBottom: activeTab === 'variants' ? '2px solid #714B67' : 'none',
              marginBottom: -2,
            }}
          >
            Attributes & Variants
          </button>
        </div>

        {activeTab === 'general' ? (
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
              Description
            </label>
            <textarea
              className="odoo-input"
              rows={4}
              defaultValue={prod.description}
            />
          </div>
        ) : (
          <div style={{ padding: '1rem', fontSize: '0.8125rem', color: '#64748B' }}>
            Variant attributes: Size (Pack), Color (Space Gray, Silver), Extra prices configured per variant.
          </div>
        )}
      </div>
    </div>
  );
}

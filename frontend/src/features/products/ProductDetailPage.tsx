import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { catalogApi } from '../../services/apiServices';
import { mapProduct } from '../../services/dataMappers';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [salesPrice, setSalesPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [description, setDescription] = useState('');
  const [activeTab, setActiveTab] = useState<'general' | 'variants' | 'sales'>('general');

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        if (!id) return;
        const res = await catalogApi.getProductById(id);
        const mappedProd = mapProduct(res.data);
        setName(mappedProd.name);
        setSku(mappedProd.sku);
        setSalesPrice(mappedProd.salesPrice.toString());
        setCostPrice(mappedProd.costPrice.toString());
        setDescription(mappedProd.description);
      } catch (err: any) {
        const msg = err?.response?.data?.message || err.message || 'Failed to load product details';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const handleSave = async () => {
    try {
      if (!id) return;
      await catalogApi.updateProduct(id, {
        name,
        sku,
        base_price: Number(salesPrice),
        cost_price: Number(costPrice),
        description,
      });
      toast.success(`Product ${name} updated successfully!`);
      navigate('/products');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to update product');
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading product details...</div>;
  if (error) return <div style={{ padding: '2rem', color: 'red' }}>{error}</div>;

  return (
    <div className="odoo-container">
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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

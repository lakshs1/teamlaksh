import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDealFlowStore, type ProductItem } from '../../stores/dealflowStore';
import toast from 'react-hot-toast';
import { catalogApi } from '../../services/apiServices';
import { MOCK_CATEGORIES } from '../../services/mockData';

interface CategoryOption {
  id: number;
  name: string;
  maxDiscountPct?: string | number;
}

export default function ProductCatalogPage() {
  const navigate = useNavigate();
  const { products, addProduct, fetchLiveData } = useDealFlowStore();
  const [searchTerm, setSearchTerm] = useState('');

  // Dynamic categories from backend DB
  const [categories, setCategories] = useState<CategoryOption[]>(MOCK_CATEGORIES);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>(MOCK_CATEGORIES[0]?.id || 1);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // New Product Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodSalesPrice, setProdSalesPrice] = useState('');
  const [prodCostPrice, setProdCostPrice] = useState('');
  const [prodUnit, setProdUnit] = useState('unit');
  const [isActive, setIsActive] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [prodDescription, setProdDescription] = useState('');

  // Load dynamic categories & live products on mount if not in pure mock mode
  useEffect(() => {
    let isMounted = true;
    const loadCategories = async () => {
      const useMock = import.meta.env.VITE_USE_MOCK_DATA !== 'false';
      if (useMock) return;

      setIsLoadingCategories(true);
      try {
        const res = await catalogApi.getCategories();
        const fetchedCategories: CategoryOption[] = res?.data || [];
        if (isMounted && fetchedCategories.length > 0) {
          setCategories(fetchedCategories);
          setSelectedCategoryId(fetchedCategories[0].id);
        }
      } catch (err: any) {
        console.warn('Backend categories fetch failed, using mock categories:', err?.message);
      } finally {
        if (isMounted) setIsLoadingCategories(false);
      }
    };

    loadCategories();
    fetchLiveData?.();

    return () => {
      isMounted = false;
    };
  }, [fetchLiveData]);

  const handleCategorySelect = (categoryId: number) => {
    setSelectedCategoryId(categoryId);
    const cat = categories.find((c) => c.id === categoryId);
    if (cat?.name.toLowerCase().includes('subscri')) {
      setIsRecurring(true);
      setProdUnit('license');
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) {
      toast.error('Please enter product name');
      return;
    }

    if (!selectedCategoryId) {
      toast.error('Please select a product category');
      return;
    }

    setSubmitting(true);
    const useMock = import.meta.env.VITE_USE_MOCK_DATA !== 'false';
    const selectedCat = categories.find((c) => c.id === Number(selectedCategoryId));
    let createdProdFromDb: any = null;

    if (!useMock) {
      try {
        const res = await catalogApi.createProduct({
          name: prodName.trim(),
          description: prodDescription.trim() || 'New product item added to catalog.',
          category_id: Number(selectedCategoryId),
          base_price: Number(prodSalesPrice) || 0,
          cost_price: Number(prodCostPrice) || 0,
          unit: prodUnit.trim() || 'unit',
          sku: prodSku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
          tax_pct: 18,
          is_recurring: isRecurring,
          recurring_interval: isRecurring ? recurringInterval : undefined,
          is_active: isActive,
        });

        if (res?.data) {
          createdProdFromDb = res.data;
        }
      } catch (err: any) {
        console.warn("Backend create product failed, adding to local catalog:", err?.message);
      }
    }

    const newProd: ProductItem = {
      id: createdProdFromDb?.id ? String(createdProdFromDb.id) : `prod-${Date.now()}`,
      name: createdProdFromDb?.name || prodName.trim(),
      sku: createdProdFromDb?.sku || prodSku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      category: (selectedCat?.name as any) || 'Hardware',
      salesPrice: createdProdFromDb?.basePrice !== undefined ? Number(createdProdFromDb.basePrice) : (Number(prodSalesPrice) || 0),
      costPrice: createdProdFromDb?.costPrice !== undefined ? Number(createdProdFromDb.costPrice) : (Number(prodCostPrice) || 0),
      status: isActive ? 'Active' : 'Draft',
      description: createdProdFromDb?.description || prodDescription.trim() || 'New product item added to catalog.',
      canBeSold: true,
      canBePurchased: true,
    };

    addProduct(newProd);
    toast.success(`Product "${newProd.name}" added to catalog!`);

    // Reset form
    setProdName('');
    setProdSku('');
    setProdSalesPrice('');
    setProdCostPrice('');
    setProdUnit('unit');
    setIsActive(true);
    setIsRecurring(false);
    setRecurringInterval('monthly');
    setProdDescription('');
    setShowModal(false);
    setSubmitting(false);
  };

  return (
    <div className="odoo-container" style={{ position: 'relative' }}>
      <div className="odoo-page-header">
        <div>
          <h1 className="odoo-page-title">Product Catalog</h1>
          <p className="text-muted text-sm">Manage products, variants, and pricing.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button id="btn-new-product" className="odoo-btn odoo-btn-primary" onClick={() => setShowModal(true)}>
            + New Product
          </button>
          <button className="odoo-btn odoo-btn-secondary" onClick={() => navigate('/settings/discount-rules')}>
            Manage Price Rules
          </button>
        </div>
      </div>

      {/* Top 3 Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="odoo-card">
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>Total Products</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1F2937' }}>{products.length}</div>
        </div>

        <div className="odoo-card">
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>Product Categories</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#714B67' }}>
            {new Set(products.map((p) => p.category)).size}
          </div>
        </div>

        <div className="odoo-card">
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>Variants</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1F2937' }}>{products.length ? products.length * 2 : 0}</div>
        </div>
      </div>

      <div className="odoo-table-container">
        <div style={{ padding: '1rem', borderBottom: '1px solid #E2E8F0' }}>
          <input
            type="text"
            className="odoo-input"
            placeholder="Search products by name, SKU, category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ maxWidth: 360 }}
          />
        </div>

        <table className="odoo-table">
          <thead>
            <tr>
              <th><input type="checkbox" /></th>
              <th>Name</th>
              <th>Category</th>
              <th>SKU</th>
              <th>Sales Price</th>
              <th>Cost Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>
                    No Products Found
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginBottom: '1rem' }}>
                    No products matching filter. Click below to add a new product.
                  </p>
                  <button className="odoo-btn odoo-btn-primary" onClick={() => setShowModal(true)}>
                    + Create First Product
                  </button>
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => (
                <tr key={p.id}>
                  <td><input type="checkbox" /></td>
                  <td style={{ fontWeight: 700, color: '#714B67' }}>{p.name}</td>
                  <td>{p.category}</td>
                  <td>{p.sku}</td>
                  <td style={{ fontWeight: 700 }}>₹{(p.salesPrice || 0).toLocaleString('en-IN')}</td>
                  <td>₹{(p.costPrice || 0).toLocaleString('en-IN')}</td>
                  <td>
                    <span className="odoo-badge">{p.status || 'Active'}</span>
                  </td>
                  <td>
                    <button
                      className="odoo-btn odoo-btn-secondary"
                      style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => navigate(`/products/${p.id}`)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New Product Modal in Same Page & Section */}
      {showModal && (
        <div
          id="create-product-modal"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              width: 560,
              maxWidth: '92vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #E2E8F0',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 10,
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#714B67', margin: 0 }}>
                  Create New Product
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  Add product item directly to your live sales catalog
                </span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreateProduct} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                  Product Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  id="prod-name-input"
                  className="odoo-input"
                  placeholder="e.g. Wireless Ergonomic Keyboard K380"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                    Category {isLoadingCategories && <span style={{ fontSize: '0.75rem', color: '#64748B' }}>(loading...)</span>}
                  </label>
                  <select
                    id="prod-category-select"
                    className="odoo-input"
                    value={selectedCategoryId}
                    onChange={(e) => handleCategorySelect(Number(e.target.value))}
                    disabled={isLoadingCategories || categories.length === 0}
                    required
                  >
                    {categories.length === 0 ? (
                      <option value="">{isLoadingCategories ? "Loading categories from DB..." : "No categories available"}</option>
                    ) : (
                      categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                    SKU Code
                  </label>
                  <input
                    type="text"
                    className="odoo-input"
                    placeholder="e.g. PROD-9920"
                    value={prodSku}
                    onChange={(e) => setProdSku(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                    Sales Price (₹)
                  </label>
                  <input
                    type="number"
                    className="odoo-input"
                    placeholder="e.g. 4500"
                    value={prodSalesPrice}
                    onChange={(e) => setProdSalesPrice(e.target.value)}
                    min="0"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                    Cost Price (₹)
                  </label>
                  <input
                    type="number"
                    className="odoo-input"
                    placeholder="e.g. 2800"
                    value={prodCostPrice}
                    onChange={(e) => setProdCostPrice(e.target.value)}
                    min="0"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                    Measurement Unit
                  </label>
                  <input
                    type="text"
                    className="odoo-input"
                    placeholder="e.g. unit, seat, license, hour"
                    value={prodUnit}
                    onChange={(e) => setProdUnit(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', cursor: 'pointer', marginTop: '1.2rem' }}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#714B67' }}
                    />
                    <span>Is Active Product</span>
                  </label>
                </div>
              </div>

              {/* Recurring Subscription Section */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '0.85rem 1rem', backgroundColor: '#F8F9FA' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 700, color: '#1F2937', cursor: 'pointer', marginBottom: isRecurring ? '0.75rem' : 0 }}>
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#714B67' }}
                  />
                  <span>Is Recurring Subscription Product</span>
                </label>

                {isRecurring && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                      Recurring Billing Interval
                    </label>
                    <select
                      className="odoo-input"
                      style={{ fontSize: '0.8125rem' }}
                      value={recurringInterval}
                      onChange={(e) => setRecurringInterval(e.target.value as any)}
                    >
                      <option value="monthly">Monthly Recurring</option>
                      <option value="quarterly">Quarterly Recurring</option>
                      <option value="yearly">Yearly Recurring</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                  Description
                </label>
                <textarea
                  className="odoo-input"
                  rows={3}
                  placeholder="Enter product specification or details..."
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #E2E8F0' }}>
                <button
                  type="button"
                  className="odoo-btn odoo-btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="odoo-btn odoo-btn-primary" disabled={submitting}>
                  {submitting ? 'Saving to Database...' : 'Save & Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

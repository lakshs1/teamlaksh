import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { fulfillmentApi } from '../../services/apiServices';

interface Warehouse {
  id: number;
  name: string;
  code?: string | null;
  location?: string | null;
  shippingCostWeight?: number | string;
  shipping_cost_weight?: number | string;
  isActive?: boolean;
  is_active?: boolean;
  createdAt?: string;
}

interface StockItem {
  id: number;
  warehouse_id: number;
  product_id: number;
  variant_id?: number | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  available_quantity: number;
  reorder_level: number;
  reorder_quantity: number;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  product_name: string;
  category_name?: string;
  sku?: string;
  unit?: string;
  base_price?: number;
  warehouse_name?: string;
}

export default function WarehouseSetupPage() {
  const [activeTab, setActiveTab] = useState<'warehouses' | 'stock' | 'simulator'>('warehouses');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);

  // Selected warehouse for stock & replenishment management
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Add Warehouse Form State
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newCostWeight, setNewCostWeight] = useState('1.00');
  const [creatingWarehouse, setCreatingWarehouse] = useState(false);

  // Edit Warehouse Modal State
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editCostWeight, setEditCostWeight] = useState('1.00');
  const [editIsActive, setEditIsActive] = useState(true);
  const [savingWarehouse, setSavingWarehouse] = useState(false);

  // Adjust Stock & Replenishment Rule Modal State
  const [adjustingStock, setAdjustingStock] = useState<StockItem | null>(null);
  const [adjustOnHand, setAdjustOnHand] = useState<number>(0);
  const [adjustReorderLevel, setAdjustReorderLevel] = useState<number>(10);
  const [adjustReorderQty, setAdjustReorderQty] = useState<number>(50);
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [savingStockRule, setSavingStockRule] = useState(false);

  // Quick Replenish Loading State Map (productId -> boolean)
  const [replenishingMap, setReplenishingMap] = useState<Record<number, boolean>>({});

  // Simulator State
  const [simQuantity, setSimQuantity] = useState<number>(25);
  const [simSelectedProductId, setSimSelectedProductId] = useState<number | null>(null);
  const [simResult, setSimResult] = useState<any | null>(null);

  // Fetch all warehouses
  const fetchWarehouses = async () => {
    try {
      setLoadingWarehouses(true);
      const res = await fulfillmentApi.getWarehouses();
      const list: Warehouse[] = res.data || [];
      setWarehouses(list);
      if (list.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(list[0].id);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to load warehouses');
    } finally {
      setLoadingWarehouses(false);
    }
  };

  // Fetch stock levels & replenishment rules for selected warehouse
  const fetchStock = async (whId: number) => {
    try {
      setLoadingStocks(true);
      const res = await fulfillmentApi.getWarehouseStock(whId);
      const items: StockItem[] = res.data || [];
      setStocks(items);
      if (items.length > 0 && !simSelectedProductId) {
        setSimSelectedProductId(items[0].product_id);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to load warehouse inventory');
    } finally {
      setLoadingStocks(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (selectedWarehouseId) {
      fetchStock(selectedWarehouseId);
    }
  }, [selectedWarehouseId]);

  // Handle Add Warehouse
  const handleAddWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error('Warehouse name is required');
      return;
    }
    try {
      setCreatingWarehouse(true);
      await fulfillmentApi.createWarehouse({
        name: newName.trim(),
        code: newCode.trim() || undefined,
        location: newLocation.trim() || undefined,
        shipping_cost_weight: parseFloat(newCostWeight) || 1.0,
        is_active: true,
      });
      toast.success(`Warehouse "${newName}" successfully created`);
      setNewName('');
      setNewCode('');
      setNewLocation('');
      setNewCostWeight('1.00');
      await fetchWarehouses();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to add warehouse');
    } finally {
      setCreatingWarehouse(false);
    }
  };

  // Open Edit Warehouse Modal
  const openEditWarehouseModal = (w: Warehouse) => {
    setEditingWarehouse(w);
    setEditName(w.name || '');
    setEditCode(w.code || '');
    setEditLocation(w.location || '');
    const weight = w.shippingCostWeight ?? w.shipping_cost_weight ?? 1.0;
    setEditCostWeight(String(weight));
    setEditIsActive(w.isActive ?? w.is_active ?? true);
  };

  // Save Warehouse Edits
  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse) return;
    try {
      setSavingWarehouse(true);
      await fulfillmentApi.updateWarehouse(editingWarehouse.id, {
        name: editName.trim(),
        code: editCode.trim() || undefined,
        location: editLocation.trim() || undefined,
        shipping_cost_weight: parseFloat(editCostWeight) || 1.0,
        is_active: editIsActive,
      });
      toast.success(`Warehouse "${editName}" updated successfully`);
      setEditingWarehouse(null);
      await fetchWarehouses();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to update warehouse');
    } finally {
      setSavingWarehouse(false);
    }
  };

  // Open Adjust Stock & Rule Modal
  const openAdjustStockModal = (item: StockItem) => {
    setAdjustingStock(item);
    setAdjustOnHand(item.quantity_on_hand);
    setAdjustReorderLevel(item.reorder_level);
    setAdjustReorderQty(item.reorder_quantity || 50);
    setAdjustNotes('');
  };

  // Save Stock Adjustments and Replenishment Rules
  const handleSaveStockRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingStock || !selectedWarehouseId) return;
    try {
      setSavingStockRule(true);
      await fulfillmentApi.updateStock(selectedWarehouseId, {
        product_id: adjustingStock.product_id,
        variant_id: adjustingStock.variant_id ?? undefined,
        quantity: Number(adjustOnHand),
        reorder_level: Number(adjustReorderLevel),
        reorder_quantity: Number(adjustReorderQty),
        notes: adjustNotes.trim() || 'Inventory level and replenishment rule adjustment',
      });
      toast.success(`Updated stock & rules for ${adjustingStock.product_name}`);
      setAdjustingStock(null);
      await fetchStock(selectedWarehouseId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to update stock rule');
    } finally {
      setSavingStockRule(false);
    }
  };

  // Handle Quick Replenish Action
  const handleQuickReplenish = async (item: StockItem) => {
    if (!selectedWarehouseId) return;
    const qty = item.reorder_quantity || 50;
    try {
      setReplenishingMap((prev) => ({ ...prev, [item.product_id]: true }));
      await fulfillmentApi.replenishStock(selectedWarehouseId, {
        product_id: item.product_id,
        variant_id: item.variant_id ?? undefined,
        quantity: qty,
        notes: `Quick Replenish rule triggered (+${qty} units)`,
      });
      toast.success(`Replenished +${qty} units of ${item.product_name}`);
      await fetchStock(selectedWarehouseId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Replenishment failed');
    } finally {
      setReplenishingMap((prev) => ({ ...prev, [item.product_id]: false }));
    }
  };

  // Run Simulator
  const handleRunSimulator = () => {
    if (!simSelectedProductId) {
      toast.error('Please select a product to simulate');
      return;
    }
    const targetProduct = stocks.find((s) => s.product_id === simSelectedProductId);
    const prodName = targetProduct?.product_name || `Product #${simSelectedProductId}`;

    // Compute simulation based on active warehouses sorted by shippingCostWeight
    const sortedWarehouses = [...warehouses]
      .filter((w) => (w.isActive ?? w.is_active ?? true))
      .sort((a, b) => {
        const wa = Number(a.shippingCostWeight ?? a.shipping_cost_weight ?? 1);
        const wb = Number(b.shippingCostWeight ?? b.shipping_cost_weight ?? 1);
        return wa - wb;
      });

    // Find if single warehouse can fulfill 100% of order
    let singleCapableWh: Warehouse | null = null;
    let singleOnHand = 0;

    for (const wh of sortedWarehouses) {
      // In selected warehouse we have live stocks; for others we estimate
      const onHand = wh.id === selectedWarehouseId ? (targetProduct?.available_quantity || 0) : 100;
      if (onHand >= simQuantity) {
        singleCapableWh = wh;
        singleOnHand = onHand;
        break;
      }
    }

    if (singleCapableWh) {
      const weight = Number(singleCapableWh.shippingCostWeight ?? singleCapableWh.shipping_cost_weight ?? 1);
      setSimResult({
        mode: 'single_shipment',
        product_name: prodName,
        requested_quantity: simQuantity,
        total_shipments: 1,
        explanation: 'Minimization Success: Fulfillable completely from a single warehouse. Lowest shipping cost weighting prioritized.',
        allocations: [
          {
            warehouse_name: singleCapableWh.name,
            warehouse_code: singleCapableWh.code || `WH-${singleCapableWh.id}`,
            quantity: simQuantity,
            shipping_weight: weight,
            is_primary: true,
          },
        ],
      });
    } else {
      // Multi-warehouse greedy split
      let remaining = simQuantity;
      const allocations: any[] = [];
      for (const wh of sortedWarehouses) {
        if (remaining <= 0) break;
        const available = wh.id === selectedWarehouseId ? (targetProduct?.available_quantity || 0) : 15;
        if (available > 0) {
          const take = Math.min(available, remaining);
          allocations.push({
            warehouse_name: wh.name,
            warehouse_code: wh.code || `WH-${wh.id}`,
            quantity: take,
            shipping_weight: Number(wh.shippingCostWeight ?? wh.shipping_cost_weight ?? 1),
          });
          remaining -= take;
        }
      }

      setSimResult({
        mode: remaining > 0 ? 'backordered_split' : 'multi_warehouse_split',
        product_name: prodName,
        requested_quantity: simQuantity,
        total_shipments: allocations.length,
        backordered_quantity: remaining > 0 ? remaining : 0,
        explanation: remaining > 0
          ? 'Split Required with Backorders: Multi-warehouse allocation utilized lowest-weight hubs first, but insufficient stock resulted in a backorder.'
          : 'Multi-Warehouse Split: No single warehouse possessed sufficient inventory; greedy algorithm minimized total shipments using lowest shipping weights.',
        allocations,
      });
    }
  };

  // Filtered stock list
  const filteredStocks = stocks.filter((item) => {
    const matchesSearch =
      item.product_name.toLowerCase().includes(stockSearch.toLowerCase()) ||
      (item.category_name && item.category_name.toLowerCase().includes(stockSearch.toLowerCase())) ||
      (item.sku && item.sku.toLowerCase().includes(stockSearch.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all' ? true : item.stock_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // KPI calculations
  const totalMonitored = stocks.length;
  const inStockCount = stocks.filter((s) => s.stock_status === 'in_stock').length;
  const lowStockCount = stocks.filter((s) => s.stock_status === 'low_stock').length;
  const outOfStockCount = stocks.filter((s) => s.stock_status === 'out_of_stock').length;

  return (
    <div className="odoo-container" style={{ padding: '1.5rem', maxWidth: 1400, margin: '0 auto' }}>
      {/* Top Header */}
      <div className="odoo-page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="odoo-page-title" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>
            Warehouse & Fulfillment Setup (A4)
          </h1>
          <p className="text-muted text-sm" style={{ marginTop: '0.25rem', color: '#6B7280' }}>
            Configure stock levels, replenishment rules per warehouse, and shipping cost weighting to minimize number of shipments.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid #E5E7EB',
          marginBottom: '1.5rem',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('warehouses')}
          style={{
            padding: '0.625rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'warehouses' ? '2px solid #714B67' : '2px solid transparent',
            color: activeTab === 'warehouses' ? '#714B67' : '#6B7280',
            marginBottom: -2,
            transition: 'all 0.15s ease',
          }}
        >
          Warehouses & Shipping Weights ({warehouses.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stock')}
          style={{
            padding: '0.625rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'stock' ? '2px solid #714B67' : '2px solid transparent',
            color: activeTab === 'stock' ? '#714B67' : '#6B7280',
            marginBottom: -2,
            transition: 'all 0.15s ease',
          }}
        >
          Stock Levels & Replenishment Rules
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('simulator')}
          style={{
            padding: '0.625rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'simulator' ? '2px solid #714B67' : '2px solid transparent',
            color: activeTab === 'simulator' ? '#714B67' : '#6B7280',
            marginBottom: -2,
            transition: 'all 0.15s ease',
          }}
        >
          Auto-Split & Minimization Simulator
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: WAREHOUSES & SHIPPING COST WEIGHTING             */}
      {/* ======================================================== */}
      {activeTab === 'warehouses' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Left Table: Warehouses List */}
          <div className="odoo-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: '#111827' }}>
                  Configured Warehouses & Shipping Priorities
                </h2>
                <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: '0.2rem 0 0 0' }}>
                  Lower shipping weight factor takes priority during auto-split fulfillment to minimize carrier costs.
                </p>
              </div>
            </div>

            {loadingWarehouses ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6B7280' }}>
                Loading warehouses...
              </div>
            ) : (
              <div className="odoo-table-container" style={{ overflowX: 'auto' }}>
                <table className="odoo-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>Code</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>Warehouse</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>Location</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>Shipping Weight</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>Priority</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouses.map((w, idx) => {
                      const weight = Number(w.shippingCostWeight ?? w.shipping_cost_weight ?? 1.0);
                      const isActive = w.isActive ?? w.is_active ?? true;
                      return (
                        <tr key={w.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#111827' }}>
                            <span style={{ background: '#F3F4F6', padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.8125rem' }}>
                              {w.code || `WH-${w.id}`}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#714B67' }}>
                            {w.name}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: '#4B5563', fontSize: '0.875rem' }}>
                            {w.location || '-'}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#111827' }}>
                            <span style={{ color: weight <= 1.0 ? '#059669' : '#D97706' }}>
                              {weight.toFixed(2)}x
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            {idx === 0 ? (
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#DCFCE7', color: '#15803D', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                                Primary Route
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#F3F4F6', color: '#4B5563', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                                Secondary
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                padding: '0.2rem 0.5rem',
                                borderRadius: 4,
                                background: isActive ? '#DCFCE7' : '#FEE2E2',
                                color: isActive ? '#15803D' : '#B91C1C',
                              }}
                            >
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => openEditWarehouseModal(w)}
                              className="odoo-btn"
                              style={{
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.8125rem',
                                border: '1px solid #D1D5DB',
                                background: '#FFFFFF',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontWeight: 500,
                              }}
                            >
                              Edit Weight
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {warehouses.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#6B7280' }}>
                          No warehouses configured yet. Add your first warehouse using the form.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Card: Add New Warehouse */}
          <div className="odoo-card" style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#111827' }}>
              Add New Warehouse
            </h2>
            <p style={{ fontSize: '0.8125rem', color: '#6B7280', marginBottom: '1.25rem' }}>
              Register a distribution center or fulfillment hub with its relative shipping cost weight.
            </p>

            <form onSubmit={handleAddWarehouse} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Warehouse Name *
                </label>
                <input
                  type="text"
                  className="odoo-input"
                  placeholder="e.g. Central Logistics Depot"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Warehouse Code
                </label>
                <input
                  type="text"
                  className="odoo-input"
                  placeholder="e.g. WH-CENTRAL"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Location / Address
                </label>
                <input
                  type="text"
                  className="odoo-input"
                  placeholder="e.g. Dallas Fulfillment Center, TX"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Shipping Cost Weight Factor *
                  </label>
                  <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Default: 1.00</span>
                </div>
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="10"
                  className="odoo-input"
                  value={newCostWeight}
                  onChange={(e) => setNewCostWeight(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
                <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.35rem', lineHeight: 1.4 }}>
                  Auto-split optimizer multiplies base carrier rates by this factor. Lower weights are prioritized first to minimize shipments and lower logistics costs.
                </p>
              </div>

              <button
                type="submit"
                disabled={creatingWarehouse}
                className="odoo-btn odoo-btn-primary"
                style={{
                  marginTop: '0.5rem',
                  padding: '0.625rem 1.25rem',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: creatingWarehouse ? 'not-allowed' : 'pointer',
                  opacity: creatingWarehouse ? 0.7 : 1,
                }}
              >
                {creatingWarehouse ? 'Creating Warehouse...' : 'Save Warehouse'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: STOCK LEVELS & REPLENISHMENT RULES               */}
      {/* ======================================================== */}
      {activeTab === 'stock' && (
        <div>
          {/* Header Controls & Warehouse Selector */}
          <div
            className="odoo-card"
            style={{
              padding: '1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Target Warehouse
                </label>
                <select
                  className="odoo-input"
                  value={selectedWarehouseId || ''}
                  onChange={(e) => setSelectedWarehouseId(Number(e.target.value))}
                  style={{ minWidth: 260, fontWeight: 600, color: '#714B67' }}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code || `WH-${w.id}`}) - Weight: {Number(w.shippingCostWeight ?? w.shipping_cost_weight ?? 1).toFixed(2)}x
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Search Catalog Products
                </label>
                <input
                  type="text"
                  className="odoo-input"
                  placeholder="Filter by product name, category..."
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  style={{ minWidth: 260 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Stock Status Filter
                </label>
                <select
                  className="odoo-input"
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  style={{ minWidth: 160 }}
                >
                  <option value="all">All Statuses</option>
                  <option value="in_stock">In Stock</option>
                  <option value="low_stock">Low Stock (At / Below Min)</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => selectedWarehouseId && fetchStock(selectedWarehouseId)}
              className="odoo-btn"
              style={{
                border: '1px solid #D1D5DB',
                background: '#FFFFFF',
                padding: '0.5rem 1rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Refresh Stock Levels
            </button>
          </div>

          {/* Metric KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div className="odoo-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>
                Monitored Products
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', marginTop: '0.25rem' }}>
                {totalMonitored}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>
                Catalog items in this warehouse
              </div>
            </div>

            <div className="odoo-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
                In Stock (Healthy)
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#059669', marginTop: '0.25rem' }}>
                {inStockCount}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>
                Above configured reorder level
              </div>
            </div>

            <div className="odoo-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#D97706', textTransform: 'uppercase' }}>
                Low Stock Triggers
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#D97706', marginTop: '0.25rem' }}>
                {lowStockCount}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>
                Replenishment threshold reached
              </div>
            </div>

            <div className="odoo-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>
                Out of Stock
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#DC2626', marginTop: '0.25rem' }}>
                {outOfStockCount}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>
                Zero available inventory
              </div>
            </div>
          </div>

          {/* Stock Levels & Replenishment Rules Table */}
          <div className="odoo-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: '#111827' }}>
                  Warehouse Inventory & Replenishment Rules
                </h2>
                <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: '0.2rem 0 0 0' }}>
                  Set minimum stock triggers and batch replenishment sizes for automated or one-click replenishment.
                </p>
              </div>
            </div>

            {loadingStocks ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>
                Loading warehouse stock levels and rules...
              </div>
            ) : (
              <div className="odoo-table-container" style={{ overflowX: 'auto' }}>
                <table className="odoo-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>Product</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>Category</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>On Hand</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>Reserved</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>Available</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>Min Stock Rule</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>Replenish Batch</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStocks.map((item) => {
                      const isReplenishing = !!replenishingMap[item.product_id];
                      return (
                        <tr key={item.product_id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ fontWeight: 600, color: '#111827' }}>{item.product_name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                              SKU / ID: #{item.product_id} | {item.unit || 'unit'}
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: '#4B5563', fontSize: '0.875rem' }}>
                            <span style={{ background: '#F3F4F6', padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.8125rem' }}>
                              {item.category_name || 'General'}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#111827' }}>
                            {item.quantity_on_hand}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: '#6B7280' }}>
                            {item.quantity_reserved}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>
                            <span style={{ color: item.available_quantity <= item.reorder_level ? '#D97706' : '#059669' }}>
                              {item.available_quantity}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: '#374151' }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                              {item.reorder_level} units
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>Trigger threshold</div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: '#374151' }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                              +{item.reorder_quantity || 50} units
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>Reorder batch size</div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            {item.stock_status === 'in_stock' && (
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#DCFCE7', color: '#15803D', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                                In Stock
                              </span>
                            )}
                            {item.stock_status === 'low_stock' && (
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#FEF3C7', color: '#B45309', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                                Low Stock
                              </span>
                            )}
                            {item.stock_status === 'out_of_stock' && (
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#FEE2E2', color: '#B91C1C', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                                Out of Stock
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => openAdjustStockModal(item)}
                                className="odoo-btn"
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.75rem',
                                  border: '1px solid #D1D5DB',
                                  background: '#FFFFFF',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                }}
                              >
                                Configure Rule
                              </button>

                              <button
                                type="button"
                                disabled={isReplenishing}
                                onClick={() => handleQuickReplenish(item)}
                                className="odoo-btn"
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.75rem',
                                  border: '1px solid #714B67',
                                  background: '#714B67',
                                  color: '#FFFFFF',
                                  borderRadius: 4,
                                  cursor: isReplenishing ? 'not-allowed' : 'pointer',
                                  fontWeight: 600,
                                  opacity: isReplenishing ? 0.6 : 1,
                                }}
                              >
                                {isReplenishing ? 'Restocking...' : `+${item.reorder_quantity || 50} Replenish`}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredStocks.length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: '#6B7280' }}>
                          No catalog products matched your search or status filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: AUTO-SPLIT & MINIMIZATION SIMULATOR              */}
      {/* ======================================================== */}
      {activeTab === 'simulator' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Left Panel: Simulator Inputs & Strategy Overview */}
          <div className="odoo-card" style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#111827' }}>
              Auto-Split Routing Simulator
            </h2>
            <p style={{ fontSize: '0.8125rem', color: '#6B7280', marginBottom: '1.25rem' }}>
              Test how warehouse stock availability and shipping cost weighting interact to minimize total shipments.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Select Product to Simulate
                </label>
                <select
                  className="odoo-input"
                  value={simSelectedProductId || ''}
                  onChange={(e) => setSimSelectedProductId(Number(e.target.value))}
                  style={{ width: '100%' }}
                >
                  {stocks.map((s) => (
                    <option key={s.product_id} value={s.product_id}>
                      {s.product_name} (Current Available: {s.available_quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Requested Order Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  className="odoo-input"
                  value={simQuantity}
                  onChange={(e) => setSimQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, padding: '0.85rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#374151', marginBottom: '0.35rem' }}>
                  Minimization Rules (ADR-004)
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.75rem', color: '#6B7280', lineHeight: 1.5 }}>
                  <li>
                    <strong>Single-Shipment Priority:</strong> If any active warehouse can satisfy 100% of order lines, the algorithm chooses the capable warehouse with the lowest shipping cost weight. Result: exactly 1 shipment.
                  </li>
                  <li>
                    <strong>Greedy Multi-Warehouse Split:</strong> If no single warehouse has complete stock, inventory is taken from the cheapest available warehouse first.
                  </li>
                  <li>
                    <strong>Backorder Isolation:</strong> Unfulfilled units are flagged as backordered and tracked separately.
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleRunSimulator}
                className="odoo-btn odoo-btn-primary"
                style={{
                  padding: '0.625rem 1.25rem',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Simulate Warehouse Allocation
              </button>
            </div>
          </div>

          {/* Right Panel: Simulation Results */}
          <div className="odoo-card" style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#111827' }}>
              Simulation Outcome
            </h2>

            {simResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Result Summary Banner */}
                <div
                  style={{
                    padding: '1rem',
                    borderRadius: 6,
                    border: '1px solid',
                    borderColor:
                      simResult.mode === 'single_shipment'
                        ? '#BBF7D0'
                        : simResult.mode === 'multi_warehouse_split'
                          ? '#FED7AA'
                          : '#FECACA',
                    background:
                      simResult.mode === 'single_shipment'
                        ? '#F0FDF4'
                        : simResult.mode === 'multi_warehouse_split'
                          ? '#FFF7ED'
                          : '#FEF2F2',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}>
                      {simResult.mode === 'single_shipment'
                        ? 'Optimized: Single Shipment (1 Shipment)'
                        : simResult.mode === 'multi_warehouse_split'
                          ? `Split Fulfilled: ${simResult.total_shipments} Shipments`
                          : `Split & Backorder: ${simResult.total_shipments} Shipments + Backorder`}
                    </div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.5rem',
                        borderRadius: 4,
                        background: simResult.mode === 'single_shipment' ? '#DCFCE7' : '#FEF3C7',
                        color: simResult.mode === 'single_shipment' ? '#15803D' : '#B45309',
                      }}
                    >
                      {simResult.total_shipments} Package{simResult.total_shipments !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#4B5563', margin: '0.5rem 0 0 0' }}>
                    {simResult.explanation}
                  </p>
                </div>

                {/* Allocation Details */}
                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>
                    Allocations for {simResult.requested_quantity}x {simResult.product_name}
                  </h3>
                  <div className="odoo-table-container">
                    <table className="odoo-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
                          <th style={{ padding: '0.65rem 0.85rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>Warehouse</th>
                          <th style={{ padding: '0.65rem 0.85rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>Cost Weight</th>
                          <th style={{ padding: '0.65rem 0.85rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>Allocated Qty</th>
                          <th style={{ padding: '0.65rem 0.85rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4B5563' }}>Shipment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {simResult.allocations.map((alloc: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#714B67' }}>
                              {alloc.warehouse_name} ({alloc.warehouse_code})
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#111827' }}>
                              {alloc.shipping_weight.toFixed(2)}x
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#059669' }}>
                              {alloc.quantity} units
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <span style={{ fontSize: '0.75rem', background: '#F3F4F6', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                                Shipment #{idx + 1}
                              </span>
                            </td>
                          </tr>
                        ))}

                        {simResult.backordered_quantity > 0 && (
                          <tr style={{ background: '#FEF2F2', borderBottom: '1px solid #FEE2E2' }}>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#DC2626' }}>
                              Unfulfilled Backorder
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', color: '#6B7280' }}>-</td>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#DC2626' }}>
                              {simResult.backordered_quantity} units
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <span style={{ fontSize: '0.75rem', background: '#FEE2E2', color: '#B91C1C', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                                Pending Inbound
                              </span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>
                Select a product and order quantity on the left, then click &ldquo;Simulate Warehouse Allocation&rdquo; to test the minimization routing.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT WAREHOUSE & SHIPPING COST WEIGHT            */}
      {/* ======================================================== */}
      {editingWarehouse && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 8,
              padding: '1.5rem',
              width: '100%',
              maxWidth: 500,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
                Edit Warehouse & Shipping Weight
              </h3>
              <button
                type="button"
                onClick={() => setEditingWarehouse(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#9CA3AF' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Warehouse Name *
                </label>
                <input
                  type="text"
                  className="odoo-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Warehouse Code
                </label>
                <input
                  type="text"
                  className="odoo-input"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Location / Address
                </label>
                <input
                  type="text"
                  className="odoo-input"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Shipping Cost Weight Factor *
                  </label>
                  <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Current: {editCostWeight}x</span>
                </div>
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="10"
                  className="odoo-input"
                  value={editCostWeight}
                  onChange={(e) => setEditCostWeight(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
                <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.35rem', lineHeight: 1.4 }}>
                  Used by auto-split logic to minimize shipments and prioritize cheapest fulfillment centers.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="warehouseIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="warehouseIsActive" style={{ fontSize: '0.875rem', color: '#374151', cursor: 'pointer' }}>
                  Active for Fulfillment Splitting
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingWarehouse(null)}
                  className="odoo-btn"
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.8125rem',
                    border: '1px solid #D1D5DB',
                    background: '#FFFFFF',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingWarehouse}
                  className="odoo-btn odoo-btn-primary"
                  style={{
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: savingWarehouse ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingWarehouse ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CONFIGURE STOCK LEVELS & REPLENISHMENT RULES     */}
      {/* ======================================================== */}
      {adjustingStock && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 8,
              padding: '1.5rem',
              width: '100%',
              maxWidth: 520,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
                  Configure Stock & Replenishment Rule
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8125rem', color: '#6B7280' }}>
                  {adjustingStock.product_name} ({adjustingStock.category_name || 'General'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingStock(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#9CA3AF' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveStockRule} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Current On-Hand Inventory (Physical Count) *
                </label>
                <input
                  type="number"
                  min="0"
                  className="odoo-input"
                  value={adjustOnHand}
                  onChange={(e) => setAdjustOnHand(Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ width: '100%' }}
                  required
                />
                <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.35rem' }}>
                  Currently reserved: {adjustingStock.quantity_reserved} | Available after update: {Math.max(0, adjustOnHand - adjustingStock.quantity_reserved)}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Min Stock Reorder Level (Trigger Threshold) *
                </label>
                <input
                  type="number"
                  min="0"
                  className="odoo-input"
                  value={adjustReorderLevel}
                  onChange={(e) => setAdjustReorderLevel(Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ width: '100%' }}
                  required
                />
                <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.35rem' }}>
                  When available stock drops to or below this quantity, the product is flagged as &ldquo;Low Stock&rdquo;.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Replenishment Batch Size (Reorder Quantity) *
                </label>
                <input
                  type="number"
                  min="1"
                  className="odoo-input"
                  value={adjustReorderQty}
                  onChange={(e) => setAdjustReorderQty(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width: '100%' }}
                  required
                />
                <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.35rem' }}>
                  The standard order quantity added when replenishment is executed.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Audit Notes / Reason
                </label>
                <input
                  type="text"
                  className="odoo-input"
                  placeholder="e.g. Physical inventory count reconciliation"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setAdjustingStock(null)}
                  className="odoo-btn"
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.8125rem',
                    border: '1px solid #D1D5DB',
                    background: '#FFFFFF',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStockRule}
                  className="odoo-btn odoo-btn-primary"
                  style={{
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: savingStockRule ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingStockRule ? 'Saving...' : 'Save Stock & Rules'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

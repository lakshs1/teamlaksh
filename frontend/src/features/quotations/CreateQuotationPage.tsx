import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useDealFlowStore, type QuotationLine, type Quotation } from '../../stores/dealflowStore';
import { useAuthStore } from '../../stores/authStore';
import { quoteApi, customerApi, catalogApi } from '../../services/apiServices';

interface CustomerOption {
  id: number;
  name: string;
  email: string;
  tier: 'Bronze' | 'Silver' | 'Gold';
  maxDiscountPct: number;
  paymentTerms: string;
}

export default function CreateQuotationPage() {
  const navigate = useNavigate();
  const { products: storeProducts, currentRole } = useDealFlowStore();
  const { user } = useAuthStore();

  // Helper dates
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultExpiryStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Auto-generate reference code
  const generatedRef = useMemo(() => {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return `SO/2026/${randomNum}`;
  }, []);

  // Customer List State (fetched from backend)
  const [customerList, setCustomerList] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(0);
  const [catalogProducts, setCatalogProducts] = useState(storeProducts);

  // Fetch live backend customers and catalog on mount
  useEffect(() => {
    async function loadLiveBackendData() {
      try {
        const custRes = await customerApi.getCustomers({ limit: 50 });
        if (custRes?.data && Array.isArray(custRes.data) && custRes.data.length > 0) {
          const mappedCustomers: CustomerOption[] = custRes.data.map((c: any) => ({
            id: c.id,
            name: c.name,
            email: c.email || `${c.name.toLowerCase().replace(/\s+/g, '')}@example.com`,
            tier: (c.tier?.name?.includes('Gold') ? 'Gold' : c.tier?.name?.includes('Silver') ? 'Silver' : 'Bronze') as 'Bronze' | 'Silver' | 'Gold',
            maxDiscountPct: c.tier?.max_discount_pct ? Number(c.tier.max_discount_pct) : 15,
            paymentTerms: 'Net 30 Days',
          }));
          setCustomerList(mappedCustomers);
          setSelectedCustomerId(mappedCustomers[0].id);
        }
      } catch {
        // Keep empty list on error
      }

      try {
        const prodRes = await catalogApi.getProducts({ limit: 50 });
        if (prodRes?.data && Array.isArray(prodRes.data) && prodRes.data.length > 0) {
          const mappedProds = prodRes.data.map((p: any) => {
            const price = Number(p.basePrice || p.base_price || p.salesPrice || 0);
            const cost = Number(p.costPrice || p.cost_price || (price > 0 ? price * 0.65 : 0));
            return {
              id: String(p.id),
              name: p.name,
              sku: p.sku || `PROD-${p.id}`,
              category: (p.category?.name || 'Hardware') as any,
              salesPrice: price,
              costPrice: cost > 0 ? cost : price * 0.65,
              status: 'Active' as const,
              description: p.description || '',
              canBeSold: true,
              canBePurchased: true,
            };
          });
          setCatalogProducts(mappedProds);
        }
      } catch {
        // Fallback to store products
      }
    }

    loadLiveBackendData();
  }, []);

  // Form states
  const [quotationDate, setQuotationDate] = useState<string>(todayStr);
  const [expiryDate, setExpiryDate] = useState<string>(defaultExpiryStr);
  const [paymentTerms, setPaymentTerms] = useState<string>('Net 30 Days');
  const [salesRepName, setSalesRepName] = useState<string>(user?.name || `${currentRole} User`);
  const [salesTeam, setSalesTeam] = useState<string>('Enterprise North');
  const [fiscalPosition, setFiscalPosition] = useState<string>('Standard B2B GST (18%)');
  const [clientOrderRef, setClientOrderRef] = useState<string>('');
  const [internalNotes, setInternalNotes] = useState<string>('Standard sales quotation with tier-discount governance.');
  const [activeTab, setActiveTab] = useState<'lines' | 'info'>('lines');
  const [showUpsell, setShowUpsell] = useState<boolean>(true);
  const [showCatalogModal, setShowCatalogModal] = useState<boolean>(false);
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>('All');
  const [isSubmittingLoading, setIsSubmittingLoading] = useState<boolean>(false);

  // Selected customer object
  const currentCustomer: CustomerOption = useMemo(() => {
    return customerList.find((c) => c.id === Number(selectedCustomerId)) || customerList[0] || { id: 0, name: 'Select a customer', email: '', tier: 'Bronze' as const, maxDiscountPct: 5, paymentTerms: 'Net 30 Days' };
  }, [customerList, selectedCustomerId]);

  // Allowed discount ceilings helper based on customer tier and category
  const getCategoryDiscountCeiling = (category: string, tier: 'Bronze' | 'Silver' | 'Gold') => {
    const tierMax = tier === 'Gold' ? 15 : tier === 'Silver' ? 10 : 5;
    if (category === 'Accessories') return Math.max(tierMax, 20);
    if (category === 'Subscriptions') return Math.max(tierMax, 25);
    if (category === 'Services') return tierMax;
    return tierMax; // Hardware
  };

  // Initial order lines: empty array
  const [lines, setLines] = useState<QuotationLine[]>([]);

  // Recalculate allowed discounts when customer changes
  const handleCustomerChange = (customerId: number) => {
    setSelectedCustomerId(customerId);
    const newCust = customerList.find((c) => c.id === customerId);
    if (newCust) {
      setPaymentTerms(newCust.paymentTerms || 'Net 30 Days');
      setLines((prev) =>
        prev.map((l) => {
          const allowed = getCategoryDiscountCeiling(l.category, newCust.tier);
          return { ...l, allowedDiscount: allowed };
        })
      );
    }
  };

  // Line item manipulation
  const handleQuantityChange = (lineId: string, delta: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const newQty = Math.max(1, l.quantity + delta);
        const newTotal = newQty * l.unitPrice * (1 - l.discount / 100);
        return { ...l, quantity: newQty, total: newTotal };
      })
    );
  };

  const handleQuantityInput = (lineId: string, val: number) => {
    const qty = Math.max(1, isNaN(val) ? 1 : val);
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const newTotal = qty * l.unitPrice * (1 - l.discount / 100);
        return { ...l, quantity: qty, total: newTotal };
      })
    );
  };

  const handleUnitPriceChange = (lineId: string, val: number) => {
    const price = Math.max(0, isNaN(val) ? 0 : val);
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const newTotal = l.quantity * price * (1 - l.discount / 100);
        const newCost = l.costPrice && l.costPrice > 0 ? l.costPrice : price * 0.65;
        return { ...l, unitPrice: price, costPrice: newCost, total: newTotal };
      })
    );
  };

  const handleDiscountChange = (lineId: string, val: number) => {
    const disc = Math.min(100, Math.max(0, isNaN(val) ? 0 : val));
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const newTotal = l.quantity * l.unitPrice * (1 - disc / 100);
        return { ...l, discount: disc, total: newTotal };
      })
    );
  };

  const handleDescriptionChange = (lineId: string, desc: string) => {
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, description: desc } : l))
    );
  };

  const handleDeleteLine = (lineId: string) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
    toast.success('Line item removed');
  };

  const handleAddProductFromCatalog = (product: any) => {
    const unitPrice = Number(product.salesPrice || product.basePrice || product.base_price || 100000);
    const costPrice = Number(product.costPrice || product.cost_price || (unitPrice > 0 ? unitPrice * 0.65 : 65000));
    const allowed = getCategoryDiscountCeiling(product.category, currentCustomer.tier);

    const newLine: QuotationLine = {
      id: `ql-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      productId: String(product.id),
      productName: product.name,
      category: product.category,
      description: product.description || product.name,
      quantity: 1,
      unitPrice: unitPrice,
      costPrice: costPrice,
      discount: 0,
      allowedDiscount: allowed,
      taxPercent: 18,
      total: unitPrice,
    };
    setLines((prev) => [...prev, newLine]);
    setShowCatalogModal(false);
    toast.success(`Added ${product.name} to order lines`);
  };

  const handleAddUpsell = (
    name: string,
    price: number,
    cat: 'Hardware' | 'Services' | 'Subscriptions' | 'Accessories',
    promoDesc: string
  ) => {
    const allowed = getCategoryDiscountCeiling(cat, currentCustomer.tier);
    const cost = price * 0.55; // healthy margin on upsells
    const newLine: QuotationLine = {
      id: `ql-upsell-${Date.now()}`,
      productId: `prod-upsell-${Date.now()}`,
      productName: name,
      category: cat,
      description: promoDesc,
      quantity: 1,
      unitPrice: price,
      costPrice: cost,
      discount: 0,
      allowedDiscount: allowed,
      taxPercent: 18,
      total: price,
    };
    setLines((prev) => [...prev, newLine]);
    toast.success(`Upsell item "${name}" added to quotation!`);
  };

  // Financial calculations
  const untaxedAmount = useMemo(() => {
    return lines.reduce((acc, l) => acc + l.total, 0);
  }, [lines]);

  const rawSubtotalBeforeDiscount = useMemo(() => {
    return lines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0);
  }, [lines]);

  const totalDiscountAmount = rawSubtotalBeforeDiscount - untaxedAmount;
  const taxAmount = untaxedAmount * 0.18;
  const totalAmount = untaxedAmount + taxAmount;

  // Live Cost calculation for Gross Margin
  const totalCost = useMemo(() => {
    return lines.reduce((acc, l) => {
      let unitCost = l.costPrice;
      if (unitCost === undefined || unitCost === null || unitCost === 0) {
        const matchProd = catalogProducts.find((p: any) => String(p.id) === String(l.productId));
        unitCost = matchProd && Number(matchProd.costPrice) > 0
          ? Number(matchProd.costPrice)
          : l.unitPrice * 0.65;
      }
      return acc + unitCost * l.quantity;
    }, 0);
  }, [lines, catalogProducts]);

  // Live Gross Margin %: ((Untaxed Revenue - Total Cost) / Untaxed Revenue) * 100
  const grossMarginPercent = useMemo(() => {
    if (untaxedAmount <= 0) return 0;
    const margin = Math.round(((untaxedAmount - totalCost) / untaxedAmount) * 100);
    return Math.max(0, Math.min(100, margin));
  }, [untaxedAmount, totalCost]);

  // Blended Risk Score calculation
  const { blendedRiskScore, requiresManager, requiresFinance } = useMemo(() => {
    if (rawSubtotalBeforeDiscount <= 0 || lines.length === 0) {
      return { blendedRiskScore: 0, requiresManager: false, requiresFinance: false };
    }

    let totalExcessWeighted = 0;
    lines.forEach((l) => {
      const excess = Math.max(0, l.discount - l.allowedDiscount);
      const lineBase = l.quantity * l.unitPrice;
      totalExcessWeighted += excess * (lineBase / rawSubtotalBeforeDiscount);
    });

    const score = Number(totalExcessWeighted.toFixed(1));
    const reqMgr = score > 0;
    const reqFin = score > 12 || lines.some((l) => l.discount > 20);

    return {
      blendedRiskScore: score,
      requiresManager: reqMgr,
      requiresFinance: reqFin,
    };
  }, [lines, rawSubtotalBeforeDiscount]);

  // AI Upsell Recommendations based on current lines
  const upsellSuggestions = useMemo(() => {
    const hasHardware = lines.some((l) => l.category === 'Hardware');
    const hasSubscription = lines.some((l) => l.category === 'Subscriptions');
    const hasService = lines.some((l) => l.category === 'Services');

    const suggestions = [];

    if (hasHardware && !lines.some((l) => l.productName.includes('Docking Station'))) {
      suggestions.push({
        id: 'up-1',
        name: 'Thunderbolt 4 Triple-Display Docking Station',
        price: 18500,
        category: 'Accessories' as const,
        badge: 'PROMO',
        marginImpact: '+2.8%',
        reason: 'Recommended for enterprise hardware workstation bundles',
      });
    }

    if (hasHardware && !hasService) {
      suggestions.push({
        id: 'up-2',
        name: '24/7 Dedicated SLA Infrastructure Support',
        price: 45000,
        category: 'Services' as const,
        badge: 'HIGH MARGIN',
        marginImpact: '+5.4%',
        reason: 'Attach mission-critical maintenance to high-value hardware nodes',
      });
    }

    if (!hasSubscription) {
      suggestions.push({
        id: 'up-3',
        name: 'DealFlow360 Enterprise ERP License (Monthly)',
        price: 12000,
        category: 'Subscriptions' as const,
        badge: 'RECURRING',
        marginImpact: '+4.2%',
        reason: 'Add recurring SaaS seat licenses to one-time sales order',
      });
    }

    if (!lines.some((l) => l.productName.includes('Keyboard'))) {
      suggestions.push({
        id: 'up-4',
        name: 'Wireless Ergonomic Keyboard & Mouse Suite',
        price: 7500,
        category: 'Accessories' as const,
        badge: 'POPULAR',
        marginImpact: '+1.6%',
        reason: 'Frequently co-purchased accessory bundle',
      });
    }

    return suggestions;
  }, [lines]);

  // Filtered catalog products for modal
  const filteredCatalog = useMemo(() => {
    return catalogProducts.filter((p: any) => {
      const matchSearch =
        p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(catalogSearch.toLowerCase()));
      const matchCat =
        catalogCategoryFilter === 'All' || p.category === catalogCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [catalogProducts, catalogSearch, catalogCategoryFilter]);

  // Save Quotation Handler
  const handleSaveQuotation = async (isSubmitting: boolean = false) => {
    if (lines.length === 0) {
      toast.error('Cannot create a quotation without order lines.');
      return;
    }

    setIsSubmittingLoading(true);

    // Call backend API if live mode or connected
    try {
      const createRes = await quoteApi.createQuote({
        customer_id: Number(currentCustomer.id),
        notes: internalNotes,
        expires_at: expiryDate ? new Date(`${expiryDate}T23:59:59.000Z`).toISOString() : undefined,
      });

      if (createRes?.data?.id) {
        const backendQuoteId = createRes.data.id;
        for (const line of lines) {
          const numProdId = parseInt(String(line.productId).replace(/\D/g, '')) || 1;
          try {
            await quoteApi.addLine(backendQuoteId, {
              product_id: numProdId,
              quantity: line.quantity,
              discount_pct: line.discount,
            });
          } catch {
            // Non-blocking line addition fallback
          }
        }

        if (isSubmitting) {
          await quoteApi.submitQuote(backendQuoteId);
        }
      }
    } catch (err: any) {
      console.warn('Backend synchronization notice:', err?.response?.data || err?.message);
      if (err?.response?.data?.message) {
        toast.error(`Backend notice: ${err.response.data.message}`, { duration: 5000 });
      }
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to create quotation';
      toast.error(`Backend notice: ${errMsg}`, { duration: 5000 });
      setIsSubmittingLoading(false);
      return;
    } finally {
      setIsSubmittingLoading(false);
    }

    if (isSubmitting) {
      if (requiresFinance) {
        toast.success(
          `Quotation ${generatedRef} submitted! Routed to Sales Manager & Finance approval (Risk: ${blendedRiskScore}%)`
        );
      } else if (requiresManager) {
        toast.success(
          `Quotation ${generatedRef} submitted! Routed to Sales Manager approval (Risk: ${blendedRiskScore}%)`
        );
      } else {
        toast.success(
          `Quotation ${generatedRef} auto-approved! Ready for fulfillment or customer portal.`
        );
      }
    } else {
      toast.success(`Draft Quotation ${generatedRef} saved successfully!`);
    }

    navigate('/quotations');
  };

  return (
    <div className="odoo-container">
      {/* Top Header & Breadcrumbs */}
      <div className="odoo-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: '#64748B', marginBottom: '0.25rem' }}>
            <span
              style={{ cursor: 'pointer', color: '#714B67', fontWeight: 600 }}
              onClick={() => navigate('/quotations')}
            >
              Quotations
            </span>
            <span>/</span>
            <span style={{ fontWeight: 600, color: '#1F2937' }}>New Quotation</span>
          </div>
          <h1 className="odoo-page-title" style={{ color: '#714B67', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {generatedRef}
            <span className="odoo-badge" style={{ backgroundColor: '#F1F5F9', color: '#475569', fontSize: '0.75rem' }}>
              Draft (New)
            </span>
          </h1>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className="odoo-btn odoo-btn-secondary"
            onClick={() => navigate('/quotations')}
            disabled={isSubmittingLoading}
          >
            Discard
          </button>
          <button
            className="odoo-btn odoo-btn-secondary"
            onClick={() => handleSaveQuotation(false)}
            disabled={isSubmittingLoading}
          >
            Save as Draft
          </button>
          <button
            className="odoo-btn odoo-btn-primary"
            onClick={() => handleSaveQuotation(true)}
            disabled={isSubmittingLoading}
          >
            {isSubmittingLoading ? 'Submitting...' : 'Submit for Approval ➔'}
          </button>
        </div>
      </div>

      {/* Main Form Layout (Split Grid with AI Upsell Side Panel) */}
      <div style={{ display: 'grid', gridTemplateColumns: showUpsell ? '3.2fr 1.3fr' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Column: Form & Table */}
        <div className="odoo-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Metadata Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid #E2E8F0' }}>
            {/* Customer Dropdown */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                Customer <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                className="odoo-input"
                value={selectedCustomerId}
                onChange={(e) => handleCustomerChange(Number(e.target.value))}
                style={{ fontWeight: 600, color: '#1F2937' }}
              >
                {customerList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.tier} Tier — Max {c.maxDiscountPct}%)
                  </option>
                ))}
              </select>
              <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="odoo-badge" style={{ backgroundColor: currentCustomer.tier === 'Gold' ? '#FEF3C7' : currentCustomer.tier === 'Silver' ? '#F1F5F9' : '#FFEDD5', color: currentCustomer.tier === 'Gold' ? '#B45309' : '#475569' }}>
                  {currentCustomer.tier} Tier (Max {currentCustomer.maxDiscountPct}% Dis.)
                </span>
                <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{currentCustomer.email}</span>
              </div>
            </div>

            {/* Quotation Date */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                Quotation Date
              </label>
              <input
                type="date"
                className="odoo-input"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
              />
            </div>

            {/* Expiration Date */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                Expiration Date
              </label>
              <input
                type="date"
                className="odoo-input"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>

            {/* Payment Terms */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                Payment Terms
              </label>
              <select
                className="odoo-input"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
              >
                <option value="Immediate Payment">Immediate Payment</option>
                <option value="Net 15 Days">Net 15 Days</option>
                <option value="Net 30 Days">Net 30 Days</option>
                <option value="Net 60 Days">Net 60 Days</option>
                <option value="End of Following Month">End of Following Month</option>
              </select>
            </div>
          </div>

          {/* Live Dynamic Margin & Risk Governance Engine Bar */}
          <div
            style={{
              backgroundColor: '#F8F9FA',
              padding: '0.85rem 1.25rem',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            {/* Live Gross Margin */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: grossMarginPercent >= 30 ? '#059669' : grossMarginPercent >= 15 ? '#D97706' : '#EF4444',
                }}
              />
              <div>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569' }}>Live Margin: </span>
                <span style={{ fontWeight: 800, color: '#714B67', fontSize: '0.9375rem' }}>
                  {grossMarginPercent}% Gross Margin
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748B', marginLeft: '0.4rem' }}>
                  (Est. Cost: ₹{Math.round(totalCost).toLocaleString('en-IN')})
                </span>
              </div>
            </div>

            {/* Live Blended Risk Score & Route Prediction */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>Blended Risk Score:</span>
              <span
                className="odoo-badge"
                style={{
                  backgroundColor: blendedRiskScore === 0 ? '#DCFCE7' : blendedRiskScore <= 12 ? '#FEF3C7' : '#FEE2E2',
                  color: blendedRiskScore === 0 ? '#15803D' : blendedRiskScore <= 12 ? '#B45309' : '#B91C1C',
                  fontWeight: 700,
                }}
              >
                {blendedRiskScore}% {blendedRiskScore === 0 ? '(Within Tier Limits)' : '(Threshold Exceeded)'}
              </span>

              <span
                className="odoo-badge"
                style={{
                  backgroundColor: '#714B67',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                }}
              >
                Route: {requiresFinance ? 'Manager + Finance Approval' : requiresManager ? 'Manager Approval' : 'Auto-Approve'}
              </span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #E2E8F0' }}>
            <button
              onClick={() => setActiveTab('lines')}
              style={{
                padding: '0.5rem 1rem',
                fontWeight: 700,
                fontSize: '0.875rem',
                color: activeTab === 'lines' ? '#714B67' : '#64748B',
                borderBottom: activeTab === 'lines' ? '2px solid #714B67' : 'none',
                marginBottom: -2,
                cursor: 'pointer',
              }}
            >
              Order Lines ({lines.length})
            </button>
            <button
              onClick={() => setActiveTab('info')}
              style={{
                padding: '0.5rem 1rem',
                fontWeight: 700,
                fontSize: '0.875rem',
                color: activeTab === 'info' ? '#714B67' : '#64748B',
                borderBottom: activeTab === 'info' ? '2px solid #714B67' : 'none',
                marginBottom: -2,
                cursor: 'pointer',
              }}
            >
              Other Information
            </button>
          </div>

          {/* TAB 1: Order Lines Table */}
          {activeTab === 'lines' ? (
            <div>
              <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                <table className="odoo-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '22%' }}>Product</th>
                      <th style={{ width: '22%' }}>Description</th>
                      <th style={{ width: '11%', textAlign: 'center' }}>Quantity</th>
                      <th style={{ width: '14%' }}>Unit Price (₹)</th>
                      <th style={{ width: '13%' }}>Discount (%)</th>
                      <th style={{ width: '8%' }}>Taxes</th>
                      <th style={{ width: '14%', textAlign: 'right' }}>Amount</th>
                      <th style={{ width: '4%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const isDiscountExceeded = line.discount > line.allowedDiscount;
                      const lineCost = (line.costPrice && line.costPrice > 0 ? line.costPrice : line.unitPrice * 0.65) * line.quantity;
                      const lineMargin = line.total > 0 ? Math.round(((line.total - lineCost) / line.total) * 100) : 35;

                      return (
                        <tr key={line.id}>
                          {/* Product & Category */}
                          <td>
                            <div style={{ fontWeight: 700, color: '#1F2937', fontSize: '0.8125rem' }}>
                              {line.productName}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                              <span
                                className="odoo-badge"
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '0.1rem 0.4rem',
                                  backgroundColor:
                                    line.category === 'Hardware'
                                      ? '#EFF6FF'
                                      : line.category === 'Subscriptions'
                                      ? '#FAF5FF'
                                      : line.category === 'Services'
                                      ? '#ECFDF5'
                                      : '#FFFBEB',
                                  color:
                                    line.category === 'Hardware'
                                      ? '#1D4ED8'
                                      : line.category === 'Subscriptions'
                                      ? '#7E22CE'
                                      : line.category === 'Services'
                                      ? '#047857'
                                      : '#B45309',
                                }}
                              >
                                {line.category}
                              </span>
                              <span style={{ fontSize: '0.65rem', color: lineMargin >= 30 ? '#059669' : '#D97706', fontWeight: 600 }}>
                                {lineMargin}% margin
                              </span>
                            </div>
                          </td>

                          {/* Description */}
                          <td>
                            <input
                              type="text"
                              className="odoo-input"
                              value={line.description}
                              onChange={(e) => handleDescriptionChange(line.id, e.target.value)}
                              style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
                            />
                          </td>

                          {/* Quantity */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                              <button
                                type="button"
                                className="odoo-btn odoo-btn-secondary"
                                style={{ padding: '0.15rem 0.45rem', fontSize: '0.75rem' }}
                                onClick={() => handleQuantityChange(line.id, -1)}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={1}
                                className="odoo-input"
                                value={line.quantity}
                                onChange={(e) => handleQuantityInput(line.id, parseInt(e.target.value) || 1)}
                                style={{ width: 48, textAlign: 'center', padding: '0.25rem 0.2rem', fontSize: '0.8125rem', fontWeight: 600 }}
                              />
                              <button
                                type="button"
                                className="odoo-btn odoo-btn-secondary"
                                style={{ padding: '0.15rem 0.45rem', fontSize: '0.75rem' }}
                                onClick={() => handleQuantityChange(line.id, 1)}
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Unit Price */}
                          <td>
                            <input
                              type="number"
                              min={0}
                              className="odoo-input"
                              value={line.unitPrice}
                              onChange={(e) => handleUnitPriceChange(line.id, parseFloat(e.target.value) || 0)}
                              style={{ fontSize: '0.8125rem', fontWeight: 600, padding: '0.3rem 0.5rem', minWidth: 90 }}
                            />
                          </td>

                          {/* Discount % with Tier warning */}
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                className="odoo-input"
                                value={line.discount}
                                onChange={(e) => handleDiscountChange(line.id, parseFloat(e.target.value) || 0)}
                                style={{
                                  fontSize: '0.8125rem',
                                  fontWeight: 600,
                                  padding: '0.3rem 0.5rem',
                                  borderColor: isDiscountExceeded ? '#EF4444' : '#CBD5E1',
                                  backgroundColor: isDiscountExceeded ? '#FEF2F2' : '#FFFFFF',
                                }}
                              />
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  color: isDiscountExceeded ? '#DC2626' : '#64748B',
                                }}
                              >
                                Max {line.allowedDiscount}% {isDiscountExceeded && '(Exceeded)'}
                              </span>
                            </div>
                          </td>

                          {/* Taxes */}
                          <td>
                            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                              GST {line.taxPercent}%
                            </span>
                          </td>

                          {/* Amount */}
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#1F2937', fontSize: '0.875rem' }}>
                            ₹{Math.round(line.total).toLocaleString('en-IN')}
                          </td>

                          {/* Delete */}
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleDeleteLine(line.id)}
                              style={{ color: '#EF4444', fontSize: '1rem', cursor: 'pointer', padding: '0.2rem' }}
                              title="Delete line"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add a line buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                <button
                  type="button"
                  className="odoo-btn odoo-btn-secondary"
                  onClick={() => setShowCatalogModal(true)}
                  style={{ color: '#714B67', borderColor: '#714B67', fontWeight: 700 }}
                >
                  + Add a Product from Catalog
                </button>
                <button
                  type="button"
                  className="odoo-btn odoo-btn-secondary"
                  onClick={() => {
                    const customLine: QuotationLine = {
                      id: `ql-custom-${Date.now()}`,
                      productId: 'prod-custom',
                      productName: 'Custom Solution Line',
                      category: 'Services',
                      description: 'Custom implementation or consultative line',
                      quantity: 1,
                      unitPrice: 15000,
                      costPrice: 9000,
                      discount: 0,
                      allowedDiscount: currentCustomer.maxDiscountPct,
                      taxPercent: 18,
                      total: 15000,
                    };
                    setLines((prev) => [...prev, customLine]);
                  }}
                >
                  + Add Custom Line
                </button>
              </div>

              {/* Totals Summary */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E2E8F0', paddingTop: '1.25rem' }}>
                <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                    <span>Untaxed Amount (Subtotal):</span>
                    <span style={{ fontWeight: 600, color: '#1F2937' }}>
                      ₹{Math.round(untaxedAmount).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {totalDiscountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                      <span>Total Discount Savings:</span>
                      <span style={{ fontWeight: 600 }}>
                        - ₹{Math.round(totalDiscountAmount).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                    <span>Taxes (18% GST):</span>
                    <span style={{ fontWeight: 600, color: '#1F2937' }}>
                      ₹{Math.round(taxAmount).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 800,
                      fontSize: '1.15rem',
                      color: '#714B67',
                      borderTop: '2px solid #714B67',
                      paddingTop: '0.6rem',
                      marginTop: '0.2rem',
                    }}
                  >
                    <span>Total Amount:</span>
                    <span>₹{Math.round(totalAmount).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: Other Information */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', padding: '0.5rem 0' }}>
              <div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1F2937', marginBottom: '1rem' }}>
                  Sales Information
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748B', marginBottom: '0.25rem' }}>
                      Salesperson
                    </label>
                    <input
                      type="text"
                      className="odoo-input"
                      value={salesRepName}
                      onChange={(e) => setSalesRepName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748B', marginBottom: '0.25rem' }}>
                      Sales Team
                    </label>
                    <input
                      type="text"
                      className="odoo-input"
                      value={salesTeam}
                      onChange={(e) => setSalesTeam(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748B', marginBottom: '0.25rem' }}>
                      Customer PO / Reference
                    </label>
                    <input
                      type="text"
                      className="odoo-input"
                      placeholder="e.g. PO-2026-9921"
                      value={clientOrderRef}
                      onChange={(e) => setClientOrderRef(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1F2937', marginBottom: '1rem' }}>
                  Fiscal & Terms
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748B', marginBottom: '0.25rem' }}>
                      Fiscal Position
                    </label>
                    <input
                      type="text"
                      className="odoo-input"
                      value={fiscalPosition}
                      onChange={(e) => setFiscalPosition(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748B', marginBottom: '0.25rem' }}>
                      Terms & Conditions / Internal Notes
                    </label>
                    <textarea
                      rows={4}
                      className="odoo-input"
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Screen B5 AI Upsell & Cross-Sell Panel */}
        {showUpsell && (
          <div className="odoo-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '1.1rem' }}>💡</span>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937' }}>
                  AI Upsell & Recommendations
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUpsell(false)}
                style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600, cursor: 'pointer' }}
              >
                Hide
              </button>
            </div>

            <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>
              Live co-purchase pairings and promotions tailored for <strong>{currentCustomer.name}</strong>:
            </p>

            {upsellSuggestions.map((item) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: 8,
                  padding: '0.75rem',
                  backgroundColor: '#F8F9FA',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#1F2937' }}>
                    {item.name}
                  </span>
                  <span
                    className="odoo-badge"
                    style={{
                      fontSize: '0.65rem',
                      backgroundColor: item.badge === 'PROMO' ? '#FEF3C7' : item.badge === 'HIGH MARGIN' ? '#DCFCE7' : '#EFF6FF',
                      color: item.badge === 'PROMO' ? '#B45309' : item.badge === 'HIGH MARGIN' ? '#15803D' : '#1D4ED8',
                    }}
                  >
                    {item.badge}
                  </span>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                  {item.reason}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#714B67' }}>
                    ₹{item.price.toLocaleString('en-IN')}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>
                    {item.marginImpact} margin
                  </span>
                </div>

                <button
                  type="button"
                  className="odoo-btn odoo-btn-primary"
                  style={{ width: '100%', fontSize: '0.75rem', padding: '0.35rem', marginTop: '0.3rem' }}
                  onClick={() => handleAddUpsell(item.name, item.price, item.category, item.reason)}
                >
                  + Add to Quote
                </button>
              </div>
            ))}

            <div style={{ backgroundColor: '#F1F5F9', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.7rem', color: '#64748B' }}>
              ℹ️ Adding suggestions updates the gross margin indicator and re-evaluates approval governance in real time.
            </div>
          </div>
        )}
      </div>

      {/* Product Catalog Picker Modal */}
      {showCatalogModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 300,
            padding: '1rem',
          }}
        >
          <div
            className="odoo-card"
            style={{
              width: '100%',
              maxWidth: 760,
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1F2937' }}>
                  Select Product from Catalog
                </h2>
                <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>
                  Showing active products, SKUs, pricing, and category ceilings for {currentCustomer.name} ({currentCustomer.tier} Tier)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                style={{ fontSize: '1.25rem', color: '#64748B', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <input
                type="text"
                className="odoo-input"
                placeholder="Search products by title or SKU..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                style={{ flex: 1 }}
              />
              <select
                className="odoo-input"
                value={catalogCategoryFilter}
                onChange={(e) => setCatalogCategoryFilter(e.target.value)}
                style={{ width: 160 }}
              >
                <option value="All">All Categories</option>
                <option value="Hardware">Hardware</option>
                <option value="Accessories">Accessories</option>
                <option value="Services">Services</option>
                <option value="Subscriptions">Subscriptions</option>
              </select>
            </div>

            {/* Products List */}
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: 420 }}>
              {filteredCatalog.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                  No matching products found in catalog.
                </div>
              ) : (
                filteredCatalog.map((prod: any) => {
                  const allowedCeiling = getCategoryDiscountCeiling(prod.category, currentCustomer.tier);
                  const price = Number(prod.salesPrice || prod.basePrice || prod.base_price || 0);
                  const cost = Number(prod.costPrice || prod.cost_price || (price > 0 ? price * 0.65 : 0));

                  return (
                    <div
                      key={prod.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        border: '1px solid #E2E8F0',
                        borderRadius: 8,
                        backgroundColor: '#FFFFFF',
                        transition: 'background-color 150ms ease',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1F2937' }}>
                            {prod.name}
                          </span>
                          <span className="odoo-badge" style={{ fontSize: '0.65rem' }}>
                            {prod.category}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#64748B', fontFamily: 'monospace' }}>
                            {prod.sku}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>
                          {prod.description}
                        </p>
                        <div style={{ fontSize: '0.7rem', color: '#059669', marginTop: '0.2rem' }}>
                          ✓ Max discount for {currentCustomer.tier} Tier: <strong>{allowedCeiling}%</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginLeft: '1rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#714B67' }}>
                            ₹{price.toLocaleString('en-IN')}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                            Cost: ₹{cost.toLocaleString('en-IN')}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="odoo-btn odoo-btn-primary"
                          onClick={() => handleAddProductFromCatalog(prod)}
                        >
                          + Select
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E2E8F0', paddingTop: '0.75rem' }}>
              <button
                type="button"
                className="odoo-btn odoo-btn-secondary"
                onClick={() => setShowCatalogModal(false)}
              >
                Close Catalog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

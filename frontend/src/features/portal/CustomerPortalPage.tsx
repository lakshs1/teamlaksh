import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDealFlowStore, type PortalChatMessage } from '../../stores/dealflowStore';
import { useAuthStore } from '../../stores/authStore';
import { portalApi, catalogApi } from '../../services/apiServices';
import toast from 'react-hot-toast';

export default function CustomerPortalPage() {
  const navigate = useNavigate();
  const { portalToken, id } = useParams<{ portalToken?: string; id?: string }>();
  const activeToken = portalToken || id;

  const { user, logout } = useAuthStore();
  const { portalMessages, setPortalMessages, addPortalMessage } = useDealFlowStore();

  // Tab State: 'quotation' vs 'catalog'
  const [activeTab, setActiveTab] = useState<'quotation' | 'catalog'>('quotation');

  // Quotation & Chat State
  const [localMessages, setLocalMessages] = useState<PortalChatMessage[]>(() => {
    try {
      const cached = localStorage.getItem(`dealflow_portal_chat_${activeToken || 'active'}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return portalMessages;
  });

  const [inputMsg, setInputMsg] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [counterDiscount, setCounterDiscount] = useState('10');
  const [counterType, setCounterType] = useState<'customer' | 'rep'>('customer');
  const [counterNote, setCounterNote] = useState('');
  const [liveQuote, setLiveQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Catalog Browsing State
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [inquirySuccess, setInquirySuccess] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isStaff = Boolean(
    user?.role &&
    ['rep', 'sales rep', 'manager', 'sales manager', 'admin', 'finance', 'operations'].includes(user.role.toLowerCase())
  );

  const customerName = user?.name || liveQuote?.customer_name || 'Customer Account';
  const customerEmail = user?.email || liveQuote?.customer_email || 'No registered email';
  const initial = customerName.charAt(0).toUpperCase();

  const quoteLines = liveQuote?.lines || liveQuote?.items || [];
  const displayMessages = localMessages.length > 0 ? localMessages : portalMessages;

  const latestCounterMsg = displayMessages
    .slice()
    .reverse()
    .find((m) => m.counterDiscountPct !== undefined && m.counterDiscountPct !== null && m.counterDiscountPct > 0);
  const isLatestFromRep = latestCounterMsg?.authorType === 'rep' || latestCounterMsg?.sender === 'Sales Rep';
  const isLatestFromCust = Boolean(latestCounterMsg && !isLatestFromRep);

  useEffect(() => {
    if (activeTab === 'quotation') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayMessages, activeTab]);

  // 1. Fetch live quote data
  const loadQuoteData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    const tokenToFetch =
      activeToken && activeToken !== 'active'
        ? activeToken
        : (user as any)?.portal_token || (user as any)?.portalToken || null;

    const storeQuotes = useDealFlowStore.getState().quotations;
    const matchingStoreQuote = storeQuotes.find(
      (q) =>
        (tokenToFetch && (q as any).portal_token === tokenToFetch) ||
        (tokenToFetch && (q as any).portalToken === tokenToFetch) ||
        (tokenToFetch && q.id === tokenToFetch) ||
        (tokenToFetch && q.reference === tokenToFetch) ||
        (user?.email && q.customerName?.toLowerCase().includes(user.email.split('@')[0].toLowerCase())) ||
        (user?.name && q.customerName?.toLowerCase().includes(user.name.toLowerCase()))
    );

    if (matchingStoreQuote) {
      const storeGross = matchingStoreQuote.lines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0);
      const storeDiscAmt = matchingStoreQuote.lines.reduce((acc, l) => acc + l.quantity * l.unitPrice * (l.discount / 100), 0);
      const storeDiscPct = storeGross > 0 ? Number(((storeDiscAmt / storeGross) * 100).toFixed(1)) : 0;

      setLiveQuote({
        id: matchingStoreQuote.id,
        reference: matchingStoreQuote.reference,
        portal_token: (matchingStoreQuote as any).portal_token || (matchingStoreQuote as any).portalToken || matchingStoreQuote.id,
        customer_name: matchingStoreQuote.customerName,
        customer_tier: matchingStoreQuote.customerTier,
        status: matchingStoreQuote.status,
        date: matchingStoreQuote.date,
        expires_at: matchingStoreQuote.expiryDate,
        subtotal: storeGross,
        total_discount: storeDiscAmt,
        discount_pct: storeDiscPct,
        untaxed_amount: matchingStoreQuote.untaxedAmount,
        tax_amount: matchingStoreQuote.taxAmount,
        total_amount: matchingStoreQuote.totalAmount,
        lines: matchingStoreQuote.lines.map((l) => ({
          id: l.id,
          product_name: l.productName,
          category: l.category,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unitPrice,
          discount_pct: l.discount,
          total: l.total,
        })),
      });
    }

    try {
      if (!tokenToFetch && !matchingStoreQuote) {
        setLoading(false);
        return;
      }
      const res = await portalApi.getPortalQuote(tokenToFetch || 'active');
      const data = res?.data || res;
      if (data) {
        const displayStatus =
          data.status === 'pending_manager' || data.status === 'pending_finance'
            ? 'Pending Approval'
            : data.status === 'fulfillment'
            ? 'Confirmed'
            : data.status ? data.status.charAt(0).toUpperCase() + data.status.slice(1) : 'Sent';

        const rawSubtotal = Number(data.subtotal || data.untaxed_amount || 0);
        const rawDiscount = Number(data.total_discount || data.discount_amount || 0);
        const rawTax = Number(data.total_tax || data.tax_amount || 0);
        const rawGrand = Number(data.grand_total || data.total_amount || 0);
        const rawLines = Array.isArray(data.lines) ? data.lines : [];

        const computedDiscountPct =
          data.discount_pct !== undefined && data.discount_pct !== null && Number(data.discount_pct) > 0
            ? Number(data.discount_pct)
            : rawSubtotal > 0 && rawDiscount > 0
            ? Number(((rawDiscount / rawSubtotal) * 100).toFixed(1))
            : rawLines.length > 0 && rawLines.some((l: any) => Number(l.discount_pct || l.discountPct || l.discount || 0) > 0)
            ? Number(
                (
                  rawLines.reduce(
                    (acc: number, l: any) =>
                      acc +
                      Number(l.discount_pct || l.discountPct || l.discount || 0) *
                        (Number(l.unit_price || l.unitPrice || 0) * Number(l.quantity || 1)),
                    0
                  ) /
                  Math.max(
                    1,
                    rawLines.reduce(
                      (acc: number, l: any) =>
                        acc + Number(l.unit_price || l.unitPrice || 0) * Number(l.quantity || 1),
                      0
                    )
                  )
                ).toFixed(1)
              )
            : 0;

        setLiveQuote({
          ...data,
          subtotal: rawSubtotal,
          total_discount: rawDiscount,
          total_tax: rawTax,
          grand_total: rawGrand,
          discount_pct: computedDiscountPct,
          status: displayStatus,
        });

        if (data.comments && Array.isArray(data.comments)) {
          const mappedMsgs: PortalChatMessage[] = data.comments.map((c: any) => {
            const isCust = c.author_type === 'customer';
            const timeStr = c.created_at
              ? new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Just now';
            return {
              id: `pc-${c.id}`,
              sender: isCust ? 'Customer' : 'Sales Rep',
              senderName: c.author_name || (isCust ? 'Customer' : 'Sales Team'),
              timestamp: timeStr,
              text: c.message,
              counterDiscountPct: c.counter_discount_pct !== undefined && c.counter_discount_pct !== null ? Number(c.counter_discount_pct) : null,
              authorType: c.author_type || (isCust ? 'customer' : 'rep'),
            };
          });

          setLocalMessages(mappedMsgs);
          setPortalMessages(mappedMsgs);

          try {
            localStorage.setItem(`dealflow_portal_chat_${tokenToFetch}`, JSON.stringify(mappedMsgs));
            if (data.portal_token) {
              localStorage.setItem(`dealflow_portal_chat_${data.portal_token}`, JSON.stringify(mappedMsgs));
            }
            if (data.id) {
              localStorage.setItem(`dealflow_portal_chat_${data.id}`, JSON.stringify(mappedMsgs));
            }
          } catch {}
        }
      }
    } catch (err: any) {
      console.warn('Portal quote fetch failed:', err?.message);
      setErrorMsg('No active quotation available.');
    } finally {
      setLoading(false);
    }
  }, [activeToken, user, setPortalMessages]);

  // 2. Fetch public product catalog
  const loadCatalogData = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        catalogApi.getProducts({ limit: 100 }),
        catalogApi.getCategories(),
      ]);
      const pData = prodRes?.data || prodRes || [];
      const cData = catRes?.data || catRes || [];
      if (Array.isArray(pData)) setCatalogProducts(pData);
      if (Array.isArray(cData)) setCategories(cData);
    } catch (err: any) {
      console.warn('Failed to load catalog for customer portal:', err?.message);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuoteData();
    loadCatalogData();
  }, [loadQuoteData, loadCatalogData]);

  // Handle sending chat message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || isSending) return;

    const newMsgText = inputMsg.trim();
    setInputMsg('');
    setIsSending(true);

    const isSenderRep = isStaff;
    const senderRoleName = isSenderRep ? (user?.name || 'Sales Representative') : customerName;
    const authorType = isSenderRep ? 'rep' : 'customer';

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const localNewMsg: PortalChatMessage = {
      id: `msg-${Date.now()}`,
      sender: isSenderRep ? 'Sales Rep' : 'Customer',
      senderName: senderRoleName,
      timestamp: timeStr,
      text: newMsgText,
      authorType,
    };

    const updated = [...localMessages, localNewMsg];
    setLocalMessages(updated);
    addPortalMessage(newMsgText, isSenderRep ? 'Sales Rep' : 'Customer');

    const tokenToUse = liveQuote?.portal_token || activeToken || 'active';
    try {
      localStorage.setItem(`dealflow_portal_chat_${tokenToUse}`, JSON.stringify(updated));
    } catch {}

    try {
      await portalApi.postComment(tokenToUse, {
        message: newMsgText,
        author_name: senderRoleName,
        author_type: authorType,
      });
      await loadQuoteData();
    } catch (err: any) {
      console.error('Failed to persist comment on server:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Handle accepting quotation offer
  const handleAcceptOffer = async () => {
    try {
      const tokenToUse = liveQuote?.portal_token || activeToken || 'active';
      const res = await portalApi.confirmPortalQuote(tokenToUse);
      const discountNote = latestCounterMsg?.counterDiscountPct ? ` at ${latestCounterMsg.counterDiscountPct}% discount` : '';
      toast.success(res?.message || `Quotation Accepted${discountNote}! Routed to warehouse fulfillment.`);
      await loadQuoteData();
    } catch (err: any) {
      console.error('Failed to confirm quote:', err);
      toast.error(err?.response?.data?.message || 'Failed to accept quotation');
    }
  };

  // Handle submitting counter offer discount
  const handleSendCounter = async () => {
    setShowCounterModal(false);
    const counterVal = parseFloat(counterDiscount);
    if (isNaN(counterVal) || counterVal <= 0 || counterVal > 100) {
      toast.error('Please enter a valid counter discount percentage between 1 and 100.');
      return;
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tokenToUse = liveQuote?.portal_token || activeToken || 'active';

    const isRepCounter = counterType === 'rep' || isStaff;
    const authorName = isRepCounter ? (user?.name || 'Sales Representative') : customerName;
    const authorType = isRepCounter ? 'rep' : 'customer';
    const messageText = counterNote.trim()
      ? counterNote.trim()
      : isRepCounter
      ? `Sales Team counter-proposal: Offering ${counterVal}% discount on order lines.`
      : `Counter-proposal submitted: Requesting ${counterVal}% discount on order lines.`;

    const counterProposalMsg: PortalChatMessage = {
      id: `msg-${Date.now()}`,
      sender: isRepCounter ? 'Sales Rep' : 'Customer',
      senderName: authorName,
      timestamp: timeStr,
      text: messageText,
      counterDiscountPct: counterVal,
      authorType,
    };

    const updatedWithCounter = [...localMessages, counterProposalMsg];
    setLocalMessages(updatedWithCounter);
    addPortalMessage(counterProposalMsg.text, isRepCounter ? 'Sales Rep' : 'Customer');

    try {
      localStorage.setItem(`dealflow_portal_chat_${tokenToUse}`, JSON.stringify(updatedWithCounter));
    } catch {}

    toast.success(
      isRepCounter
        ? `Sales counter-offer of ${counterVal}% proposed to customer!`
        : `Counter proposal of ${counterVal}% discount submitted!`
    );

    try {
      await portalApi.postComment(tokenToUse, {
        message: messageText,
        counter_discount_pct: counterVal,
        author_name: authorName,
        author_type: authorType,
      });
      setCounterNote('');
      await loadQuoteData();
    } catch (err: any) {
      console.error('Failed to submit counter proposal:', err);
      toast.error(err?.response?.data?.message || 'Failed to submit counter proposal');
    }
  };

  // Handle inquiry from catalog
  const handleInquireProduct = (prod: any) => {
    const priceFormatted = Number(prod.basePrice || prod.base_price || 0).toLocaleString('en-IN');
    if (liveQuote) {
      setActiveTab('quotation');
      setInputMsg(`Hi, I'm interested in adding "${prod.name}" (Price: ₹${priceFormatted}) to our quotation. Could you please provide details and quantity options?`);
      toast.success(`Inquiry draft ready! Click Send in live negotiation.`);
    } else {
      setInquirySuccess(prod.name);
      toast.success(`Inquiry noted for ${prod.name}! Your sales representative will include this in your upcoming proposal.`);
      setTimeout(() => setInquirySuccess(null), 6000);
    }
  };

  // Filtered products in catalog
  const filteredProducts = catalogProducts.filter((p) => {
    const matchesCategory =
      selectedCategory === 'all' ||
      p.categoryId?.toString() === selectedCategory ||
      p.category?.name === selectedCategory ||
      p.category_id?.toString() === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={{ backgroundColor: '#F8F9FA', minHeight: '100vh', padding: '1rem', fontFamily: 'Inter, sans-serif' }}>
      {/* Top Header & Brand Bar */}
      <header
        style={{
          maxWidth: 1100,
          margin: '0 auto 1rem auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FFFFFF',
          padding: '0.6rem 1.25rem',
          borderRadius: 8,
          border: '1px solid #E2E8F0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
          <span style={{ fontWeight: 800, color: '#714B67', fontSize: '1.2rem', letterSpacing: '-0.5px' }}>odoo</span>
          <span style={{ color: '#64748B', fontWeight: 600 }}>Customer Portal</span>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => {
              logout();
              toast.success('Signed out from Customer Portal');
              navigate('/login');
            }}
            className="odoo-btn odoo-btn-secondary"
            style={{ padding: '0.35rem 0.85rem', fontSize: '0.8125rem', cursor: 'pointer' }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Customer Profile Banner */}
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto 1.25rem auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FFFFFF',
          padding: '1rem 1.5rem',
          borderRadius: 12,
          border: '1px solid #E2E8F0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#714B67', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.2rem' }}>
            {initial}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1F2937' }}>{customerName}</div>
            <div style={{ fontSize: '0.8125rem', color: '#64748B' }}>{customerEmail} • Customer Portal View</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {liveQuote?.customer_quotes && Array.isArray(liveQuote.customer_quotes) && liveQuote.customer_quotes.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Quotation:</span>
              <select
                className="odoo-select"
                value={liveQuote?.portal_token || liveQuote?.id}
                onChange={(e) => {
                  const selectedToken = e.target.value;
                  navigate(`/portal/${selectedToken}`);
                }}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: 6, border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', color: '#1F2937', fontWeight: 600 }}
              >
                {liveQuote.customer_quotes.map((cq: any) => (
                  <option key={cq.id} value={cq.portal_token || cq.id}>
                    {cq.quote_number} (₹{Math.round(cq.grand_total).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          )}
          <span className="odoo-badge" style={{ background: '#714B67', color: '#FFF', padding: '0.3rem 0.8rem' }}>
            {liveQuote?.status ? `Status: ${liveQuote.status}` : 'Bronze Tier Account'}
          </span>
        </div>
      </div>

      {/* Primary Navigation Tabs: Quotation vs Catalog */}
      <div style={{ maxWidth: 1100, margin: '0 auto 1.25rem auto', display: 'flex', gap: '0.5rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('quotation')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.2rem',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 700,
            backgroundColor: activeTab === 'quotation' ? '#714B67' : 'transparent',
            color: activeTab === 'quotation' ? '#FFFFFF' : '#64748B',
            transition: 'all 150ms ease',
          }}
        >
          <span>📑</span>
          <span>My Quotations & Negotiation</span>
          {liveQuote && (
            <span
              style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.45rem',
                borderRadius: 10,
                backgroundColor: activeTab === 'quotation' ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
                color: activeTab === 'quotation' ? '#FFF' : '#475569',
              }}
            >
              {liveQuote.status || 'Active'}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.2rem',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 700,
            backgroundColor: activeTab === 'catalog' ? '#714B67' : 'transparent',
            color: activeTab === 'catalog' ? '#FFFFFF' : '#64748B',
            transition: 'all 150ms ease',
          }}
        >
          <span>🛍️</span>
          <span>Browse Product Catalogs</span>
          <span
            style={{
              fontSize: '0.7rem',
              padding: '0.15rem 0.45rem',
              borderRadius: 10,
              backgroundColor: activeTab === 'catalog' ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
              color: activeTab === 'catalog' ? '#FFF' : '#475569',
            }}
          >
            {catalogProducts.length} Products
          </span>
        </button>
      </div>

      {/* TAB 1: QUOTATION & LIVE NEGOTIATION */}
      {activeTab === 'quotation' && (
        <>
          {/* Empty State when no quotation exists */}
          {!loading && !liveQuote ? (
            <div
              className="odoo-card"
              style={{
                maxWidth: 760,
                margin: '2rem auto',
                padding: '3.5rem 2rem',
                textAlign: 'center',
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  backgroundColor: '#F5EEF4',
                  color: '#714B67',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.8rem',
                  margin: '0 auto 1.25rem auto',
                }}
              >
                📋
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1F2937', marginBottom: '0.5rem' }}>
                No Active Quotation Published Yet
              </h2>
              <p style={{ fontSize: '0.925rem', color: '#64748B', lineHeight: 1.6, maxWidth: 520, margin: '0 auto 1.75rem auto' }}>
                Welcome, <strong>{customerName}</strong>. Your account is active, but your Sales Representative has not published an active proposal for your account yet. You can explore available enterprise solutions and indicate interest in products below.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                <button
                  onClick={() => setActiveTab('catalog')}
                  className="odoo-btn odoo-btn-primary"
                  style={{ padding: '0.65rem 1.3rem', fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  Browse Product Catalogs ↗
                </button>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
              {/* 1. Staff Mode Banner: Rep / Manager accessing portal */}
              {isStaff && (
                <div
                  style={{
                    backgroundColor: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: 10,
                    padding: '0.85rem 1.25rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>👁️</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1E40AF', fontSize: '0.875rem' }}>
                        Sales Team Portal Preview Mode ({user?.name || 'Sales Rep'} • {user?.role || 'Staff'})
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#3B82F6' }}>
                        You are viewing the interactive customer portal. You can negotiate and propose counter-offers directly to the customer.
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      className="odoo-btn odoo-btn-primary"
                      onClick={() => {
                        setCounterType('rep');
                        setCounterDiscount('5');
                        setShowCounterModal(true);
                      }}
                      style={{ fontSize: '0.8125rem', padding: '0.4rem 0.85rem' }}
                    >
                      ⚡ Propose Counter-Offer to Customer
                    </button>
                    {liveQuote?.id && (
                      <button
                        className="odoo-btn odoo-btn-secondary"
                        onClick={() => navigate(`/quotations/${liveQuote.id}`)}
                        style={{ fontSize: '0.8125rem', padding: '0.4rem 0.85rem' }}
                      >
                        ← Back to Quotation Details
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 2. Customer Action Banner: Sales Rep proposed a counter-offer */}
              {!isStaff && isLatestFromRep && latestCounterMsg && (
                <div
                  style={{
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #86EFAC',
                    borderRadius: 10,
                    padding: '1rem 1.25rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, color: '#166534', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>🎉</span> Special Revised Offer: Sales Team Proposes {latestCounterMsg.counterDiscountPct}% Discount!
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#15803D', marginTop: '0.25rem' }}>
                      "{latestCounterMsg.text}"
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      className="odoo-btn odoo-btn-primary"
                      onClick={handleAcceptOffer}
                      style={{ backgroundColor: '#15803D', borderColor: '#15803D', fontWeight: 700 }}
                    >
                      ✓ Accept {latestCounterMsg.counterDiscountPct}% Offer & Proceed
                    </button>
                    <button
                      className="odoo-btn odoo-btn-secondary"
                      onClick={() => {
                        setCounterType('customer');
                        setCounterDiscount(String(latestCounterMsg.counterDiscountPct || 10));
                        setShowCounterModal(true);
                      }}
                    >
                      Counter Again
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Customer Status Notice: Counter-Offer Lifecycle */}
              {!isStaff && isLatestFromCust && latestCounterMsg && (
                liveQuote?.status === 'approved' ? (
                  <div
                    style={{
                      backgroundColor: '#F0FDF4',
                      border: '1px solid #86EFAC',
                      borderRadius: 10,
                      padding: '1rem 1.25rem',
                      marginBottom: '1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, color: '#166534', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>✅</span> Counter-Offer Approved! Sales Team Accepted Your {latestCounterMsg.counterDiscountPct}% Discount
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: '#15803D', marginTop: '0.25rem' }}>
                        Your requested concession has been applied to this quotation. Accept below to proceed to order fulfillment.
                      </div>
                    </div>
                    <button
                      className="odoo-btn odoo-btn-primary"
                      onClick={handleAcceptOffer}
                      style={{ backgroundColor: '#15803D', borderColor: '#15803D', fontWeight: 700 }}
                    >
                      ✓ Accept Quotation Terms
                    </button>
                  </div>
                ) : (liveQuote?.status === 'fulfillment' || liveQuote?.status === 'confirmed' || liveQuote?.status === 'invoiced') ? (
                  <div
                    style={{
                      backgroundColor: '#EFF6FF',
                      border: '1px solid #93C5FD',
                      borderRadius: 10,
                      padding: '0.85rem 1.25rem',
                      marginBottom: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>📦</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1D4ED8', fontSize: '0.875rem' }}>
                        Order Confirmed & In Fulfillment
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#2563EB' }}>
                        This quotation terms were confirmed and converted into an active fulfillment order.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      backgroundColor: '#FFFBEB',
                      border: '1px solid #FCD34D',
                      borderRadius: 10,
                      padding: '0.85rem 1.25rem',
                      marginBottom: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ fontSize: '0.8125rem', color: '#92400E' }}>
                      ⏳ Your counter-proposal requesting <strong>{latestCounterMsg.counterDiscountPct}% discount</strong> is currently pending review by your Sales Representative / Manager.
                    </div>
                    <button
                      className="odoo-btn odoo-btn-secondary"
                      onClick={() => {
                        setCounterType('customer');
                        setShowCounterModal(true);
                      }}
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                    >
                      Adjust Counter
                    </button>
                  </div>
                )
              )}

              {/* Main Quotation Grid: Chat / Negotiation left, Summary right */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                {/* Left Chat / Messages & Line Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Live Quotation Products Card */}
                <div className="odoo-card">
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.75rem' }}>
                    Quotation Line Items & Available Products
                  </h3>
                  {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B', fontSize: '0.875rem' }}>
                      Fetching live backend data...
                    </div>
                  ) : quoteLines.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#F8F9FA', borderRadius: 8, border: '1px dashed #CBD5E1' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
                        No Products Registered
                      </div>
                      <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0 }}>
                        No quotation lines are registered for this reference.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {quoteLines.map((line: any, idx: number) => {
                        const lineQty = Number(line.quantity || 1);
                        const lineUnitPrice = Number(line.unit_price || line.unitPrice || 0);
                        const lineDiscPct = Number(line.discount_pct ?? line.discountPct ?? line.discount ?? 0);
                        const lineGross = lineQty * lineUnitPrice;
                        const lineDiscAmt = Number(line.discount_amount || line.discountAmount || (lineGross * (lineDiscPct / 100)));
                        const lineNet = Number(line.line_total || line.total || (lineGross - lineDiscAmt));

                        return (
                          <div
                            key={line.id || idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.85rem 1rem',
                              background: '#F8FAFC',
                              borderRadius: 8,
                              border: '1px solid #E2E8F0',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937' }}>
                                {line.product_name || line.productName || 'Item'}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                <span>Qty: {lineQty} • Unit Price: ₹{lineUnitPrice.toLocaleString()}</span>
                                {lineDiscPct > 0 && (
                                  <span
                                    style={{
                                      backgroundColor: '#DCFCE7',
                                      color: '#15803D',
                                      padding: '0.1rem 0.45rem',
                                      borderRadius: 4,
                                      fontWeight: 600,
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    {lineDiscPct}% off (-₹{Math.round(lineDiscAmt).toLocaleString()})
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#714B67' }}>
                                ₹{Math.round(lineNet).toLocaleString()}
                              </div>
                              {lineDiscPct > 0 && (
                                <div style={{ fontSize: '0.75rem', color: '#94A3B8', textDecoration: 'line-through' }}>
                                  ₹{Math.round(lineGross).toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Chat Card: Live Line-Item Negotiation */}
                <div className="odoo-card" style={{ display: 'flex', flexDirection: 'column', height: 420 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>
                        Live Line-Item Negotiation
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0.2rem 0 0 0' }}>
                        Ask line level questions or request counter discounts directly with your sales manager
                      </p>
                    </div>
                    <span className="odoo-badge" style={{ backgroundColor: '#F1F5F9', color: '#475569', fontSize: '0.7rem' }}>
                      {displayMessages.length} messages
                    </span>
                  </div>

                  {/* Messages Area */}
                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '0.75rem',
                      background: '#FFFFFF',
                      borderRadius: 8,
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    {displayMessages.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.8125rem', marginTop: 'auto', marginBottom: 'auto' }}>
                        No messages yet. Type below to start live negotiation.
                      </div>
                    ) : (
                      displayMessages.map((m) => {
                        const isMe = isStaff
                          ? (m.sender === 'Sales Rep' || m.authorType === 'rep')
                          : (m.sender === 'Customer' || m.authorType === 'customer');
                        const hasDiscount = m.counterDiscountPct !== undefined && m.counterDiscountPct !== null && m.counterDiscountPct > 0;
                        return (
                          <div
                            key={m.id}
                            style={{
                              alignSelf: isMe ? 'flex-end' : 'flex-start',
                              maxWidth: '78%',
                              backgroundColor: isMe ? '#714B67' : hasDiscount ? '#FFFBEB' : '#F1F5F9',
                              border: hasDiscount ? '1px solid #FCD34D' : 'none',
                              color: isMe ? '#FFFFFF' : '#1F2937',
                              padding: '0.65rem 0.9rem',
                              borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                              fontSize: '0.8125rem',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            }}
                          >
                            <div style={{ fontSize: '0.7rem', opacity: isMe ? 0.9 : 0.75, marginBottom: '0.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                              <span>{m.senderName}</span>
                              {hasDiscount && (
                                <span style={{ backgroundColor: '#F59E0B', color: '#FFF', padding: '0.1rem 0.35rem', borderRadius: 4, fontSize: '0.65rem' }}>
                                  Counter: {m.counterDiscountPct}%
                                </span>
                              )}
                              <span>{m.timestamp}</span>
                            </div>
                            <div style={{ wordBreak: 'break-word', lineHeight: 1.4 }}>{m.text}</div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input form */}
                  <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="odoo-input"
                      placeholder={isStaff ? "Type a reply or counter note to customer..." : "Type a message or negotiation note..."}
                      value={inputMsg}
                      onChange={(e) => setInputMsg(e.target.value)}
                      disabled={isSending}
                      style={{ flex: 1, fontSize: '0.8125rem', padding: '0.5rem 0.75rem' }}
                    />
                    <button
                      type="submit"
                      className="odoo-btn odoo-btn-primary"
                      disabled={isSending || !inputMsg.trim()}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
                    >
                      {isSending ? 'Sending...' : 'Send'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column: Terms & Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="odoo-card">
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '1rem' }}>
                    Current Offer Terms
                  </h3>

                  {(() => {
                    const quoteSubtotal = Number(liveQuote?.subtotal || liveQuote?.untaxed_amount || 0);
                    const quoteDiscountAmt = Number(liveQuote?.total_discount || liveQuote?.discount_amount || 0);
                    const quoteTaxAmt = Number(liveQuote?.total_tax || liveQuote?.tax_amount || 0);
                    const quoteGrandTotal = Number(
                      liveQuote?.grand_total || liveQuote?.total_amount || (quoteSubtotal - quoteDiscountAmt + quoteTaxAmt)
                    );

                    const lineAvgDiscount =
                      quoteLines.length > 0
                        ? quoteLines.reduce((acc: number, l: any) => acc + Number(l.discount_pct || l.discountPct || l.discount || 0), 0) /
                          quoteLines.length
                        : 0;

                    const effectiveDiscountPct = Number(
                      liveQuote?.discount_pct !== undefined && liveQuote?.discount_pct !== null && Number(liveQuote.discount_pct) > 0
                        ? liveQuote.discount_pct
                        : quoteSubtotal > 0 && quoteDiscountAmt > 0
                        ? ((quoteDiscountAmt / quoteSubtotal) * 100).toFixed(1)
                        : lineAvgDiscount > 0
                        ? lineAvgDiscount.toFixed(1)
                        : 0
                    );

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                        {quoteSubtotal > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748B' }}>Gross Subtotal:</span>
                            <span style={{ fontWeight: 600, color: '#475569' }}>
                              ₹{Math.round(quoteSubtotal).toLocaleString()}
                            </span>
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#64748B' }}>Applied Discount:</span>
                          <span
                            style={{
                              fontWeight: 700,
                              color: effectiveDiscountPct > 0 ? '#059669' : '#64748B',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              flexWrap: 'wrap',
                              justifyContent: 'flex-end',
                            }}
                          >
                            {effectiveDiscountPct > 0 ? (
                              <>
                                <span style={{ backgroundColor: '#DCFCE7', color: '#15803D', padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.75rem' }}>
                                  {effectiveDiscountPct}% OFF
                                </span>
                                {quoteDiscountAmt > 0 && <span>(-₹{Math.round(quoteDiscountAmt).toLocaleString()})</span>}
                              </>
                            ) : (
                              '0%'
                            )}
                          </span>
                        </div>

                        {quoteTaxAmt > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748B' }}>Estimated Tax (18%):</span>
                            <span style={{ fontWeight: 600, color: '#475569' }}>
                              +₹{Math.round(quoteTaxAmt).toLocaleString()}
                            </span>
                          </div>
                        )}

                        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '0.6rem', marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ color: '#1F2937', fontWeight: 600 }}>Total Amount:</span>
                          <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#714B67' }}>
                            ₹{Math.round(quoteGrandTotal).toLocaleString()}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          <span style={{ color: '#64748B' }}>Validity:</span>
                          <span style={{ fontWeight: 600, color: '#475569' }}>
                            {liveQuote?.expires_at ? `Valid till ${new Date(liveQuote.expires_at).toLocaleDateString()}` : 'Valid for 30 Days'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {isStaff ? (
                      <>
                        <button
                          className="odoo-btn odoo-btn-primary"
                          onClick={() => {
                            setCounterType('rep');
                            setCounterDiscount('5');
                            setShowCounterModal(true);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          ⚡ Propose Sales Counter-Offer
                        </button>
                        {liveQuote?.id && (
                          <button
                            className="odoo-btn odoo-btn-secondary"
                            onClick={() => navigate(`/quotations/${liveQuote.id}`)}
                            style={{ cursor: 'pointer' }}
                          >
                            ← Back to Quotation Details
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          className="odoo-btn odoo-btn-primary"
                          onClick={handleAcceptOffer}
                          style={{ cursor: 'pointer' }}
                        >
                          {isLatestFromRep && latestCounterMsg
                            ? `✓ Accept Sales Offer (${latestCounterMsg.counterDiscountPct}% Off)`
                            : 'Accept Offer'}
                        </button>
                        <button
                          className="odoo-btn odoo-btn-secondary"
                          onClick={() => {
                            setCounterType('customer');
                            setCounterDiscount(String(latestCounterMsg?.counterDiscountPct || 10));
                            setShowCounterModal(true);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          Counter Offer
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </>
      )}

      {/* TAB 2: BROWSE PRODUCT CATALOG */}
      {activeTab === 'catalog' && (
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header Card with Search & Filters */}
          <div className="odoo-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1F2937', marginBottom: '0.25rem' }}>
                  Enterprise Product & Solution Catalog
                </h2>
                <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0 }}>
                  Browse available hardware, servers, cloud infrastructure, and software subscriptions available for enterprise quotation.
                </p>
              </div>

              {/* Search Bar */}
              <div style={{ minWidth: 280, flex: 1, maxWidth: 420 }}>
                <input
                  type="text"
                  className="odoo-input"
                  placeholder="🔍 Search catalog products or descriptions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
              <button
                onClick={() => setSelectedCategory('all')}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: 20,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: selectedCategory === 'all' ? '#714B67' : '#E2E8F0',
                  backgroundColor: selectedCategory === 'all' ? '#714B67' : '#FFFFFF',
                  color: selectedCategory === 'all' ? '#FFFFFF' : '#475569',
                }}
              >
                All Products ({catalogProducts.length})
              </button>
              {categories.map((c: any) => {
                const isSelected = selectedCategory === c.id?.toString() || selectedCategory === c.name;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id?.toString() || c.name)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: 20,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: isSelected ? '#714B67' : '#E2E8F0',
                      backgroundColor: isSelected ? '#714B67' : '#FFFFFF',
                      color: isSelected ? '#FFFFFF' : '#475569',
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Success Banner if inquiry made */}
          {inquirySuccess && (
            <div style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '0.75rem 1.25rem', borderRadius: 8, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>✓ Inquiry recorded for <strong>{inquirySuccess}</strong>. Your sales manager will attach this to your upcoming proposal.</span>
              <button onClick={() => setInquirySuccess(null)} style={{ background: 'none', border: 'none', color: '#065F46', fontWeight: 700, cursor: 'pointer' }}>✕</button>
            </div>
          )}

          {/* Products Grid */}
          {catalogLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
              Loading enterprise catalog items...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="odoo-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔍</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1F2937' }}>No matching products found</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748B' }}>Try adjusting your search terms or clearing category filters.</p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                className="odoo-btn odoo-btn-secondary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', marginTop: '0.5rem', cursor: 'pointer' }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {filteredProducts.map((prod: any) => {
                const categoryName = prod.category?.name || categories.find((c: any) => c.id === prod.categoryId)?.name || 'General';
                const price = Number(prod.basePrice || prod.base_price || 0);
                return (
                  <div
                    key={prod.id}
                    className="odoo-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'transform 150ms ease, box-shadow 150ms ease',
                      border: '1px solid #E2E8F0',
                      borderRadius: 10,
                      padding: '1.25rem',
                      backgroundColor: '#FFFFFF',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div>
                      {/* Top Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#714B67', backgroundColor: 'rgba(113, 75, 103, 0.08)', padding: '0.2rem 0.55rem', borderRadius: 4 }}>
                          {categoryName}
                        </span>
                        {prod.isRecurring || prod.is_recurring ? (
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0D9488', backgroundColor: 'rgba(13, 148, 136, 0.1)', padding: '0.2rem 0.55rem', borderRadius: 4 }}>
                            Recurring / {prod.recurringInterval || prod.recurring_interval || 'Monthly'}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', backgroundColor: '#F1F5F9', padding: '0.2rem 0.55rem', borderRadius: 4 }}>
                            One-Time Purchase
                          </span>
                        )}
                      </div>

                      {/* Product Name & Description */}
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.4rem', lineHeight: 1.3 }}>
                        {prod.name}
                      </h3>
                      <p style={{ fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.5, minHeight: '2.5rem', marginBottom: '1rem' }}>
                        {prod.description || 'Enterprise grade solution configured for high reliability and scale.'}
                      </p>
                    </div>

                    {/* Bottom Pricing & Action */}
                    <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1F2937' }}>
                          ₹{price.toLocaleString('en-IN')}
                          <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>
                            {prod.unit ? ` / ${prod.unit}` : ''}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                          Standard Base Price
                        </div>
                      </div>

                      <button
                        onClick={() => handleInquireProduct(prod)}
                        className="odoo-btn odoo-btn-primary"
                        style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        Inquire in Quote ↗
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Counter offer modal */}
      {showCounterModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFF', padding: '1.5rem', borderRadius: 12, width: 440, maxWidth: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#1F2937' }}>
                {counterType === 'rep' || isStaff ? '⚡ Propose Sales Counter-Offer' : 'Submit Counter Offer'}
              </h3>
              <button
                onClick={() => setShowCounterModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.4rem', color: '#475569' }}>
                {counterType === 'rep' || isStaff ? 'Offered Counter Discount (%)' : 'Requested Discount (%)'}
              </label>
              <input
                type="number"
                min="0.5"
                max="100"
                step="0.5"
                className="odoo-input"
                value={counterDiscount}
                onChange={(e) => setCounterDiscount(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.4rem', color: '#475569' }}>
                Negotiation Note / Reason (Optional)
              </label>
              <textarea
                className="odoo-input"
                rows={3}
                placeholder={
                  counterType === 'rep' || isStaff
                    ? 'e.g., We can offer 5% enterprise concession if closed this quarter.'
                    : 'e.g., Requesting 10% volume discount for annual commitment.'
                }
                value={counterNote}
                onChange={(e) => setCounterNote(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <p style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '1.25rem', lineHeight: 1.4 }}>
              {counterType === 'rep' || isStaff
                ? 'This counter-offer will be sent directly to the customer portal chat thread. If discount is within policy, status remains Approved; if it exceeds tier limits, it routes to the Sales Manager.'
                : 'Submitting a counter discount will automatically re-route this proposal through internal Sales Manager & Finance approvals.'}
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="odoo-btn odoo-btn-secondary" onClick={() => setShowCounterModal(false)} style={{ cursor: 'pointer' }}>
                Cancel
              </button>
              <button className="odoo-btn odoo-btn-primary" onClick={handleSendCounter} style={{ cursor: 'pointer' }}>
                {counterType === 'rep' || isStaff ? 'Send Sales Counter-Offer' : 'Submit Counter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

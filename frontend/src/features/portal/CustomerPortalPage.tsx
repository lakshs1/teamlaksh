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

  const customerName = user?.name || liveQuote?.customer_name || 'Customer Account';
  const customerEmail = user?.email || liveQuote?.customer_email || 'No registered email';
  const initial = customerName.charAt(0).toUpperCase();

  const quoteLines = liveQuote?.lines || liveQuote?.items || [];
  const displayMessages = localMessages.length > 0 ? localMessages : portalMessages;

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
      setLiveQuote({
        id: matchingStoreQuote.id,
        reference: matchingStoreQuote.reference,
        portal_token: (matchingStoreQuote as any).portal_token || (matchingStoreQuote as any).portalToken || matchingStoreQuote.id,
        customer_name: matchingStoreQuote.customerName,
        customer_tier: matchingStoreQuote.customerTier,
        status: matchingStoreQuote.status,
        date: matchingStoreQuote.date,
        expires_at: matchingStoreQuote.expiryDate,
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

        setLiveQuote({
          ...data,
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

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const localNewMsg: PortalChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'Customer',
      senderName: customerName,
      timestamp: timeStr,
      text: newMsgText,
    };

    const updated = [...localMessages, localNewMsg];
    setLocalMessages(updated);
    addPortalMessage(newMsgText, 'Customer');

    const tokenToUse = liveQuote?.portal_token || activeToken || 'active';
    try {
      localStorage.setItem(`dealflow_portal_chat_${tokenToUse}`, JSON.stringify(updated));
    } catch {}

    try {
      await portalApi.postComment(tokenToUse, {
        message: newMsgText,
        author_name: customerName,
        author_type: 'customer',
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
      await portalApi.confirmPortalQuote(tokenToUse);
      toast.success('Quotation Accepted! Fulfillment and confirmation scheduled.');
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

    const counterProposalMsg: PortalChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'Customer',
      senderName: customerName,
      timestamp: timeStr,
      text: `Counter-proposal submitted: Requesting ${counterVal}% discount on order lines.`,
    };

    const updatedWithCounter = [...localMessages, counterProposalMsg];
    setLocalMessages(updatedWithCounter);
    addPortalMessage(counterProposalMsg.text, 'Customer');

    try {
      localStorage.setItem(`dealflow_portal_chat_${tokenToUse}`, JSON.stringify(updatedWithCounter));
    } catch {}

    toast.success(`Counter proposal of ${counterVal}% discount submitted!`);

    try {
      await portalApi.postComment(tokenToUse, {
        message: `Counter-proposal submitted: Requesting ${counterVal}% discount on order lines.`,
        counter_discount_pct: counterVal,
        author_name: customerName,
        author_type: 'customer',
      });
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
            /* Main Quotation Grid: Chat / Negotiation left, Summary right */
            <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {quoteLines.map((line: any, idx: number) => (
                        <div
                          key={line.id || idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.75rem',
                            background: '#F8FAFC',
                            borderRadius: 6,
                            border: '1px solid #E2E8F0',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937' }}>
                              {line.product_name || line.productName || 'Item'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                              Qty: {line.quantity} • Unit Price: ₹{(line.unit_price || line.unitPrice || 0).toLocaleString()}
                            </div>
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#714B67' }}>
                            ₹{(line.line_total || line.total || (line.quantity * (line.unit_price || line.unitPrice || 0))).toLocaleString()}
                          </div>
                        </div>
                      ))}
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
                        const isMe = m.sender === 'Customer';
                        return (
                          <div
                            key={m.id}
                            style={{
                              alignSelf: isMe ? 'flex-end' : 'flex-start',
                              maxWidth: '75%',
                              backgroundColor: isMe ? '#714B67' : '#F1F5F9',
                              color: isMe ? '#FFFFFF' : '#1F2937',
                              padding: '0.6rem 0.85rem',
                              borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                              fontSize: '0.8125rem',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            }}
                          >
                            <div style={{ fontSize: '0.7rem', opacity: 0.85, marginBottom: '0.2rem', fontWeight: 600 }}>
                              {m.senderName} • {m.timestamp}
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
                      placeholder="Type a message or negotiation note..."
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

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Total Amount:</span>
                      <span style={{ fontWeight: 700, color: '#1F2937' }}>
                        ₹{(liveQuote?.grand_total || liveQuote?.total_amount || 0).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Applied Discount:</span>
                      <span style={{ fontWeight: 600, color: '#059669' }}>
                        {liveQuote?.discount_pct ? `${liveQuote.discount_pct}%` : '0%'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Validity:</span>
                      <span style={{ fontWeight: 600 }}>
                        {liveQuote?.expires_at ? `Valid till ${new Date(liveQuote.expires_at).toLocaleDateString()}` : 'Valid till 10/6/2026'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button className="odoo-btn odoo-btn-primary" onClick={handleAcceptOffer} style={{ cursor: 'pointer' }}>
                      Accept Offer
                    </button>
                    <button className="odoo-btn odoo-btn-secondary" onClick={() => setShowCounterModal(true)} style={{ cursor: 'pointer' }}>
                      Counter Offer
                    </button>
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
          <div style={{ background: '#FFF', padding: '1.5rem', borderRadius: 12, width: 400, maxWidth: '90%' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#1F2937' }}>
              Submit Counter Offer
            </h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.4rem', color: '#475569' }}>
                Requested Discount (%)
              </label>
              <input
                type="number"
                className="odoo-input"
                value={counterDiscount}
                onChange={(e) => setCounterDiscount(e.target.value)}
              />
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '1.25rem' }}>
              Submitting a counter discount will automatically re-route this proposal through internal Sales Manager & Finance approvals.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="odoo-btn odoo-btn-secondary" onClick={() => setShowCounterModal(false)} style={{ cursor: 'pointer' }}>
                Cancel
              </button>
              <button className="odoo-btn odoo-btn-primary" onClick={handleSendCounter} style={{ cursor: 'pointer' }}>
                Submit Counter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useDealFlowStore, type PortalChatMessage } from '../../stores/dealflowStore';
import { useAuthStore } from '../../stores/authStore';
import { portalApi } from '../../services/apiServices';
import toast from 'react-hot-toast';

export default function CustomerPortalPage() {
  const { portalToken, id } = useParams<{ portalToken?: string; id?: string }>();
  const activeToken = portalToken || id;

  const { user } = useAuthStore();
  const { portalMessages, setPortalMessages, addPortalMessage } = useDealFlowStore();

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

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const customerName = user?.name || liveQuote?.customer_name || 'Customer Account';
  const customerEmail = user?.email || liveQuote?.customer_email || 'No registered email';
  const initial = customerName.charAt(0).toUpperCase();

  const quoteLines = liveQuote?.lines || liveQuote?.items || [];

  const displayMessages = localMessages.length > 0 ? localMessages : portalMessages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages]);

  const loadQuoteData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    // 1. Check if any quotation matches in the active Zustand store
    const storeQuotes = useDealFlowStore.getState().quotations;
    const matchingStoreQuote = storeQuotes.find(
      (q) =>
        (q as any).portal_token === activeToken ||
        (q as any).portalToken === activeToken ||
        q.id === activeToken ||
        q.reference === activeToken ||
        (user?.name && q.customerName?.toLowerCase().includes(user.name.toLowerCase())) ||
        (user?.email && user.email.includes('odoo') && q.customerName?.toLowerCase().includes('odoo'))
    ) || (activeToken === 'active' && storeQuotes.length > 0 ? storeQuotes[0] : null);

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

    // 2. Fetch live data & persisted comments from backend
    try {
      const tokenToFetch = activeToken || 'active';
      const res = await portalApi.getPortalQuote(tokenToFetch);
      const data = res?.data || res;
      if (data) {
        // Map backend quote status for display
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

        // Sync persisted comments from the database
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
      console.warn("Portal quote fetch failed:", err?.message);
      setErrorMsg('Failed to load live quote data.');
    } finally {
      setLoading(false);
    }
  }, [activeToken, user, setPortalMessages]);

  useEffect(() => {
    loadQuoteData();
  }, [loadQuoteData]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || isSending) return;
    const msgToSend = inputMsg.trim();
    setInputMsg('');
    setIsSending(true);

    const tokenToUse = liveQuote?.portal_token || activeToken || 'active';

    // Optimistic message update
    const optimisticMsg: PortalChatMessage = {
      id: `opt-${Date.now()}`,
      sender: 'Customer',
      senderName: customerName || 'Customer',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: msgToSend,
    };
    setLocalMessages((prev) => [...prev, optimisticMsg]);
    addPortalMessage(msgToSend, 'Customer');

    try {
      await portalApi.postComment(tokenToUse, {
        message: msgToSend,
        author_name: customerName,
        author_type: 'customer',
      });
      // Re-fetch to get the official database-persisted record
      await loadQuoteData();
      toast.success('Message sent to sales team');
    } catch (err: any) {
      console.error("Failed to post comment", err);
      toast.error(err?.response?.data?.message || 'Failed to post comment');
    } finally {
      setIsSending(false);
    }
  };

  const handleAcceptOffer = async () => {
    const tokenToUse = liveQuote?.portal_token || activeToken || 'active';
    try {
      const res = await portalApi.confirmPortalQuote(tokenToUse);
      toast.success(res?.message || res?.data?.message || 'Quotation confirmed! Moving to order fulfillment.');
      addPortalMessage('Quotation accepted and digitally signed by Customer.', 'Sales Rep');
      if (liveQuote) {
        setLiveQuote({ ...liveQuote, status: 'Confirmed' });
      }
      await loadQuoteData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to confirm quotation');
    }
  };

  const handleSendCounter = async () => {
    setShowCounterModal(false);
    const counterPct = Number(counterDiscount);
    const msg = `Counter-proposal submitted: Requesting ${counterPct}% discount on order lines.`;

    const tokenToUse = liveQuote?.portal_token || activeToken || 'active';

    // Optimistic message update
    const optimisticMsg: PortalChatMessage = {
      id: `opt-${Date.now()}`,
      sender: 'Customer',
      senderName: customerName || 'Customer',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: msg,
    };
    setLocalMessages((prev) => [...prev, optimisticMsg]);
    addPortalMessage(msg, 'Customer');

    try {
      // 1. Post Customer Counter-Discount Comment to database
      await portalApi.postComment(tokenToUse, {
        message: msg,
        counter_discount_pct: counterPct,
        author_name: customerName,
        author_type: 'customer',
      });

      // 2. Submit & Confirm Quote with Counter-Offer to re-enter approval flow
      const confirmRes = await portalApi.confirmPortalQuote(tokenToUse);
      const statusMsg = confirmRes?.data?.message || confirmRes?.message || 'Counter proposal submitted! Quotation automatically re-entered approval flow for review.';
      toast.success(statusMsg);

      if (liveQuote) {
        setLiveQuote({
          ...liveQuote,
          status: 'Pending Approval',
          discount_pct: counterPct,
        });
      }

      // Re-fetch to get updated comments & status from backend database
      await loadQuoteData();
    } catch (err: any) {
      console.error("Failed to submit counter proposal:", err);
      toast.error(err?.response?.data?.message || 'Failed to submit counter proposal');
    }
  };

  return (
    <div style={{ backgroundColor: '#F8F9FA', minHeight: '100vh', padding: '1rem', fontFamily: 'Inter, sans-serif' }}>
      {/* Top Exit Navigation Bar */}
      <div
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
          <span style={{ fontWeight: 800, color: '#714B67' }}>odoo</span>
          <span style={{ color: '#64748B' }}>Customer Portal Mode</span>
        </div>
        <button
          onClick={() => {
            const { logout } = useAuthStore.getState();
            logout();
            toast.success('Signed out from Customer Portal');
            window.location.href = '/';
          }}
          className="odoo-btn odoo-btn-secondary"
          style={{ padding: '0.3rem 0.8rem', fontSize: '0.8125rem' }}
        >
          Exit Portal / Sign Out
        </button>
      </div>

      {/* Main Banner */}
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto 1.5rem auto',
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
        <span className="odoo-badge" style={{ background: '#714B67', color: '#FFF', padding: '0.3rem 0.8rem' }}>
          {liveQuote?.status ? `Status: ${liveQuote.status}` : 'Active Portal Session'}
        </span>
      </div>

      {/* Main Grid: Chat / Negotiation left, Summary right */}
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
                  No Products Found
                </div>
                <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0 }}>
                  No products or quotation lines are registered for this reference or region.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {quoteLines.map((line: any, idx: number) => (
                  <div
                    key={line.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      border: '1px solid #E2E8F0',
                      borderRadius: 6,
                      fontSize: '0.8125rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#1F2937' }}>{line.product_name || line.productName || `Product #${line.product_id}`}</div>
                      <div style={{ color: '#64748B', fontSize: '0.75rem' }}>Qty: {line.quantity} • Unit Price: ₹{Number(line.unit_price || line.unitPrice || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: '#714B67' }}>
                      ₹{Number(line.total || (line.quantity * (line.unit_price || line.unitPrice || 0))).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Negotiation Chat */}
          <div className="odoo-card" style={{ display: 'flex', flexDirection: 'column', height: 440 }}>
            <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid #E2E8F0', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Live Line-Item Negotiation
                  {displayMessages.length > 0 && (
                    <span
                      style={{
                        backgroundColor: '#EDE9FE',
                        color: '#6D28D9',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: 12,
                      }}
                    >
                      {displayMessages.length} message{displayMessages.length > 1 ? 's' : ''}
                    </span>
                  )}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  Ask line level questions or request counter discounts directly with your sales manager
                </span>
              </div>
            </div>

            {/* Messages list */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.5rem' }}>
              {displayMessages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.8125rem', margin: 'auto' }}>
                  No messages yet. Type below to start live negotiation.
                </div>
              ) : (
                displayMessages.map((msg) => {
                  const isCustomer = msg.sender === 'Customer';
                  const isSystemOrCounter = msg.text.toLowerCase().includes('counter') || msg.text.toLowerCase().includes('status');
                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: isCustomer ? 'flex-end' : 'flex-start',
                        maxWidth: '82%',
                        backgroundColor: isCustomer ? '#714B67' : isSystemOrCounter ? '#F5F3FF' : '#F1F5F9',
                        color: isCustomer ? '#FFFFFF' : '#1F2937',
                        border: isCustomer ? 'none' : isSystemOrCounter ? '1px solid #DDD6FE' : '1px solid #E2E8F0',
                        padding: '0.75rem 1rem',
                        borderRadius: 12,
                        fontSize: '0.8125rem',
                        lineHeight: 1.5,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.7rem',
                          opacity: isCustomer ? 0.85 : 0.75,
                          marginBottom: '0.25rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <span>{msg.senderName}</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Form */}
            <form onSubmit={handleSendMessage} style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="odoo-input"
                placeholder="Type a message or negotiation note..."
                value={inputMsg}
                disabled={isSending}
                onChange={(e) => setInputMsg(e.target.value)}
              />
              <button
                type="submit"
                className="odoo-btn odoo-btn-primary"
                disabled={isSending || !inputMsg.trim()}
                style={{ minWidth: 80 }}
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>

        </div>

        {/* Right Offer Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="odoo-card">
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '1rem' }}>
              Current Offer Terms
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Total Amount:</span>
                <span style={{ fontWeight: 700, color: '#1F2937' }}>
                  {liveQuote?.total_amount ? `₹${Number(liveQuote.total_amount).toLocaleString('en-IN')}` : '₹0'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Applied Discount:</span>
                <span style={{ fontWeight: 700, color: '#714B67' }}>
                  {liveQuote?.discount_pct ? `${liveQuote.discount_pct}%` : '0%'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Validity:</span>
                <span style={{ fontWeight: 600 }}>
                  {liveQuote?.expires_at ? `Valid till ${new Date(liveQuote.expires_at).toLocaleDateString()}` : 'No Expiry Date'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button className="odoo-btn odoo-btn-primary" onClick={handleAcceptOffer}>
                Accept Offer
              </button>
              <button className="odoo-btn odoo-btn-secondary" onClick={() => setShowCounterModal(true)}>
                Counter Offer
              </button>
            </div>
          </div>
        </div>
      </div>

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
              <button className="odoo-btn odoo-btn-secondary" onClick={() => setShowCounterModal(false)}>
                Cancel
              </button>
              <button className="odoo-btn odoo-btn-primary" onClick={handleSendCounter}>
                Submit Counter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

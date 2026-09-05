import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDealFlowStore } from '../../stores/dealflowStore';
import { useAuthStore } from '../../stores/authStore';
import { portalApi, quoteApi } from '../../services/apiServices';
import toast from 'react-hot-toast';

export default function CustomerPortalPage() {
  const { portalToken, id } = useParams<{ portalToken?: string; id?: string }>();
  const activeToken = portalToken || id;

  const { user } = useAuthStore();
  const { portalMessages, addPortalMessage } = useDealFlowStore();

  const [inputMsg, setInputMsg] = useState('');
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [counterDiscount, setCounterDiscount] = useState('10');
  const [liveQuote, setLiveQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const customerName = user?.name || liveQuote?.customer_name || 'Customer Account';
  const customerEmail = user?.email || liveQuote?.customer_email || 'No registered email';
  const initial = customerName.charAt(0).toUpperCase();

  const quoteLines = liveQuote?.lines || liveQuote?.items || [];

  useEffect(() => {
    async function loadQuoteData() {
      if (!activeToken) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setErrorMsg(null);
      try {
        // ✅ Public fetch using portalToken (No JWT required)
        const res = await portalApi.getPortalQuote(activeToken);
        if (res?.data) {
          setLiveQuote(res.data);
        } else if (res) {
          setLiveQuote(res);
        }
      } catch (err: any) {
        console.error("Failed to load portal quote", err);
        setErrorMsg(err?.response?.data?.message || 'Quotation magic link is invalid or expired.');
      } finally {
        setLoading(false);
      }
    }
    loadQuoteData();
  }, [activeToken]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    const msgToSend = inputMsg;
    setInputMsg('');
    addPortalMessage(msgToSend, 'Customer');
    
    const tokenToUse = liveQuote?.portal_token || activeToken;
    if (tokenToUse) {
      try {
        await portalApi.postComment(tokenToUse, { message: msgToSend });
      } catch (err) {
        console.error("Failed to post comment", err);
      }
    }
  };

  const handleAcceptOffer = async () => {
    const tokenToUse = liveQuote?.portal_token || activeToken;
    if (tokenToUse) {
      try {
        await portalApi.confirmPortalQuote(tokenToUse);
        toast.success('Quotation confirmed! Moving to order fulfillment.');
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Failed to confirm quotation');
      }
    }
  };

  const handleSendCounter = async () => {
    setShowCounterModal(false);
    const msg = `Counter-proposal submitted: Requesting ${counterDiscount}% discount on order lines.`;
    addPortalMessage(msg, 'Customer');
    const tokenToUse = liveQuote?.portal_token || activeToken;
    if (tokenToUse) {
      try {
        await portalApi.postComment(tokenToUse, { message: msg, counter_discount_pct: Number(counterDiscount) });
        toast.success(`Counter proposal submitted! Quotation automatically re-entered approval flow for review.`);
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Failed to submit counter proposal');
      }
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
          <div className="odoo-card" style={{ display: 'flex', flexDirection: 'column', height: 420 }}>
            <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid #E2E8F0', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937' }}>Live Line-Item Negotiation</h3>
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Ask line level questions or request counter discounts directly with your sales manager</span>
            </div>

            {/* Messages list */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingRight: '0.5rem' }}>
              {portalMessages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.8125rem', margin: 'auto' }}>
                  No messages yet. Type below to start live negotiation.
                </div>
              ) : (
                portalMessages.map((msg) => {
                  const isCustomer = msg.sender === 'Customer';
                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: isCustomer ? 'flex-end' : 'flex-start',
                        maxWidth: '75%',
                        backgroundColor: isCustomer ? '#714B67' : '#F1F5F9',
                        color: isCustomer ? '#FFFFFF' : '#1F2937',
                        padding: '0.75rem 1rem',
                        borderRadius: 12,
                        fontSize: '0.8125rem',
                        lineHeight: 1.5,
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '0.2rem', fontWeight: 600 }}>
                        {msg.senderName} • {msg.timestamp}
                      </div>
                      <div>{msg.text}</div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSendMessage} style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="odoo-input"
                placeholder="Type a message or negotiation note..."
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
              />
              <button type="submit" className="odoo-btn odoo-btn-primary">
                Send
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

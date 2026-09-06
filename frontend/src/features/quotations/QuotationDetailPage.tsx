import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { quoteApi, recommendationApi, portalApi } from '../../services/apiServices';
import { mapQuote } from '../../services/dataMappers';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

export default function QuotationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upsellSuggestions, setUpsellSuggestions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'lines' | 'negotiation' | 'audit' | 'info'>('lines');
  const [showUpsell, setShowUpsell] = useState(true);
  const [replyMsg, setReplyMsg] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [submittingCounter, setSubmittingCounter] = useState(false);
  const [showRepCounterModal, setShowRepCounterModal] = useState(false);
  const [repCounterDiscount, setRepCounterDiscount] = useState('5');
  const [repCounterNote, setRepCounterNote] = useState('');

  const fetchQuoteData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await quoteApi.getQuoteDetails(id);
      setQuote(mapQuote(res.data));
      
      try {
        const recRes = await recommendationApi.getSuggestions(id);
        const suggestions = recRes.data?.items ?? recRes.data ?? [];
        setUpsellSuggestions(suggestions);
      } catch (e) {
        // Fallback or ignore if recommendations fail
      }
    } catch (err: any) {
      toast.error('Failed to load quotation details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuoteData();
  }, [id]);

  if (loading) {
    return <div className="odoo-container"><div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div></div>;
  }

  if (!quote) {
    return <div className="odoo-container"><div style={{ padding: '2rem', textAlign: 'center' }}>Quotation not found</div></div>;
  }

  // Compute total revenue and cost to derive margin
  const totalRevenue = quote.untaxedAmount;
  const totalCost = quote.lines.reduce((acc: number, line: any) => acc + (line.unitPrice * 0.7) * line.quantity, 0);
  const marginPercent = totalRevenue > 0 ? Math.round(((totalRevenue - totalCost) / totalRevenue) * 100) : 35;
  const isDraft = quote.status === 'Draft';
  const isLocked = ['Invoiced', 'Confirmed', 'Done', 'Cancelled'].includes(quote.status);
  const canEdit = !isLocked;

  const handleQtyChange = async (lineId: string, currentQty: number, delta: number) => {
    if (isLocked) {
      toast.error(`Cannot edit items on a quote with status '${quote.status}'`);
      return;
    }
    const newQty = Math.max(1, currentQty + delta);
    try {
      await quoteApi.updateLine(quote.id, lineId, { quantity: newQty });
      toast.success('Quantity updated');
      fetchQuoteData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update quantity');
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    if (isLocked) {
      toast.error(`Cannot delete items on a quote with status '${quote.status}'`);
      return;
    }
    if (confirm('Are you sure you want to delete this line?')) {
      try {
        await quoteApi.deleteLine(quote.id, lineId);
        toast.success('Line deleted');
        fetchQuoteData();
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Failed to delete line');
      }
    }
  };

  const handleAddUpsellItem = async (productId: number | string, isUpsell: boolean = true) => {
    if (isLocked) {
      toast.error(`Cannot add items to a quote with status '${quote.status}'`);
      return;
    }
    try {
      const pId = typeof productId === 'string' ? parseInt(productId.replace(/\D/g, '')) || 1 : productId;
      await quoteApi.addLine(quote.id, {
        product_id: pId,
        quantity: 1,
        is_upsell: isUpsell,
      });
      toast.success('Item added to quote');
      fetchQuoteData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add item');
    }
  };

  const comments = quote.comments || [];
  const auditLogs = quote.auditTrail || [];

  // Find latest counter proposal in comments
  const latestCounterComment = comments
    .slice()
    .reverse()
    .find((c: any) => (c.counterDiscountPct || c.counter_discount_pct) && Number(c.counterDiscountPct || c.counter_discount_pct) > 0);

  const isFromCustomer = latestCounterComment && (
    latestCounterComment.authorType === 'customer' ||
    latestCounterComment.author_type === 'customer' ||
    latestCounterComment.sender === 'Customer'
  );

  const counterPct = latestCounterComment ? Number(latestCounterComment.counterDiscountPct || latestCounterComment.counter_discount_pct) : 0;

  // First principles check: Has this counter-offer already been accepted or resolved?
  // 1. All quote lines already have this discount applied (within small precision epsilon)
  const linesAlreadyDiscounted = quote.lines.length > 0 && quote.lines.every((l: any) => {
    const lineDiscount = typeof l.discount === 'number' ? l.discount : parseFloat(l.discountPct || l.discount || '0');
    return lineDiscount >= counterPct - 0.05;
  });

  // 2. An approval/acceptance log occurred after or at the time of the counter-proposal
  const counterCommentTime = latestCounterComment?.createdAt ? new Date(latestCounterComment.createdAt).getTime() : 0;
  const hasAcceptanceLogAfterCounter = (quote.approvalLogs || []).some((log: any) => {
    const logTime = log.createdAt ? new Date(log.createdAt).getTime() : 0;
    const isAcceptAction = log.action === 'approved' || log.action === 'counter_offer_accepted';
    return isAcceptAction && (!counterCommentTime || logTime >= counterCommentTime - 1000);
  });

  // 3. Management or Rep posted an acceptance confirmation comment after this counter
  const hasAcceptanceCommentAfter = comments.some((c: any) => {
    const cTime = c.createdAt ? new Date(c.createdAt).getTime() : 0;
    const isStaffMsg = c.authorType === 'rep' || c.author_type === 'rep' || c.sender === 'Sales Rep';
    const text = String(c.message || c.text || '').toLowerCase();
    const isAcceptText = text.includes('accepted') && (text.includes('discount') || text.includes('approved'));
    return isStaffMsg && isAcceptText && (!counterCommentTime || cTime >= counterCommentTime - 1000);
  });

  // 4. Quote is approved with lines discounted or in a post-negotiation status (fulfillment, confirmed, invoiced)
  const isQuoteApprovedWithDiscount = (quote.status === 'Approved' || quote.status === 'approved') && linesAlreadyDiscounted;
  const isPostNegotiationStatus = ['Confirmed', 'Invoiced', 'Fulfillment', 'confirmed', 'invoiced', 'fulfillment', 'done'].includes(quote.status);

  const isCounterResolved =
    linesAlreadyDiscounted ||
    hasAcceptanceLogAfterCounter ||
    hasAcceptanceCommentAfter ||
    isQuoteApprovedWithDiscount ||
    isPostNegotiationStatus;

  // Active counter-offer exists ONLY if proposed by customer and not yet resolved
  const activeCounterOffer = (quote.pendingCounterOffer !== undefined && quote.pendingCounterOffer === null)
    ? null
    : (quote.pendingCounterOffer || (isFromCustomer && !isCounterResolved ? latestCounterComment : null));

  const handleAcceptCounterOffer = async () => {
    if (!activeCounterOffer || !quote) return;
    setSubmittingCounter(true);
    try {
      const res = await quoteApi.acceptCounterOffer(quote.id, { discount_pct: counterPct });
      const roleStr = String(user?.role || '').toLowerCase();
      const isMgr = roleStr.includes('manager') || roleStr.includes('admin');
      if (isMgr) {
        toast.success(`Counter-offer accepted! Quotation re-approved with ${counterPct}% discount.`);
      } else {
        toast.success(`Counter-offer of ${counterPct}% accepted! Routed to Sales Manager for approval.`);
      }
      if (res?.data) {
        setQuote(mapQuote(res.data));
      }
      await fetchQuoteData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to apply counter-discount');
    } finally {
      setSubmittingCounter(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMsg.trim() || !quote) return;
    setSubmittingReply(true);
    try {
      const token = quote.portalToken || quote.id;
      await portalApi.postComment(token, {
        message: replyMsg.trim(),
        author_type: 'rep',
        author_name: user?.name || 'Sales Rep',
      });
      setReplyMsg('');
      toast.success('Reply sent to customer portal!');
      await fetchQuoteData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleSendRepCounterOffer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const discountVal = parseFloat(repCounterDiscount);
    if (isNaN(discountVal) || discountVal <= 0 || discountVal > 100) {
      toast.error('Please enter a valid counter discount percentage between 1 and 100.');
      return;
    }
    if (!quote) return;
    setSubmittingCounter(true);
    try {
      const token = quote.portalToken || quote.id;
      const note = repCounterNote.trim() || `Sales Team proposed revised offer: ${discountVal}% discount on order lines.`;
      await portalApi.postComment(token, {
        message: note,
        counter_discount_pct: discountVal,
        author_type: 'rep',
        author_name: user?.name || 'Sales Representative',
      });
      toast.success(`Counter-offer of ${discountVal}% sent to customer portal!`);
      setShowRepCounterModal(false);
      setRepCounterNote('');
      await fetchQuoteData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit counter-offer');
    } finally {
      setSubmittingCounter(false);
    }
  };

  return (
    <div className="odoo-container">
      {/* Header bar */}
      <div className="odoo-page-header">
        <div>
          <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>Quotation</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 className="odoo-page-title" style={{ color: '#714B67', margin: 0 }}>
              {quote.reference}
            </h1>
            <span
              className="odoo-badge"
              style={{
                backgroundColor:
                  quote.status === 'Draft'
                    ? '#F1F5F9'
                    : quote.status === 'Approved'
                    ? '#DCFCE7'
                    : quote.status === 'Confirmed'
                    ? '#E0E7FF'
                    : '#FEF3C7',
                color:
                  quote.status === 'Draft'
                    ? '#475569'
                    : quote.status === 'Approved'
                    ? '#16A34A'
                    : quote.status === 'Confirmed'
                    ? '#4F46E5'
                    : '#D97706',
                fontWeight: 700,
                fontSize: '0.8125rem',
                padding: '0.25rem 0.6rem',
              }}
            >
              {quote.status}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="odoo-btn odoo-btn-primary"
            onClick={() => {
              const portalToken = (quote as any)?.portal_token || (quote as any)?.portalToken || quote.id;
              navigate(`/portal/${portalToken}`);
            }}
          >
            Open Customer Portal Link
          </button>
          <button className="odoo-btn odoo-btn-secondary">Send by Email</button>
          <button
            className="odoo-btn odoo-btn-secondary"
            onClick={() => navigate('/fulfillment')}
          >
            Convert to Order
          </button>
          <button className="odoo-btn odoo-btn-secondary">Print</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showUpsell && upsellSuggestions.length > 0 ? '3fr 1fr' : '1fr', gap: '1.5rem' }}>
        {/* Main Quote Card */}
        <div className="odoo-card">
          {/* Active Customer Counter-Offer Alert Banner */}
          {activeCounterOffer && (
            <div
              style={{
                backgroundColor: '#FFFBEB',
                border: '1px solid #F59E0B',
                borderRadius: 8,
                padding: '1rem 1.25rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ fontWeight: 800, color: '#92400E', fontSize: '0.95rem' }}>
                  Customer Counter-Offer: {counterPct}% Discount Proposed
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#B45309', marginTop: '0.25rem' }}>
                  "{activeCounterOffer.message}" — Submitted by {activeCounterOffer.authorName || activeCounterOffer.author_name || 'Customer'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="odoo-btn odoo-btn-primary"
                  onClick={handleAcceptCounterOffer}
                  disabled={submittingCounter}
                  style={{ backgroundColor: '#15803D', borderColor: '#15803D' }}
                >
                  {submittingCounter ? 'Applying...' : `✓ Accept ${counterPct}% Discount`}
                </button>
                <button
                  className="odoo-btn odoo-btn-secondary"
                  onClick={() => setShowRepCounterModal(true)}
                  style={{ fontWeight: 600 }}
                >
                  Propose Counter-Offer
                </button>
                <button
                  className="odoo-btn odoo-btn-secondary"
                  onClick={() => setActiveTab('negotiation')}
                >
                  View Negotiation History
                </button>
              </div>
            </div>
          )}

          {/* Metadata Top Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #E2E8F0' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Customer</div>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1F2937' }}>{quote.customerName}</div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{quote.customerTier} Customer</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Quotation Date</div>
              <div style={{ fontWeight: 600 }}>{quote.date}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Expiry Date</div>
              <div style={{ fontWeight: 600 }}>{quote.expiryDate}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Payment Terms</div>
              <div style={{ fontWeight: 600 }}>{quote.paymentTerms}</div>
            </div>
          </div>

          {/* Live Margin & Risk Indicator Bar */}
          <div
            style={{
              backgroundColor: '#F8F9FA',
              padding: '0.75rem 1rem',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569' }}>Live Margin Indicator: </span>
              <span style={{ fontWeight: 700, color: '#714B67' }}>{marginPercent}% Gross Margin</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.8125rem', color: '#64748B' }}>Blended Risk Score: </span>
              <span className="odoo-badge" style={{ background: '#714B67', color: '#FFF' }}>
                {quote.blendedRiskScore} (Approval Required)
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #E2E8F0', marginBottom: '1rem' }}>
            <button
              onClick={() => setActiveTab('lines')}
              style={{
                padding: '0.5rem 1rem',
                fontWeight: 600,
                color: activeTab === 'lines' ? '#714B67' : '#64748B',
                borderBottom: activeTab === 'lines' ? '2px solid #714B67' : 'none',
                marginBottom: -2,
              }}
            >
              Order Lines
            </button>
            <button
              onClick={() => setActiveTab('negotiation')}
              style={{
                padding: '0.5rem 1rem',
                fontWeight: 600,
                color: activeTab === 'negotiation' ? '#714B67' : '#64748B',
                borderBottom: activeTab === 'negotiation' ? '2px solid #714B67' : 'none',
                marginBottom: -2,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              Customer Negotiation
              {comments.length > 0 && (
                <span
                  style={{
                    backgroundColor: activeCounterOffer ? '#F59E0B' : '#714B67',
                    color: '#FFF',
                    fontSize: '0.7rem',
                    borderRadius: 10,
                    padding: '0.1rem 0.45rem',
                  }}
                >
                  {comments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              style={{
                padding: '0.5rem 1rem',
                fontWeight: 600,
                color: activeTab === 'audit' ? '#714B67' : '#64748B',
                borderBottom: activeTab === 'audit' ? '2px solid #714B67' : 'none',
                marginBottom: -2,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              Audit Trail & History
              {auditLogs.length > 0 && (
                <span
                  style={{
                    backgroundColor: '#E2E8F0',
                    color: '#475569',
                    fontSize: '0.7rem',
                    borderRadius: 10,
                    padding: '0.1rem 0.45rem',
                  }}
                >
                  {auditLogs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('info')}
              style={{
                padding: '0.5rem 1rem',
                fontWeight: 600,
                color: activeTab === 'info' ? '#714B67' : '#64748B',
                borderBottom: activeTab === 'info' ? '2px solid #714B67' : 'none',
                marginBottom: -2,
              }}
            >
              Other Information
            </button>
          </div>

          {activeTab === 'lines' ? (
            <div>
              <table className="odoo-table" style={{ marginBottom: '1rem' }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Discount (%)</th>
                    <th>Taxes</th>
                    <th>Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lines.map((line: any) => (
                    <tr key={line.id}>
                      <td style={{ fontWeight: 600 }}>{line.productName}</td>
                      <td>{line.description}</td>
                      <td>
                        {isDraft ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                              className="odoo-btn odoo-btn-secondary"
                              style={{ padding: '0.1rem 0.4rem' }}
                              onClick={() => handleQtyChange(line.id, line.quantity, -1)}
                            >
                              -
                            </button>
                            <span>{line.quantity}</span>
                            <button
                              className="odoo-btn odoo-btn-secondary"
                              style={{ padding: '0.1rem 0.4rem' }}
                              onClick={() => handleQtyChange(line.id, line.quantity, 1)}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <span>{line.quantity}</span>
                        )}
                      </td>
                      <td>₹{line.unitPrice.toLocaleString('en-IN')}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: line.discount > line.allowedDiscount ? '#714B67' : '#1F2937' }}>
                          {line.discount}% (Max {line.allowedDiscount}%)
                        </span>
                      </td>
                      <td>{line.taxPercent}%</td>
                      <td style={{ fontWeight: 700 }}>₹{line.total.toLocaleString('en-IN')}</td>
                      <td>
                        {isDraft && (
                          <button
                            className="odoo-btn odoo-btn-secondary"
                            style={{ padding: '0.2rem 0.4rem', color: '#EF4444' }}
                            onClick={() => handleDeleteLine(line.id)}
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {quote.lines.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                        No order lines
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Totals Section */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                    <span>Untaxed Amount:</span>
                    <span style={{ fontWeight: 600 }}>₹{quote.untaxedAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                    <span>Taxes (18%):</span>
                    <span style={{ fontWeight: 600 }}>₹{quote.taxAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem', color: '#714B67', borderTop: '2px solid #E2E8F0', paddingTop: '0.5rem' }}>
                    <span>Total:</span>
                    <span>₹{quote.totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'negotiation' ? (
            <div style={{ padding: '0.5rem 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937' }}>
                    Customer Negotiation & Counter-Offers
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    Direct communication with the customer from the Customer Portal magic link.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    className="odoo-btn odoo-btn-secondary"
                    onClick={() => setShowRepCounterModal(true)}
                    style={{ fontSize: '0.8125rem', fontWeight: 600 }}
                  >
                    Propose Counter-Offer
                  </button>
                  {activeCounterOffer && (
                    <button
                      className="odoo-btn odoo-btn-primary"
                      onClick={handleAcceptCounterOffer}
                      disabled={submittingCounter}
                      style={{ backgroundColor: '#15803D', borderColor: '#15803D', fontSize: '0.8125rem' }}
                    >
                      {submittingCounter ? 'Applying...' : `Accept ${counterPct}% Discount on All Lines`}
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Thread */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                maxHeight: 380,
                overflowY: 'auto',
                padding: '1rem',
                backgroundColor: '#F8FAFC',
                borderRadius: 8,
                border: '1px solid #E2E8F0',
                marginBottom: '1rem',
              }}>
                {comments.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.8125rem', padding: '1.5rem' }}>
                    No negotiation comments yet. Customers can counter-offer or question terms in their portal.
                  </div>
                )}
                {comments.map((msg: any, idx: number) => {
                  const isRep = msg.authorType === 'rep' || msg.author_type === 'rep';
                  const hasCounter = msg.counterDiscountPct || msg.counter_discount_pct;
                  return (
                    <div
                      key={idx}
                      style={{
                        alignSelf: isRep ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        backgroundColor: isRep ? '#F5EEF4' : hasCounter ? '#FFFBEB' : '#FFFFFF',
                        border: isRep ? '1px solid #E7D2E2' : hasCounter ? '1px solid #FCD34D' : '1px solid #E2E8F0',
                        borderRadius: 8,
                        padding: '0.75rem 1rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.75rem', color: isRep ? '#714B67' : hasCounter ? '#92400E' : '#334155' }}>
                          {msg.authorName || msg.author_name || (isRep ? 'Sales Representative' : 'Customer')}
                          {hasCounter && (
                            <span style={{ marginLeft: '0.4rem', backgroundColor: '#F59E0B', color: '#FFF', padding: '0.1rem 0.35rem', borderRadius: 4, fontSize: '0.65rem' }}>
                              Counter: {msg.counterDiscountPct || msg.counter_discount_pct}%
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: '#1F2937', lineHeight: 1.4 }}>
                        {msg.message}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendReply} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="odoo-input"
                  placeholder="Type a message or counter-proposal to the customer..."
                  value={replyMsg}
                  onChange={(e) => setReplyMsg(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  className="odoo-btn odoo-btn-primary"
                  disabled={submittingReply || !replyMsg.trim()}
                >
                  {submittingReply ? 'Sending...' : 'Send Reply'}
                </button>
              </form>
            </div>
          ) : activeTab === 'audit' ? (
            <div style={{ padding: '0.5rem 0' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937', marginBottom: '0.75rem' }}>
                Quotation Audit History & Lifecycle Events
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {auditLogs.map((log: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      borderLeft: '3px solid #714B67',
                      paddingLeft: '0.85rem',
                      paddingTop: '0.2rem',
                      paddingBottom: '0.2rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontWeight: 700, color: '#1F2937', fontSize: '0.8125rem' }}>{log.step}</span>
                      <span
                        className="odoo-badge"
                        style={{
                          backgroundColor: log.status === 'Approved' ? '#DCFCE7' : log.status === 'Rejected' ? '#FEE2E2' : '#FEF3C7',
                          color: log.status === 'Approved' ? '#15803D' : log.status === 'Rejected' ? '#B91C1C' : '#B45309',
                          fontSize: '0.6875rem',
                          padding: '0.1rem 0.4rem',
                        }}
                      >
                        {log.status}
                      </span>
                    </div>
                    <div style={{ color: '#64748B', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                      {log.user} • {log.timestamp}
                    </div>
                    {log.note && (
                      <div style={{ marginTop: '0.3rem', color: '#475569', fontSize: '0.8125rem', backgroundColor: '#F8FAFC', padding: '0.4rem 0.6rem', borderRadius: 4 }}>
                        "{log.note}"
                      </div>
                    )}
                  </div>
                ))}
                {auditLogs.length === 0 && (
                  <div style={{ color: '#94A3B8', fontSize: '0.8125rem', padding: '1rem 0' }}>
                    No audit logs recorded for this quotation yet.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: '1rem', fontSize: '0.875rem', lineHeight: 1.6, color: '#475569' }}>
              <p><strong>Sales Representative:</strong> Maviya</p>
              <p><strong>Sales Team:</strong> Enterprise North</p>
              <p><strong>Fiscal Position:</strong> Standard B2B GST</p>
              <p><strong>Portal Token:</strong> <code style={{ fontSize: '0.75rem', background: '#F1F5F9', padding: '0.15rem 0.4rem', borderRadius: 4 }}>{quote.portalToken || 'N/A'}</code></p>
            </div>
          )}
        </div>

        {/* Right Side Panel: Screen 5 Upsell & Cross-sell panel */}
        {showUpsell && upsellSuggestions.length > 0 && (
          <div className="odoo-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1F2937' }}>
                AI Upsell & Cross-Sell
              </h3>
              <button
                onClick={() => setShowUpsell(false)}
                style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600 }}
              >
                Dismiss
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748B' }}>
              Recommended pairings based on co-purchase history and active promotions:
            </p>

            {upsellSuggestions.map((suggestion, idx) => (
              <div key={idx} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '0.75rem', backgroundColor: '#F8F9FA' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.8125rem' }}>{suggestion.product_name || suggestion.productName || suggestion.name}</span>
                </div>
                {suggestion.reason && (
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '0.5rem' }}>
                    {suggestion.reason}
                  </div>
                )}
                <button
                  className="odoo-btn odoo-btn-primary"
                  style={{
                    width: '100%',
                    fontSize: '0.75rem',
                    padding: '0.3rem',
                    opacity: canEdit ? 1 : 0.6,
                    cursor: canEdit ? 'pointer' : 'not-allowed',
                  }}
                  disabled={!canEdit}
                  title={!canEdit ? `Cannot add items: Quotation is in '${quote.status}' status` : ''}
                  onClick={() => handleAddUpsellItem(suggestion.product_id || suggestion.suggested_product_id || suggestion.id, true)}
                >
                  {canEdit ? '+ Add to Quote' : `Locked (${quote.status})`}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Propose Counter-Offer Modal */}
      {showRepCounterModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFF', padding: '1.5rem', borderRadius: 12, width: 440, maxWidth: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#1F2937' }}>
                Propose Sales Counter-Offer to Customer
              </h3>
              <button
                onClick={() => setShowRepCounterModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.4rem', color: '#475569' }}>
                Offered Counter Discount (%)
              </label>
              <input
                type="number"
                min="0.5"
                max="100"
                step="0.5"
                className="odoo-input"
                value={repCounterDiscount}
                onChange={(e) => setRepCounterDiscount(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.4rem', color: '#475569' }}>
                Negotiation Note / Reason (Optional)
              </label>
              <textarea
                className="odoo-input"
                rows={3}
                placeholder="e.g. We can offer a 5% discount if the order is confirmed this week."
                value={repCounterNote}
                onChange={(e) => setRepCounterNote(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <p style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '1.25rem', lineHeight: 1.4 }}>
              This proposal will be sent directly to the customer's portal chat thread. If within customer tier limits, status remains Approved; if exceeding tier limits, it routes to the Sales Manager.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="odoo-btn odoo-btn-secondary" onClick={() => setShowRepCounterModal(false)} style={{ cursor: 'pointer' }}>
                Cancel
              </button>
              <button className="odoo-btn odoo-btn-primary" onClick={handleSendRepCounterOffer} disabled={submittingCounter} style={{ cursor: 'pointer' }}>
                {submittingCounter ? 'Submitting...' : 'Send Counter-Offer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

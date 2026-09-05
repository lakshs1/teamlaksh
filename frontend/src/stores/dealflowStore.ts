import { create } from 'zustand';
import {
  MOCK_PRODUCTS,
  MOCK_QUOTATIONS,
  MOCK_APPROVALS,
  MOCK_FULFILLMENTS,
  MOCK_SUBSCRIPTIONS,
  MOCK_INVOICES,
  MOCK_DEAL_HEALTH_ALERTS,
  MOCK_PORTAL_MESSAGES,
} from '../services/mockData';

export interface QuotationLine {
  id: string;
  productId: string;
  productName: string;
  category: 'Hardware' | 'Services' | 'Subscriptions' | 'Accessories';
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number; // percentage
  allowedDiscount: number;
  taxPercent: number;
  total: number;
}

export interface Quotation {
  id: string;
  reference: string;
  customerName: string;
  customerTier: 'Bronze' | 'Silver' | 'Gold';
  date: string;
  expiryDate: string;
  paymentTerms: string;
  status: 'Draft' | 'Sent' | 'Pending Approval' | 'Approved' | 'Confirmed' | 'Expired';
  lines: QuotationLine[];
  untaxedAmount: number;
  taxAmount: number;
  totalAmount: number;
  blendedRiskScore: number; // e.g. 18.5
  requiresManagerApproval: boolean;
  requiresFinanceApproval: boolean;
}

export interface ApprovalItem {
  id: string;
  reference: string; // APP/00012
  quotationId: string;
  customerName: string;
  requestType: 'Discount Approval' | 'Credit Limit Increase' | 'New Customer Terms';
  amount: number;
  requestedBy: string;
  requestedDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  blendedRiskScore: number;
  reason: string;
  auditTrail: { step: string; user: string; status: string; timestamp: string; note?: string }[];
}

export interface WarehouseSplit {
  warehouseName: string;
  quantityFulfilled: number;
  stockAvailable: number;
  estimatedCost: number;
  shipmentCount: number;
}

export interface FulfillmentItem {
  id: string;
  reference: string; // SO/00024
  quotationReference: string;
  customerName: string;
  scheduledDate: string;
  status: 'Draft' | 'Ready' | 'Picking' | 'Shipped' | 'Done' | 'Cancelled';
  responsible: string;
  lines: {
    productName: string;
    description: string;
    demand: number;
    done: number;
    unit: string;
  }[];
  splits: WarehouseSplit[];
  backorderPrompt?: boolean;
}

export interface SubscriptionItem {
  id: string;
  reference: string; // SUB/00012
  customerName: string;
  planName: string;
  startDate: string;
  nextBillingDate: string;
  billingFrequency: 'Monthly' | 'Quarterly' | 'Yearly';
  status: 'Active' | 'Paused' | 'Cancelled' | 'Expired';
  recurringLines: {
    productName: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
}

export interface InvoiceItem {
  id: string;
  reference: string; // INV/00015
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  status: 'Draft' | 'Posted' | 'Paid' | 'Overdue';
  paymentTerms: string;
  lines: {
    productName: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxes: number;
    amount: number;
  }[];
}

export interface DealHealthItem {
  id: string;
  quotationRef: string;
  customerName: string;
  repName: string;
  amount: number;
  daysInactive: number;
  riskCategory: 'Stalled Deal' | 'Discount Anomaly' | 'Delivery Slippage';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  triggeredAction?: string;
}

export interface ProductItem {
  id: string;
  name: string;
  sku: string;
  category: 'Hardware' | 'Accessories' | 'Services' | 'Subscriptions';
  salesPrice: number;
  costPrice: number;
  status: 'Active' | 'Draft' | 'Archived';
  description: string;
  canBeSold: boolean;
  canBePurchased: boolean;
}

export interface DiscountRule {
  customerTierCeilings: { tier: 'Bronze' | 'Silver' | 'Gold'; maxDiscount: number }[];
  categoryCeilings: { category: string; maxDiscount: number }[];
  approvalChain: { discountRange: string; approvalRequired: string }[];
}

export interface PortalChatMessage {
  id: string;
  sender: 'Customer' | 'Sales Rep';
  senderName: string;
  timestamp: string;
  text: string;
}

export type UserRole = 'Sales Rep' | 'Sales Manager' | 'Finance' | 'Operations' | 'Admin';

export interface DealFlowState {
  currentRole: UserRole;
  quotations: Quotation[];
  approvals: ApprovalItem[];
  fulfillments: FulfillmentItem[];
  subscriptions: SubscriptionItem[];
  invoices: InvoiceItem[];
  dealHealthAlerts: DealHealthItem[];
  products: ProductItem[];
  discountRules: DiscountRule;
  portalMessages: PortalChatMessage[];

  // Actions
  setRole: (role: UserRole) => void;
  fetchLiveData: () => Promise<void>;
  addQuotationLine: (quoteId: string, line: Omit<QuotationLine, 'id' | 'total'>) => void;
  updateQuotationLine: (quoteId: string, lineId: string, updates: Partial<QuotationLine>) => void;
  approveRequest: (approvalId: string, note?: string) => void;
  rejectRequest: (approvalId: string, note?: string) => void;
  validateFulfillment: (fulfillmentId: string) => void;
  registerInvoicePayment: (invoiceId: string) => void;
  addPortalMessage: (text: string, sender: 'Customer' | 'Sales Rep') => void;
  updateDiscountRules: (newRules: DiscountRule) => void;
  triggerDealNudge: (alertId: string) => void;
  addProduct: (prod: ProductItem) => void;
  addQuotation: (quote: Quotation) => void;
}

export const useDealFlowStore = create<DealFlowState>((set) => ({
  currentRole: 'Sales Manager',
  setRole: (role) => set({ currentRole: role }),
  quotations: MOCK_QUOTATIONS,
  approvals: MOCK_APPROVALS,
  fulfillments: MOCK_FULFILLMENTS,
  subscriptions: MOCK_SUBSCRIPTIONS,
  invoices: MOCK_INVOICES,
  dealHealthAlerts: MOCK_DEAL_HEALTH_ALERTS,
  products: MOCK_PRODUCTS,
  discountRules: {
    customerTierCeilings: [
      { tier: 'Bronze', maxDiscount: 5 },
      { tier: 'Silver', maxDiscount: 10 },
      { tier: 'Gold', maxDiscount: 15 },
    ],
    categoryCeilings: [
      { category: 'Hardware', maxDiscount: 15 },
      { category: 'Services', maxDiscount: 10 },
    ],
    approvalChain: [
      { discountRange: 'Within Tier/Category limit', approvalRequired: 'No approval needed' },
      { discountRange: 'Over Limit, blended risk medium', approvalRequired: 'Sales Manager' },
      { discountRange: 'Over Limit, blended risk high', approvalRequired: 'Sales Manager then Finance' },
    ],
  },
  portalMessages: MOCK_PORTAL_MESSAGES,

  fetchLiveData: async () => {
    // If running in mock data mode (default for UI design & testing), keep our rich mock state
    const useMock = import.meta.env.VITE_USE_MOCK_DATA !== 'false';
    if (useMock) {
      return;
    }

    // Dynamic live backend data loader (when VITE_USE_MOCK_DATA=false)
    try {
      const { quoteApi, catalogApi, approvalApi, billingApi, analyticsApi } = await import('../services/apiServices');
      
      const [quotesRes, prodsRes, appRes, subRes, invRes, healthRes] = await Promise.allSettled([
        quoteApi.getQuotes(),
        catalogApi.getProducts(),
        approvalApi.getPendingApprovals(),
        billingApi.getSubscriptions(),
        billingApi.getInvoices(),
        analyticsApi.getDealHealth(),
      ]);

      set((state) => ({
        quotations: quotesRes.status === 'fulfilled' && quotesRes.value?.data ? quotesRes.value.data : state.quotations,
        products: prodsRes.status === 'fulfilled' && prodsRes.value?.data ? prodsRes.value.data : state.products,
        approvals: appRes.status === 'fulfilled' && appRes.value?.data ? appRes.value.data : state.approvals,
        subscriptions: subRes.status === 'fulfilled' && subRes.value?.data ? subRes.value.data : state.subscriptions,
        invoices: invRes.status === 'fulfilled' && invRes.value?.data ? invRes.value.data : state.invoices,
        dealHealthAlerts: healthRes.status === 'fulfilled' && healthRes.value?.data ? healthRes.value.data : state.dealHealthAlerts,
      }));
    } catch {
      // Clean error handling
    }
  },

  addQuotationLine: (quoteId, lineData) => set((state) => {
    const updatedQuotations = state.quotations.map((q) => {
      if (q.id !== quoteId) return q;
      const newLineTotal = lineData.quantity * lineData.unitPrice * (1 - lineData.discount / 100);
      const newLine: QuotationLine = {
        ...lineData,
        id: `ql-${Date.now()}`,
        total: newLineTotal,
      };
      const updatedLines = [...q.lines, newLine];
      const newUntaxed = updatedLines.reduce((acc, l) => acc + l.total, 0);
      const newTax = newUntaxed * 0.18;
      return {
        ...q,
        lines: updatedLines,
        untaxedAmount: newUntaxed,
        taxAmount: newTax,
        totalAmount: newUntaxed + newTax,
      };
    });
    return { quotations: updatedQuotations };
  }),

  updateQuotationLine: (quoteId, lineId, updates) => set((state) => {
    const updatedQuotations = state.quotations.map((q) => {
      if (q.id !== quoteId) return q;
      const updatedLines = q.lines.map((l) => {
        if (l.id !== lineId) return l;
        const merged = { ...l, ...updates };
        merged.total = merged.quantity * merged.unitPrice * (1 - merged.discount / 100);
        return merged;
      });
      const newUntaxed = updatedLines.reduce((acc, l) => acc + l.total, 0);
      const newTax = newUntaxed * 0.18;
      return {
        ...q,
        lines: updatedLines,
        untaxedAmount: newUntaxed,
        taxAmount: newTax,
        totalAmount: newUntaxed + newTax,
      };
    });
    return { quotations: updatedQuotations };
  }),

  approveRequest: (approvalId, note) => set((state) => ({
    approvals: state.approvals.map((a) =>
      a.id === approvalId
        ? {
            ...a,
            status: 'Approved',
            auditTrail: [
              ...a.auditTrail,
              { step: 'Final Approval', user: 'Approver', status: 'Approved', timestamp: new Date().toLocaleTimeString(), note },
            ],
          }
        : a
    ),
  })),

  rejectRequest: (approvalId, note) => set((state) => ({
    approvals: state.approvals.map((a) =>
      a.id === approvalId
        ? {
            ...a,
            status: 'Rejected',
            auditTrail: [
              ...a.auditTrail,
              { step: 'Rejection', user: 'Approver', status: 'Rejected', timestamp: new Date().toLocaleTimeString(), note },
            ],
          }
        : a
    ),
  })),

  validateFulfillment: (fulfillmentId) => set((state) => ({
    fulfillments: state.fulfillments.map((f) =>
      f.id === fulfillmentId ? { ...f, status: 'Done' } : f
    ),
  })),

  registerInvoicePayment: (invoiceId) => set((state) => ({
    invoices: state.invoices.map((inv) =>
      inv.id === invoiceId ? { ...inv, status: 'Paid' } : inv
    ),
  })),

  addPortalMessage: (text, sender) => set((state) => ({
    portalMessages: [
      ...state.portalMessages,
      {
        id: `pm-${Date.now()}`,
        sender,
        senderName: sender === 'Customer' ? 'Acme Corp' : 'Sales Lead',
        timestamp: 'Just now',
        text,
      },
    ],
  })),

  updateDiscountRules: (newRules) => set({ discountRules: newRules }),

  triggerDealNudge: (alertId) => set((state) => ({
    dealHealthAlerts: state.dealHealthAlerts.map((a) =>
      a.id === alertId ? { ...a, triggeredAction: 'Nudge Sent to Rep' } : a
    ),
  })),

  addProduct: (prod) => set((state) => ({
    products: [prod, ...state.products],
  })),

  addQuotation: (quote) => set((state) => ({
    quotations: [quote, ...state.quotations],
  })),
}));

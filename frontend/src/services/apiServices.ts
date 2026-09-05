import api from '../lib/axios';

/* ============================================================
   DealFlow360 API Services Layer (Connecting frontend to /api/v1)
   ============================================================ */

// 1. Auth API
export const authApi = {
  login: async (credentials: { email: string; password: string }) => {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },
  register: async (userData: { name: string; email: string; password: string; role?: string }) => {
    const res = await api.post('/auth/register', userData);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

// 2. Customer & Tier API
export const customerApi = {
  getTiers: async () => {
    const res = await api.get('/customers/tiers');
    return res.data;
  },
  getCustomers: async (params?: { search?: string; tier_id?: number; page?: number; limit?: number }) => {
    const res = await api.get('/customers', { params });
    return res.data;
  },
  createCustomer: async (customerData: { name: string; email: string; tier_id: number }) => {
    const res = await api.post('/customers', customerData);
    return res.data;
  },
};

// 3. Catalog API
export const catalogApi = {
  getCategories: async () => {
    const res = await api.get('/catalog/categories');
    return res.data;
  },
  getProducts: async (params?: { category_id?: number; search?: string; page?: number; limit?: number }) => {
    const res = await api.get('/catalog/products', { params });
    return res.data;
  },
  getProductById: async (id: number | string) => {
    const res = await api.get(`/catalog/products/${id}`);
    return res.data;
  },
  createProduct: async (productData: {
    name: string;
    description?: string;
    category_id?: number;
    base_price: number;
    cost_price?: number;
    unit?: string;
    sku?: string;
    tax_pct?: number;
    is_recurring?: boolean;
    recurring_interval?: string;
    is_active?: boolean;
  }) => {
    const res = await api.post('/catalog/products', productData);
    return res.data;
  },
};

// 4. Quote API
export const quoteApi = {
  getQuotes: async (params?: { status?: string; customer_id?: number; page?: number; limit?: number }) => {
    const res = await api.get('/quotes', { params });
    return res.data;
  },
  createQuote: async (data: { customer_id: number; notes?: string; expires_at?: string }) => {
    const res = await api.post('/quotes', data);
    return res.data;
  },
  getQuoteDetails: async (id: number | string) => {
    const res = await api.get(`/quotes/${id}`);
    return res.data;
  },
  updateQuote: async (id: number | string, updates: Record<string, any>) => {
    const res = await api.patch(`/quotes/${id}`, updates);
    return res.data;
  },
  addLine: async (quoteId: number | string, lineData: { product_id: number; variant_id?: number; quantity: number; discount_pct?: number; is_upsell?: boolean }) => {
    const res = await api.post(`/quotes/${quoteId}/lines`, lineData);
    return res.data;
  },
  updateLine: async (quoteId: number | string, lineId: number | string, updates: { quantity?: number; discount_pct?: number }) => {
    const res = await api.patch(`/quotes/${quoteId}/lines/${lineId}`, updates);
    return res.data;
  },
  deleteLine: async (quoteId: number | string, lineId: number | string) => {
    const res = await api.delete(`/quotes/${quoteId}/lines/${lineId}`);
    return res.data;
  },
  submitQuote: async (quoteId: number | string) => {
    const res = await api.post(`/quotes/${quoteId}/submit`);
    return res.data;
  },
  confirmQuote: async (quoteId: number | string) => {
    const res = await api.post(`/quotes/${quoteId}/confirm`);
    return res.data;
  },
};

// 5. Approvals API
export const approvalApi = {
  getPendingApprovals: async () => {
    const res = await api.get('/approvals/pending');
    return res.data;
  },
  getAuditLogs: async (quoteId: number | string) => {
    const res = await api.get(`/approvals/quotes/${quoteId}/logs`);
    return res.data;
  },
  approveQuote: async (quoteId: number | string, reason?: string) => {
    const res = await api.post(`/approvals/quotes/${quoteId}/approve`, { reason });
    return res.data;
  },
  rejectQuote: async (quoteId: number | string, reason: string) => {
    const res = await api.post(`/approvals/quotes/${quoteId}/reject`, { reason });
    return res.data;
  },
  reviseQuote: async (quoteId: number | string, reason: string) => {
    const res = await api.post(`/approvals/quotes/${quoteId}/revise`, { reason });
    return res.data;
  },
};

// 6. Recommendations API
export const recommendationApi = {
  getSuggestions: async (quoteId: number | string) => {
    const res = await api.get(`/recommendations/quotes/${quoteId}/suggestions`);
    return res.data;
  },
};

// 7. Fulfillment API
export const fulfillmentApi = {
  getSplit: async (quoteId: number | string) => {
    const res = await api.get(`/fulfillment/quotes/${quoteId}/split`);
    return res.data;
  },
  acceptSplit: async (quoteId: number | string) => {
    const res = await api.post(`/fulfillment/quotes/${quoteId}/split/accept`);
    return res.data;
  },
};

// 8. Subscriptions & Invoicing API
export const billingApi = {
  getSubscriptions: async (params?: { customer_id?: number; status?: string }) => {
    const res = await api.get('/billing/subscriptions', { params });
    return res.data;
  },
  getInvoices: async (params?: { customer_id?: number; status?: string }) => {
    const res = await api.get('/billing/invoices', { params });
    return res.data;
  },
  payInvoice: async (invoiceId: number | string) => {
    const res = await api.post(`/billing/invoices/${invoiceId}/pay`);
    return res.data;
  },
};

// 9. Customer Portal API (Public Magic Link)
export const portalApi = {
  getPortalQuote: async (token: string) => {
    const res = await api.get(`/portal/quotes/${token}`);
    return res.data;
  },
  postComment: async (token: string, data: { quote_line_id?: number; message: string; counter_discount_pct?: number }) => {
    const res = await api.post(`/portal/quotes/${token}/comments`, data);
    return res.data;
  },
  confirmPortalQuote: async (token: string) => {
    const res = await api.post(`/portal/quotes/${token}/confirm`);
    return res.data;
  },
};

// 10. Analytics & Deal Health API
export const analyticsApi = {
  getDealHealth: async (stalledDays: number = 7) => {
    const res = await api.get('/analytics/deal-health', { params: { stalled_days: stalledDays } });
    return res.data;
  },
  getAlerts: async (params?: { type?: string; is_resolved?: boolean; page?: number; limit?: number }) => {
    const res = await api.get('/analytics/alerts', { params });
    return res.data;
  },
};

import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';

// Layouts
const UserLayout    = lazy(() => import('../components/layout/UserLayout'));
const BackendLayout = lazy(() => import('../components/layout/BackendLayout'));

// Lazy Pages for DealFlow360
const AuthPortalPage          = lazy(() => import('../features/auth/AuthPortalPage'));
const SalesDashboardPage      = lazy(() => import('../features/dashboard/SalesDashboardPage'));
const QuotationsListPage      = lazy(() => import('../features/quotations/QuotationsListPage'));
const PipelineKanbanPage      = lazy(() => import('../features/quotations/PipelineKanbanPage'));
const CreateQuotationPage     = lazy(() => import('../features/quotations/CreateQuotationPage'));
const QuotationDetailPage     = lazy(() => import('../features/quotations/QuotationDetailPage'));
const ApprovalsListPage       = lazy(() => import('../features/approvals/ApprovalsListPage'));
const ApprovalDetailPage      = lazy(() => import('../features/approvals/ApprovalDetailPage'));
const FulfillmentListPage     = lazy(() => import('../features/fulfillment/FulfillmentListPage'));
const FulfillmentDetailPage   = lazy(() => import('../features/fulfillment/FulfillmentDetailPage'));
const FulfillmentStockPage    = lazy(() => import('../features/fulfillment/FulfillmentStockPage'));
const SubscriptionsListPage   = lazy(() => import('../features/subscriptions/SubscriptionsListPage'));
const SubscriptionDetailPage  = lazy(() => import('../features/subscriptions/SubscriptionDetailPage'));
const CustomerPortalPage      = lazy(() => import('../features/portal/CustomerPortalPage'));
const InvoicesListPage        = lazy(() => import('../features/invoices/InvoicesListPage'));
const InvoiceDetailPage       = lazy(() => import('../features/invoices/InvoiceDetailPage'));
const DealHealthDashboardPage = lazy(() => import('../features/dealhealth/DealHealthDashboardPage'));
const ProductCatalogPage      = lazy(() => import('../features/products/ProductCatalogPage'));
const ProductDetailPage       = lazy(() => import('../features/products/ProductDetailPage'));
const DiscountRulesPage       = lazy(() => import('../features/settings/DiscountRulesPage'));
const WarehouseSetupPage      = lazy(() => import('../features/settings/WarehouseSetupPage'));
const SubscriptionPlansSetupPage = lazy(() => import('../features/settings/SubscriptionPlansSetupPage'));
const UpsellRulesSetupPage    = lazy(() => import('../features/settings/UpsellRulesSetupPage'));
const ReportsPage             = lazy(() => import('../features/reports/ReportsPage'));

// Fallback loader
const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#F8F9FA' }}>
    <div style={{ width: 40, height: 40, border: '3px solid #E2E8F0', borderTopColor: '#714B67', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const router = createBrowserRouter([
  // Launch / Authentication Routes (Dual Portal: Employee vs Customer)
  {
    path: '/',
    element: <Suspense fallback={<PageLoader />}><AuthPortalPage /></Suspense>,
  },
  {
    path: '/login',
    element: <Suspense fallback={<PageLoader />}><AuthPortalPage /></Suspense>,
  },
  {
    path: '/auth/login',
    element: <Suspense fallback={<PageLoader />}><AuthPortalPage /></Suspense>,
  },
  {
    path: '/register',
    element: <Suspense fallback={<PageLoader />}><AuthPortalPage /></Suspense>,
  },
  {
    path: '/auth/register',
    element: <Suspense fallback={<PageLoader />}><AuthPortalPage /></Suspense>,
  },

  // Isolated Customer Portal (B8)
  {
    path: '/portal',
    element: <Suspense fallback={<PageLoader />}><CustomerPortalPage /></Suspense>,
  },
  {
    path: '/portal/:portalToken',
    element: <Suspense fallback={<PageLoader />}><CustomerPortalPage /></Suspense>,
  },
  {
    path: '/portal/quotation/:portalToken',
    element: <Suspense fallback={<PageLoader />}><CustomerPortalPage /></Suspense>,
  },

  // Part B: Sales Frontend (Rep Workspace Experience - B1 to B9)
  {
    element: <Suspense fallback={<PageLoader />}><UserLayout /></Suspense>,
    children: [
      { path: '/dashboard', element: <Suspense fallback={<PageLoader />}><SalesDashboardPage /></Suspense> },
      { path: '/quotations', element: <Suspense fallback={<PageLoader />}><QuotationsListPage /></Suspense> },
      { path: '/quotations/create', element: <Suspense fallback={<PageLoader />}><CreateQuotationPage /></Suspense> },
      { path: '/quotations/new', element: <Suspense fallback={<PageLoader />}><CreateQuotationPage /></Suspense> },
      { path: '/quotations/pipeline', element: <Suspense fallback={<PageLoader />}><PipelineKanbanPage /></Suspense> },
      { path: '/quotations/:id', element: <Suspense fallback={<PageLoader />}><QuotationDetailPage /></Suspense> },
      { path: '/approvals', element: <Suspense fallback={<PageLoader />}><ApprovalsListPage /></Suspense> },
      { path: '/approvals/:id', element: <Suspense fallback={<PageLoader />}><ApprovalDetailPage /></Suspense> },
      { path: '/fulfillment', element: <Suspense fallback={<PageLoader />}><FulfillmentListPage /></Suspense> },
      { path: '/fulfillment/:id', element: <Suspense fallback={<PageLoader />}><FulfillmentDetailPage /></Suspense> },
      { path: '/fulfillment/:id/stock', element: <Suspense fallback={<PageLoader />}><FulfillmentStockPage /></Suspense> },
      { path: '/subscriptions', element: <Suspense fallback={<PageLoader />}><SubscriptionsListPage /></Suspense> },
      { path: '/subscriptions/:id', element: <Suspense fallback={<PageLoader />}><SubscriptionDetailPage /></Suspense> },
      { path: '/invoices', element: <Suspense fallback={<PageLoader />}><InvoicesListPage /></Suspense> },
      { path: '/invoices/:id', element: <Suspense fallback={<PageLoader />}><InvoiceDetailPage /></Suspense> },
      { path: '/deal-health', element: <Suspense fallback={<PageLoader />}><DealHealthDashboardPage /></Suspense> },
      { path: '/products', element: <Suspense fallback={<PageLoader />}><ProductCatalogPage /></Suspense> },
      { path: '/products/:id', element: <Suspense fallback={<PageLoader />}><ProductDetailPage /></Suspense> },
      { path: '/settings/discount-rules', element: <Suspense fallback={<PageLoader />}><DiscountRulesPage /></Suspense> },
      { path: '/reports', element: <Suspense fallback={<PageLoader />}><ReportsPage /></Suspense> },
    ],
  },

  // Part A: Sales Backend (Configuration Area - A1 to A7)
  {
    element: <Suspense fallback={<PageLoader />}><BackendLayout /></Suspense>,
    children: [
      { path: '/backend', element: <Navigate to="/backend/products" replace /> },
      { path: '/backend/products', element: <Suspense fallback={<PageLoader />}><ProductCatalogPage /></Suspense> },
      { path: '/backend/discount-rules', element: <Suspense fallback={<PageLoader />}><DiscountRulesPage /></Suspense> },
      { path: '/backend/warehouses', element: <Suspense fallback={<PageLoader />}><WarehouseSetupPage /></Suspense> },
      { path: '/backend/subscription-plans', element: <Suspense fallback={<PageLoader />}><SubscriptionPlansSetupPage /></Suspense> },
      { path: '/backend/upsell-rules', element: <Suspense fallback={<PageLoader />}><UpsellRulesSetupPage /></Suspense> },
      { path: '/backend/reports', element: <Suspense fallback={<PageLoader />}><ReportsPage /></Suspense> },
    ],
  },

  // 404 Catch-All
  {
    path: '*',
    element: (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:16, fontFamily:'Inter, sans-serif' }}>
        <div style={{ fontSize: 64, fontWeight: 800, color: '#714B67' }}>404</div>
        <div style={{ fontSize: 20, color: '#64748B' }}>Page not found</div>
        <a href="/" style={{ color: '#714B67', fontWeight: 600 }}>← Back to Portal</a>
      </div>
    ),
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}

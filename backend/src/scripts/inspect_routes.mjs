import authRoutes from '../modules/auth/auth.routes.js';
import customersRoutes from '../modules/customers/customers.routes.js';
import catalogRoutes from '../modules/catalog/catalog.routes.js';
import discountRulesRoutes from '../modules/discount-rules/discount-rules.routes.js';
import quotesRoutes from '../modules/quotes/quotes.routes.js';
import approvalsRoutes from '../modules/approvals/approvals.routes.js';
import recommendationsRoutes from '../modules/recommendations/recommendations.routes.js';
import fulfillmentRoutes from '../modules/fulfillment/fulfillment.routes.js';
import billingRoutes from '../modules/billing/billing.routes.js';
import portalRoutes from '../modules/portal/portal.routes.js';
import analyticsRoutes from '../modules/analytics/analytics.routes.js';

const modules = [
  { prefix: '/api/v1/auth', router: authRoutes },
  { prefix: '/api/v1/customers', router: customersRoutes },
  { prefix: '/api/v1/catalog', router: catalogRoutes },
  { prefix: '/api/v1/discount-rules', router: discountRulesRoutes },
  { prefix: '/api/v1/quotes', router: quotesRoutes },
  { prefix: '/api/v1/approvals', router: approvalsRoutes },
  { prefix: '/api/v1/recommendations', router: recommendationsRoutes },
  { prefix: '/api/v1/fulfillment', router: fulfillmentRoutes },
  { prefix: '/api/v1/billing', router: billingRoutes },
  { prefix: '/api/v1/portal', router: portalRoutes },
  { prefix: '/api/v1/analytics', router: analyticsRoutes },
];

const allRoutes = [
  { method: 'GET', path: '/api/health' }
];

for (const { prefix, router } of modules) {
  if (router && router.stack) {
    for (const layer of router.stack) {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
        methods.forEach(method => {
          allRoutes.push({
            method,
            path: (prefix + (layer.route.path === '/' ? '' : layer.route.path)).replace(/\/+/g, '/')
          });
        });
      }
    }
  }
}

console.log(`\n=== TOTAL UNIQUE API ENDPOINTS (${allRoutes.length}) ===`);
allRoutes.forEach((r, i) => console.log(`${i+1}. ${r.method} ${r.path}`));

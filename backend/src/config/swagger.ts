import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { type Express } from "express";
import swaggerUi from "swagger-ui-express";

// Global registry — all module schemas register themselves here
export const registry = new OpenAPIRegistry();

/**
 * Register security scheme for Bearer JWT auth.
 */
registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

/**
 * Generate OpenAPI spec from the registry and mount Swagger UI.
 */
export function setupSwagger(app: Express): void {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  const doc = generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "DealFlow360 API v1",
      version: "1.0.0",
      description:
        "Sales Operations, Quotation, Approval & Fulfillment Engine API. Built with Express, Drizzle ORM & Zod.",
    },
    servers: [{ url: "/api/v1" }, { url: "/api" }],
  });

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(doc, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "DealFlow360 API Docs",
    })
  );

  console.log("📄 DealFlow360 Swagger UI available at /api-docs");
}

import { app, logger } from "./app.js";
import { env } from "./config/env.js";
import { checkDbConnection } from "@db";

async function main() {
  // ── Validate DB connection ────────────────────────────────
  await checkDbConnection();

  // ── Start server ──────────────────────────────────────────
  app.listen(env.PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${env.PORT}`);
    logger.info(`📄 Swagger UI: http://localhost:${env.PORT}/api-docs`);
    logger.info(`❤️  Health check: http://localhost:${env.PORT}/api/health`);
    logger.info(`🌍 Environment: ${env.NODE_ENV}`);
  });
}

main().catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});

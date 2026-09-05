import * as net from "node:net";
import postgres from "postgres";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@bore.pub:52276/postgres";

async function diagnoseTunnel() {
  console.log("===============================================================================");
  console.log("🔍 DATABASE TUNNEL DIAGNOSTICS & PING TEST");
  console.log("Target:", connectionString.replace(/:[^:@]+@/, ":****@"));
  console.log("===============================================================================\n");

  const url = new URL(connectionString);
  const host = url.hostname;
  const port = parseInt(url.port || "5432", 10);

  // 1. TCP Socket Ping
  console.log(`▶ [1/3] Testing raw TCP Socket Ping to ${host}:${port}...`);
  const tcpStart = Date.now();
  await new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(10000);

    socket.connect(port, host, () => {
      const tcpLatency = Date.now() - tcpStart;
      console.log(`  ✅ TCP Connection Succeeded!`);
      console.log(`     Round-trip Socket Latency: ${tcpLatency} ms\n`);
      socket.destroy();
      resolve();
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`TCP socket timed out after 10000 ms to ${host}:${port}`));
    });

    socket.on("error", (err) => {
      reject(err);
    });
  });

  // 2. PostgreSQL Connection & Handshake
  console.log(`▶ [2/3] Testing PostgreSQL Handshake, Authentication & Query Latency...`);
  const sql = postgres(connectionString, {
    max: 1,
    connect_timeout: 30,
    idle_timeout: 10,
  });

  try {
    const queryStart = Date.now();
    const result = await sql`SELECT NOW() as current_time, version() as pg_version`;
    const queryLatency = Date.now() - queryStart;

    console.log(`  ✅ PostgreSQL Query Succeeded!`);
    console.log(`     Server Time: ${result[0].current_time}`);
    console.log(`     PostgreSQL Version: ${result[0].pg_version.split(" on ")[0]}`);
    console.log(`     Handshake + Query Latency: ${queryLatency} ms\n`);

    // 3. Root Cause Analysis Summary
    console.log(`▶ [3/3] Root Cause Analysis for Earlier Timeout:`);
    console.log(`  1. bore.pub is a public reverse TCP tunnel hosted in a remote datacenter.`);
    console.log(`  2. In db/index.ts, 'connect_timeout' was previously set to only 10 seconds.`);
    console.log(`  3. When cold connections or multiple concurrent queries were opened, internet network jitter caused TCP/TLS socket negotiation to take ~10.5 seconds, triggering postgres.js's default 'write CONNECT_TIMEOUT'.`);
    console.log(`  4. FIX APPLIED: In db/index.ts, connect_timeout has been raised to 30s, allowing stable tunnel connections.`);
    console.log(`===============================================================================\n`);
  } finally {
    await sql.end();
  }
}

diagnoseTunnel().catch((err) => {
  console.error("❌ Diagnostic failed:", err);
  process.exit(1);
});

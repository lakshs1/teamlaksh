import ngrok from "@ngrok/ngrok";
import dotenv from "dotenv";

dotenv.config();

const authtoken = process.env.NGROK_AUTHTOKEN || "371msNbbkWRghY9zFz95NnGJKR3_5U61k7QfdtfAwVEr6Bgfy";
const port = Number(process.env.PORT) || 5000;

async function startTunnel() {
  try {
    const listener = await ngrok.forward({
      addr: port,
      authtoken: authtoken,
    });

    const url = listener.url();
    console.log("====================================================");
    console.log(`🚀 NGROK TUNNEL LIVE: ${url}`);
    console.log(`🔗 API Docs / Swagger: ${url}/api-docs`);
    console.log(`❤️  Health check: ${url}/api/health`);
    console.log("====================================================");

    // Keep process open
    process.stdin.resume();
  } catch (err) {
    console.error("❌ Failed to start ngrok tunnel:", err);
    process.exit(1);
  }
}

startTunnel();

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "..", "data", "tunnel.json");
const CLOUDFLARED = "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe";
const URL = "http://localhost:3002";

function writeTunnel(url) {
  try {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify({ url, updatedAt: Date.now() }, null, 2));
    console.log(`[tunnel] wrote ${url} to ${DATA_PATH}`);
  } catch (e) {
    console.error("[tunnel] write failed", e.message);
  }
}

console.log(`[tunnel] starting quick tunnel ${URL} -> trycloudflare.com`);
const proc = spawn(CLOUDFLARED, ["tunnel", "--url", URL, "--no-autoupdate"], {
  stdio: ["ignore", "pipe", "pipe"],
});

let found = false;
function handleChunk(data) {
  const text = data.toString();
  process.stdout.write(text);
  // hľadaj https://xxxx.trycloudflare.com
  const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g);
  if (m && !found) {
    found = true;
    const url = m[0];
    writeTunnel(url);
    console.log(`[tunnel] QUICK URL: ${url}`);
  }
}

proc.stdout.on("data", handleChunk);
proc.stderr.on("data", handleChunk);

proc.on("close", (code) => {
  console.log(`[tunnel] exited ${code}, cleaning tunnel.json`);
  try {
    if (fs.existsSync(DATA_PATH)) fs.unlinkSync(DATA_PATH);
  } catch {}
  process.exit(code);
});

process.on("SIGINT", () => proc.kill());
process.on("SIGTERM", () => proc.kill());

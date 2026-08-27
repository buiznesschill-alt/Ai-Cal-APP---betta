import { NextRequest, NextResponse } from "next/server";
import os from "os";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

function getLanIp(): string | null {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        if (net.address.startsWith("192.168.") || net.address.startsWith("10.") || net.address.startsWith("172.")) return net.address;
      }
    }
  }
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return null;
}

async function getPublicUrl(): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", "tunnel.json"), "utf-8");
    const j = JSON.parse(raw);
    if (j?.url && typeof j.updatedAt === "number" && Date.now() - j.updatedAt < 12*60*60*1000) return j.url;
  } catch {}
  return null;
}

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "localhost:3002";
  const protocol = req.headers.get("x-forwarded-proto") === "https" ? "https" : "http";
  const origin = `${protocol}://${host}`;
  const lanIp = getLanIp();
  // iba 3443 https pre LAN (http vypnutý)
  const lanUrl = lanIp ? `https://${lanIp}:3443` : origin;
  const publicUrl = await getPublicUrl();
  return NextResponse.json({ origin, lanIp, lanUrl, host, publicUrl });
}

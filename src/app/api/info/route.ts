import { NextRequest, NextResponse } from "next/server";
import os from "os";

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

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "localhost:3002";
  // https len ak naozaj pride cez proxy s x-forwarded-proto: https – inak http
  const protocol = req.headers.get("x-forwarded-proto") === "https" ? "https" : "http";
  const origin = `${protocol}://${host}`;
  const lanIp = getLanIp();
  // port berieme z actual requestu, nie hardcoded
  const port = host.includes(":") ? host.split(":").pop()! : "3002";
  const lanUrl = lanIp ? `http://${lanIp}:${port}` : origin;
  return NextResponse.json({ origin, lanIp, lanUrl, host });
}

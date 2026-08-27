import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookie, verifyToken } from "@/lib/auth";
import { getWater, setWater } from "@/lib/db";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = new URL(req.url).searchParams.get("date") || today();
  const ml = await getWater(payload.userId, date);
  return NextResponse.json({ date, ml });
}

export async function PUT(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const ml = Number(body?.ml);
  if (!Number.isFinite(ml) || ml < 0) return NextResponse.json({ error: "Invalid ml" }, { status: 400 });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body?.date || "") ? body.date : today();
  const saved = await setWater(payload.userId, date, ml);
  return NextResponse.json({ ok: true, date, ml: saved });
}

import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookie, verifyToken } from "@/lib/auth";
import { listWeights, addWeight } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitParam = new URL(req.url).searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(365, parseInt(limitParam))) : undefined;
  const weights = await listWeights(payload.userId, limit);
  return NextResponse.json({ weights });
}

export async function POST(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const kg = Number(body?.kg);
  if (!Number.isFinite(kg) || kg <= 0 || kg > 500) return NextResponse.json({ error: "Invalid weight" }, { status: 400 });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body?.date || "") ? body.date : new Date().toISOString().slice(0, 10);
  const entry = await addWeight(payload.userId, date, kg);
  return NextResponse.json({ entry });
}

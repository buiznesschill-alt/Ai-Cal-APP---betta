import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookie, verifyToken } from "@/lib/auth";
import { listSupplements, addSupplement, deleteSupplement } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || undefined;
  const list = await listSupplements(payload.userId, date);
  return NextResponse.json({ supplements: list });
}

export async function POST(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(()=>({}));
  const name = String(body?.name||"").trim().slice(0,80);
  const amount = String(body?.amount||"").trim().slice(0,40);
  const time = String(body?.time||"").trim().slice(0,5) || new Date().toTimeString().slice(0,5);
  const date = String(body?.date||"").trim() || new Date().toISOString().slice(0,10);
  if (!name) return NextResponse.json({ error: "Zadaj názov doplnku" }, { status: 400 });
  const sup = await addSupplement(payload.userId, { date, name, amount, time });
  return NextResponse.json({ supplement: sup });
}

export async function DELETE(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const ok = await deleteSupplement(payload.userId, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

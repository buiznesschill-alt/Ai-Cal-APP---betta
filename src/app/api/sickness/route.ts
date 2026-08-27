import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookie, verifyToken } from "@/lib/auth";
import { getSicknesses, createSickness, endSickness, getActiveSickness } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const list = await getSicknesses(payload.userId);
  const active = await getActiveSickness(payload.userId);
  return NextResponse.json({ sicknesses: list, active });
}

export async function POST(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const note = String(body?.note || "").trim().slice(0, 200);
  if (note.length < 3) return NextResponse.json({ error: "Napíš aká choroba (aspoň 3 znaky)" }, { status: 400 });
  const active = await getActiveSickness(payload.userId);
  if (active) return NextResponse.json({ error: "Už máš aktívnu chorobu" }, { status: 400 });
  const s = await createSickness(payload.userId, note);
  return NextResponse.json({ sickness: s });
}

export async function DELETE(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await endSickness(payload.userId);
  if (!s) return NextResponse.json({ error: "Žiadna aktívna choroba" }, { status: 400 });
  return NextResponse.json({ sickness: s });
}

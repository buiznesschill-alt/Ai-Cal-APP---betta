import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookie, verifyToken } from "@/lib/auth";
import { getSavedTips, setSavedTips } from "@/lib/db";

type SavedRef = { id: string; kind: string; savedAt: number };

function parseRefs(body: any): SavedRef[] | null {
  const refs = body?.refs;
  if (!Array.isArray(refs)) return null;
  const clean: SavedRef[] = [];
  for (const r of refs) {
    if (!r || typeof r.id !== "string" || (r.kind !== "tip" && r.kind !== "advice")) return null;
    if (clean.length >= 200) break;
    clean.push({ id: r.id.slice(0, 64), kind: r.kind, savedAt: typeof r.savedAt === "number" ? r.savedAt : Date.now() });
  }
  return clean;
}

export async function GET(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const refs = await getSavedTips(payload.userId);
  return NextResponse.json({ refs });
}

export async function PUT(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const refs = parseRefs(body);
  if (!refs) return NextResponse.json({ error: "Invalid refs" }, { status: 400 });
  await setSavedTips(payload.userId, refs);
  return NextResponse.json({ ok: true });
}

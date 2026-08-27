import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookie, verifyToken } from "@/lib/auth";
import { findUserById } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ user: null }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ user: null }, { status: 401 });
  const user = await findUserById(payload.userId);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  const { passwordHash, ...safe } = user;
  return NextResponse.json({ user: safe });
}

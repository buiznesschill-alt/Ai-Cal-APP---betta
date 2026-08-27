import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/validators";
import { findUserByUsername } from "@/lib/db";
import { verifyPassword, createToken, getAuthCookie } from "@/lib/auth";

// simple in-memory rate limit
const attempts = new Map<string, { count: number; reset: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.reset) {
    attempts.set(ip, { count: 1, reset: now + 15 * 60 * 1000 });
    return true;
  }
  if (rec.count >= 5) return false;
  rec.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: "Príliš veľa pokusov, skús o 15 min" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Zlé údaje" }, { status: 400 });
    }
    const { username, password } = parsed.data;
    const user = await findUserByUsername(username);
    if (!user) return NextResponse.json({ error: "Nesprávne meno alebo heslo" }, { status: 401 });
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Nesprávne meno alebo heslo" }, { status: 401 });

    const token = await createToken({ userId: user.id, username: user.username });
    const res = NextResponse.json({ ok: true });
    res.headers.set("Set-Cookie", getAuthCookie(token));
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

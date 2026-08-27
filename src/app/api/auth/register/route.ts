import { NextRequest, NextResponse } from "next/server";
import { registerSchema } from "@/lib/validators";
import { findUserByUsername, createUser } from "@/lib/db";
import { hashPassword, createToken, getAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { username, password, displayName } = parsed.data;
    const existing = await findUserByUsername(username);
    if (existing) {
      return NextResponse.json({ error: "Meno už existuje" }, { status: 409 });
    }
    const passwordHash = await hashPassword(password);
    const user = await createUser({
      username,
      displayName: displayName || username,
      passwordHash,
      locale: "sk",
      goalKcal: 2200,
      goalProtein: 120,
      goalCarbs: 250,
      goalFat: 70,
      keepThumbnails: true,
    });

    const token = await createToken({ userId: user.id, username: user.username });
    const res = NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
    res.headers.set("Set-Cookie", getAuthCookie(token));
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Chyba" }, { status: 500 });
  }
}

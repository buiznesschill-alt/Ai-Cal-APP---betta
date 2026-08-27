import { NextResponse } from "next/server";
import { getClearCookie } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", getClearCookie());
  return res;
}

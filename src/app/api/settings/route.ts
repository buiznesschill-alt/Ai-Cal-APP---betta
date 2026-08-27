import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookie, verifyToken, hashPassword, verifyPassword } from "@/lib/auth";
import { findUserById, updateUser, deleteOldThumbnails } from "@/lib/db";
import { settingsSchema } from "@/lib/validators";

export async function GET(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await findUserById(payload.userId);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { passwordHash, ...safe } = user;
  return NextResponse.json({ user: safe });
}

export async function PATCH(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // special action: clear thumbnails
  if (body.action === "clearThumbnails") {
    const count = await deleteOldThumbnails(payload.userId, 90);
    return NextResponse.json({ ok: true, cleared: count });
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;

  const user = await findUserById(payload.userId);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // handle password change
  if (data.newPassword) {
    if (!data.oldPassword) return NextResponse.json({ error: "Zadaj staré heslo" }, { status: 400 });
    const ok = await verifyPassword(data.oldPassword, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Zlé staré heslo" }, { status: 400 });
    const hash = await hashPassword(data.newPassword);
    await updateUser(user.id, { passwordHash: hash });
  }

  const patch: any = {};
  if (data.displayName !== undefined) patch.displayName = data.displayName;
  if (data.locale !== undefined) patch.locale = data.locale;
  if (data.heightCm !== undefined) patch.heightCm = data.heightCm;
  if (data.weightKg !== undefined) patch.weightKg = data.weightKg;
  if (data.age !== undefined) patch.age = data.age;
  if (data.sex !== undefined) patch.sex = data.sex;
  if (data.activity !== undefined) patch.activity = data.activity;
  if (data.goalType !== undefined) patch.goalType = data.goalType;
  if (data.goalKcal !== undefined) patch.goalKcal = data.goalKcal;
  if (data.goalProtein !== undefined) patch.goalProtein = data.goalProtein;
  if (data.goalCarbs !== undefined) patch.goalCarbs = data.goalCarbs;
  if (data.goalFat !== undefined) patch.goalFat = data.goalFat;
  if (data.keepThumbnails !== undefined) patch.keepThumbnails = data.keepThumbnails;
  if (data.autoMeal !== undefined) patch.autoMeal = data.autoMeal;

  // auto calc if goalType/activity changed and user has metrics
  if ((data.goalType || data.activity || data.weightKg || data.heightCm || data.age || data.sex) && !data.goalKcal) {
    const w = data.weightKg ?? user.weightKg;
    const h = data.heightCm ?? user.heightCm;
    const a = data.age ?? user.age;
    const s = data.sex ?? user.sex;
    const act = data.activity ?? user.activity;
    const goal = data.goalType ?? user.goalType;
    if (w && h && a && s) {
      let bmr = s === "male" ? 10 * w + 6.25 * h - 5 * a + 5 : 10 * w + 6.25 * h - 5 * a - 161;
      const actMap: any = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
      let tdee = bmr * (actMap[act || "moderate"] || 1.55);
      if (goal === "lose") tdee -= 400;
      if (goal === "gain") tdee += 400;
      patch.goalKcal = Math.round(tdee);
    }
  }

  if (Object.keys(patch).length > 0) {
    await updateUser(user.id, patch);
  }

  const updated = await findUserById(user.id);
  const { passwordHash, ...safe } = updated!;
  const res = NextResponse.json({ user: safe, ok: true });

  // set locale cookie if changed
  if (data.locale) {
    res.headers.set("Set-Cookie", `fitcal_locale=${data.locale}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`);
  }

  return res;
}

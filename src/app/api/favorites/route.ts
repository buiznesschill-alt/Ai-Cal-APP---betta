import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookie, verifyToken } from "@/lib/auth";
import { listFavorites, createFavorite, deleteFavorite } from "@/lib/db";
import type { MealType } from "@/lib/types";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function num(v: unknown, def = 0): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : def;
}

function parseFavBody(body: any) {
  if (!body || typeof body.dish !== "string" || !body.dish.trim()) return null;
  const mealType: MealType = MEAL_TYPES.includes(body.mealType) ? body.mealType : "snack";
  return {
    dish: body.dish.trim().slice(0, 120),
    description: typeof body.description === "string" ? body.description.slice(0, 300) : "",
    portion_g: num(body.portion_g, 100),
    kcal: Math.round(num(body.kcal)),
    protein: num(body.protein),
    carbs: num(body.carbs),
    fat: num(body.fat),
    fiber: num(body.fiber),
    sugar: num(body.sugar),
    salt: num(body.salt),
    iron: num(body.iron),
    potassium: num(body.potassium),
    mealType,
  };
}

export async function GET(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const favorites = await listFavorites(payload.userId);
  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const data = parseFavBody(body);
  if (!data) return NextResponse.json({ error: "Invalid favorite" }, { status: 400 });
  const favorite = await createFavorite(payload.userId, data);
  return NextResponse.json({ favorite });
}

export async function DELETE(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const ok = await deleteFavorite(payload.userId, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

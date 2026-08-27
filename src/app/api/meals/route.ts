import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookie, verifyToken } from "@/lib/auth";
import { getMealsByUser, deleteMeal, getDaySummary, getMonthTotals, getAllDayTotals, finalizeDayScores, getDayScores, createMeal, updateMealPortion, findUserById } from "@/lib/db";
import type { MealType, MealSource } from "@/lib/types";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function num(v: unknown, def = 0): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : def;
}

export async function GET(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined;

  // Beta: month day totals for heatmap calendar
  if (searchParams.get("summary") === "month") {
    const month = searchParams.get("month");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    const totals = await getMonthTotals(payload.userId, month);
    return NextResponse.json({ totals });
  }

  // Beta: all-time day totals – pre bodový systém rankov (minulé dni sa zamknú na ±1)
  if (searchParams.get("summary") === "all") {
    const user = await findUserById(payload.userId);
    const goal = user?.goalKcal ?? 2000;
    await finalizeDayScores(payload.userId, goal);
    const totals = await getAllDayTotals(payload.userId);
    const scores = await getDayScores(payload.userId);
    return NextResponse.json({ totals, scores });
  }

  if (searchParams.get("summary") === "1" && date) {
    const summary = await getDaySummary(payload.userId, date);
    return NextResponse.json(summary);
  }

  const meals = await getMealsByUser(payload.userId, { date, limit });
  return NextResponse.json({ meals });
}

// Beta: manual entry / re-add favorite / any direct meal creation
export async function POST(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.dish !== "string" || !body.dish.trim()) return NextResponse.json({ error: "Invalid dish" }, { status: 400 });

  const mealType: MealType = MEAL_TYPES.includes(body.mealType) ? body.mealType : "snack";
  const source: MealSource = body.source === "ai" || body.source === "favorite" || body.source === "barcode" ? body.source : "manual";
  const date: string = /^\d{4}-\d{2}-\d{2}$/.test(body.date || "") ? body.date : new Date().toISOString().slice(0, 10);

  const meal = await createMeal({
    userId: payload.userId,
    date,
    mealType,
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
    iron: body.iron != null ? num(body.iron) : undefined,
    potassium: body.potassium != null ? num(body.potassium) : undefined,
    confidence: source === "manual" ? 1 : num(body.confidence, 1),
    thumbnail: typeof body.thumbnail === "string" ? body.thumbnail : null,
    source,
  });
  return NextResponse.json({ meal });
}

// Beta: portion edit – macros scale proportionally
export async function PATCH(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const body = await req.json().catch(() => null);
  const portion = Number(body?.portion_g);
  if (!Number.isFinite(portion) || portion <= 0 || portion > 5000) return NextResponse.json({ error: "Invalid portion" }, { status: 400 });

  const meal = await updateMealPortion(payload.userId, id, Math.round(portion));
  if (!meal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ meal });
}

export async function DELETE(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const ok = await deleteMeal(payload.userId, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

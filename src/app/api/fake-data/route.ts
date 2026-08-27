import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookie, verifyToken } from "@/lib/auth";
import { createMeal, getMealsByUser, removeFakeMeals, countFakeMeals } from "@/lib/db";
import type { MealType } from "@/lib/types";

const FAKE_MENU: Record<MealType, { dish: string; description: string; kcal: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number; salt: number; iron: number; potassium: number }[]> = {
  breakfast: [
    { dish: "Ovocná miska s jogurtom", description: "Banán, jahody, čučoriedky, biely jogurt, med", kcal: 310, protein: 12, carbs: 42, fat: 9, fiber: 6, sugar: 28, salt: 0.3, iron: 1.2, potassium: 480 },
    { dish: "Avokádový toast", description: "Celozrnný chlieb, avokádo, vajce, semienka", kcal: 380, protein: 14, carbs: 28, fat: 22, fiber: 7, sugar: 2, salt: 1.1, iron: 2.4, potassium: 420 },
  ],
  lunch: [
    { dish: "Kuracie prsia s ryžou a zeleninou", description: "Grilované kuracie prsia, dusená ryža, mix zeleniny", kcal: 520, protein: 38, carbs: 48, fat: 18, fiber: 4, sugar: 3, salt: 1.2, iron: 2.0, potassium: 520 },
    { dish: "Grécky šalát s fetou", description: "Paradajky, uhorka, olivy, feta, olivový olej", kcal: 340, protein: 9, carbs: 12, fat: 28, fiber: 5, sugar: 6, salt: 1.8, iron: 1.5, potassium: 380 },
  ],
  dinner: [
    { dish: "Losos so zemiakmi", description: "Pečený losos, varené zemiaky, brokolica", kcal: 610, protein: 35, carbs: 42, fat: 28, fiber: 5, sugar: 2, salt: 1.5, iron: 1.8, potassium: 890 },
    { dish: "Špagety carbonara", description: "Cestoviny, slanina, vajce, parmezán", kcal: 640, protein: 26, carbs: 58, fat: 32, fiber: 3, sugar: 3, salt: 1.9, iron: 2.2, potassium: 310 },
  ],
  snack: [
    { dish: "Banan s orechovym maslom", description: "Banán, mandľové maslo, škorica", kcal: 220, protein: 5, carbs: 30, fat: 9, fiber: 4, sugar: 18, salt: 0.1, iron: 0.9, potassium: 520 },
    { dish: "Tvarohový krém s ovocím", description: "Polotučný tvaroh, jahody, med", kcal: 240, protein: 18, carbs: 22, fat: 8, fiber: 2, sugar: 16, salt: 0.2, iron: 0.8, potassium: 340 },
  ],
};

const PLAN: { mealType: MealType; hour: number }[] = [
  { mealType: "breakfast", hour: 8 },
  { mealType: "snack", hour: 11 },
  { mealType: "lunch", hour: 13 },
  { mealType: "dinner", hour: 19 },
];

function authPayload(req: NextRequest) {
  return getTokenFromCookie(req.headers.get("cookie"));
}

export async function GET(req: NextRequest) {
  const token = authPayload(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    fakeToday: await countFakeMeals(payload.userId, new Date().toISOString().slice(0, 10)),
    fakeTotal: await countFakeMeals(payload.userId),
  });
}

export async function POST(req: NextRequest) {
  const token = authPayload(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const count = Math.min(Math.max(Number(body?.count) || 4, 1), 4);

  const today = new Date().toISOString().slice(0, 10);

  // idempotent: replace today's fake meals with a fresh set
  await removeFakeMeals(payload.userId, today);

  let added = 0;
  for (const slot of PLAN.slice(0, count)) {
    const options = FAKE_MENU[slot.mealType];
    const base = options[Math.floor(Math.random() * options.length)];
    const portion = 220 + Math.floor(Math.random() * 180);
    const factor = portion / 350;
    const jitter = (n: number) => Math.max(1, Math.round(n * factor));
    const createdAt = new Date();
    createdAt.setHours(slot.hour + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);

    await createMeal(
      {
        userId: payload.userId,
        date: today,
        mealType: slot.mealType,
        dish: base.dish,
        description: base.description,
        portion_g: portion,
        kcal: jitter(base.kcal),
        protein: jitter(base.protein),
        carbs: jitter(base.carbs),
        fat: jitter(base.fat),
        fiber: jitter(base.fiber),
        sugar: jitter(base.sugar),
        salt: Number((base.salt * factor).toFixed(1)),
        iron: Math.round(base.iron * factor * 10) / 10,
        potassium: Math.round(base.potassium * factor),
        confidence: 0.88 + Math.random() * 0.1,
        thumbnail: null,
        source: "ai",
        isFake: true,
      } as any,
      createdAt.toISOString()
    );
    added++;
  }

  return NextResponse.json({ added, fakeToday: await countFakeMeals(payload.userId, today) });
}

export async function DELETE(req: NextRequest) {
  const token = authPayload(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // safety: never touch real (non-fake) meals
  const realCount = (await getMealsByUser(payload.userId)).filter((m) => !(m as any).isFake).length;
  const removed = await removeFakeMeals(payload.userId);
  return NextResponse.json({ removed, realMealsUntouched: realCount });
}

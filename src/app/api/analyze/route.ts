import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookie, verifyToken } from "@/lib/auth";
import { findUserById } from "@/lib/db";
import { getAIProvider } from "@/lib/ai/provider";

const rl = new Map<string, { count: number; reset: number }>();
function checkRate(userId: string) {
  const now = Date.now();
  const rec = rl.get(userId);
  if (!rec || now > rec.reset) {
    rl.set(userId, { count: 1, reset: now + 60 * 1000 });
    return true;
  }
  if (rec.count >= 10) return false;
  rec.count++;
  return true;
}

// Smart priradenie do času – AI rozozná či jedlo je snack alebo poriadne jedlo:
//   snack (keks, tyčinka, ovocie...) → vždy "snack" bez ohľadu na hodinu
//   main (plný tanier) → slot podľa časti dňa
//   neznáme → ponechá výber používateľa
function smartMealType(foodClass: string | undefined, requested: string): string {
  const valid = ["breakfast", "lunch", "dinner", "snack"];
  const req = valid.includes(requested) ? requested : "lunch";
  if (foodClass === "snack") return "snack";
  if (foodClass === "main") {
    const hour = new Date().getHours();
    if (hour < 11) return "breakfast";
    if (hour < 16) return "lunch";
    if (hour < 22) return "dinner";
    return "snack"; // po 22. hodine je aj poriadne jedlo skôr nočným občerstvením
  }
  return req;
}

export async function POST(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!checkRate(payload.userId)) return NextResponse.json({ error: "Rate limit: max 10/min" }, { status: 429 });

  const user = await findUserById(payload.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    const form = await req.formData();
    const file = form.get("image") as File | null;
    const mealType = (form.get("mealType") as string) || "lunch";
    const thumb = form.get("thumbnail") as string | null;
    // poznámka od používateľa – upresní jedlo pre analyzátor (max 500 znakov)
    const note = ((form.get("note") as string) || "").trim().slice(0, 500);
    const locale = (form.get("locale") as string) === "en" ? "en" : "sk";

    if (!file) return NextResponse.json({ error: "Chýba fotka" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${file.type};base64,${buf.toString("base64")}`;

    const provider = getAIProvider();
    // Analyze = iba analýza, NIE uloženie. Jedlo sa uloží až cez "Save to diary" (POST /api/meals).
    let result;
    try {
      result = await provider.analyze(base64, { mealType, note, locale: (form.get("locale") as string) === "en" ? "en" : "sk" });
    } catch (aiErr: any) {
      // AI nedostupné (rate limit free variantu / výpadok) → mock odhad, appka funguje ďalej
      console.error("AI analyze failed, fallback to mock:", aiErr?.message);
      const { MockProvider } = await import("@/lib/ai/provider");
      result = await new MockProvider().analyze(base64, { mealType, note });
      result.tips = `⚠️ AI limit prekročený – zobrazený je hrubý odhad. Skús o chvíľu znova. ${result.tips}`;
    }

    // Decide thumbnail storage – space efficient
    let thumbnailToStore: string | null = null;
    if (user.keepThumbnails && thumb) {
      // thumb already 256 webp ~15KB
      thumbnailToStore = thumb;
      // extra guard: if > 40KB drop
      if (thumbnailToStore.length > 40000) thumbnailToStore = null;
    }

    return NextResponse.json({
      result,
      thumbnail: thumbnailToStore,
      mealType: smartMealType(result.foodClass, mealType),
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Chyba analýzy" }, { status: 500 });
  }
}

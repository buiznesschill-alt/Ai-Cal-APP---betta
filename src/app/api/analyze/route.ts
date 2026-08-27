import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookie, verifyToken } from "@/lib/auth";
import { findUserById } from "@/lib/db";
import { getAIProvider } from "@/lib/ai/provider";

const rl = new Map<string, { count: number; reset: number }>();
const rlIP = new Map<string, { count: number; reset: number }>();
// FÁZA 0D+2L: cleanup + IP rate limit
setInterval(() => {
  const now = Date.now();
  rl.forEach((v, k) => { if (now > v.reset) rl.delete(k); });
  rlIP.forEach((v, k) => { if (now > v.reset) rlIP.delete(k); });
}, 5*60*1000).unref?.();

function getIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
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
function checkRateIP(ip: string) {
  const now = Date.now();
  const rec = rlIP.get(ip);
  if (!rec || now > rec.reset) {
    rlIP.set(ip, { count: 1, reset: now + 60*1000 });
    return true;
  }
  if (rec.count >= 30) return false;
  rec.count++;
  return true;
}
// FÁZA 2L: p-limit pre AI — max 3 súbežné analýzy, zvyšok 429
let concurrent = 0;
const MAX_CONCURRENT = 3;

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
  const ip = getIP(req);
  if (!checkRateIP(ip)) return NextResponse.json({ error: "Rate limit IP: max 30/min" }, { status: 429 });
  if (concurrent >= MAX_CONCURRENT) return NextResponse.json({ error: "Server busy, skús o sekundu" }, { status: 429 });
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!checkRate(payload.userId)) return NextResponse.json({ error: "Rate limit: max 10/min" }, { status: 429 });
  const tStart = Date.now();

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
    // FÁZA 2L: p-limit — chráni AI pred preťažením
    if (concurrent >= MAX_CONCURRENT) return NextResponse.json({ error: "Server busy, skús o sekundu" }, { status: 429 });
    concurrent++;
    let result;
    try {
      result = await provider.analyze(base64, { mealType, note, locale });
    } catch (aiErr: any) {
      // AI nedostupné (rate limit free variantu / výpadok) → mock odhad, appka funguje ďalej
      console.error("AI analyze failed, fallback to mock:", aiErr?.message);
      const { MockProvider } = await import("@/lib/ai/provider");
      result = await new MockProvider().analyze(base64, { mealType, note, locale });
      result.tips = `⚠️ AI limit prekročený – zobrazený je hrubý odhad. Skús o chvíľu znova. ${result.tips}`;
    } finally {
      concurrent = Math.max(0, concurrent - 1);
      const dur = Date.now() - tStart;
      console.log(`[analyze] ${payload.userId} ${dur}ms concurrent:${concurrent} ip:${ip} note:${note ? "yes" : "no"}`);
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

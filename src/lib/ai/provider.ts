import type { NutritionResult } from "../types";
import { searchFoodCandidates, candidatesToPromptJSON, type FoodCandidate } from "../foodSearch";
import { lookupByEAN, isValidGTIN } from "../productLookup";

// Abstraction – swap Mock for OpenRouter/Muse Spark when keys are set
export interface AIProvider {
  analyze(imageBase64: string, opts?: { mealType?: string; note?: string; locale?: string }): Promise<NutritionResult>;
}

// Vytiahne gramáže z poznámky typu "250g ryze, 120 g kurata" – SČÍTA ich, lebo
// zvyčajne opisujú rôzne komponenty taniera (príloha + mäso + omáčka...)
export function extractNoteGrams(note: string): number | null {
  if (!note) return null;
  const re = /(\d{1,4})\s*(?:g\b|gram)/gi;
  let total = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(note)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > 0 && n <= 3000) total += n;
  }
  return total > 0 ? Math.min(total, 3000) : null;
}

// Domáce meradlá – koľko ~gramov má jedna jednotka (priemerné hodnoty varených jedál)
const UNIT_TABLE: { re: string; g: number }[] = [
  { re: "lyžičk\\w*|lyzick\\w*|tsp", g: 8 }, // lyžička
  { re: "kopč\\w*|kopc\\w*", g: 20 }, // kopček ryže/zeleniny...
  { re: "lyžic\\w*|lyzic\\w*|tbsp|spoons?", g: 18 }, // lyžica
  { re: "plát\\w*|platk\\w*|slice", g: 28 }, // platok mäsa/syrа/chleba
  { re: "hŕst\\w*|hrst\\w*|handful", g: 35 }, // hrsť oriechov...
  { re: "hrnč\\w*|hrnc\\w*|hrnk\\w*|šálk\\w*|salk\\w*|cups?|mugs?", g: 180 }, // hrnček/šálka
  { re: "pohár\\w*|pohar\\w*|glass", g: 240 }, // pohár
  { re: "misk\\w*|bowls?", g: 280 }, // miska
  { re: "porci\\w*|portions?|servings?", g: 300 }, // porcia
  { re: "tanier\\w*|plates?", g: 320 }, // tanier
  { re: "kúso\\w*|kus\\w*|pieces?", g: 90 }, // kus (kuracia prsia, koláč...)
];

// Prepočíta slovné množstvá ("3 kopčeky ryže", "2 platky mäsa") na gramy a sčíta ich
export function extractNoteUnits(note: string): number | null {
  if (!note) return null;
  let total = 0;
  let found = false;
  for (const u of UNIT_TABLE) {
    const re = new RegExp("(\\d{1,3})\\s*(?:x\\s*)?(?:" + u.re + ")", "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(note)) !== null) {
      if (!m[1]) continue;
      const n = parseFloat(m[1].replace(",", "."));
      if (n > 0 && n <= 50) {
        total += n * u.g;
        found = true;
      }
    }
  }
  return found ? Math.min(Math.round(total), 3000) : null;
}

// Simple deterministic mock that gives plausible values based on image hash
export class MockProvider implements AIProvider {
  async analyze(imageBase64: string, opts?: { mealType?: string; note?: string; locale?: string }): Promise<NutritionResult> {
    // Cheap hash from base64 length + first chars
    let hash = 0;
    for (let i = 0; i < Math.min(imageBase64.length, 5000); i++) {
      hash = (hash * 31 + imageBase64.charCodeAt(i)) % 1000000;
    }
    const dishes = [
      {
        dish: "Kuracie prsia s ryžou a zeleninou",
        description: "Grilované kuracie prsia, dusená ryža, mix zeleniny",
        kcal: 520,
        iron: 2.0, potassium: 520,
        protein: 38,
        carbs: 48,
        fat: 18,
        fiber: 4,
        sugar: 3,
        salt: 1.2,
      },
      {
        dish: "Bryndzové halušky",
        description: "Halušky s bryndzou a slaninkou",
        kcal: 680,
        iron: 2.5, potassium: 340,
        protein: 22,
        carbs: 72,
        fat: 32,
        fiber: 3,
        sugar: 2,
        salt: 2.1,
      },
      {
        dish: "Grécky šalát s fetou",
        description: "Paradajky, uhorka, olivy, feta, olivový olej",
        kcal: 340,
        iron: 1.5, potassium: 380,
        protein: 9,
        carbs: 12,
        fat: 28,
        fiber: 5,
        sugar: 6,
        salt: 1.8,
      },
      {
        dish: "Pizza Margherita (1/2)",
        description: "Tenké cesto, paradajková omáčka, mozzarella",
        kcal: 580,
        iron: 2.5, potassium: 460,
        protein: 24,
        carbs: 62,
        fat: 26,
        fiber: 3,
        sugar: 5,
        salt: 2.4,
      },
      {
        dish: "Ovocná miska s jogurtom",
        description: "Banán, jahody, čučoriedky, biely jogurt, med",
        kcal: 310,
        iron: 1.0, potassium: 500,
        protein: 12,
        carbs: 42,
        fat: 9,
        fiber: 6,
        sugar: 28,
        salt: 0.3,
      },
      {
        dish: "Burger s hranolkami",
        description: "Hovädzí burger, syr, hranolky, kečup",
        kcal: 740,
        iron: 3.2, potassium: 480,
        protein: 32,
        carbs: 68,
        fat: 38,
        fiber: 4,
        sugar: 8,
        salt: 2.8,
      },
    ];
    const idx = hash % dishes.length;
    const base = dishes[idx];

    // poznámka od používateľa – upresní porciu (gramy alebo slovné jednotky) a obohatí popis
    const note = (opts?.note || "").trim().slice(0, 500);
    let portion = 280 + (hash % 180); // 280-459g
    const noteGrams = extractNoteGrams(note);
    const noteUnits = extractNoteUnits(note);
    if (noteGrams != null || noteUnits != null) {
      const sum = (noteGrams ?? 0) + (noteUnits ?? 0);
      if (sum >= 10) portion = Math.min(sum, 3000);
    }

    const factor = portion / 350;
    const jitter = (n: number) => Math.round(n * factor);

    return {
      dish: base.dish,
      description: note ? `${base.description} • Poznámka: ${note}` : base.description,
      portion_g: portion,
      kcal: jitter(base.kcal),
      protein: jitter(base.protein),
      carbs: jitter(base.carbs),
      fat: jitter(base.fat),
      fiber: jitter(base.fiber),
      sugar: jitter(base.sugar),
      salt: Number((base.salt * factor).toFixed(1)),
      iron: Math.round((base.iron ?? 0) * factor * 10) / 10,
      potassium: Math.round((base.potassium ?? 0) * factor),
      confidence: note ? Math.min(0.97, 0.94 + (hash % 4) / 100) : 0.92 + (hash % 5) / 100,
      tips: "Skús pridať viac zeleniny pre vlákninu. Nezabudni na pitný režim!",
    };
  }
}

// ---------------- shared config & helpers ----------------

const MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL || "https://api.minimax.io/anthropic";
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || "MiniMax-M3";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "minimax/minimax-m3:free";
const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const TEMPERATURE = 0.2;
const MAX_ATTEMPTS = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Jeden fetch s jedným automatickým opakovaním pri 429/503 (transientné limity)
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let res = await fetch(url, init);
  if ((res.status === 429 || res.status === 503) && init.body) {
    await sleep(7000);
    res = await fetch(url, init);
  }
  return res;
}

const SYSTEM_PROMPT = (locale: string, mealType: string, note: string) =>
  [
    "You are a world-class food recognition scientist and dietitian analyzing photos for a calorie-tracking app. Accuracy is critical.",
    "",
    ...(note.trim()
      ? [`USER DESCRIPTION (HIGHEST PRIORITY for identity and quantities – it overrides your visual guess when specific): "${note.trim()}"`, ""]
      : []),
    "IDENTIFICATION METHODOLOGY – follow strictly:",
    "1. Scan the entire image: determine the cuisine (Slovak, Czech, Central European, Italian, Asian, American fast-food, ...), cooking method and EVERY visible component.",
    "2. Identify the SPECIFIC dish from visual cues: shape, color, texture, sauce, garnish, side dishes, tableware, packaging. Use deep knowledge of regional cuisines – e.g., Slovak dishes like bryndzové halušky, kapustnica, lokše, vyprážaný syr s hranolkami, segedínsky guláš, pirohy.",
    "3. If several foods are visible (main + side + drink + garnish), estimate ALL of them and SUM the totals for the whole tray/plate.",
    "4. Estimate portion weight in grams using visual references: dinner plate ≈ 26 cm across, soup bowl ≈ 400 ml, fork ≈ 19 cm long, bread slice ≈ 30 g, standard pizza slice ≈ 100 g, canned drink ≈ 330 ml.",
    "5. Derive macronutrients per component from typical nutritional-database values (USDA-like), adjusted for the visible preparation: deep-fried adds oil/fat, breaded coating adds carbs+fat, cream/butter sauces add fat, sugar glazes add carbs.",
    "6. CONSISTENCY CHECK before answering: kcal must approximately equal 4×protein + 4×carbs + 9×fat (within ±20 %). If it does not, correct the values.",
    "7. HONESTY: if the photo truly contains no food/drink, set all numeric nutrition fields to 0 and confidence to 0, explain in description. If you cannot confidently identify the dish, give the best generic match (e.g. 'vyprážané mäsové jedlo') and LOWER confidence below 0.5 instead of guessing a specific wrong name.",
    "",
    "CONFIDENCE CALIBRATION – always fill this field, calibrated to identification certainty (never inflated, never shy):",
    "- 0.95-0.99: PACKAGED product with brand/product name clearly readable on the packaging, or a very well-known branded item",
    "- 0.90-0.94: standard well-known dish, every component clearly recognizable",
    "- 0.75-0.89: homemade meal, ingredients identifiable but exact recipe/portion uncertain",
    "- 0.50-0.74: partially visible, unusual preparation or heavily mixed components",
    "- below 0.50: cannot identify – generic description only",
    "A packaged product whose name you can READ is NEVER below 0.90.",
    "",
    "OUTPUT FORMAT:",
    "- Exactly ONE valid JSON object. No markdown fences, no extra text.",
    `- All string values in ${locale}.`,
    "- All numbers are plain digits without units or quotes.",
    "- ALWAYS include EVERY schema field – never omit confidence.",
    "Schema:",
    '{"dish": string – short specific name,',
    ' "description": string – components + estimated weight breakdown in 1-2 sentences,',
    ' "product_query": string – PACKAGED product or branded item in the photo: transcribe exact brand + product name printed on it (e.g. "Nutella Ferrero"); fresh unbranded meal/dish: best short database search phrase for it,',
    ' "ean_on_pack": string – digits of the barcode printed on the packaging, transcribed carefully digit by digit ONLY if clearly readable, otherwise "",',
    ' "pack_weight_g": number – declared net weight printed on the package (e.g. "450 g" or "6 x 75 g" total), else 0,',
    ' "retailer": string – store brand / retailer visible on the packaging (Lidl, Kaufland, Tesco...), else "",',
    ' "portion_g": number – total estimated weight eaten,',
    ' "food_form": string – ONE of: "dish" (fresh meal on plate), "piece" (countable units: pockets, nuggets, dumplings, cookies...), "slice" (sliced bread/cake/cheese...), "drink", "pack",',
    ' "unit_weight_g": number – estimated weight of ONE such piece/unit when food is countable (from packaging like "6 x 75 g" or visual size), else 0,',
    ' "pieces_estimated": number – HOW MANY pieces the user likely ate (combine visible units with user description), else 0,',
    ' "kcal": number, "protein": number (g), "carbs": number (g), "fat": number (g),',
    ' "fiber": number (g), "sugar": number (g), "salt": number (g),',
    ' "iron": number (mg), "potassium": number (mg),',
    ' "confidence": number 0-1 – certainty of identification AND estimates,',
    ' "food_class": string – "snack" if this food is typically a SMALL SNACK/TREAT (cookies, candy bar, chocolate, chips, fruit, yogurt, pastry, ice cream...) even if eaten as a whole pack, "main" if it is a PROPER MEAL (meat+sides, pasta, rice dishes, soup+main, full breakfast plate, pizza...),',
    ' "tips": string – ONE short practical health tip about this exact meal}',
    "",
    `Context: this photo shows the user's ${mealType}.`,
  ].join("\n");

const TASK_TEXT = "Analyze this food photo following the methodology. Return exactly one JSON object.";

const GROUND_TEXT = (query: string, candidatesJSON: string, note: string) =>
  [
    `REAL DATABASE CANDIDATES found on the internet for query "${query}" (per-100g values):`,
    candidatesJSON,
    "",
    "GROUNDING TASK:",
    "1. Compare what is visible in the photo (packaging text, brand logo, label values, dish appearance) against these real candidates.",
    "2. VERIFY THE MATCH on three levels: (a) name/brand similarity, (b) declared package weight – if a weight is readable on the photo packaging and it differs from the candidate's package_net_weight_g by more than 10 %, REJECT the match, (c) packaging shape/type in the photo.",
    "3. For countable foods (pieces/slices) also compare candidate unit_weight_g with the visible size of one piece on the photo.",
    "4. If a candidate clearly matches ALL checks: ADOPT its per_100g nutrition as ground truth and scale it to your estimated portion. Set confidence to at least 0.9.",
    '5. When you adopted a candidate, set "matched_source" to its exact source name AND mention it in description. When NO candidate passes the verification, set "matched_source" to "" and keep your own visual estimate unchanged.',
    "6. If the photo shows a readable nutrition label on packaging, label values always win over both database values and your guesses.",
    ...(note.trim() ? [`7. The user's description "${note.trim()}" still overrides quantity and piece-count estimates.`] : []),
    "8. Keep all string values in the same language as before.",
    "Return exactly one final JSON object matching the schema (including matched_source), nothing else.",
  ].join("\n");

// Magic-byte sniffing – uploady niekedy prídu bez MIME typu alebo ako HEIC/AVIF,
// ktoré model nezoberie; podľa prvých base64 bajtov určíme skutočný formát
function sniffMediaType(b64: string): string | null {
  if (b64.startsWith("/9j/")) return "image/jpeg"; // FFD8FF
  if (b64.startsWith("iVBORw0KGgo")) return "image/png"; // 89504E47
  if (b64.startsWith("R0lGOD")) return "image/gif"; // GIF87a/89a
  if (b64.startsWith("UklGR")) return "image/webp"; // RIFF....WEBP
  return null;
}

function parseDataUrl(dataUrl: string): { mediaType: string; data: string } {
  const match = /^data:([^;]*)[;]?base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) throw new Error("Neplatný formát obrázku");
  let mediaType = (match[1] || "").toLowerCase();
  const data = match[2];
  if (!ALLOWED_MEDIA.has(mediaType)) {
    const sniffed = sniffMediaType(data);
    if (!sniffed) throw new Error(`Nepodporovaný typ obrázku: ${mediaType || "neznámy"}`);
    mediaType = sniffed;
  }
  if (data.length > 10 * 1024 * 1024 * 1.37) throw new Error("Obrázok je príliš veľký (max ~10 MB)");
  return { mediaType, data };
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI nevrátilo JSON");
  return JSON.parse(raw.slice(start, end + 1));
}

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

type ParsedAnalysis = {
  result: NutritionResult;
  productQuery: string;
  matchedSource: string;
  eanOnPack: string;
  packWeightG: number;
  retailer: string;
  foodForm: string;
  unitWeightG: number;
  piecesEstimated: number;
  foodClass?: "main" | "snack";
};

function parseAnalysis(text: string): ParsedAnalysis {
  const parsed = extractJson(text);
  const result: NutritionResult = {
    dish: String(parsed.dish ?? "Neznáme jedlo").slice(0, 120),
    description: String(parsed.description ?? "").slice(0, 500),
    portion_g: Math.round(num(parsed.portion_g)),
    kcal: Math.round(num(parsed.kcal)),
    protein: Math.round(num(parsed.protein)),
    carbs: Math.round(num(parsed.carbs)),
    fat: Math.round(num(parsed.fat)),
    fiber: Math.round(num(parsed.fiber)),
    sugar: Math.round(num(parsed.sugar)),
    salt: Number(num(parsed.salt).toFixed(1)),
    iron: parsed.iron != null ? Math.round(num(parsed.iron) * 10) / 10 : undefined,
    potassium: parsed.potassium != null ? Math.round(num(parsed.potassium)) : undefined,
    confidence: Math.min(1, Math.max(0, num(parsed.confidence) || 0.75)),
    tips: parsed.tips ? String(parsed.tips).slice(0, 300) : undefined,
    source: undefined,
  };
  return {
    result,
    productQuery: String(parsed.product_query || result.dish).slice(0, 150),
    matchedSource: String(parsed.matched_source || ""),
    eanOnPack: String(parsed.ean_on_pack || "").replace(/\D/g, "").slice(0, 14),
    packWeightG: Math.round(num(parsed.pack_weight_g)),
    retailer: String(parsed.retailer || "")
      .trim()
      .toLowerCase()
      .slice(0, 40),
    foodForm: String(parsed.food_form || "")
      .trim()
      .toLowerCase()
      .slice(0, 20),
    unitWeightG: Math.round(num(parsed.unit_weight_g)),
    piecesEstimated: Math.round(num(parsed.pieces_estimated)),
    foodClass: parsed.food_class === "snack" ? "snack" : parsed.food_class === "main" ? "main" : undefined,
  };
}

// Physical plausibility checks – catches hallucinated / inconsistent nutrition data
function validateResult(r: NutritionResult): string[] {
  const noFood = r.kcal === 0 && r.protein === 0 && r.carbs === 0 && r.fat === 0;
  if (noFood) return [];
  const issues: string[] = [];
  if (r.kcal < 10 || r.kcal > 4000) issues.push(`kcal ${r.kcal} out of realistic range`);
  if (r.portion_g < 10 || r.portion_g > 3000) issues.push(`portion_g ${r.portion_g} out of range`);
  const atwater = 4 * r.protein + 4 * r.carbs + 9 * r.fat;
  if (atwater >= 50 && Math.abs(r.kcal - atwater) / atwater > 0.5) {
    issues.push(`kcal (${r.kcal}) inconsistent with macros (expected ~${Math.round(atwater)} by 4P+4C+9F)`);
  }
  if (r.sugar > r.carbs + 5) issues.push(`sugar ${r.sugar}g exceeds carbs ${r.carbs}g`);
  if (r.fiber > r.carbs + 5) issues.push(`fiber ${r.fiber}g exceeds carbs ${r.carbs}g`);
  if (r.salt > 25) issues.push(`salt ${r.salt}g unrealistic for one meal`);
  if (r.iron != null && r.iron > 60) issues.push(`iron ${r.iron}mg unrealistic for one meal`);
  if (r.potassium != null && r.potassium > 6000) issues.push(`potassium ${r.potassium}mg unrealistic for one meal`);
  return issues;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: any };

const CORRECTION_PROMPT = (issues: string) =>
  `Problems found in your previous answer: ${issues}. Re-examine the photo carefully, fix exactly these problems and respond again with ONE valid JSON object matching the schema, nothing else.`;

// Up to MAX_ATTEMPTS passes; implausible/inconsistent results get fed back to the
// model for self-correction. Best usable answer wins.
async function analyzeWithRetry(
  baseMessages: ChatMessage[],
  send: (messages: ChatMessage[]) => Promise<string>
): Promise<ParsedAnalysis> {
  let messages = baseMessages;
  let lastText: string | null = null;
  let transportError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let text: string;
    try {
      text = await send(messages);
    } catch (e: any) {
      if (/API error|not set|OpenRouter error/i.test(String(e?.message))) throw e;
      transportError = e;
      break;
    }
    lastText = text;
    let parsed: ParsedAnalysis;
    try {
      parsed = parseAnalysis(text);
    } catch {
      messages = [
        ...messages,
        { role: "assistant", content: text },
        { role: "user", content: CORRECTION_PROMPT("response was not a single valid JSON object matching the schema") },
      ];
      continue;
    }
    const issues = validateResult(parsed.result);
    if (!issues.length) return parsed;
    messages = [
      ...messages,
      { role: "assistant", content: text },
      { role: "user", content: CORRECTION_PROMPT(issues.join("; ")) },
    ];
  }

  if (lastText !== null) {
    try {
      return parseAnalysis(lastText);
    } catch {
      /* fall through */
    }
  }
  throw new Error(transportError instanceof Error ? transportError.message : "AI analýza zlyhala – skús odfotiť jedlo znova");
}

// Lineárny prepočet všetkých výživových hodnôt na novú porciu
function rescaleToPortion(result: NutritionResult, newPortion: number): NutritionResult {
  if (!result.portion_g || newPortion <= 0) return result;
  const k = newPortion / result.portion_g;
  const scaleInt = (v: number) => Math.round(v * k);
  const scale1 = (v: number) => Math.round(v * k * 10) / 10;
  return {
    ...result,
    portion_g: Math.round(newPortion),
    kcal: scaleInt(result.kcal),
    protein: scaleInt(result.protein),
    carbs: scaleInt(result.carbs),
    fat: scaleInt(result.fat),
    fiber: scaleInt(result.fiber),
    sugar: scaleInt(result.sugar),
    salt: scale1(result.salt),
    iron: result.iron != null ? scale1(result.iron) : undefined,
    potassium: result.potassium != null ? scaleInt(result.potassium) : undefined,
  };
}

// Počet kusov z poznámky – "3 taščičky", "zjedol som 4 kusy", "2 pirohy"...
function extractNoteCount(note: string): number {
  const re =
    /(\d{1,2})\s*(?:x\s*)?(?:kus\w*|ks\b|kúso\w*|kuso\w*|pieces?|pcs\b|taščičk\w*|tascick\w*|piroh\w*|pierog\w*|koliešk\w*|koliesk\w*|nugget\w*|sušienk\w*|susienk\w*|vafľ\w*|vafl\w*|tyčink\w*|tycink\w*|cukrík\w*|cukrik\w*|bonbón\w*|bonbon\w*|langoš\w*|langos\w*)/i;
  const m = note.match(re);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return n > 0 && n <= 30 ? n : 0;
}

// Deterministická finálna vrstva (fáza E): rozhodne o porcii podľa priority
//   1. explicitné gramy z poznámky ("150 g syra, 200 g hranolky")
//   2. počet kusov z poznámky × hmotnosť kusu ("3 taščičky" × 75 g)
//   3. model odhad počtu kusov × hmotnosť kusu
// Inak ostáva model odhad porcie bez zásahu.
function finalizePortions(
  parsed: ParsedAnalysis,
  note: string,
  candidateUnitWeightG: number | null,
  candidatePieces: number | null
): NutritionResult {
  const result = parsed.result;
  const noFood = result.kcal === 0 && result.protein === 0 && result.carbs === 0 && result.fat === 0;
  if (noFood || !result.portion_g) return result;

  const trimmedNote = (note || "").trim();

  // unit weight priorita: DB kandidát (unit alebo netWeight/pieces) > model odhad z fotky
  let unitW: number | null = candidateUnitWeightG ?? null;
  if (!unitW && candidatePieces && candidatePieces >= 2 && parsed.packWeightG >= candidatePieces) {
    unitW = Math.round(parsed.packWeightG / candidatePieces);
  }
  if (!unitW && parsed.unitWeightG >= 10 && parsed.unitWeightG <= 1000) unitW = parsed.unitWeightG;

  // 1) gramy z poznámky
  const gramsNote = extractNoteGrams(trimmedNote);
  const unitsNote = extractNoteUnits(trimmedNote);
  const noteTotal = (gramsNote ?? 0) + (unitsNote ?? 0);

  let target = 0;
  if (noteTotal >= 10) {
    target = noteTotal;
  } else {
    // 2) počet kusov z poznámky
    const noteCount = extractNoteCount(trimmedNote);
    // 3) model odhad počtu kusov
    const modelCount = parsed.piecesEstimated > 0 ? parsed.piecesEstimated : 0;

    // multipack z obalu: "zjedol som 2 z balenia 6 x 75 g" → noteCount rieši;
    // ak model vidí viac kusov a form je piece/slice, použi jeho odhad
    const countable = parsed.foodForm === "piece" || parsed.foodForm === "slice" || !!candidatePieces;
    if (noteCount > 0 && unitW) target = Math.min(noteCount * unitW, 3000);
    else if (modelCount > 0 && unitW && countable) target = Math.min(modelCount * unitW, 3000);
  }

  if (target > 0 && Math.abs(result.portion_g - target) / target > 0.2) {
    // sanity cap – prepočet nesmie odbehnúť viac ako 3× (resp. +300 g) od vizuálneho
    // odhadu modelu; chráni to pred zlým unit-weight (napr. serving pomylený za kus)
    const cap = Math.max(result.portion_g * 3, result.portion_g + 300);
    if (target <= cap) return rescaleToPortion(result, target);
  }
  return result;
}

// Shared two-pass pipeline: (1) vision analysis, (2) grounding against real
// internet nutrition databases when candidates are found.
abstract class VisionProvider implements AIProvider {
  protected abstract visionContent(): any[];
  protected abstract send(messages: ChatMessage[]): Promise<string>;

  async analyze(_imageBase64: string, opts?: { mealType?: string; note?: string; locale?: string }): Promise<NutritionResult> {
    const localeName = opts?.locale === "en" ? "English" : "slovenčina";
    const sys = SYSTEM_PROMPT(localeName, opts?.mealType || "lunch", opts?.note || "");
    const makeMessages = (extraText?: string): ChatMessage[] => [
      { role: "system", content: sys },
      { role: "user", content: [...this.visionContent(), { type: "text", text: extraText ?? TASK_TEXT }] },
    ];

    // Pass 1 – pure visual analysis with self-correction
    const p1 = await analyzeWithRetry(makeMessages(), (m) => this.send(m));
    if (p1.foodClass) p1.result.foodClass = p1.foodClass;

    const noFood = p1.result.kcal === 0 && p1.result.protein === 0 && p1.result.carbs === 0 && p1.result.fat === 0;
    if (noFood) return finalizePortions(p1, opts?.note || "", null, null);

    // Fáza B – EAN fast-path: čitateľný čiarový kód z obalu → priamy DB lookup
    let candidates: FoodCandidate[] | null = null;
    if (p1.eanOnPack && isValidGTIN(p1.eanOnPack)) {
      try {
        const hit = await lookupByEAN(p1.eanOnPack);
        if (hit && hit.kcal100 != null && hit.kcal100 > 0) {
          candidates = [
            {
              source: hit.source,
              name: hit.name,
              brand: hit.brand,
              kcal100: hit.kcal100,
              protein100: hit.protein100,
              carbs100: hit.carbs100,
              sugar100: hit.sugar100,
              fat100: hit.fat100,
              fiber100: hit.fiber100,
              salt100: hit.salt100,
              servingG: hit.servingG,
              netWeightG: hit.netWeightG,
              unitWeightG: hit.unitWeightG,
              pieces: hit.pieces,
            },
          ];
        }
      } catch {}
    }

    // Name search fallback (fáza C) – retailer boost robí foodSearch interne
    if (!candidates) {
      try {
        candidates = await searchFoodCandidates(p1.productQuery);
      } catch {
        return finalizePortions(p1, opts?.note || "", null, null);
      }
    }
    if (!candidates.length) return finalizePortions(p1, opts?.note || "", null, null);

    const best = candidates[0];

    // Pass 2 – ground the estimate in real database values
    try {
      const grounded = await analyzeWithRetry(
        makeMessages(GROUND_TEXT(p1.productQuery, candidatesToPromptJSON(candidates), opts?.note || "")),
        (m) => this.send(m)
      );
      // source razíme len keď model skutočne prebral kandidáta (matched_source)
      if (!grounded.result.source && /open food facts|usda|foodrepo/i.test(grounded.matchedSource)) {
        grounded.result.source = grounded.matchedSource;
      }
      // Overené hodnoty z databázy (etiketa) sú objektívne spoľahlivejšie než vizuálny
      // odhad – pri potvrdenej zhode je podlaha dôvery 0.9 vecne opodstatnená
      const verified = /open food facts|usda|foodrepo/i.test(grounded.matchedSource);
      if (verified && grounded.result.confidence < 0.9) {
        grounded.result = { ...grounded.result, confidence: 0.9 };
      }
      if (grounded.foodClass) grounded.result.foodClass = grounded.foodClass;
      // unit weight z kandidáta len pri potvrdenej zhode
      const unitW = grounded.matchedSource ? best.unitWeightG ?? null : null;
      const pieces = grounded.matchedSource ? best.pieces ?? null : null;
      return finalizePortions(grounded, opts?.note || "", unitW, pieces);
    } catch {
      // pass-2 zlyhal → vizuálny odhad + kusová logika bez DB unit weight
      return finalizePortions(p1, opts?.note || "", null, null);
    }
  }
}

// OpenRouter vision provider – MiniMax M3 (free) / iné modely cez OPENROUTER_MODEL
class OpenRouterProvider extends VisionProvider {
  private imageBase64 = "";

  async analyze(imageBase64: string, opts?: { mealType?: string; note?: string; locale?: string }): Promise<NutritionResult> {
    // validácia + normalizácia – pri zlom/chýbajúcom MIME type sniffing vráti správny
    // formát a data-URL sa prestavi, aby ho model akceptoval
    const fixed = parseDataUrl(imageBase64);
    const normalized = `data:${fixed.mediaType};base64,${fixed.data}`;
    this.imageBase64 = normalized;
    return super.analyze(normalized, opts);
  }

  protected visionContent(): any[] {
    return [{ type: "image_url", image_url: { url: this.imageBase64 } }];
  }

  protected async send(messages: ChatMessage[]): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY!;
    const res = await fetchWithRetry("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: 2048,
        temperature: TEMPERATURE,
        response_format: { type: "json_object" },
        messages,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenRouter API error ${res.status}: ${body.slice(0, 300)}`);
    }
    const json: any = await res.json();
    if (json.error) throw new Error(`OpenRouter error: ${JSON.stringify(json.error).slice(0, 300)}`);
    return json.choices?.[0]?.message?.content ?? "";
  }
}

class MuseSparkProvider implements AIProvider {
  async analyze(imageBase64: string, opts?: { mealType?: string; note?: string; locale?: string }): Promise<NutritionResult> {
    // Real implementation – calls Muse Spark Vision API
    // Expected to be enabled when MUSE_SPARK_API_KEY is set.
    // For now, throw to fallback to mock if not configured.
    const apiKey = process.env.MUSE_SPARK_API_KEY;
    if (!apiKey) throw new Error("MUSE_SPARK_API_KEY not set");

    // Example prompt – replace endpoint with real one when available
    // This is a placeholder for future integration:
    // const res = await fetch("https://api.muse-spark.example/v1/vision/analyze", { ... })
    // user note (opts.note) will be part of the prompt so the model can use it
    // For now delegate to mock to keep app functional
    const mock = new MockProvider();
    return mock.analyze(imageBase64, opts);
  }
}

export function getAIProvider(): AIProvider {
  if (process.env.OPENROUTER_API_KEY) return new OpenRouterProvider();
  if (process.env.MUSE_SPARK_API_KEY) return new MuseSparkProvider();
  return new MockProvider();
}

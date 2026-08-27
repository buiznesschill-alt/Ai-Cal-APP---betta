import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookie, verifyToken } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";
import { parsePackaging } from "@/lib/quantity/parse";
import { classifyProduct } from "@/lib/quantity/classify";
import { buildQuantityProfile } from "@/lib/quantity/profile";

// Beta: cache úspešných lookupov (rule 8) – rýchlejšie skeny, menej rate-limitov
const CACHE_PATH = path.join(process.cwd(), "data", "barcode-cache-beta.json");

async function readCache(): Promise<Record<string, any>> {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeCacheEntry(code: string, entry: Record<string, any>): Promise<void> {
  try {
    const cache = await readCache();
    cache[code] = { ...entry, last_synced_at: new Date().toISOString() };
    await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
    await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");
  } catch {}
}

// Beta: barcode lookup – reťazec databáz (všetky potraviny):
//  1. Open Food Facts (world)      – najväčšia otvorená food DB
//  2. Open Food Facts (mirror)     – CDN fallback keď je world preťažený
//  3. USDA FoodData Central        – voliteľné (USDA_FDC_API_KEY), plné mikroživiny
//  4. Open Food Facts legacy v0    – posledný OFF pokus
export async function GET(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let code = (new URL(req.url).searchParams.get("code") || "").replace(/\D/g, "");
  // GTIN-14 (z GS1 AI 01) → normalizácia na EAN-13/8 odstránením vedúcich núl
  while (code.length > 13 && code.startsWith("0")) code = code.slice(1);
  if (code.length < 6 || code.length > 14) return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  // originálny naskenovaný obsah (môže byť GS1-128/Digital Link) – uchováme ho oddelene (rule: original + normalized)
  const rawScan = new URL(req.url).searchParams.get("raw") || "";

  // GS1 AI 310n (kg, n desatín) / 320n (lb) → gramy net-weight
  function parseGs1Weight(raw: string): number | null {
    const kg = raw.match(/\(?\s*31(0[0-3])\)?\s*\)?(\d{6})/);
    if (kg) {
      const dec = parseInt(kg[1][1], 10);
      const g = Math.round((parseInt(kg[2], 10) / Math.pow(10, dec)) * 1000);
      if (g > 0 && g <= 30000) return g;
    }
    const lb = raw.match(/\(?\s*32(0[0-3])\)?\s*\)?(\d{6})/);
    if (lb) {
      const dec = parseInt(lb[1][1], 10);
      const g = Math.round((parseInt(lb[2], 10) / Math.pow(10, dec)) * 453.59237);
      if (g > 0 && g <= 30000) return g;
    }
    return null;
  }
  const gs1Weight = parseGs1Weight(rawScan);

  const SOURCE = "Open Food Facts";
  const SOURCE_URL = `https://world.openfoodfacts.org/product/${code}`;
  const LICENCE = "ODbL";

  // cache hit – okamžitá odpoveď bez siete (len ak záznam obsahuje profile + nutrition flag)
  const cache = await readCache();
  const cacheHit = cache[code];
  if (cacheHit?.product && cacheHit.profile && cacheHit.product.nutrition != null && cacheHit.barcode_original != null) {
    return NextResponse.json({ found: true, product: cacheHit.product, profile: cacheHit.profile, source: cacheHit.source ?? SOURCE, sourceUrl: cacheHit.source_url ?? SOURCE_URL, licence: LICENCE, barcodeOriginal: cacheHit.barcode_original ?? code, cached: true });
  }

  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };

  // "240 g" / "0.24 kg" / "24 dag" / "1 l" -> gramy (ml≈g pri potravinách)
  function parseGrams(s: string): number | null {
    if (!s) return null;
    const m = s.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilogram\w*|dag\b|deka\b|g\b|gram\w*|l\b|liter\w*|litr\w*|ml\b|mililit\w*)/i);
    if (!m) return null;
    let v = parseFloat(m[1].replace(",", "."));
    const u = m[2].toLowerCase();
    if (u.startsWith("kg") || u.startsWith("kilogram")) v *= 1000;
    else if (u === "dag" || u === "deka") v *= 10;
    else if (u === "l" || u.startsWith("litr") || u.startsWith("liter")) v *= 1000;
    if (!Number.isFinite(v) || v <= 0 || v > 30000) return null;
    return Math.round(v);
  }

  // počet kusov v balení: "6 ks", "6 kusov", "6 pieces", "6 tyčinok", "6x", "pack of 6"...
  function parsePieces(s: string): number | null {
    if (!s) return null;
    const patterns = [
      /(\d{1,3})\s*(?:ks\b|kus)/i,
      /(\d{1,3})\s*(?:pieces?|pcs\b|capsules?|sachets?|bars?\b|tablets?|candies?)/i,
      /(\d{1,3})\s*(?:porci\w*)/i,
      /(\d{1,3})\s*(?:tyčin\w*|tycin\w*|rolk\w*|kapsl\w*|vreck\w*|plechovk\w*|plechoviek|flašk\w*|flask\w*)/i,
      /(?:pack|balenie|sada)\D{0,12}(\d{1,3})/i,
      /(\d{1,3})\s*x\b/i,
    ];
    for (const re of patterns) {
      const m = s.match(re);
      if (m) {
        const v = parseInt(m[1], 10);
        if (v >= 2 && v <= 100) return v;
      }
    }
    return null;
  }

  interface ProviderHit {
    product: any;
    hasNutrition: boolean;
    source: string;
    sourceUrl: string;
    kcal100: number;
    np: any;
  }

  // ---- Open Food Facts (v2) – world aj mirror host ----
  async function lookupOFF(host: string, sourceLabel: string, gs1Weight: number | null): Promise<ProviderHit | null> {
    const fields = [
      "product_name_sk", "product_name_cs", "product_name_en", "product_name",
      "brands", "quantity", "serving_quantity", "serving_size", "nutriments",
      "categories_tags",
    ].join(",");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(`https://${host}/api/v2/product/${code}.json?fields=${fields}`, {
      signal: ctrl.signal,
      headers: { "User-Agent": "FitCal-Beta - Android - Version 1.0" },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    if (j.status !== 1 || !j.product) return null;
    const p = j.product;
    const n = (p.nutriments ?? {}) as Record<string, unknown>;

    let kcal100 = num(n["energy-kcal_100g"]);
    if (!Number.isFinite(kcal100)) kcal100 = num(n["energy-kcal"]);
    if (!Number.isFinite(kcal100)) {
      const e = num(n["energy_100g"]) ?? num(n["energy"]);
      const unit = String(n["energy_unit"] ?? n["unit"] ?? "").toLowerCase();
      if (Number.isFinite(e) && e > 0) kcal100 = unit === "kcal" ? e : e / 4.184;
    }

    let salt100 = num(n["salt_100g"]);
    if (!Number.isFinite(salt100)) {
      const sodium = num(n["sodium_100g"]);
      if (Number.isFinite(sodium)) salt100 = sodium * 2.5;
    }

    const iron100 = num(n["iron_100g"]);
    const potassium100 = num(n["potassium_100g"]);

    const servingQty = Number(p.serving_quantity);
    const basis = Number.isFinite(servingQty) && servingQty > 0 ? Math.round(servingQty) : 100;
    const scale = (per100: unknown): number => {
      const v = Number(per100);
      if (!Number.isFinite(v) || v < 0) return 0;
      return Math.round(((v * basis) / 100) * 10) / 10;
    };

    const name: string = (p.product_name_sk || p.product_name_cs || p.product_name_en || p.product_name || "").toString().trim();
    const brands: string = (p.brands || "").toString().trim();
    const qty: string = (p.quantity || p.serving_size || "").toString().trim();

    // kusy v balení – reálny prepočet
    let pieceG: number | null = null;
    let packageG: number | null = null;
    let pieces: number | null = null;
    const multi = (name + " " + qty).match(/(\d{1,3})\s*(?:x|×)\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i);
    if (multi) {
      pieces = parseInt(multi[1], 10);
      const unitG = parseGrams(`${multi[2]} ${multi[3]}`);
      if (pieces >= 2 && pieces <= 100 && unitG) {
        pieceG = unitG;
        packageG = pieces * unitG;
      } else {
        pieces = null;
      }
    }
    if (pieceG == null) {
      packageG = parseGrams(qty) ?? parseGrams(name);
      const searchPieces = parsePieces(name) ?? parsePieces(qty);
      const serving = num(p.serving_quantity);
      if (packageG && searchPieces && searchPieces >= 2 && packageG / searchPieces >= 1) {
        pieces = searchPieces;
        pieceG = Math.round((packageG / pieces) * 10) / 10;
      } else if (Number.isFinite(serving) && serving > 0 && serving < 1500) {
        pieceG = Math.round(serving);
        pieces = packageG && packageG >= serving ? Math.floor(packageG / serving) : null;
      }
    }

    const hasNutrition = Number.isFinite(kcal100) && kcal100 > 0;

    const product = {
      code,
      barcodeOriginal: rawScan || code,
      dish: (name || `Produkt ${code}`).slice(0, 80),
      description: [brands, qty].filter(Boolean).join(" • ").slice(0, 120),
      portion_g: basis,
      pieceG,
      packageG,
      pieces,
      kcal: Math.round(scale(Number.isFinite(kcal100) ? kcal100 : 0)),
      protein: scale(n["proteins_100g"]),
      carbs: scale(n["carbohydrates_100g"]),
      fat: scale(n["fat_100g"]),
      fiber: scale(n["fiber_100g"]),
      sugar: scale(n["sugars_100g"]),
      salt: Math.min(50, scale(salt100)),
      iron: Number.isFinite(iron100) ? Math.round(scale(iron100) * 10) / 10 : 0,
      potassium: Number.isFinite(potassium100) ? Math.round(scale(potassium100)) : 0,
      nutrition: hasNutrition,
    };

    const packaging = parsePackaging(qty, name, p.serving_size || "", p.serving_quantity);
    // GS1-128 AI 310n/320n – net weight z čiarového kódu doplní chýbajúcu gramáž
    if (packaging.netWeight == null && gs1Weight) packaging.netWeight = gs1Weight;
    const np = {
      barcode: code,
      name: name || `Produkt ${code}`,
      brand: brands,
      netWeight: packaging.netWeight,
      netWeightUnit: packaging.netWeightUnit,
      packageCount: packaging.packageCount,
      unitWeight: packaging.unitWeight,
      servingSize: packaging.servingSize,
      servingsPerPackage: packaging.servingsPerPackage,
      categoriesTags: (p.categories_tags || []) as string[],
      packagingText: packaging.packagingText,
      productText: name,
      isLiquid: packaging.isLiquid,
    };

    return { product, hasNutrition, source: sourceLabel, sourceUrl: `https://world.openfoodfacts.org/product/${code}`, kcal100: Number.isFinite(kcal100) ? kcal100 : 0, np };
  }

  // ---- USDA FoodData Central – search podľa UPC (by-upc endpoint je nespľahlivý) ----
  async function lookupUSDA(code: string): Promise<ProviderHit | null> {
    const key = process.env.USDA_FDC_API_KEY;
    if (!key) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${key}&query=${code}&dataType=Branded&pageSize=10`, {
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    const foods: any[] = j?.foods ?? [];
    if (!foods.length) return null;

    // match gtinUpc ignorujúc vedúce nuly
    const cPad = code.padStart(14, "0");
    const f = foods.find((x: any) => {
      const g = String(x.gtinUpc ?? "").replace(/\D/g, "");
      if (!g) return false;
      return g === code || g.padStart(14, "0") === cPad;
    });
    if (!f || !f.description) return null;

    const nutrients: any[] = f.foodNutrients ?? [];
    const pick = (match: (x: any) => boolean): number => {
      const x = nutrients.find(match);
      const v = x ? Number(x.value) : NaN;
      return Number.isFinite(v) && v >= 0 ? v : 0;
    };
    let kcal100 = pick((x) => x.nutrientName === "Energy" && String(x.unitName).toUpperCase() === "KCAL");
    if (!kcal100) {
      const kj = pick((x) => x.nutrientName === "Energy" && String(x.unitName).toUpperCase() === "KJ");
      if (kj) kcal100 = kj / 4.184;
    }
    const protein100 = pick((x) => x.nutrientName === "Protein");
    const carbs100 = pick((x) => String(x.nutrientName).startsWith("Carbohydrate, by difference"));
    const fat100 = pick((x) => x.nutrientName === "Total lipid (fat)");
    const fiber100 = pick((x) => String(x.nutrientName).startsWith("Fiber, total dietary"));
    const sugar100 = pick((x) => String(x.nutrientName).startsWith("Sugars, total"));
    const sodiumMg = pick((x) => x.nutrientName === "Sodium");
    const salt100 = sodiumMg ? (sodiumMg * 2.5) / 1000 : 0;
    const iron100 = pick((x) => x.nutrientName === "Iron, Fe");
    const potassium100 = pick((x) => x.nutrientName === "Potassium, K");

    const servingQty = Number(f.servingSize);
    const basis = Number.isFinite(servingQty) && servingQty > 0 ? Math.round(servingQty) : 100;
    const scale = (per100: number): number => Math.round(((per100 * basis) / 100) * 10) / 10;

    const hasNutrition = kcal100 > 0 || protein100 > 0 || carbs100 > 0;
    const product = {
      code,
      dish: String(f.description).slice(0, 80),
      description: [f.brandOwner, f.dataType].filter(Boolean).join(" • ").slice(0, 120),
      portion_g: basis,
      pieceG: null,
      packageG: null,
      pieces: null,
      kcal: Math.round(scale(kcal100)),
      protein: scale(protein100),
      carbs: scale(carbs100),
      fat: scale(fat100),
      fiber: scale(fiber100),
      sugar: scale(sugar100),
      salt: Math.min(50, scale(salt100)),
      iron: Math.round(scale(iron100) * 10) / 10,
      potassium: Math.round(scale(potassium100)),
      nutrition: hasNutrition,
    };

    const packaging = parsePackaging("", product.dish, f.servingSize ? `${f.servingSize} g` : "", null);
    const np = {
      barcode: code,
      name: product.dish,
      brand: f.brandOwner || "",
      netWeight: null,
      netWeightUnit: "g" as const,
      packageCount: null,
      unitWeight: null,
      servingSize: basis,
      servingsPerPackage: null,
      categoriesTags: [] as string[],
      packagingText: "",
      productText: product.dish,
      isLiquid: false,
    };

    return { product, hasNutrition, source: "USDA FoodData Central", sourceUrl: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${f.fdcId}/nutrients`, kcal100, np };
  }

  // ---- Edamam Food Database – parser podporuje UPC (voliteľné: EDAMAM_APP_ID + EDAMAM_APP_KEY) ----
  async function lookupEdamam(code: string): Promise<ProviderHit | null> {
    const appId = process.env.EDAMAM_APP_ID;
    const appKey = process.env.EDAMAM_APP_KEY;
    if (!appId || !appKey) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(`https://api.edamam.com/api/food-database/v2/parser?upc=${code}&app_id=${appId}&app_key=${appKey}`, {
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    const food = j?.hints?.[0]?.food;
    if (!food?.label) return null;
    const n = food.nutrients ?? {};
    const pick = (k: string): number => {
      const v = Number(n[k]);
      return Number.isFinite(v) && v >= 0 ? v : 0;
    };
    const kcal100 = pick("ENERC_KCAL");
    const protein100 = pick("PROCNT");
    const carbs100 = pick("CHOCDF");
    const fat100 = pick("FAT");
    const fiber100 = pick("FIBER");
    const sugar100 = pick("SUGAR");
    const sodiumMg = pick("NA");
    const salt100 = sodiumMg ? (sodiumMg * 2.5) / 1000 : 0;
    const iron100 = pick("FE");
    const potassium100 = pick("K");

    const basis = 100;
    const scale = (per100: number): number => Math.round(per100 * 10) / 10;
    const hasNutrition = kcal100 > 0 || protein100 > 0 || carbs100 > 0;

    const product = {
      code,
      dish: String(food.label).slice(0, 80),
      description: (food.brand ? String(food.brand) : "Edamam").slice(0, 120),
      portion_g: basis,
      pieceG: null,
      packageG: null,
      pieces: null,
      kcal: Math.round(scale(kcal100)),
      protein: scale(protein100),
      carbs: scale(carbs100),
      fat: scale(fat100),
      fiber: scale(fiber100),
      sugar: scale(sugar100),
      salt: Math.min(50, scale(salt100)),
      iron: scale(iron100),
      potassium: Math.round(scale(potassium100)),
      nutrition: hasNutrition,
    };

    const packaging = parsePackaging("", product.dish, "", null);
    const np = {
      barcode: code,
      name: product.dish,
      brand: String(food.brand || ""),
      netWeight: null,
      netWeightUnit: "g" as const,
      packageCount: null,
      unitWeight: null,
      servingSize: basis,
      servingsPerPackage: null,
      categoriesTags: [] as string[],
      packagingText: "",
      productText: product.dish,
      isLiquid: false,
    };

    return { product, hasNutrition, source: "Edamam", sourceUrl: `https://www.edamam.com/food-database/`, kcal100, np };
  }

  // ---- FoodRepo (CH/EU) – barcode lookup (voliteľné: FOODREPO_API_KEY, free na foodrepo.org) ----
  async function lookupFoodRepo(code: string): Promise<ProviderHit | null> {
    const key = process.env.FOODREPO_API_KEY;
    if (!key) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(`https://www.foodrepo.org/api/v3/products/barcode/${code}`, {
      signal: ctrl.signal,
      headers: { "api-key": key, Accept: "application/json" },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    const p = j?.data;
    if (!p) return null;
    const names = p.name_translations ?? {};
    const name: string = (names.en || names.de || names.fr || names.it || "").toString().trim();
    if (!name) return null;

    const q = p.nutrient_quantities_per_100g ?? {};
    const val = (k: string): number => {
      const v = Number(q[k]?.value);
      return Number.isFinite(v) && v >= 0 ? v : 0;
    };
    const kcal100 = val("energy_kcal");
    const protein100 = val("proteins");
    const carbs100 = val("carbohydrates");
    const fat100 = val("fat");
    const fiber100 = val("fiber");
    const sugar100 = val("sugar");
    let salt100 = val("salt");
    if (!salt100) {
      const sodium = val("sodium");
      if (sodium) salt100 = (sodium * 2.5) / 1000;
    }
    const iron100 = val("iron");
    const potassium100 = val("potassium");

    const hasNutrition = kcal100 > 0 || protein100 > 0 || carbs100 > 0;
    const product = {
      code,
      dish: name.slice(0, 80),
      description: [p.brand?.name || p.brand_string, p.quantity ? `${p.quantity} ${p.unit ?? ""}`.trim() : ""].filter(Boolean).join(" • ").slice(0, 120),
      portion_g: 100,
      pieceG: null,
      packageG: null,
      pieces: null,
      kcal: Math.round(kcal100),
      protein: Math.round(protein100 * 10) / 10,
      carbs: Math.round(carbs100 * 10) / 10,
      fat: Math.round(fat100 * 10) / 10,
      fiber: Math.round(fiber100 * 10) / 10,
      sugar: Math.round(sugar100 * 10) / 10,
      salt: Math.min(50, Math.round(salt100 * 100) / 100),
      iron: Math.round(iron100 * 10) / 10,
      potassium: Math.round(potassium100),
      nutrition: hasNutrition,
    };

    const packaging = parsePackaging(p.quantity || "", name, "", null);
    const np = {
      barcode: code,
      name,
      brand: p.brand?.name || p.brand_string || "",
      netWeight: packaging.netWeight,
      netWeightUnit: packaging.netWeightUnit,
      packageCount: packaging.packageCount,
      unitWeight: packaging.unitWeight,
      servingSize: null,
      servingsPerPackage: null,
      categoriesTags: (p.categories_tags || []) as string[],
      packagingText: p.quantity || "",
      productText: name,
      isLiquid: packaging.isLiquid,
    };

    return { product, hasNutrition, source: "FoodRepo", sourceUrl: `https://www.foodrepo.org/products/${p.id ?? ""}`, kcal100, np };
  }

  // ---- reťazec poskytovateľov: preferujeme zásah s výživovými hodnotami ----
  const results: ProviderHit[] = [];
  const tryProvider = async (fn: () => Promise<ProviderHit | null>) => {
    try {
      const hit = await fn();
      if (hit) results.push(hit);
    } catch {}
  };

  await tryProvider(() => lookupOFF("world.openfoodfacts.org", "Open Food Facts", gs1Weight));
  if (!results.some((r) => r.hasNutrition)) await tryProvider(() => lookupOFF("static.openfoodfacts.org", "Open Food Facts", gs1Weight));
  if (!results.some((r) => r.hasNutrition) && process.env.USDA_FDC_API_KEY) await tryProvider(() => lookupUSDA(code));
  if (!results.some((r) => r.hasNutrition) && process.env.FOODREPO_API_KEY) await tryProvider(() => lookupFoodRepo(code));
  if (!results.some((r) => r.hasNutrition) && process.env.EDAMAM_APP_ID && process.env.EDAMAM_APP_KEY) await tryProvider(() => lookupEdamam(code));
  if (!results.some((r) => r.hasNutrition)) await tryProvider(() => lookupOFF("world.openfoodfacts.org", "Open Food Facts", gs1Weight));

  const providerHit: ProviderHit | null = results.find((r) => r.hasNutrition) ?? results[0] ?? null;
  if (!providerHit) {
    return NextResponse.json({ found: false });
  }

  // --- Quantity Engine: normalizácia → classifier → profile (server-side) ---
  const { packageType, confidence } = classifyProduct(providerHit.np);
  const profile = buildQuantityProfile(providerHit.np, packageType, confidence, providerHit.kcal100);

  // rule 8 + 10: cache úspešný lookup + source/licence metadáta
  await writeCacheEntry(code, { product: providerHit.product, profile, source: providerHit.source, source_url: providerHit.sourceUrl, licence: providerHit.source === "Open Food Facts" ? "ODbL" : "Public domain (USDA)", barcode_original: rawScan || code });

  return NextResponse.json({
    found: true,
    product: providerHit.product,
    profile,
    source: providerHit.source,
    sourceUrl: providerHit.sourceUrl,
    licence: providerHit.source === "Open Food Facts" ? "ODbL" : "Public domain",
    barcodeOriginal: rawScan || code,
    cached: false,
  });
}

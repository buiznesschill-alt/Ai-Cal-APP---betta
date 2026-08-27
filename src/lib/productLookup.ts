// Shared EAN/GTIN lookup pre AI photo-flow (fáza B retail matching).
// Zjednodušená verzia logiky z api/barcode – vracia per-100g dáta + packaging info,
// ktoré grounding fáza v provideri použije na verifikáciu zhody s fotkou.

export interface BarcodeProduct {
  source: string;
  code: string;
  name: string;
  brand: string | null;
  kcal100: number | null;
  protein100: number | null;
  carbs100: number | null;
  sugar100: number | null;
  fat100: number | null;
  fiber100: number | null;
  salt100: number | null;
  iron100: number | null;
  potassium100: number | null;
  netWeightG: number | null; // celková gramaž balenia (napr. 450)
  unitWeightG: number | null; // hmotnosť 1 kusu pri multipackoch (napr. taščička 75 g)
  pieces: number | null; // počet kusov v balení
  servingG: number | null;
}

const UA = { "User-Agent": "FitCal-Beta - Android - Version 1.0" };

async function fetchJSON(url: string, headers: Record<string, string> = {}, timeoutMs = 9000): Promise<any> {
  const res = await fetch(url, {
    headers: { ...UA, ...headers },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.trimStart().startsWith("{") && !text.trimStart().startsWith("[")) {
    throw new Error("Non-JSON response");
  }
  return JSON.parse(text);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

// "240 g" / "0.24 kg" / "24 dag" / "1 l" -> gramy
function parseGrams(s: string): number | null {
  if (!s) return null;
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilogram\w*|dag\b|deka\b|g\b|gram\w*|l\b|liter\w*|litr\w*|ml\b|mililit\w*)/i);
  if (!m) return null;
  let v = parseFloat(m[1].replace(",", "."));
  const u = m[2].toLowerCase();
  if (u.startsWith("kg") || u.startsWith("kilogram")) v *= 1000;
  else if (u === "dag" || u === "deka") v *= 10;
  else if (u === "l" || u.startsWith("litr") || u.startsWith("liter")) v *= 1000;
  // ml ≈ g pri potravinách – ostáva bez zmeny
  if (!Number.isFinite(v) || v <= 0 || v > 30000) return null;
  return Math.round(v);
}

async function lookupOFF(code: string, host: string, sourceLabel: string): Promise<BarcodeProduct | null> {
  const fields = [
    "product_name_sk",
    "product_name_cs",
    "product_name_en",
    "product_name",
    "brands",
    "quantity",
    "serving_quantity",
    "serving_size",
    "nutriments",
  ].join(",");
  const json = await fetchJSON(`https://${host}/api/v2/product/${code}.json?fields=${fields}`);
  if (json.status !== 1 || !json.product) return null;
  const p = json.product;
  const n: Record<string, unknown> = p.nutriments ?? {};

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

  const name: string = String(p.product_name_sk || p.product_name_cs || p.product_name_en || p.product_name || "").trim();
  if (!name) return null;

  // gramaž balenia + multipack ("6 x 75 g", "6x75g")
  let netWeightG: number | null = parseGrams(String(p.quantity || ""));
  let unitWeightG: number | null = null;
  let pieces: number | null = null;
  const multi = `${name} ${p.quantity || ""}`.match(/(\d{1,3})\s*(?:x|×)\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i);
  if (multi) {
    const cnt = parseInt(multi[1], 10);
    const unitG = parseGrams(`${multi[2]} ${multi[3]}`);
    if (cnt >= 2 && cnt <= 100 && unitG) {
      pieces = cnt;
      unitWeightG = unitG;
      netWeightG = cnt * unitG;
    }
  }
  if (netWeightG == null && unitWeightG == null) {
    const servingQty = num(p.serving_quantity);
    if (Number.isFinite(servingQty) && servingQty > 0 && servingQty < 1500) unitWeightG = Math.round(servingQty);
  }

  return {
    source: sourceLabel,
    code,
    name,
    brand: String(p.brands || "").split(",")[0].trim() || null,
    kcal100: Number.isFinite(kcal100) ? Math.round(kcal100 * 10) / 10 : null,
    protein100: Number.isFinite(num(n["proteins_100g"])) ? Math.round(num(n["proteins_100g"]) * 10) / 10 : null,
    carbs100: Number.isFinite(num(n["carbohydrates_100g"])) ? Math.round(num(n["carbohydrates_100g"]) * 10) / 10 : null,
    sugar100: Number.isFinite(num(n["sugars_100g"])) ? Math.round(num(n["sugars_100g"]) * 10) / 10 : null,
    fat100: Number.isFinite(num(n["fat_100g"])) ? Math.round(num(n["fat_100g"]) * 10) / 10 : null,
    fiber100: Number.isFinite(num(n["fiber_100g"])) ? Math.round(num(n["fiber_100g"]) * 10) / 10 : null,
    salt100: Number.isFinite(salt100) ? Math.round(salt100 * 100) / 100 : null,
    iron100: Number.isFinite(num(n["iron_100g"])) ? Math.round(num(n["iron_100g"]) * 100) / 100 : null,
    potassium100: Number.isFinite(num(n["potassium_100g"])) ? Math.round(num(n["potassium_100g"])) : null,
    netWeightG,
    unitWeightG,
    pieces,
    servingG: Number.isFinite(num(p.serving_quantity)) && num(p.serving_quantity) > 0 ? Math.round(num(p.serving_quantity)) : null,
  };
}

async function lookupUSDA(code: string): Promise<BarcodeProduct | null> {
  const key = process.env.USDA_FDC_API_KEY;
  if (!key) return null;
  const json = await fetchJSON(
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${key}&query=${code}&dataType=Branded&pageSize=10`
  );
  const foods: any[] = json?.foods ?? [];
  const cPad = code.padStart(14, "0");
  const f = foods.find((x: any) => {
    const g = String(x.gtinUpc ?? "").replace(/\D/g, "");
    return g && (g === code || g.padStart(14, "0") === cPad);
  });
  if (!f?.description) return null;

  const nutrients: any[] = f.foodNutrients ?? [];
  const pick = (match: (x: any) => boolean): number | null => {
    const x = nutrients.find(match);
    const v = x ? Number(x.value) : NaN;
    return Number.isFinite(v) && v >= 0 ? v : null;
  };
  let kcal100 = pick((x) => x.nutrientName === "Energy" && String(x.unitName).toUpperCase() === "KCAL");
  if (kcal100 == null) {
    const kj = pick((x) => x.nutrientName === "Energy" && String(x.unitName).toUpperCase() === "KJ");
    if (kj != null) kcal100 = kj / 4.184;
  }
  const sodiumMg = pick((x) => x.nutrientName === "Sodium");

  return {
    source: "USDA FoodData Central",
    code,
    name: String(f.description).trim(),
    brand: f.brandOwner || null,
    kcal100: kcal100 != null ? Math.round(kcal100 * 10) / 10 : null,
    protein100: pick((x) => x.nutrientName === "Protein"),
    carbs100: pick((x) => String(x.nutrientName).startsWith("Carbohydrate, by difference")),
    sugar100: pick((x) => String(x.nutrientName).startsWith("Sugars, total")),
    fat100: pick((x) => x.nutrientName === "Total lipid (fat)"),
    fiber100: pick((x) => String(x.nutrientName).startsWith("Fiber, total dietary")),
    salt100: sodiumMg != null ? Math.round(((sodiumMg * 2.5) / 1000) * 100) / 100 : null,
    iron100: pick((x) => x.nutrientName === "Iron, Fe"),
    potassium100: pick((x) => x.nutrientName === "Potassium, K"),
    netWeightG: null,
    unitWeightG: null,
    pieces: null,
    servingG: Number(f.servingSize) > 0 ? Math.round(Number(f.servingSize)) : null,
  };
}

async function lookupFoodRepo(code: string): Promise<BarcodeProduct | null> {
  const key = process.env.FOODREPO_API_KEY;
  if (!key) return null;
  const json = await fetchJSON(`https://www.foodrepo.org/api/v3/products/barcode/${code}`, { "api-key": key, Accept: "application/json" });
  const p = json?.data;
  if (!p) return null;
  const names = p.name_translations ?? {};
  const name: string = String(names.en || names.de || names.fr || names.it || "").trim();
  if (!name) return null;
  const q = p.nutrient_quantities_per_100g ?? {};
  const val = (k: string): number | null => {
    const v = Number(q[k]?.value);
    return Number.isFinite(v) && v >= 0 ? v : null;
  };
  let salt100 = val("salt");
  if (salt100 == null) {
    const sodium = val("sodium");
    if (sodium != null) salt100 = (sodium * 2.5) / 1000;
  }
  return {
    source: "FoodRepo",
    code,
    name,
    brand: p.brand?.name || p.brand_string || null,
    kcal100: val("energy_kcal"),
    protein100: val("proteins"),
    carbs100: val("carbohydrates"),
    sugar100: val("sugar"),
    fat100: val("fat"),
    fiber100: val("fiber"),
    salt100,
    iron100: val("iron"),
    potassium100: val("potassium"),
    netWeightG: parseGrams(String(p.quantity || "")),
    unitWeightG: null,
    pieces: null,
    servingG: null,
  };
}

/** GTIN/EAN kontrolný súčet (EAN-8/UPC-E/EAN-13/GTIN-14). */
export function isValidGTIN(rawCode: string): boolean {
  const code = rawCode.replace(/\D/g, "");
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  digits.reverse().forEach((d, i) => {
    sum += i % 2 === 0 ? d * 3 : d;
  });
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Vyhľadá produkt podľa EAN/GTIN v reťazci databáz.
 * Vráti prvý zásah s výživovými hodnotami, alebo najlepší dostupný.
 */
export async function lookupByEAN(rawCode: string): Promise<BarcodeProduct | null> {
  let code = rawCode.replace(/\D/g, "");
  while (code.length > 13 && code.startsWith("0")) code = code.slice(1); // GTIN-14 → EAN-13
  if (!isValidGTIN(code)) return null;

  const attempts: (() => Promise<BarcodeProduct | null>)[] = [
    () => lookupOFF(code, "world.openfoodfacts.org", "Open Food Facts"),
    () => lookupOFF(code, "static.openfoodfacts.org", "Open Food Facts"),
    () => lookupUSDA(code),
    () => lookupFoodRepo(code),
  ];

  let fallback: BarcodeProduct | null = null;
  for (const attempt of attempts) {
    try {
      const hit = await attempt();
      if (!hit) continue;
      if (hit.kcal100 != null && hit.kcal100 > 0) return hit;
      if (!fallback) fallback = hit;
    } catch {}
  }
  return fallback;
}

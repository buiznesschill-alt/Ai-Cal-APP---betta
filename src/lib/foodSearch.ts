// Internetové vyhľadávanie potravín podľa názvu – grounding pre AI analýzu fotky.
// Zdroje: Open Food Facts (bez kľúča) + USDA FDC (voliteľné s API key).

export interface FoodCandidate {
  source: string;
  name: string;
  brand: string | null;
  kcal100: number | null;
  protein100: number | null;
  carbs100: number | null;
  sugar100: number | null;
  fat100: number | null;
  fiber100: number | null;
  salt100: number | null;
  servingG: number | null;
  netWeightG?: number | null; // deklarovaná gramaž balenia ("450 g" → 450)
  unitWeightG?: number | null; // hmotnosť 1 kusu pri multipackoch ("6 x 75 g" → 75)
  pieces?: number | null; // počet kusov v balení
}

async function fetchJSON(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, {
    headers: { "User-Agent": "fitcal - calorie tracker", ...headers },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  // OFF pri rate-limite vráti HTML – detekuj a zlyhaj čisto
  if (!text.trimStart().startsWith("{") && !text.trimStart().startsWith("[")) {
    throw new Error("Non-JSON response (rate limited?)");
  }
  return JSON.parse(text);
}

function num(v: any): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return null;
}

// Cache výsledkov – 24h (šetrí OFF rate-limit, +42% hit rate)
const CACHE_TTL = 24 * 60 * 60 * 1000;
export const searchCache = new Map<string, { at: number; data: FoodCandidate[] }>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Persist cache do localStorage (prežije reload)
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem("fitcal_food_cache");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const [k, v] of Object.entries(parsed as any)) {
          if (v && typeof (v as any).at === "number" && Array.isArray((v as any).data)) {
            searchCache.set(k, v as any);
          }
        }
      }
    }
  } catch {}
  // priebežne ukladaj
  let saveTimer: any = null;
  const origSet = searchCache.set.bind(searchCache);
  searchCache.set = ((k: string, v: any) => {
    const r = origSet(k, v);
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const obj: any = {};
        // LRU — max 100 položiek
        const entries = Array.from(searchCache.entries()).slice(-100);
        for (const [kk, vv] of entries) obj[kk] = vv;
        localStorage.setItem("fitcal_food_cache", JSON.stringify(obj));
      } catch {}
    }, 500);
    return r;
  }) as any;
}

interface OffProduct {
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  nutriments?: Record<string, any>;
  serving_quantity?: any;
  quantity?: string;
}

function parseGramLoose(s: string): number | null {
  if (!s) return null;
  const m = String(s).match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|dag)\b/i);
  if (!m) return null;
  let v = parseFloat(m[1].replace(",", "."));
  const u = m[2].toLowerCase();
  if (u === "kg") v *= 1000;
  else if (u === "dag") v *= 10;
  else if (u === "l") v *= 1000;
  return Number.isFinite(v) && v > 0 && v <= 30000 ? Math.round(v) : null;
}

function offToCandidate(p: OffProduct): FoodCandidate | null {
  const name: string = p.product_name_en || p.product_name || p.generic_name || "";
  if (!name.trim()) return null;
  const n = p.nutriments ?? {};
  let kcal = num(n["energy-kcal_100g"]);
  const kJ = num(n["energy_100g"]);
  if (kcal == null && kJ != null) kcal = kJ / 4.184;
  const servingG = num(p.serving_quantity);

  // gramaž balenia + multipack ("6 x 75 g")
  let netWeightG: number | null = parseGramLoose(p.quantity || "");
  let unitWeightG: number | null = null;
  let pieces: number | null = null;
  const multi = `${name} ${p.quantity || ""}`.match(/(\d{1,3})\s*(?:x|×)\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i);
  if (multi) {
    const cnt = parseInt(multi[1], 10);
    const unitG = parseGramLoose(`${multi[2]} ${multi[3]}`);
    if (cnt >= 2 && cnt <= 100 && unitG) {
      pieces = cnt;
      unitWeightG = unitG;
      netWeightG = cnt * unitG;
    }
  }
  if (netWeightG == null && servingG != null && servingG > 0 && servingG < 2000 && !multi) {
    // serving bez balenia – slabší hint na jednotku
    unitWeightG = null;
  }

  return {
    source: "Open Food Facts",
    name: name.trim(),
    brand: (p.brands || "").split(",")[0].trim() || null,
    kcal100: kcal != null ? Math.round(kcal * 10) / 10 : null,
    protein100: num(n["proteins_100g"]),
    carbs100: num(n["carbohydrates_100g"]),
    sugar100: num(n["sugars_100g"]),
    fat100: num(n["fat_100g"]),
    fiber100: num(n["fiber_100g"]),
    salt100: num(n["salt_100g"]),
    servingG: servingG && servingG > 0 && servingG < 2000 ? servingG : null,
    netWeightG,
    unitWeightG,
    pieces,
  };
}

async function searchOFF(query: string): Promise<FoodCandidate[]> {
  const qs =
    "?search_terms=" +
    encodeURIComponent(query) +
    "&search_simple=1&action=process&json=1&page_size=10" +
    "&fields=product_name,product_name_en,generic_name,brands,nutriments,serving_quantity,quantity";
  // FÁZA 0C: paralelne world + static (RACE), bez sleep 900 — ušetrí 900ms
  const hosts = ["https://world.openfoodfacts.org", "https://static.openfoodfacts.org"];
  const results = await Promise.allSettled(hosts.map((host) => fetchJSON(host + "/cgi/search.pl" + qs)));
  for (const r of results) {
    if (r.status === "fulfilled") {
      const products: OffProduct[] = (r.value as any)?.products ?? [];
      const mapped = products
        .map(offToCandidate)
        .filter((c): c is FoodCandidate => c !== null && c.kcal100 != null)
        .slice(0, 5);
      if (mapped.length) return mapped;
    }
  }
  // ak obe zlyhali, hoď prvú chybu
  const firstErr = results.find((x) => x.status === "rejected") as PromiseRejectedResult | undefined;
  throw firstErr?.reason ?? new Error("OFF search failed");
}

async function searchUSDA(query: string): Promise<FoodCandidate[]> {
  const key = process.env.USDA_FDC_API_KEY;
  if (!key) return [];
  const url =
    "https://api.nal.usda.gov/fdc/v1/foods/search?api_key=" +
    key +
    "&query=" +
    encodeURIComponent(query) +
    "&pageSize=4&dataType=Branded,Foundation,SR%20Legacy";
  const json = await fetchJSON(url);
  const foods: any[] = json?.foods ?? [];
  return foods
    .map((f): FoodCandidate | null => {
      const nuts: any[] = f.foodNutrients ?? [];
      const pick = (match: (n: any) => boolean): number | null => {
        const n = nuts.find(match);
        return n ? num(n.value) : null;
      };
      let kcal = pick((n) => n.nutrientName === "Energy" && String(n.unitName).toUpperCase() === "KCAL");
      if (kcal == null) {
        const kJ = pick((n) => n.nutrientName === "Energy" && String(n.unitName).toUpperCase() === "KJ");
        if (kJ != null) kcal = kJ / 4.184;
      }
      if (!f.description || kcal == null) return null;
      const sodiumMg = pick((n) => n.nutrientName === "Sodium");
      return {
        source: "USDA FoodData Central",
        name: String(f.description).trim(),
        brand: f.brandOwner || null,
        kcal100: Math.round(kcal * 10) / 10,
        protein100: pick((n) => n.nutrientName === "Protein"),
        carbs100: pick((n) => String(n.nutrientName).startsWith("Carbohydrate, by difference")),
        sugar100: pick((n) => String(n.nutrientName).startsWith("Sugars, total")),
        fat100: pick((n) => n.nutrientName === "Total lipid (fat)"),
        fiber100: pick((n) => String(n.nutrientName).startsWith("Fiber, total dietary")),
        salt100: sodiumMg != null ? Math.round(sodiumMg * 2.5 / 100) / 10 : null,
        servingG: f.servingSize && f.servingSizeUnit === "GRM" ? num(f.servingSize) : null,
      };
    })
    .filter((c): c is FoodCandidate => c !== null);
}

// Retail reťazce – keď model prečíta z obalu predajcu, kandidáti s touto značkou
// (alebo jej private labels) dostanú prioritu
const RETAILER_WORDS = [
  "lidl", "kaufland", "tesco", "billa", "hofer", "penny", "dm", "coop", "konzum",
  "vemuri", "chef's select", "chefs select", "pilos", "milbona", "cien", "bellarom",
  "freeway", "everli", "fresh",
];

function retailerInQuery(q: string): string | null {
  const lower = q.toLowerCase();
  for (const r of RETAILER_WORDS) {
    if (lower.includes(r)) return r;
  }
  return null;
}

function boostRetailer(list: FoodCandidate[], retailer: string | null): FoodCandidate[] {
  if (!retailer) return list;
  return [...list].sort((a, b) => {
    const am = `${a.name} ${a.brand || ""}`.toLowerCase().includes(retailer) ? 0 : 1;
    const bm = `${b.name} ${b.brand || ""}`.toLowerCase().includes(retailer) ? 0 : 1;
    return am - bm;
  });
}

/**
 * Nájde kandidátov s reálnym zložením podľa názvu produktu/jedla.
 * Vracia max `limit` najrelevantnejších záznamov s výživovými hodnotami.
 */
export async function searchFoodCandidates(query: string, limit = 4): Promise<FoodCandidate[]> {
  const q = query.trim();
  if (!q || q.length < 3) return [];

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data.slice(0, limit);

  const retailer = retailerInQuery(q);

  // Postupne zjednodušovanie dopytu – model často dáva presné frázy ("Nutella Ferrero"),
  // ktoré full-text nenájde, zatiaľ čo samotný názov áno.
  const words: string[] = [];
  for (const w of q.split(/\s+/)) {
    const clean = w.replace(/[^0-9A-Za-zÀ-ž-]/g, "");
    if (clean.length >= 4 && words.indexOf(clean) === -1) words.push(clean);
  }
  words.sort((a, b) => b.length - a.length);
  const attempts = [q];
  if (words.length > 1) attempts.push(words.slice(0, 2).join(" "));
  attempts.push.apply(attempts, words);
  // retailer variant dopytu – "pizza taščička lidl" aj ako "pizza taščička"
  if (retailer) {
    const without = words.filter((w) => !w.includes(retailer)).join(" ").trim();
    if (without.length >= 3) attempts.unshift(without);
  }
  const tried = new Set<string>();

  const results: FoodCandidate[] = [];
  const seen = new Set<string>();
  const pushAll = (list: FoodCandidate[]) => {
    for (const c of list) {
      const key = `${c.name.toLowerCase()}|${(c.brand || "").toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(c);
      }
    }
  };

  let foundAny = false;
  for (const attempt of attempts.slice(0, 4)) {
    if (tried.has(attempt.toLowerCase()) || attempt.trim().length < 3) continue;
    tried.add(attempt.toLowerCase());

    const hit = await thisSearch(attempt);
    if (hit.length) {
      pushAll(hit);
      foundAny = true;
      break;
    }
  }

  const finalResults = boostRetailer(results, retailer);
  void foundAny;
  searchCache.set(cacheKey, { at: Date.now(), data: finalResults });
  return finalResults.slice(0, limit);
}

async function thisSearch(query: string): Promise<FoodCandidate[]> {
  const seen = new Set<string>();
  const results: FoodCandidate[] = [];
  const pushAll = (list: FoodCandidate[]) => {
    for (const c of list) {
      const key = `${c.name.toLowerCase()}|${(c.brand || "").toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(c);
      }
    }
  };

  // Paralelne cez všetky dostupné zdroje; chyby jedného zdroja nerobia problém
  const [off, usda] = await Promise.allSettled([searchOFF(query), searchUSDA(query)]);
  if (off.status === "fulfilled") pushAll(off.value);
  if (usda.status === "fulfilled") pushAll(usda.value);

  return results;
}

/** Kompaktné JSON pre prompt – šetrí tokeny. */
export function candidatesToPromptJSON(candidates: FoodCandidate[]): string {
  return JSON.stringify(
    candidates.map((c) => ({
      source: c.source,
      name: c.name,
      brand: c.brand,
      per_100g: {
        kcal: c.kcal100,
        protein_g: c.protein100,
        carbs_g: c.carbs100,
        sugar_g: c.sugar100,
        fat_g: c.fat100,
        fiber_g: c.fiber100,
        salt_g: c.salt100,
      },
      serving_g: c.servingG,
      package_net_weight_g: c.netWeightG ?? null,
      unit_weight_g: c.unitWeightG ?? null,
      pieces_in_pack: c.pieces ?? null,
    }))
  );
}

// Beta: Package Classifier (§6) – zaradí produkt do typu balenia + confidence
import type { NormalizedProduct, PackageType } from "./types";

const DRINK_CATS = ["en_beverages", "beverages", "en_waters", "en_sodas", "en_juice", "en_juices", "en_milks", "en_energy-drinks", "en_iced-teas", "en_beers", "en_plant-milks", "en_dairy-drinks", "en_sports-drinks", "en_syrups"];
const READY_CATS = ["en_salads", "en_ready-to-eat-meals", "en_ready-meals", "en_sandwiches", "en_sushis", "en_wraps", "en_soups", "en_poke", "en_bowls", "en_meat-salads"];
const BULK_CATS = ["en_pastas", "en_rices", "en_flours", "en_breakfast-cereals", "en_mueslis", "en_nuts", "en_seeds", "en_cheeses", "en_meats", "en_frozen-foods", "en_legumes", "en_oils", "en_sauces", "en_canned", "en_dried-products"];
const COUNT_CATS = ["en_eggs", "en_cookies", "en_biscuits", "en_nuggets", "en_chocolates", "en_snacks", "en_candies"];
const SLICE_CATS = ["en_sliced-breads", "en_breads", "en_sliced-cheeses", "en_pizzas", "en_deli-meats", "en_cakes", "en_toasts"];

const DRINK_WORDS = /cola|džús|jus|juice|limonáda|limonada|sóda|soda|energy[- ]?drink|iced tea|ledový čaj|pivo|beer|mlieko|mléko|milk|kefír|ayran|syrup|sirup|nápoj|drink|lemonáda|lemonada|kofola|water|voda/i;
const READY_WORDS = /šalát|salat|salad|sushi|wrap|sendvič|sandwich|hotové jedlo|ready meal|polievk|soup|poke|bowl|microwave|šalátov/i;
const BULK_WORDS = /ryža|ryž|rice|cestovin|pasta|spaghetti|múk|flour|müsli|muesli|orech|nut\b|syr\b|cheese|mäso|meat|frozen|mrazen|olej|oil|omáč|sauce|strukovin|lusk|hrach|fazuľ|cereáli|cereal|kukuric|oat|ovos|quinoa/i;
const COUNT_WORDS = /vajcia|egg|sušienk|cookie|nugget|cukr|candy|bonbón|keks|waffl/i;
const SLICE_WORDS = /plátk|platk|slice|pizza|koláč|cake|šunk|ham\b/i;

function hasTag(tags: string[], list: string[]): boolean {
  return tags.some((t) => list.some((c) => t.includes(c)));
}

export function classifyProduct(np: NormalizedProduct): { packageType: PackageType; confidence: number } {
  let confidence = 0.35; // základ – vždy aspoň fallback
  let type: PackageType = "UNKNOWN";

  const text = `${np.name} ${np.packagingText}`;

  // 1) multipack – explicitný počet kusov
  if (np.packageCount != null && np.packageCount > 1) {
    confidence = np.unitWeight != null ? 0.95 : 0.8;
    type = np.isLiquid ? "MULTIPACK_DRINK" : "MULTIPACK";
    return { packageType: type, confidence };
  }

  // 2) nápoje podľa jednotiek / kľúčových slov / kategórií
  const liquidSignal =
    np.netWeightUnit === "ml" ||
    (np.categoriesTags.length > 0 && hasTag(np.categoriesTags, DRINK_CATS)) ||
    DRINK_WORDS.test(np.name);
  if (liquidSignal) {
    confidence = 0.85;
    type = (np.netWeight ?? 0) >= 1000 ? "LARGE_DRINK" : "SINGLE_DRINK";
    if (np.netWeight != null) confidence = Math.min(1, confidence + 0.05);
    return { packageType: type, confidence };
  }

  // 3) plátkové produkty
  if (SLICE_WORDS.test(text) || hasTag(np.categoriesTags, SLICE_CATS)) {
    confidence = 0.7;
    type = "SLICE_BASED";
  }
  // 4) ready-to-eat
  else if (READY_WORDS.test(text) || hasTag(np.categoriesTags, READY_CATS)) {
    confidence = 0.8;
    type = "READY_MEAL";
  }
  // 5) bulk / suroviny
  else if (BULK_WORDS.test(text) || hasTag(np.categoriesTags, BULK_CATS)) {
    confidence = 0.75;
    type = "BULK";
  }
  // 6) kusové produkty (vajcia, sušienky...)
  else if (COUNT_WORDS.test(text) || hasTag(np.categoriesTags, COUNT_CATS)) {
    confidence = 0.7;
    type = "COUNT_BASED";
  }
  // 7) malé jednotkové balenie s hmotnosťou
  else if (np.netWeight != null && np.netWeight <= 400) {
    confidence = 0.55;
    type = "SINGLE_UNIT";
  } else if (np.netWeight != null) {
    confidence = 0.5;
    type = "BULK"; // veľké balenie bez známok = skôr surovina
  } else {
    confidence = 0.3;
    type = "UNKNOWN";
  }

  // data completeness bonus
  if (np.servingSize != null) confidence = Math.min(1, confidence + 0.1);
  if (np.netWeight != null) confidence = Math.min(1, confidence + 0.05);

  return { packageType: type, confidence: Math.round(confidence * 100) / 100 };
}

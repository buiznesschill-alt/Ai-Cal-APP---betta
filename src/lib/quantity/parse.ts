// Beta: parser packaging textu (§10) – "6x330ml", "4 x 125 g", "500g", "1kg", "1.5L", "8 slices", "6 ks"...
import type { NormalizedProduct } from "./types";

export function parseGramAmount(s: string): number | null {
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

export function parseCount(s: string): number | null {
  if (!s) return null;
  const patterns = [
    /(\d{1,3})\s*(?:ks\b|kus)/i,
    /(\d{1,3})\s*(?:pieces?|pcs\b|capsules?|sachets?|bars?\b|tablets?|candies?)/i,
    /(\d{1,3})\s*(?:porci\w*)/i,
    /(\d{1,3})\s*(?:tyčin\w*|tycin\w*|rolk\w*|kapsl\w*|vreck\w*|plechovk\w*|plechoviek|flašk\w*|flask\w*)/i,
    /(\d{1,3})\s*(?:slices?|plátk\w*|platk\w*)/i,
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

export function parseSlices(s: string): number | null {
  if (!s) return null;
  const m = s.match(/(\d{1,3})\s*(?:slices?|plátk\w*|platk\w*)/i);
  if (m) {
    const v = parseInt(m[1], 10);
    if (v >= 1 && v <= 100) return v;
  }
  return null;
}

function detectLiquid(text: string): boolean {
  return /\b(ml|l\b|liter\w*|litr\w*|mililit\w*)/i.test(text);
}

// Hlavný parser – z quantity textu, názvu a serving size vytvorí normalizované polia (§10)
export function parsePackaging(quantityText: string, productName: string, servingSizeText: string, servingQuantityRaw: unknown): Pick<
  NormalizedProduct,
  "netWeight" | "netWeightUnit" | "packageCount" | "unitWeight" | "servingSize" | "servingsPerPackage" | "packagingText" | "isLiquid"
> {
  const packagingText = (quantityText || "").trim();
  const combined = `${productName} ${packagingText}`;

  let netWeight: number | null = null;
  let packageCount: number | null = null;
  let unitWeight: number | null = null;
  let isLiquid = detectLiquid(packagingText) || detectLiquid(productName);

  // 1) multipack "6 x 330 ml" / "4 x 125 g" / "6×330"
  const multi = combined.match(/(\d{1,3})\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|dag)\b/i);
  if (multi) {
    const count = parseInt(multi[1], 10);
    const unit = parseGramAmount(`${multi[2]} ${multi[3]}`);
    if (count >= 2 && count <= 100 && unit) {
      packageCount = count;
      unitWeight = unit;
      netWeight = count * unit;
      isLiquid = /ml|l\b/i.test(multi[3]);
    }
  }

  // 2) celé balenie "500g" / "1kg" / "1.5L" / "750ml"
  if (netWeight == null) {
    netWeight = parseGramAmount(packagingText) ?? parseGramAmount(productName);
    if (netWeight != null && detectLiquid(packagingText)) isLiquid = true;
  }

  // 3) kusy v balení
  if (packageCount == null) {
    packageCount = parseCount(combined);
    if (packageCount != null && netWeight != null && netWeight % packageCount === 0) {
      unitWeight = netWeight / packageCount;
    }
  }
  if (unitWeight == null && packageCount != null && netWeight != null && netWeight % packageCount === 0) {
    unitWeight = netWeight / packageCount;
  }

  // 4) plátky
  const slices = parseSlices(combined);

  // 5) serving size z DB ("60 g" text alebo numerické serving_quantity)
  let servingSize: number | null = parseGramAmount(servingSizeText);
  const sq = typeof servingQuantityRaw === "number" ? servingQuantityRaw : parseFloat(String(servingQuantityRaw ?? ""));
  if (servingSize == null && Number.isFinite(sq) && sq > 0 && sq < 3000) servingSize = Math.round(sq);

  const servingsPerPackage =
    servingSize != null && netWeight != null && netWeight >= servingSize ? Math.floor(netWeight / servingSize) : null;

  return {
    netWeight,
    netWeightUnit: isLiquid ? "ml" : "g",
    packageCount,
    unitWeight,
    servingSize,
    servingsPerPackage,
    packagingText,
    isLiquid,
  };
}

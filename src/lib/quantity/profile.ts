// Beta: QuantityProfile Builder (§7, §8, §15, §16) – scoring, options, default, fallback
import type { NormalizedProduct, PackageType, QuantityOption, QuantityProfile, QuantityType } from "./types";

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function buildQuantityProfile(
  np: NormalizedProduct,
  packageType: PackageType,
  classifierConfidence: number,
  kcal100: number
): QuantityProfile {
  const isLiquid = np.isLiquid;
  const kcalPerGram = kcal100 > 0 ? round1(kcal100) / 100 : 0;
  const total = np.netWeight ?? (np.unitWeight && np.packageCount ? np.unitWeight * np.packageCount : null);
  const unitW = np.unitWeight ?? np.servingSize ?? null;
  const serving = np.servingSize ?? null;

  const options: QuantityOption[] = [];
  const scores: Record<string, number> = {};

  function addOption(o: QuantityOption, score: number) {
    // dedupe podľa type + gramsPerUnit
    if (options.some((x) => x.type === o.type && Math.abs(x.gramsPerUnit - o.gramsPerUnit) < 0.5)) return;
    options.push(o);
    scores[`${o.type}:${o.gramsPerUnit}`] = score;
  }

  // --- kandidáti podľa typu balenia ---
  const wholeGrams = total ?? unitW ?? null;
  if (wholeGrams) {
    addOption({ type: "WHOLE_PACKAGE", labelKey: "q.whole", gramsPerUnit: wholeGrams }, 0);
  }

  // zlomky balenia – ready meal / single unit (§6 A, C)
  if (wholeGrams && (packageType === "READY_MEAL" || packageType === "SINGLE_UNIT" || packageType === "UNKNOWN")) {
    for (const f of [0.25, 0.5, 0.75]) {
      addOption(
        { type: "PACKAGE_FRACTION", labelKey: f === 0.5 ? "q.half" : f === 0.25 ? "q.quarter" : "q.threeq", gramsPerUnit: round1(wholeGrams * f) },
        f === 0.5 ? 0.42 : 0.3
      );
    }
  }

  // kusy – multipack, count-based, slice-based (slices = kúsky)
  if (unitW && (packageType === "MULTIPACK" || packageType === "MULTIPACK_DRINK" || packageType === "COUNT_BASED" || packageType === "SLICE_BASED")) {
    const labelKey = packageType === "SLICE_BASED" ? "q.slice" : "q.piece";
    addOption({ type: packageType === "SLICE_BASED" ? "SLICE" : "PIECE", labelKey, gramsPerUnit: unitW }, 0);
  }

  // porcia z DB
  if (serving) {
    addOption({ type: "SERVING", labelKey: "q.serving", gramsPerUnit: serving }, 0);
  }

  // gramy / mililitre – vždy
  addOption({ type: isLiquid ? "MILLILITER" : "GRAM", labelKey: isLiquid ? "q.ml" : "q.grams", gramsPerUnit: 1 }, 0);

  // --- scoring (§8) ---
  const bump = (type: QuantityType, gramsPerUnit: number | null, pts: number) => {
    for (const key of Object.keys(scores)) {
      const [t, g] = key.split(":");
      if (t === type && (gramsPerUnit == null || Math.abs(Number(g) - gramsPerUnit) < 0.5)) {
        scores[key] += pts;
      }
    }
  };

  if (np.packageCount != null && np.packageCount > 1) {
    bump("PIECE", unitW, 100);
    if (packageType === "MULTIPACK_DRINK") bump("PIECE", unitW, 20);
  }
  if (packageType === "READY_MEAL" && (np.packageCount ?? 1) <= 1) bump("WHOLE_PACKAGE", wholeGrams, 90);
  if (packageType === "READY_MEAL" && (np.netWeight ?? 0) <= 400) bump("WHOLE_PACKAGE", wholeGrams, 20);
  if (packageType === "BULK") {
    bump("GRAM", 1, 100);
    bump("WHOLE_PACKAGE", wholeGrams, -100);
  }
  if (packageType === "BULK" && serving) bump("SERVING", serving, 120);
  if (packageType === "LARGE_DRINK") bump("MILLILITER", 1, 100);
  if (packageType === "SINGLE_DRINK") bump("WHOLE_PACKAGE", wholeGrams, 100);
  if (packageType === "MULTIPACK_DRINK") bump("PIECE", unitW, 120);
  if (packageType === "SLICE_BASED") bump("SLICE", unitW, 100);
  if (packageType === "COUNT_BASED") bump("PIECE", unitW, 100);
  if (packageType === "SINGLE_UNIT") bump("WHOLE_PACKAGE", wholeGrams, 100);

  // --- default výber + usporiadanie ---
  let defaultIndex = 0;
  let best = -Infinity;
  options.forEach((o, i) => {
    const s = scores[`${o.type}:${o.gramsPerUnit}`] ?? 0;
    if (s > best) {
      best = s;
      defaultIndex = i;
    }
  });

  let confidence = classifierConfidence;
  if (confidence < 0.6) {
    // konzervatívny fallback (§16): serving → grams/ml
    const servingIdx = options.findIndex((o) => o.type === "SERVING");
    const gramIdx = options.findIndex((o) => o.type === "GRAM" || o.type === "MILLILITER");
    defaultIndex = servingIdx >= 0 ? servingIdx : gramIdx >= 0 ? gramIdx : defaultIndex;
  }

  // suggested count pre ml u veľkých nápojov (250 ml default)
  const defOpt = options[defaultIndex];
  if (defOpt.type === "MILLILITER" && (packageType === "LARGE_DRINK" || isLiquid)) {
    defOpt.suggestedCount = 250;
  }

  return {
    options,
    defaultIndex,
    packageType,
    confidence,
    kcalPerGram,
    totalPackageWeight: total,
    packageCount: np.packageCount,
    unitWeight: unitW,
    servingSize: serving,
    isLiquid,
  };
}

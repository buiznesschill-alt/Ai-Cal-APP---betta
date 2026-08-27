// Beta: Quantity Engine – typy (podľa plánu fitapp_barcode_quantity_engine_plan.md)

export type PackageType =
  | "SINGLE_UNIT"
  | "MULTIPACK"
  | "READY_MEAL"
  | "BULK"
  | "SINGLE_DRINK"
  | "LARGE_DRINK"
  | "MULTIPACK_DRINK"
  | "SLICE_BASED"
  | "COUNT_BASED"
  | "UNKNOWN";

export type QuantityType =
  | "WHOLE_PACKAGE"
  | "PACKAGE_FRACTION"
  | "PIECE"
  | "SERVING"
  | "GRAM"
  | "MILLILITER"
  | "SLICE"
  | "CUSTOM";

// 1 jednotka optionu = gramsPerUnit gramov/ml (ml ≈ g)
export interface QuantityOption {
  type: QuantityType;
  labelKey: string; // i18n kľúč
  gramsPerUnit: number;
  suggestedCount?: number; // predvolený počet jednotiek (napr. 250 pri ml)
}

export interface QuantityProfile {
  options: QuantityOption[];
  defaultIndex: number;
  packageType: PackageType;
  confidence: number;
  kcalPerGram: number; // kanonická hodnota pre všetky prepočty
  totalPackageWeight: number | null;
  packageCount: number | null;
  unitWeight: number | null;
  servingSize: number | null;
  isLiquid: boolean;
}

// Normalizovaný produkt – jednotný formát pre všetky externé databázy (§4)
export interface NormalizedProduct {
  barcode: string;
  name: string;
  brand: string;
  netWeight: number | null; // celé balenie (g/ml)
  netWeightUnit: "g" | "ml";
  packageCount: number | null;
  unitWeight: number | null; // g/ml na 1 kus
  servingSize: number | null; // porcia z DB
  servingsPerPackage: number | null;
  categoriesTags: string[];
  packagingText: string;
  productText: string;
  isLiquid: boolean;
}

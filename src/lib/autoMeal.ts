import type { AutoMealConfig, MealType } from "./types";

// Predvolené rozsahy – používateľ si ich môže v Nastaveniach zmeniť
export function defaultAutoMeal(): AutoMealConfig {
  return {
    enabled: false,
    breakfast: { enabled: true, from: "06:00", to: "10:00" },
    lunch: { enabled: true, from: "11:30", to: "14:30" },
    dinner: { enabled: true, from: "17:30", to: "21:00" },
    snackMorning: { enabled: true, from: "10:00", to: "11:30" },
    snackLunch: { enabled: true, from: "14:30", to: "17:00" },
    snackNight: { enabled: true, from: "21:00", to: "01:00" },
  };
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Zlučí uloženú konfiguráciu s predvolenými (ochrana proti chýbajúcim/polámaným hodnotám)
export function normalizeAutoMeal(v: any): AutoMealConfig {
  const def = defaultAutoMeal();
  if (!v || typeof v !== "object") return def;
  const out: AutoMealConfig = { ...def };
  out.enabled = !!v.enabled;
  for (const key of ["breakfast", "lunch", "dinner", "snackMorning", "snackLunch", "snackNight"] as const) {
    const r = v[key];
    if (r && typeof r === "object") {
      out[key] = {
        enabled: !!r.enabled,
        from: typeof r.from === "string" && HHMM.test(r.from) ? r.from : def[key].from,
        to: typeof r.to === "string" && HHMM.test(r.to) ? r.to : def[key].to,
      };
    }
  }
  return out;
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Zvláda aj rozsahy cez polnoc (21:00 → 01:00)
function inRange(mins: number, r: { from: string; to: string }): boolean {
  const from = toMin(r.from);
  const to = toMin(r.to);
  if (from <= to) return mins >= from && mins <= to;
  return mins >= from || mins <= to;
}

// Vráti typ jedla pre aktuálny čas, alebo null (žiadna zóna nezodpovedá → manuálny výber)
export function resolveAutoMeal(cfg: AutoMealConfig | null | undefined, now: Date = new Date()): MealType | null {
  if (!cfg?.enabled) return null;
  const mins = now.getHours() * 60 + now.getMinutes();
  const order: [MealType, { enabled: boolean; from: string; to: string } | undefined][] = [
    ["breakfast", cfg.breakfast],
    ["snack", cfg.snackMorning],
    ["lunch", cfg.lunch],
    ["snack", cfg.snackLunch],
    ["dinner", cfg.dinner],
    ["snack", cfg.snackNight],
  ];
  for (const [type, r] of order) {
    if (r?.enabled && inRange(mins, r)) return type;
  }
  return null;
}

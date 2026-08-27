import type { MealType } from "./types";

export const MEAL_TYPE_ICONS: Record<MealType, string> = {
  breakfast: "/icons/breakfast.png",
  lunch: "/icons/lunch.png",
  dinner: "/icons/dinner.png",
  snack: "/icons/snacks.png",
};

export function mealTypeIcon(type: string | null | undefined): string {
  if (!type) return "";
  return MEAL_TYPE_ICONS[type as MealType] ?? "";
}

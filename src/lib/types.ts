export type Locale = "sk" | "en";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type GoalType = "lose" | "maintain" | "gain";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Sex = "male" | "female" | "other";
export type MealSource = "ai" | "manual" | "favorite" | "barcode";

// Beta: auto priradenie typu jedla podľa času
export interface AutoMealRange {
  enabled: boolean;
  from: string; // "HH:MM"
  to: string;   // "HH:MM" (môže prekračovať polnoc, napr. 21:00→01:00)
}

export interface AutoMealConfig {
  enabled: boolean;
  breakfast: AutoMealRange;
  lunch: AutoMealRange;
  dinner: AutoMealRange;
  snackMorning: AutoMealRange;
  snackLunch: AutoMealRange;
  snackNight: AutoMealRange;
}

export interface User {
  id: string;
  username: string; // lowercase
  displayName: string;
  passwordHash: string;
  locale: Locale;
  heightCm?: number;
  weightKg?: number;
  age?: number;
  sex?: Sex;
  activity?: ActivityLevel;
  goalType?: GoalType;
  goalKcal: number;
  goalProtein: number;
  goalCarbs: number;
  goalFat: number;
  goalWaterMl?: number; // beta: daily water goal in ml (default 2000)
  autoMeal?: AutoMealConfig | null; // beta: auto meal-type by time
  keepThumbnails: boolean;
  createdAt: string;
}

export interface Meal {
  id: string;
  userId: string;
  createdAt: string; // ISO
  date: string; // YYYY-MM-DD
  mealType: MealType;
  dish: string;
  description: string;
  portion_g: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  salt: number;
  iron?: number; // beta: mg na porciu (z barcode OFF)
  potassium?: number; // beta: mg na porciu (z barcode OFF)
  confidence: number; // 0-1
  thumbnail: string | null; // data url webp 256px or null
  source?: MealSource; // beta
}

export interface Favorite {
  id: string;
  userId: string;
  dish: string;
  description: string;
  portion_g: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  salt: number;
  iron?: number; // beta
  potassium?: number; // beta
  mealType: MealType; // last used
  createdAt: string;
}

export interface WaterDay {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  ml: number;
}

export interface WeightEntry {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  kg: number;
  createdAt: string;
}

export interface DayScore {
  userId: string;
  date: string; // YYYY-MM-DD
  points: number; // +1 alebo -1, zamknuté navždy
}

export interface NutritionResult {
  dish: string;
  description: string;
  portion_g: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  salt: number;
  iron?: number; // beta: mg odhad
  potassium?: number; // beta: mg odhad
  confidence: number;
  tips?: string;
  source?: string; // napr. "Open Food Facts" keď výsledok potvrdila internetová databáza
  foodClass?: "main" | "snack"; // poriadne jedlo vs. malé občerstvenie – na smart priradenie do času
}

export interface DaySummary {
  date: string;
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  meals: Meal[];
}

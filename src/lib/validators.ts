import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(3, "Meno musí mať aspoň 3 znaky")
  .max(32, "Meno max 32 znakov")
  .regex(/^[a-zA-Z0-9_]+$/, "Len písmená, čísla a _")
  .transform((v) => v.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Heslo aspoň 8 znakov")
  .max(128, "Heslo max 128 znakov");

export const registerSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  displayName: z.string().min(1).max(32).optional(),
});

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1),
});

export const analyzeSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).default("lunch"),
  portion_g: z.number().min(10).max(3000).optional(),
});

const timeRangeSchema = z.object({
  enabled: z.boolean(),
  from: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  to: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
});

const autoMealSchema = z.object({
  enabled: z.boolean(),
  breakfast: timeRangeSchema,
  lunch: timeRangeSchema,
  dinner: timeRangeSchema,
  snackMorning: timeRangeSchema,
  snackLunch: timeRangeSchema,
  snackNight: timeRangeSchema,
});

export const settingsSchema = z.object({
  displayName: z.string().min(1).max(32).optional(),
  locale: z.enum(["sk", "en"]).optional(),
  heightCm: z.number().min(100).max(250).nullable().optional(),
  weightKg: z.number().min(30).max(400).nullable().optional(),
  age: z.number().min(10).max(120).nullable().optional(),
  sex: z.enum(["male", "female", "other"]).nullable().optional(),
  activity: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).nullable().optional(),
  goalType: z.enum(["lose", "maintain", "gain"]).nullable().optional(),
  goalKcal: z.number().min(800).max(6000).optional(),
  goalProtein: z.number().min(20).max(500).optional(),
  goalCarbs: z.number().min(20).max(800).optional(),
  goalFat: z.number().min(20).max(300).optional(),
  autoMeal: autoMealSchema.optional(),
  keepThumbnails: z.boolean().optional(),
  oldPassword: z.string().optional(),
  newPassword: z.string().min(8).max(128).optional(),
});

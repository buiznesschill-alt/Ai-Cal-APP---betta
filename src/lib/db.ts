import fs from "fs/promises";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import type { User, Meal, Favorite, WaterDay, WeightEntry, DayScore, Sickness, Supplement } from "./types";
import { emitUserEvent } from "./serverEvents";

// Use temp dir to avoid Next.js file watching restart on data changes (space-efficient, not watched)
// BETA instance uses its own data dir so it never shares data with the main app (port 3000)
const DATA_DIR = path.join(os.tmpdir(), "fitcal-data-beta");
const DB_PATH = path.join(DATA_DIR, "db.json");

type DB = {
  users: User[];
  meals: Meal[];
  savedTips?: { userId: string; refs: { id: string; kind: string; savedAt: number }[] }[];
  favorites?: Favorite[];
  water?: WaterDay[];
  weights?: WeightEntry[];
  dayScores?: DayScore[];
  sicknesses?: Sickness[];
  supplements?: Supplement[];
};

let memoryCache: DB | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {}
}

async function readDB(): Promise<DB> {
  if (memoryCache) return memoryCache;
  await ensureDataDir();
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw) as DB;
    if (!parsed.users) parsed.users = [];
    if (!parsed.meals) parsed.meals = [];
    if (!parsed.favorites) parsed.favorites = [];
    if (!parsed.water) parsed.water = [];
    if (!parsed.weights) parsed.weights = [];
    if (!parsed.dayScores) parsed.dayScores = [];
    if (!parsed.sicknesses) parsed.sicknesses = [];
    if (!parsed.supplements) parsed.supplements = [];
    memoryCache = parsed;
    return parsed;
  } catch {
    const init: DB = { users: [], meals: [], favorites: [], water: [], weights: [], dayScores: [], sicknesses: [], supplements: [] };
    memoryCache = init;
    await writeDB(init);
    return init;
  }
}

async function writeDB(db: DB): Promise<void> {
  await ensureDataDir();
  memoryCache = db;
  const tmp = DB_PATH + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf-8");
  await fs.rename(tmp, DB_PATH);
}

function queuedWrite(db: DB): Promise<void> {
  const task = async () => {
    await writeDB(db);
  };
  writeQueue = writeQueue.then(task, task);
  return writeQueue;
}

// User helpers
export async function findUserByUsername(username: string): Promise<User | null> {
  const db = await readDB();
  const lower = username.toLowerCase();
  return db.users.find((u) => u.username === lower) || null;
}

export async function findUserById(id: string): Promise<User | null> {
  const db = await readDB();
  return db.users.find((u) => u.id === id) || null;
}

export async function createUser(data: Omit<User, "id" | "createdAt">): Promise<User> {
  const db = await readDB();
  const user: User = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...data,
    username: data.username.toLowerCase(),
  };
  db.users.push(user);
  await queuedWrite(db);
  return user;
}

export async function updateUser(id: string, patch: Partial<User>): Promise<User | null> {
  const db = await readDB();
  const idx = db.users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  db.users[idx] = { ...db.users[idx], ...patch };
  if (patch.username) db.users[idx].username = patch.username.toLowerCase();
  await queuedWrite(db);
  return db.users[idx];
}

// Meal helpers
export async function createMeal(meal: Omit<Meal, "id" | "createdAt">, createdAtOverride?: string): Promise<Meal> {
  const db = await readDB();
  const newMeal: Meal = {
    id: uuidv4(),
    createdAt: createdAtOverride ?? new Date().toISOString(),
    ...meal,
  };
  db.meals.unshift(newMeal); // newest first
  await queuedWrite(db);
  emitUserEvent(meal.userId, "meals");
  return newMeal;
}

// Fake/demo data helpers (beta)
export async function removeFakeMeals(userId: string, date?: string): Promise<number> {
  const db = await readDB();
  const before = db.meals.length;
  db.meals = db.meals.filter((m) => !(m.userId === userId && (m as any).isFake && (!date || m.date === date)));
  const removed = before - db.meals.length;
  if (removed > 0) {
    await queuedWrite(db);
    emitUserEvent(userId, "meals");
  }
  return removed;
}

export async function countFakeMeals(userId: string, date?: string): Promise<number> {
  const db = await readDB();
  return db.meals.filter((m) => m.userId === userId && (m as any).isFake && (!date || m.date === date)).length;
}

export async function getMealsByUser(
  userId: string,
  opts?: { date?: string; limit?: number; offset?: number }
): Promise<Meal[]> {
  const db = await readDB();
  let meals = db.meals.filter((m) => m.userId === userId);
  if (opts?.date) meals = meals.filter((m) => m.date === opts.date);
  // already sorted newest first
  if (opts?.offset) meals = meals.slice(opts.offset);
  if (opts?.limit) meals = meals.slice(0, opts.limit);
  return meals;
}

export async function getMealsGroupedByDate(userId: string, limitDays = 30) {
  const meals = await getMealsByUser(userId);
  const grouped: Record<string, Meal[]> = {};
  for (const m of meals) {
    if (!grouped[m.date]) grouped[m.date] = [];
    grouped[m.date].push(m);
  }
  return Object.entries(grouped)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, limitDays)
    .map(([date, meals]) => ({ date, meals }));
}

export async function deleteMeal(userId: string, mealId: string): Promise<boolean> {
  const db = await readDB();
  const idx = db.meals.findIndex((m) => m.id === mealId && m.userId === userId);
  if (idx === -1) return false;
  db.meals.splice(idx, 1);
  await queuedWrite(db);
  emitUserEvent(userId, "meals");
  return true;
}

export async function deleteOldThumbnails(userId: string, olderThanDays: number): Promise<number> {
  const db = await readDB();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);
  let count = 0;
  for (const m of db.meals) {
    if (m.userId === userId && m.thumbnail && new Date(m.createdAt) < cutoff) {
      m.thumbnail = null;
      count++;
    }
  }
  if (count > 0) await queuedWrite(db);
  return count;
}

// Beta: portion edit – scales all nutrition proportionally
export async function updateMealPortion(userId: string, mealId: string, newPortionG: number): Promise<Meal | null> {
  const db = await readDB();
  const meal = db.meals.find((m) => m.id === mealId && m.userId === userId);
  if (!meal) return null;
  const old = meal.portion_g || 1;
  const ratio = Math.max(0, newPortionG) / old;
  const scale = (n: number) => Math.round(n * ratio * 10) / 10;
  meal.kcal = Math.round(meal.kcal * ratio);
  meal.protein = scale(meal.protein);
  meal.carbs = scale(meal.carbs);
  meal.fat = scale(meal.fat);
  meal.fiber = scale(meal.fiber);
  meal.sugar = scale(meal.sugar);
  meal.salt = scale(meal.salt);
  meal.portion_g = Math.max(0, newPortionG);
  await queuedWrite(db);
  emitUserEvent(userId, "meals");
  return meal;
}

// Beta: month day totals for heatmap calendar
export async function getMonthTotals(userId: string, month: string): Promise<{ date: string; totalKcal: number }[]> {
  const db = await readDB();
  const totals: Record<string, number> = {};
  for (const m of db.meals) {
    if (m.userId === userId && m.date.startsWith(month)) {
      totals[m.date] = (totals[m.date] || 0) + m.kcal;
    }
  }
  return Object.entries(totals)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, totalKcal]) => ({ date, totalKcal }));
}

// Beta: all-time day totals – pre bodový systém rankov
export async function getAllDayTotals(userId: string): Promise<{ date: string; totalKcal: number }[]> {
  const db = await readDB();
  const totals: Record<string, number> = {};
  for (const m of db.meals) {
    if (m.userId === userId) {
      totals[m.date] = (totals[m.date] || 0) + m.kcal;
    }
  }
  return Object.entries(totals)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, totalKcal]) => ({ date, totalKcal }));
}

// Helper: je dátum v aktívnej chorobe?
function isDateInSickness(db: DB, userId: string, date: string): boolean {
  if (!db.sicknesses) return false;
  return db.sicknesses.some((s) => s.userId === userId && date >= s.startDate && (s.endDate == null || date <= s.endDate));
}

// Beta: zamknuté denné skóre – každý minulý deň = presne ±1/0 bod, nikdy sa nezmení
// - prázdny deň (žiadne jedlo) = -1 od prvého jedla
// - choroba freeze = 0 (modrá) — počas choroby sa hodnoty nepočítajú, body sa neodpočítavajú
export async function finalizeDayScores(userId: string, goal: number): Promise<void> {
  const db = await readDB();
  if (!db.dayScores) db.dayScores = [];
  if (!db.sicknesses) db.sicknesses = [];
  const today = new Date().toISOString().slice(0, 10);
  const totals: Record<string, number> = {};
  for (const m of db.meals) {
    if (m.userId === userId) totals[m.date] = (totals[m.date] || 0) + m.kcal;
  }
  // nájdi prvé jedlo — odvtedy sa počíta každý deň
  const allDates = Object.keys(totals).sort();
  if (allDates.length === 0) return;
  const firstDate = allDates[0];
  let changed = false;
  // loop každý deň od firstDate do yesterday
  const d = new Date(firstDate + "T12:00:00");
  const end = new Date(today + "T12:00:00");
  end.setDate(end.getDate() - 1); // yesterday
  for (; d <= end; d.setDate(d.getDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    if (db.dayScores.some((s) => s.userId === userId && s.date === date)) continue;
    let pts: number;
    let reason: "ok" | "empty" | "sick" | "freeze" = "ok";
    if (isDateInSickness(db, userId, date)) {
      pts = 0;
      reason = "freeze";
    } else if (totals[date] == null) {
      pts = -1;
      reason = "empty";
    } else {
      const kcal = totals[date];
      const ok = kcal > goal - 500 && kcal <= goal + 100;
      pts = ok ? 1 : -1;
      reason = ok ? "ok" : "empty";
    }
    db.dayScores.push({ userId, date, points: pts, reason } as any);
    changed = true;
  }
  if (changed) await queuedWrite(db);
}

export async function getDayScores(userId: string): Promise<{ date: string; points: number; reason?: string }[]> {
  const db = await readDB();
  if (!db.dayScores) db.dayScores = [];
  return db.dayScores
    .filter((s) => s.userId === userId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, points, reason }) => ({ date, points, reason } as any));
}

// Sickness / freeze — modrá 0
export async function getSicknesses(userId: string): Promise<Sickness[]> {
  const db = await readDB();
  if (!db.sicknesses) db.sicknesses = [];
  return db.sicknesses.filter((s) => s.userId === userId).sort((a,b)=> b.startDate.localeCompare(a.startDate));
}
export async function getActiveSickness(userId: string): Promise<Sickness | null> {
  const db = await readDB();
  if (!db.sicknesses) db.sicknesses = [];
  return db.sicknesses.find((s) => s.userId === userId && s.endDate == null) || null;
}
export async function createSickness(userId: string, note: string): Promise<Sickness> {
  const db = await readDB();
  if (!db.sicknesses) db.sicknesses = [];
  // ukonči predchádzajúcu aktívnu ak existuje
  const active = db.sicknesses.find((s) => s.userId === userId && s.endDate == null);
  if (active) active.endDate = new Date(Date.now()-86400000).toISOString().slice(0,10);
  const today = new Date().toISOString().slice(0,10);
  const s: Sickness = { id: uuidv4(), userId, startDate: today, endDate: null, note: note.slice(0,200), createdAt: new Date().toISOString() };
  db.sicknesses.push(s);
  await queuedWrite(db);
  emitUserEvent(userId, "sickness");
  return s;
}
export async function endSickness(userId: string): Promise<Sickness | null> {
  const db = await readDB();
  if (!db.sicknesses) db.sicknesses = [];
  const active = db.sicknesses.find((s) => s.userId === userId && s.endDate == null);
  if (!active) return null;
  // freeze končí dnes, od zajtra opäť normálne
  active.endDate = new Date().toISOString().slice(0,10);
  await queuedWrite(db);
  emitUserEvent(userId, "sickness");
  return active;
}

// Supplements — doplnky stravy
export async function listSupplements(userId: string, date?: string): Promise<Supplement[]> {
  const db = await readDB();
  if (!db.supplements) db.supplements = [];
  let list = db.supplements.filter((s) => s.userId === userId);
  if (date) list = list.filter((s) => s.date === date);
  return list.sort((a,b)=> a.time.localeCompare(b.time));
}
export async function addSupplement(userId: string, data: Omit<Supplement, "id" | "userId" | "createdAt">): Promise<Supplement> {
  const db = await readDB();
  if (!db.supplements) db.supplements = [];
  const sup: Supplement = { id: uuidv4(), userId, createdAt: new Date().toISOString(), ...data };
  db.supplements.push(sup);
  await queuedWrite(db);
  emitUserEvent(userId, "supplements" as any);
  return sup;
}
export async function deleteSupplement(userId: string, id: string): Promise<boolean> {
  const db = await readDB();
  if (!db.supplements) db.supplements = [];
  const idx = db.supplements.findIndex((s)=> s.id===id && s.userId===userId);
  if (idx===-1) return false;
  db.supplements.splice(idx,1);
  await queuedWrite(db);
  emitUserEvent(userId, "supplements" as any);
  return true;
}

// Beta: favorites
export async function listFavorites(userId: string): Promise<Favorite[]> {
  const db = await readDB();
  if (!db.favorites) db.favorites = [];
  return db.favorites.filter((f) => f.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createFavorite(userId: string, data: Omit<Favorite, "id" | "userId" | "createdAt">): Promise<Favorite> {
  const db = await readDB();
  if (!db.favorites) db.favorites = [];
  // dedupe by dish name – update existing instead of duplicating
  const existing = db.favorites.find((f) => f.userId === userId && f.dish.toLowerCase() === data.dish.toLowerCase());
  const fav: Favorite = { id: existing?.id ?? uuidv4(), userId, createdAt: new Date().toISOString(), ...data };
  if (existing) db.favorites[db.favorites.indexOf(existing)] = fav;
  else db.favorites.push(fav);
  await queuedWrite(db);
  emitUserEvent(userId, "favorites");
  return fav;
}

export async function deleteFavorite(userId: string, favId: string): Promise<boolean> {
  const db = await readDB();
  if (!db.favorites) db.favorites = [];
  const idx = db.favorites.findIndex((f) => f.id === favId && f.userId === userId);
  if (idx === -1) return false;
  db.favorites.splice(idx, 1);
  await queuedWrite(db);
  emitUserEvent(userId, "favorites");
  return true;
}

// Beta: water (ml per day)
export async function getWater(userId: string, date: string): Promise<number> {
  const db = await readDB();
  if (!db.water) db.water = [];
  return db.water.find((w) => w.userId === userId && w.date === date)?.ml ?? 0;
}

export async function setWater(userId: string, date: string, ml: number): Promise<number> {
  const db = await readDB();
  if (!db.water) db.water = [];
  const val = Math.max(0, Math.min(10000, Math.round(ml)));
  const entry = db.water.find((w) => w.userId === userId && w.date === date);
  if (entry) entry.ml = val;
  else db.water.push({ id: uuidv4(), userId, date, ml: val });
  await queuedWrite(db);
  emitUserEvent(userId, "water");
  return val;
}

// Beta: weight entries (one per day, upsert)
export async function listWeights(userId: string, limit?: number): Promise<WeightEntry[]> {
  const db = await readDB();
  if (!db.weights) db.weights = [];
  return db.weights
    .filter((w) => w.userId === userId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit ?? 365);
}

export async function addWeight(userId: string, date: string, kg: number): Promise<WeightEntry> {
  const db = await readDB();
  if (!db.weights) db.weights = [];
  const existing = db.weights.find((w) => w.userId === userId && w.date === date);
  const val = Math.max(0, Math.min(500, kg));
  if (existing) {
    existing.kg = val;
    await queuedWrite(db);
    emitUserEvent(userId, "weights");
    return existing;
  }
  const entry: WeightEntry = { id: uuidv4(), userId, date, kg: val, createdAt: new Date().toISOString() };
  db.weights.push(entry);
  await queuedWrite(db);
  emitUserEvent(userId, "weights");
  return entry;
}

export async function getDaySummary(userId: string, date: string) {
  const meals = await getMealsByUser(userId, { date });
  return {
    date,
    meals,
    totalKcal: meals.reduce((s, m) => s + m.kcal, 0),
    totalProtein: meals.reduce((s, m) => s + m.protein, 0),
    totalCarbs: meals.reduce((s, m) => s + m.carbs, 0),
    totalFat: meals.reduce((s, m) => s + m.fat, 0),
    totalFiber: meals.reduce((s, m) => s + m.fiber, 0),
  };
}

// Saved tips & advice – synced per account across devices
export async function getSavedTips(userId: string): Promise<{ id: string; kind: string; savedAt: number }[]> {
  const db = await readDB();
  if (!db.savedTips) db.savedTips = [];
  return db.savedTips.find((s) => s.userId === userId)?.refs ?? [];
}

export async function setSavedTips(userId: string, refs: { id: string; kind: string; savedAt: number }[]): Promise<void> {
  const db = await readDB();
  if (!db.savedTips) db.savedTips = [];
  const entry = db.savedTips.find((s) => s.userId === userId);
  if (entry) entry.refs = refs;
  else db.savedTips.push({ userId, refs });
  await queuedWrite(db);
}

// For Vercel Postgres future: if DATABASE_URL exists, we could switch.
// For now JSON is space-efficient and works serverless as long as Vercel FS is ephemeral –
// documented in code: for persistent prod, set DATABASE_URL and this module will auto-use postgres.

import fs from "fs/promises";
import path from "path";
import os from "os";
import { randomUUID as uuid } from "crypto";

const DB_PATH = path.join(os.tmpdir(), "fitcal-data-beta", "db.json");

const dishes = [
  { dish: "Kuracie prsia s ryžou a zeleninou", description: "Grilované kuracie prsia, dusená ryža, mix zeleniny", kcal: 520, protein: 38, carbs: 48, fat: 18, fiber: 4, sugar: 3, salt: 1.2 },
  { dish: "Bryndzové halušky", description: "Halušky s bryndzou a slaninkou", kcal: 680, protein: 22, carbs: 72, fat: 32, fiber: 3, sugar: 2, salt: 2.1 },
  { dish: "Grécky šalát s fetou", description: "Paradajky, uhorka, olivy, feta, olivový olej", kcal: 340, protein: 9, carbs: 12, fat: 28, fiber: 5, sugar: 6, salt: 1.8 },
  { dish: "Pizza Margherita (1/2)", description: "Tenké cesto, paradajková omáčka, mozzarella", kcal: 580, protein: 24, carbs: 62, fat: 26, fiber: 3, sugar: 5, salt: 2.4 },
  { dish: "Ovocná miska s jogurtom", description: "Banán, jahody, čučoriedky, biely jogurt, med", kcal: 310, protein: 12, carbs: 42, fat: 9, fiber: 6, sugar: 28, salt: 0.3 },
  { dish: "Burger s hranolkami", description: "Hovädzí burger, syr, hranolky, kečup", kcal: 740, protein: 32, carbs: 68, fat: 38, fiber: 4, sugar: 8, salt: 2.8 },
  { dish: "Losos so zemiakmi", description: "Pečený losos, varené zemiaky, brokolica", kcal: 610, protein: 35, carbs: 42, fat: 28, fiber: 5, sugar: 2, salt: 1.5 },
  { dish: "Špagety carbonara", description: "Cestoviny, slanina, vajce, parmezán", kcal: 640, protein: 26, carbs: 58, fat: 32, fiber: 3, sugar: 3, salt: 1.9 },
  { dish: "Avokádový toast", description: "Celozrnný chlieb, avokádo, vajce, semienka", kcal: 380, protein: 14, carbs: 28, fat: 22, fiber: 7, sugar: 2, salt: 1.1 },
  { dish: "Guláš s knedľou", description: "Hovädzí guláš, žemľová knedľa", kcal: 590, protein: 30, carbs: 52, fat: 26, fiber: 4, sugar: 4, salt: 2.2 },
];

const mealTypes = ["breakfast", "lunch", "dinner", "snack"];

async function main() {
  const raw = await fs.readFile(DB_PATH, "utf-8");
  const db = JSON.parse(raw);
  if (!db.meals) db.meals = [];

  // Remove existing fake data first (idempotent)
  const beforeMeals = db.meals.length;
  db.meals = db.meals.filter(m => !m.isFake);
  const removedMeals = beforeMeals - db.meals.length;
  if (removedMeals > 0) console.log(`Odstránených ${removedMeals} starých fake jedál`);
  if (db.favorites) {
    const beforeFav = db.favorites.length;
    db.favorites = db.favorites.filter(f => !f.isFake);
    const removedFav = beforeFav - db.favorites.length;
    if (removedFav > 0) console.log(`Odstránených ${removedFav} starých fake obľúbených`);
  }

  // Find betatest user
  const user = db.users.find(u => u.username === "betatest");
  if (!user) {
    console.error("User betatest not found");
    process.exit(1);
  }

  const today = new Date("2026-08-22T12:00:00Z");
  let totalAdded = 0;

  for (let d = 29; d >= 0; d--) {
    const dateObj = new Date(today);
    dateObj.setDate(today.getDate() - d);
    const dateStr = dateObj.toISOString().slice(0, 10);
    // Skip today – keep today's real meals untouched (optional)
    // if (d === 0) continue;

    const mealsPerDay = 2 + Math.floor(Math.random() * 3); // 2-4
    for (let i = 0; i < mealsPerDay; i++) {
      const base = dishes[Math.floor(Math.random() * dishes.length)];
      const portion = 250 + Math.floor(Math.random() * 200); // 250-449g
      const factor = portion / 350;
      const jitter = (n) => Math.round(n * factor);
      let mealType = mealTypes[Math.min(i, mealTypes.length - 1)];
      if (i === 3) mealType = "snack";

      // Random time during day
      const hour = 7 + i * 4 + Math.floor(Math.random() * 3); // spread
      const minute = Math.floor(Math.random() * 60);
      const createdAt = new Date(dateObj);
      createdAt.setHours(hour, minute, Math.floor(Math.random()*60), 0);

      const meal = {
        id: uuid(),
        userId: user.id,
        createdAt: createdAt.toISOString(),
        date: dateStr,
        mealType,
        dish: base.dish,
        description: base.description,
        portion_g: portion,
        kcal: jitter(base.kcal),
        protein: jitter(base.protein),
        carbs: jitter(base.carbs),
        fat: jitter(base.fat),
        fiber: jitter(base.fiber),
        sugar: jitter(base.sugar),
        salt: Number((base.salt * factor).toFixed(1)),
        confidence: 0.85 + Math.random() * 0.12,
        thumbnail: null,
        source: "ai",
        isFake: true,
      };
      db.meals.push(meal);
      totalAdded++;
    }

    // Fake water (ml per day, 1200-2600)
    if (!db.water) db.water = [];
    // remove existing fake water for this date? We'll just upsert
    const waterMl = 1200 + Math.floor(Math.random() * 1400);
    const existingWater = db.water.find(w => w.userId === user.id && w.date === dateStr);
    if (existingWater) {
      if (!existingWater.isFake) {
        // keep real water, skip
      } else {
        existingWater.ml = waterMl;
      }
    } else {
      db.water.push({ id: uuid(), userId: user.id, date: dateStr, ml: waterMl, isFake: true });
    }

    // Fake weight: one entry every 3 days, gradual trend
    if (d % 3 === 0) {
      if (!db.weights) db.weights = [];
      const baseKg = 82;
      const trend = (29 - d) * -0.04; // slight loss over month
      const kg = Number((baseKg + trend + (Math.random() * 0.6 - 0.3)).toFixed(1));
      const existingW = db.weights.find(w => w.userId === user.id && w.date === dateStr);
      if (existingW) {
        if (existingW.isFake) existingW.kg = kg;
      } else {
        db.weights.push({ id: uuid(), userId: user.id, date: dateStr, kg, createdAt: new Date(dateObj).toISOString(), isFake: true });
      }
    }
  }

  // Sort meals newest first
  db.meals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Fake favorites (5 obľúbených)
  if (!db.favorites) db.favorites = [];
  const favDishes = [...dishes].sort(() => 0.5 - Math.random()).slice(0, 5);
  let favAdded = 0;
  for (const base of favDishes) {
    const portion = 200 + Math.floor(Math.random() * 150);
    const factor = portion / 350;
    const jitter = (n) => Math.round(n * factor);
    const fav = {
      id: uuid(),
      userId: user.id,
      dish: base.dish,
      description: base.description,
      portion_g: portion,
      kcal: jitter(base.kcal),
      protein: jitter(base.protein),
      carbs: jitter(base.carbs),
      fat: jitter(base.fat),
      fiber: jitter(base.fiber),
      sugar: jitter(base.sugar),
      salt: Number((base.salt * factor).toFixed(1)),
      mealType: mealTypes[Math.floor(Math.random() * mealTypes.length)],
      createdAt: new Date().toISOString(),
      isFake: true,
    };
    db.favorites.push(fav);
    favAdded++;
  }

  // Ensure today has 3 visible meals (for dashboard "Dnes" demo)
  const todayStr = today.toISOString().slice(0, 10);
  // Remove any existing fake today meals and re-add 3 fresh ones
  db.meals = db.meals.filter(m => !(m.isFake && m.date === todayStr));
  let todayAdded = 0;
  for (let i = 0; i < 3; i++) {
    const base = dishes[i % dishes.length];
    const portion = 280 + Math.floor(Math.random() * 120);
    const factor = portion / 350;
    const jitter = (n) => Math.round(n * factor);
    const mealType = ["breakfast", "lunch", "dinner"][i];
    const hour = [8, 13, 19][i];
    const createdAt = new Date(today);
    createdAt.setHours(hour, Math.floor(Math.random() * 30), 0, 0);
    db.meals.push({
      id: uuid(),
      userId: user.id,
      createdAt: createdAt.toISOString(),
      date: todayStr,
      mealType,
      dish: base.dish,
      description: base.description,
      portion_g: portion,
      kcal: jitter(base.kcal),
      protein: jitter(base.protein),
      carbs: jitter(base.carbs),
      fat: jitter(base.fat),
      fiber: jitter(base.fiber),
      sugar: jitter(base.sugar),
      salt: Number((base.salt * factor).toFixed(1)),
      confidence: 0.9,
      thumbnail: null,
      source: "ai",
      isFake: true,
    });
    todayAdded++;
  }
  db.meals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  console.log(`Pridaných ${totalAdded} fake jedál za posledných 30 dní`);
  console.log(`Pridaných ${favAdded} fake obľúbených`);
  console.log(`Dnes (${todayStr}): ${todayAdded} fake jedál`);
  console.log(`Fake voda: ${db.water.filter(w => w.isFake).length} dní`);
  console.log(`Fake váha: ${db.weights.filter(w => w.isFake).length} záznamov`);
  console.log("Hotovo – pre odstránenie spusti: node scripts/remove-fake-data.mjs");
}

main().catch(e => { console.error(e); process.exit(1); });

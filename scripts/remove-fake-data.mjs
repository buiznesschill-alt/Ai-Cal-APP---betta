import fs from "fs/promises";
import path from "path";
import os from "os";

const DB_PATH = path.join(os.tmpdir(), "fitcal-data-beta", "db.json");

async function main() {
  const raw = await fs.readFile(DB_PATH, "utf-8");
  const db = JSON.parse(raw);
  let removedMeals = 0, removedWater = 0, removedWeights = 0;

  let removedFav = 0;
  if (db.meals) {
    const before = db.meals.length;
    db.meals = db.meals.filter(m => !m.isFake);
    removedMeals = before - db.meals.length;
  }
  if (db.favorites) {
    const before = db.favorites.length;
    db.favorites = db.favorites.filter(f => !f.isFake);
    removedFav = before - db.favorites.length;
  }
  if (db.water) {
    const before = db.water.length;
    db.water = db.water.filter(w => !w.isFake);
    removedWater = before - db.water.length;
  }
  if (db.weights) {
    const before = db.weights.length;
    db.weights = db.weights.filter(w => !w.isFake);
    removedWeights = before - db.weights.length;
  }

  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  console.log(`Odstránených ${removedMeals} fake jedál, ${removedFav} obľúbených, ${removedWater} voda, ${removedWeights} váha`);
}

main().catch(e => { console.error(e); process.exit(1); });

"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { BUS, emitBus, onBus } from "@/lib/bus";
import { NumField } from "@/components/NumField";
import { resolveAutoMeal } from "@/lib/autoMeal";
import { ClientPortal } from "@/components/ClientPortal";
import type { Favorite, MealType } from "@/lib/types";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export function FavoritesRow({ recents, onAdded, autoMeal }: { recents: { dish: string; kcal: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number; salt: number; iron?: number; potassium?: number; portion_g: number; mealType: MealType }[]; onAdded: () => void; autoMeal?: any }) {
  const { t, locale } = useI18n();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [quick, setQuick] = useState<{ dish: string; kcal: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number; salt: number; iron?: number; potassium?: number; portion_g: number; mealType: MealType } | null>(null);
  const [portion, setPortion] = useState(0);
  const [mealType, setMealType] = useState<MealType>("lunch");
const [autoOn, setAutoOn] = useState(false);

useEffect(() => {
  try {
    setAutoOn(localStorage.getItem("fitcal_auto_scan") === "1");
  } catch {}
}, []);
  const [saving, setSaving] = useState(false);
  const [removed, setRemoved] = useState<Favorite | null>(null);
  const undoTimer = useRef<number | null>(null);
  const [page, setPage] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  async function loadFavs() {
    try {
      const res = await fetch("/api/favorites");
      if (res.ok) {
        const d = await res.json();
        setFavorites(d.favorites || []);
      }
    } catch {}
  }

  useEffect(() => {
    loadFavs();
    return () => {
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
    };
  }, []);

  // live: reload favorites whenever anything stars/unstars a meal elsewhere
  useEffect(() => onBus(BUS.favorites, loadFavs), []);

  // ⊖ – optimistic remove + undo toast
  async function removeFav(fav: Favorite) {
    setFavorites((list) => list.filter((x) => x.id !== fav.id));
    setRemoved(fav);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setRemoved(null), 5000);
    try {
      await fetch(`/api/favorites?id=${fav.id}`, { method: "DELETE" });
      emitBus(BUS.favorites);
    } catch {}
  }

  async function undoRemove() {
    if (!removed) return;
    const fav = removed;
    setRemoved(null);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    setFavorites((list) => (list.some((x) => x.id === fav.id) ? list : [fav, ...list]));
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dish: fav.dish,
          description: fav.description,
          portion_g: fav.portion_g,
          kcal: fav.kcal,
          protein: fav.protein,
          carbs: fav.carbs,
          fat: fav.fat,
          fiber: fav.fiber,
          sugar: fav.sugar,
          salt: fav.salt,
          iron: (fav as any).iron ?? 0,
          potassium: (fav as any).potassium ?? 0,
          mealType: fav.mealType,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.favorite?.id) {
          setFavorites((list) => list.map((x) => (x.id === fav.id ? d.favorite : x)));
        }
        emitBus(BUS.favorites);
      }
    } catch {}
  }

  function openQuick(item: { dish: string; kcal: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number; salt: number; iron?: number; potassium?: number; portion_g: number; mealType: MealType }) {
    setQuick(item);
    setPortion(item.portion_g || 100);
    // auto-preselect typu jedla podľa času – len keď je zapnutý Auto prepínač
    let mt = item.mealType || "lunch";
    if (autoOn && autoMeal?.enabled) {
      const resolved = resolveAutoMeal(autoMeal);
      if (resolved) mt = resolved;
    }
    setMealType(mt as MealType);
  }

  function toggleAuto() {
    const next = !autoOn;
    setAutoOn(next);
    try {
      localStorage.setItem("fitcal_auto_scan", next ? "1" : "0");
    } catch {}
    if (next && autoMeal?.enabled && quick) {
      const resolved = resolveAutoMeal(autoMeal);
      if (resolved) setMealType(resolved as MealType);
    }
  }

  async function saveQuick() {
    if (!quick) return;
    setSaving(true);
    const ratio = (quick.portion_g || 1) > 0 ? portion / (quick.portion_g || 1) : 1;
    const scale = (n: number) => Math.round(n * ratio * 10) / 10;
    try {
      await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dish: quick.dish,
          description: "",
          portion_g: portion,
          kcal: Math.round(quick.kcal * ratio),
          protein: scale(quick.protein),
          carbs: scale(quick.carbs),
          fat: scale(quick.fat),
          fiber: scale(quick.fiber),
          sugar: scale(quick.sugar),
          salt: scale(quick.salt),
          iron: scale((quick as any).iron ?? 0),
          potassium: Math.round(scale((quick as any).potassium ?? 0)),
          mealType,
          source: "favorite",
        }),
      });
      onAdded();
      setQuick(null);
    } catch {}
    setSaving(false);
  }

  const [filter, setFilter] = useState<MealType | "all">("all");

  const favFiltered = filter === "all" ? favorites : favorites.filter((f) => f.mealType === filter);
  const recFiltered = filter === "all" ? recents : recents.filter((r) => r.mealType === filter);

  // Desktop: 3 cards per row, paginated with arrows
  const PER_PAGE = 3;
  useEffect(() => {
    setPage(0);
  }, [filter, favorites.length]);
  const totalPages = Math.max(1, Math.ceil(favFiltered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedFavs = isDesktop ? favFiltered.slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE) : favFiltered;
  const arrowCls = "h-8 w-8 rounded-full flex items-center justify-center font-black text-sm transition bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-fitcal-mintLight dark:hover:bg-emerald-500/10 disabled:opacity-30 disabled:hover:bg-zinc-100 dark:disabled:hover:bg-zinc-800";

  const chip = "text-left rounded-2xl border px-3 py-3 transition w-full";
  const chipIdle = "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-100 dark:border-zinc-800 hover:border-fitcal-mint/40 hover:bg-white dark:hover:bg-zinc-800";

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-4 sm:p-6">
      {/* Header with popup menu like Scan meal */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="font-extrabold text-sm sm:text-base">⭐ {t("fav.title")}</h3>
        <div className="flex items-center gap-1.5">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as MealType | "all")}
            className="text-sm font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-full px-4 py-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-fitcal-mint/40"
          >
            <option value="all">{t("hist.all")}</option>
            <option value="breakfast">{t("meal.breakfast")}</option>
            <option value="lunch">{t("meal.lunch")}</option>
            <option value="dinner">{t("meal.dinner")}</option>
            <option value="snack">{t("meal.snack")}</option>
          </select>
          {isDesktop && totalPages > 1 && (
            <>
              <button onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} aria-label={locale === "sk" ? "Predchádzajúca strana" : "Previous page"} className={arrowCls}>←</button>
              <span className="text-[11px] font-black text-zinc-400 tabular-nums min-w-[34px] text-center">{safePage + 1}/{totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1} aria-label={locale === "sk" ? "Ďalšia strana" : "Next page"} className={arrowCls}>→</button>
            </>
          )}
        </div>
      </div>
      <span className="text-[10px] font-medium text-zinc-400 hidden sm:block -mt-1 mb-2">{t("fav.starHint")}</span>
      {favFiltered.length === 0 && filter !== "all" ? (
        <p className="text-xs font-medium text-zinc-500 mt-2">{t("fav.empty")}</p>
      ) : favFiltered.length === 0 && favorites.length === 0 ? (
        <p className="text-xs font-medium text-zinc-500 mt-2">{t("fav.empty")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {pagedFavs.map((f) => (
              <div
                key={f.id}
                role="button"
                tabIndex={0}
                onClick={() => openQuick(f)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openQuick(f)}
                title={f.dish}
                className={`${chip} ${chipIdle} group relative cursor-pointer select-none`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFav(f);
                  }}
                  title={t("fav.removeTitle")}
                  aria-label={`${t("fav.removeTitle")}: ${f.dish}`}
                  className="absolute top-1.5 right-1.5 z-10 h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-200 text-[13px] font-black leading-none flex items-center justify-center shadow-sm hover:bg-red-500 hover:text-white dark:hover:bg-red-500 transition"
                >
                  −
                </button>
                <div className="font-bold text-sm line-clamp-1 pr-6 group-hover:text-fitcal-mintDark">{f.dish}</div>
                <div className="text-[11px] font-bold text-zinc-400 mt-1">
                  {f.kcal} kcal • {f.portion_g}g
                </div>
                <div className="text-[10px] font-bold text-zinc-400 capitalize">{t(`meal.${f.mealType}`)}</div>
              </div>
            ))}
          </div>

          {/* Undo toast with cooldown line */}
          <AnimatePresence>
            {removed && (
              <motion.div
                key="undo"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-2 relative overflow-hidden flex items-center justify-between gap-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3 py-2.5"
              >
                <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 line-clamp-1 truncate">
                  {t("fav.removed")} {removed.dish}
                </span>
                <button onClick={undoRemove} className="text-[11px] font-black text-fitcal-mintDark dark:text-emerald-400 hover:underline shrink-0">
                  {t("fav.undo")}
                </button>
                <motion.div
                  key={removed.id}
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: 5, ease: "linear" }}
                  style={{ transformOrigin: "left" }}
                  className="absolute bottom-0 left-0 h-1 bg-fitcal-mint dark:bg-emerald-500 w-full"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Recent dishes – rovnaký filter */}
      {recFiltered.length > 0 && (
        <>
          <h4 className="font-bold text-xs mt-4 text-zinc-500">🕘 {t("fav.recent")}</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mt-2">
            {recFiltered.map((r, i) => (
              <button key={`${r.dish}-${i}`} onClick={() => openQuick(r)} title={r.dish} className={`${chip} ${chipIdle} group text-left`}>
                <div className="font-bold text-xs line-clamp-1 group-hover:text-fitcal-mintDark">{r.dish}</div>
                <div className="text-[10px] font-bold text-zinc-400 mt-0.5">
                  {r.kcal} kcal • {r.portion_g}g
                </div>
                <div className="text-[10px] font-bold text-zinc-400 capitalize">{t(`meal.${r.mealType}`)}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Quick add dialog */}
      <ClientPortal active={!!quick}>
      <AnimatePresence>
        {quick && (
          <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setQuick(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl max-w-sm w-full shadow-2xl p-4 sm:p-5"
            >
              <h3 className="font-extrabold text-sm sm:text-base">⚡ {t("meal.quickAdd")}</h3>
              <p className="font-bold text-sm mt-1 line-clamp-1">{quick.dish}</p>

              <label className="block mt-3 text-xs font-bold tracking-widest text-zinc-500">{t("meal.portion")}</label>
              <NumField value={portion} min={1} onChange={setPortion} className="mt-1 w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fitcal-mint/30" />

              <div className="flex items-center justify-between gap-2 mt-3">
                <label className="text-xs font-bold tracking-widest text-zinc-500">{t("dash.mealType") || "Typ"}</label>
                {/* Auto prepínač – rovnaké správanie ako v Scan meal */}
                <button
                  onClick={toggleAuto}
                  title={t("settings.autoScan")}
                  className={`h-7 px-2.5 rounded-full text-[10px] font-black flex items-center gap-1 transition active:scale-95 ${
                    autoOn
                      ? "bg-fitcal-mint text-white shadow-sm"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Auto
                </button>
              </div>
              <div className={`mt-1 grid grid-cols-2 gap-1.5 ${autoOn ? "opacity-50 pointer-events-none" : ""}`}>
                {MEAL_TYPES.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMealType(m)}
                    className={`rounded-xl px-2 py-2 text-xs font-bold transition ${
                      mealType === m ? "bg-fitcal-mint text-white shadow-sm" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    {t(`meal.${m}`)}
                  </button>
                ))}
              </div>

              <div className="mt-3 rounded-2xl bg-fitcal-mintLight dark:bg-emerald-500/10 px-3 py-2 text-xs font-bold text-fitcal-mintDark dark:text-emerald-300 text-center">
                ≈ {Math.round((quick.kcal * portion) / (quick.portion_g || 1))} kcal
              </div>

              <div className="mt-4 flex gap-2">
                <button onClick={() => setQuick(null)} className="flex-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold py-2.5">
                  {t("common.cancel")}
                </button>
                <button onClick={saveQuick} disabled={saving} className="flex-1 rounded-2xl bg-fitcal-mint text-white font-bold py-2.5 disabled:opacity-60">
                  {saving ? t("dash.saving") : t("meal.add")}
                </button>
              </div>
            </motion.div>
          </motion.div>
          </>
        )}
      </AnimatePresence>
      </ClientPortal>
    </div>
  );
}

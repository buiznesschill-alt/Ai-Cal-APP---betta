"use client";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { DailyRing, MacroRing } from "@/components/MacroRing";
import { CameraCapture } from "@/components/CameraCapture";
import { InfoHint } from "@/components/InfoHint";
import { NutritionCard } from "@/components/NutritionCard";
import { DayChart } from "@/components/DayChart";
import { HistoryList } from "@/components/HistoryView";
import { LayoutToggle } from "@/components/LayoutToggle";
import { ManualMealModal } from "@/components/ManualMeal";
import { BarcodeScan } from "@/components/BarcodeScan";
import { FavoritesRow } from "@/components/FavoritesRow";
import { WaterCard } from "@/components/WaterCard";
import { StatsCard } from "@/components/StatsCard";
import { MonthHeatmap } from "@/components/MonthHeatmap";
import { PortionEditModal } from "@/components/PortionEdit";
import { SupplementsTable } from "@/components/SupplementsTable";
import { useSectionDisplay } from "@/lib/display";
import { MealTypeIcon } from "@/components/MealTypeIcon";
import { IntroTour, useIntroAuto } from "@/components/IntroTour";
import { BUS, emitBus, onBus } from "@/lib/bus";
import dynamic from "next/dynamic";

const TrendCharts = dynamic(() => import("@/components/TrendCharts").then((m) => m.TrendCharts), { ssr: false, loading: () => <div className="h-40 bg-zinc-50 rounded-3xl animate-pulse" /> });
const HealthTips = dynamic(() => import("@/components/HealthTips").then((m) => m.HealthTips), { ssr: false });
const HealthTipsExpanded = dynamic(() => import("@/components/HealthTips").then((m) => m.HealthTipsExpanded), { ssr: false });

import { useI18n } from "@/lib/i18n";
import type { Meal, User } from "@/lib/types";

// WHO defaults for extra macros
const FIBER_GOAL = 30;
const SUGAR_GOAL = 50;
const SALT_GOAL = 6;
const GRAM_GOAL = 2000; // beta: denný gramáž jedla (typicky 1,5–2,5 kg)
const IRON_GOAL = 14; // mg – EFSA odporúčanie
const POTASSIUM_GOAL = 3500; // mg – WHO odporúčanie

export default function DashboardClient({
  user: initialUser,
  initialSummary,
  initialHistory,
}: {
  user: User;
  initialSummary: any;
  initialHistory: any[];
}) {
  const { t, locale } = useI18n();
  const [user, setUser] = useState(initialUser);
  const [summary, setSummary] = useState(initialSummary);
  const [history, setHistory] = useState<any[]>(initialHistory || []);
  const [tab, setTab] = useState<"today" | "history" | "tips">("today");
  const [mealFilter, setMealFilter] = useState<Meal["mealType"] | "all">("all");
  const [analysis, setAnalysis] = useState<{ result: any; thumbnail: string | null; mealType?: string; foodClass?: "main"|"snack" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [portionMeal, setPortionMeal] = useState<Meal | null>(null);
  const [starredId, setStarredId] = useState<string | null>(null);
  const { open: introOpen, setOpen: setIntroOpen, close: closeIntro } = useIntroAuto();

  // Beta: recent unique dishes for quick re-add
  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const m of summary?.meals || []) {
      const key = m.dish.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(m);
      if (out.length >= 8) break;
    }
    return out;
  }, [summary]);

  async function starMeal(meal: Meal) {
    setStarredId(meal.id);
    try {
      const existingId = favDishes.get(meal.dish.toLowerCase());
      let res: Response;
      if (existingId != null) {
        // already a favorite → remove (toggle off)
        res = await fetch(`/api/favorites?id=${existingId}`, { method: "DELETE" });
      } else {
        res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dish: meal.dish,
            description: meal.description,
            portion_g: meal.portion_g,
            kcal: meal.kcal,
            protein: meal.protein,
            carbs: meal.carbs,
            fat: meal.fat,
            fiber: meal.fiber,
              sugar: meal.sugar,
              salt: meal.salt,
              iron: meal.iron ?? 0,
              potassium: meal.potassium ?? 0,
              mealType: meal.mealType,
            }),
        });
      }
      if (res.ok) emitBus(BUS.favorites);
    } catch {}
    setTimeout(() => setStarredId(null), 1500);
  }

  // which dishes are already in favorites (dishLower -> favorite id)
  const [favDishes, setFavDishes] = useState<Map<string, string>>(new Map());

  function loadFavorites() {
    fetch("/api/favorites")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const map = new Map<string, string>();
        for (const f of d.favorites || []) map.set(String(f.dish).toLowerCase(), f.id);
        setFavDishes(map);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadFavorites();
  }, []);

  // live: keep star states in sync with any favorites change anywhere
  useEffect(() => onBus(BUS.favorites, loadFavorites), []);

  function groupMeals(meals: Meal[]) {
    const grouped: Record<string, Meal[]> = {};
    for (const m of meals || []) {
      if (!grouped[m.date]) grouped[m.date] = [];
      grouped[m.date].push(m);
    }
    return Object.entries(grouped)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7)
      .map(([date, meals]) => ({ date, meals }));
  }

  async function fetchAll() {
    const res = await fetch(`/api/meals?date=${new Date().toISOString().slice(0, 10)}&summary=1`);
    const data = await res.json();
    setSummary(data);
    const res2 = await fetch(`/api/meals?limit=60`);
    const d2 = await res2.json();
    setHistory(groupMeals(d2.meals || []));
  }

  // local user action → update this tab and broadcast to other tabs
  async function refresh() {
    await fetchAll();
    emitBus(BUS.meals);
  }

  // remote change (another device/tab) → update silently, never re-broadcast (prevents loops)
  async function silentRefresh() {
    await fetchAll();
  }

  // live sync: server pushes instant change events for this account (all devices)
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource("/api/events");
    es.addEventListener("meals", () => {
      silentRefresh().then(() => emitBus(BUS.meals)); // also wake self-fetching widgets
    });
    es.addEventListener("favorites", () => {
      loadFavorites();
    });
    es.addEventListener("sickness", () => {
      emitBus(BUS.sickness);
    });
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleResult(data: { result: any; thumbnail: string | null; mealType?: string }) {
    setAnalysis({ ...data, foodClass: data.result?.foodClass });
    setTab("today");
  }

  // Uloží analyzované jedlo – až teraz sa započíta do denných súčtov
  async function saveMeal() {
    if (!analysis) return;
    setSaving(true);
    try {
      const r = analysis.result;
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dish: r.dish,
          description: r.description,
          portion_g: r.portion_g,
          kcal: r.kcal,
          protein: r.protein,
          carbs: r.carbs,
          fat: r.fat,
          fiber: r.fiber,
          sugar: r.sugar,
          salt: r.salt,
          iron: r.iron ?? 0,
          potassium: r.potassium ?? 0,
          confidence: r.confidence,
          thumbnail: analysis.thumbnail && analysis.thumbnail.length <= 40000 ? analysis.thumbnail : null,
          mealType: analysis.mealType || "lunch",
          source: "ai",
        }),
      });
      if (!res.ok) throw new Error();
      await refresh();
      setAnalysis(null);
      // po uložení jemne posun view tak, aby bol pred očami Daily goal a všetko pod ním.
      // rátame absolútnu pozíciu až keď sa layout po prekreslení usadí (inak scroll preletí ďalej).
      setTimeout(() => {
        const cards = document.querySelectorAll<HTMLElement>("#daily-goal-card");
        let el: HTMLElement | null = null;
        for (const c of Array.from(cards)) {
          if (c.offsetParent !== null) {
            el = c;
            break;
          }
        }
        if (!el) return;
        const y = el.getBoundingClientRect().top + window.pageYOffset - 72; // 72px = sticky header
        window.scrollTo({ top: Math.max(y, 0), behavior: "smooth" });
      }, 400);
    } catch {
      alert(t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteMeal(id: string) {
    setDeleting(id);
    await fetch(`/api/meals?id=${id}`, { method: "DELETE" });
    await refresh();
    setDeleting(null);
  }

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => d.user && setUser(d.user))
      .catch(() => {});
  }, []);

  // Streak modal → kalendárová ikonka: prepne na History tab a zameria mesiacny kalendár
  useEffect(() => {
    const openCalendar = () => {
      setTab("history");
      setTimeout(() => {
        const els = document.querySelectorAll<HTMLElement>("#month-calendar");
        let el: HTMLElement | null = null;
        for (const c of Array.from(els)) {
          if (c.offsetParent !== null) {
            el = c;
            break;
          }
        }
        if (!el) return;
        const y = el.getBoundingClientRect().top + window.pageYOffset - 72;
        window.scrollTo({ top: Math.max(y, 0), behavior: "smooth" });
      }, 400);
    };
    const onCustom = () => {
      try {
        sessionStorage.removeItem("fitcal_open_calendar");
      } catch {}
      openCalendar();
    };
    window.addEventListener("fitcal:openCalendar", onCustom as EventListener);
    // fallback ak používateľ klikol z inej stránky – flag sa spracuje po návrate na dashboard
    try {
      if (sessionStorage.getItem("fitcal_open_calendar") === "1") {
        sessionStorage.removeItem("fitcal_open_calendar");
        setTimeout(openCalendar, 300);
      }
    } catch {}
    return () => window.removeEventListener("fitcal:openCalendar", onCustom as EventListener);
  }, []);

  const remaining = Math.max(0, user.goalKcal - summary.totalKcal);
  const pct = user.goalKcal > 0 ? Math.round((summary.totalKcal / user.goalKcal) * 100) : 0;

  const macros = [
    { label: t("dash.protein"), value: summary.totalProtein, goal: user.goalProtein, color: "#10B981", infoKey: "info.protein" },
    { label: t("dash.carbs"), value: summary.totalCarbs, goal: user.goalCarbs, color: "#F59E0B", infoKey: "info.carbs" },
    { label: t("dash.fat"), value: summary.totalFat, goal: user.goalFat, color: "#F97316", infoKey: "info.fat" },
    { label: t("nut.fiber"), value: summary.totalFiber ?? 0, goal: FIBER_GOAL, color: "#06B6D4", infoKey: "info.fiber" },
    { label: t("nut.sugar"), value: summary.meals?.reduce((s: number, m: Meal) => s + m.sugar, 0) ?? 0, goal: SUGAR_GOAL, color: "#EC4899", infoKey: "info.sugar" },
    { label: t("nut.salt"), value: summary.meals?.reduce((s: number, m: Meal) => s + m.salt, 0) ?? 0, goal: SALT_GOAL, color: "#8B5CF6", infoKey: "info.salt" },
    { label: t("nut.grams"), value: summary.meals?.reduce((s: number, m: Meal) => s + m.portion_g, 0) ?? 0, goal: GRAM_GOAL, color: "#0EA5E9", infoKey: "info.grams" },
    { label: t("nut.iron"), value: summary.meals?.reduce((s: number, m: Meal) => s + (m.iron || 0), 0) ?? 0, goal: IRON_GOAL, color: "#D97706", unit: "mg", infoKey: "info.iron" },
    { label: t("nut.potassium"), value: summary.meals?.reduce((s: number, m: Meal) => s + (m.potassium || 0), 0) ?? 0, goal: POTASSIUM_GOAL, color: "#65A30D", unit: "mg", infoKey: "info.potassium" },
  ];

  // ---------- shared meal card ----------
  function MealRow({ meal }: { meal: Meal }) {
    return (
      <div className="flex gap-2 p-2.5 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800/40">
        {meal.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={meal.thumbnail} alt={meal.dish} className="h-12 w-12 rounded-xl object-cover bg-zinc-100 dark:bg-zinc-800 shrink-0" />
        ) : (
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-fitcal-mintLight to-zinc-100 dark:from-zinc-800 dark:to-zinc-800/40 flex items-center justify-center shrink-0 overflow-hidden">
            <MealTypeIcon type={meal.mealType} className="h-full w-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <h4 className="font-bold text-xs line-clamp-1">{meal.dish}</h4>
            <span className="text-[10px] font-black bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white px-1.5 py-0.5 rounded-full shrink-0">{meal.kcal} {t("nut.kcal")}</span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">{meal.description} • {meal.portion_g}g</p>
          <div className="flex gap-1 mt-1 flex-wrap">
            <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full">B {meal.protein}g</span>
            <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full">S {meal.carbs}g</span>
            <span className="text-[10px] font-bold bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full">T {meal.fat}g</span>
          </div>
        </div>
        <div className="self-center flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => starMeal(meal)}
            title={favDishes.has(meal.dish.toLowerCase()) ? t("fav.removeTitle") : t("fav.title")}
            className={`p-1.5 transition ${
              favDishes.has(meal.dish.toLowerCase())
                ? "text-amber-400"
                : "text-zinc-300 dark:text-zinc-600 hover:text-amber-400"
            } ${starredId === meal.id ? "scale-125" : ""}`}
          >
            {favDishes.has(meal.dish.toLowerCase()) || starredId === meal.id ? "⭐" : "☆"}
          </button>
          <button onClick={() => setPortionMeal(meal)} title={t("meal.editPortion")} className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-fitcal-mintDark dark:hover:text-emerald-300 transition">
            ✎
          </button>
          <button onClick={() => deleteMeal(meal.id)} disabled={deleting === meal.id} className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition">
            {deleting === meal.id ? <span className="h-3 w-3 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin block" /> : "✕"}
          </button>
        </div>
      </div>
    );
  }

  // ---------- daily goal card (shared) ----------
  function DailyGoalCard({ compact }: { compact?: boolean }) {
    return (
      <div id="daily-goal-card" data-tour="goal" className={`bg-white dark:bg-zinc-900 scroll-mt-24 ${compact ? "rounded-3xl p-4" : "rounded-3xl xl:rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-4 sm:p-6"}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-1.5">
            <h2 className={`font-extrabold ${compact ? "text-sm" : "text-base sm:text-lg"}`}>{t("dash.goal")}</h2>
            <InfoHint text={t("info.goal")} />
          </span>
          <span className={`text-[11px] sm:text-xs font-bold px-2 py-1 rounded-full ${pct > 100 ? "bg-fitcal-orange text-white" : "bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white"}`}>{pct}%</span>
        </div>
        <div className={compact ? "scale-90 -my-3" : ""}>
          <DailyRing consumed={summary.totalKcal} goal={user.goalKcal} />
        </div>
        <div className={`${compact ? "mt-2" : "mt-4"} grid grid-cols-3 gap-1.5 sm:gap-2 text-center`}>
          <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-xl sm:rounded-2xl py-2">
            <div className="text-[10px] font-bold tracking-widest text-zinc-500 flex items-center justify-center gap-0.5">
              {t("dash.consumed")} <InfoHint text={t("info.consumed")} label={t("dash.consumed")} />
            </div>
            <div className="font-black text-sm">{summary.totalKcal}</div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-xl sm:rounded-2xl py-2">
            <div className="text-[10px] font-bold tracking-widest text-zinc-500 flex items-center justify-center gap-0.5">
              {t("dash.remaining")} <InfoHint text={t("info.remaining")} label={t("dash.remaining")} />
            </div>
            <div className="font-black text-sm">{remaining}</div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-xl sm:rounded-2xl py-2">
            <div className="text-[10px] font-bold tracking-widest text-zinc-500 flex items-center justify-center gap-0.5">
              {t("dash.goal")} <InfoHint text={t("info.goal")} label={t("dash.goal")} />
            </div>
            <div className="font-black text-sm">{user.goalKcal}</div>
          </div>
        </div>
        {/* 6 makroživín */}
        <div className={`${compact ? "mt-4" : "mt-5"}`}>
          <h3 className="font-bold text-xs mb-2">{t("dash.macros")}</h3>
          <div className="grid grid-cols-3 gap-x-1 gap-y-2 justify-items-center">
            {macros.map((m) => (
              <MacroRing key={m.label} label={m.label} value={m.value} goal={m.goal} color={m.color} info={m.infoKey ? t(m.infoKey) : undefined} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------- meals card (shared) ----------
  // filtered + chronological (first meal on top, last at the bottom)
  const shownMeals = useMemo(() => {
    const list = mealFilter === "all" ? summary.meals || [] : (summary.meals || []).filter((m: Meal) => m.mealType === mealFilter);
    return [...list].sort((a: Meal, b: Meal) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [summary.meals, mealFilter]);

  function MealsCard({ maxHeight }: { maxHeight?: string }) {
    const filterBtn = (active: boolean) =>
      `px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
        active ? "bg-white dark:bg-zinc-950 shadow text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
      }`;
    return (
      <div data-tour="meals" className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-3 sm:p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1.5">
            <h3 className="font-extrabold text-sm sm:text-base">
              {t("dash.meals")} • {shownMeals.length}
              {mealFilter !== "all" && <span className="text-zinc-400 font-bold"> / {summary.meals.length}</span>}
            </h3>
            <InfoHint text={t("meals.info")} label={t("dash.meals")} />
          </span>
          <span className="text-[11px] sm:text-xs font-bold text-zinc-500" suppressHydrationWarning>{new Date().toISOString().slice(0, 10)}</span>
        </div>
        <div className="overflow-x-auto mb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-full w-max mx-auto">
            {(["all", "breakfast", "lunch", "dinner", "snack"] as const).map((ft) => (
              <button key={ft} onClick={() => setMealFilter(ft)} className={filterBtn(mealFilter === ft)}>
                {ft === "all" ? t("hist.all") : (
                  <span className="inline-flex items-center gap-1">
                    <MealTypeIcon type={ft} className="h-6 w-6 rounded-lg object-contain" />
                    {t(`meal.${ft}`)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        {shownMeals.length === 0 ? (
          <div className="text-center py-6 sm:py-8">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg mb-2">🍽️</div>
            <p className="font-medium text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm px-2">{t("dash.empty")}</p>
          </div>
        ) : (
          <div className={`space-y-2 ${maxHeight ? `${maxHeight} overflow-y-auto pr-1` : ""}`}>
            {shownMeals.map((meal: Meal) => (
              <MealRow key={meal.id} meal={meal} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------- shared layout mode ----------
  const [todayMode] = useSectionDisplay("dash-today");
  const [histMode] = useSectionDisplay("dash-history");
  const todayCols = todayMode === "split" ? "lg:grid-cols-3 md:grid-cols-2" : "";
  const histCols = histMode === "split" ? "lg:grid-cols-2" : "";

  return (
    <div className="min-h-screen pb-10 sm:pb-0" suppressHydrationWarning>
      <Header username={user.username} displayName={user.displayName} />

      <main className="px-3 sm:px-6 py-3 sm:py-6 space-y-4 sm:space-y-6" suppressHydrationWarning>
        {/* Tabs História | Dnes | Tipy – single window, swaps content (mockup 1.png / 2.png) */}
        <div className="relative flex justify-center pt-1">
          <div className="flex gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full p-1 shadow-sm">
            {(["history", "today", "tips"] as const).map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className={`px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition ${
                  tab === tb ? "bg-blue-500 text-white shadow" : "bg-transparent text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                {tb === "history" ? t("nav.history") : tb === "today" ? t("nav.today") : t("nav.tips")}
              </button>
            ))}
          </div>
          <div className="absolute right-0 top-0 h-full items-center hidden md:flex">
            <LayoutToggle section={tab === "today" ? "dash-today" : tab === "history" ? "dash-history" : "tips"} />
          </div>
        </div>

        {/* Analysis result on top */}
        <AnimatePresence>
          {analysis && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className="bg-fitcal-mint text-white rounded-2xl px-4 py-2.5 flex items-center gap-2 font-bold text-xs sm:text-sm mb-2">
                <span className="h-2 w-2 bg-white rounded-full animate-pulse" /> {t("dash.newAnalysis")}
              </div>
              <NutritionCard
                result={analysis.result}
                thumbnail={analysis.thumbnail}
                mealType={analysis.mealType as any}
                foodClass={analysis.foodClass as any}
                onSave={saveMeal}
                onCancel={() => {
                  // X = zruš analýzu a skoč úplne hore, aby bolo skenovanie nového jedla po ruke
                  setAnalysis(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                saving={saving}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============ Single window, tab swaps content (mockups 1.png, 2.png, 4.png) ============ */}
        <AnimatePresence mode="wait">
          {tab === "today" ? (
            <motion.div key="today" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {/* MOBILE stacked order: 2 scan → 1 goal → favorites → 4 meals → water → supps → stats → 5 chart → 3 tips */}
              <div className="sm:hidden space-y-4">
                <div data-tour="scan"><CameraCapture onResult={handleResult} onManual={() => setShowManual(true)} onBarcode={() => setShowBarcode(true)} autoMeal={user.autoMeal} /></div>
                <DailyGoalCard compact />
                <div data-tour="favorites"><FavoritesRow recents={recents} onAdded={refresh} autoMeal={user.autoMeal} /></div>
                <MealsCard maxHeight="max-h-72" />
                <div data-tour="water"><WaterCard goalMl={user.goalWaterMl ?? 2000} /></div>
                <SupplementsTable />
                <div data-tour="stats"><StatsCard goalKcal={user.goalKcal} /></div>
                <div data-tour="chart"><DayChart meals={summary.meals} /></div>
                <div data-tour="tips"><HealthTips onShowAll={() => { setTab("tips"); window.scrollTo(0, 0); }} /></div>
              </div>

              {/* DESKTOP grid: 1 | 2+fav+4 | 3+5+water+supps+stats */}
              <div className="hidden sm:block">
                <div className={`grid ${todayCols} gap-6 items-start`}>
                  <DailyGoalCard />
                  <div className="space-y-6">
                    <div data-tour="scan"><CameraCapture onResult={handleResult} onManual={() => setShowManual(true)} onBarcode={() => setShowBarcode(true)} autoMeal={user.autoMeal} /></div>
                    <div data-tour="favorites"><FavoritesRow recents={recents} onAdded={refresh} autoMeal={user.autoMeal} /></div>
                    <MealsCard maxHeight="max-h-[420px]" />
                  </div>
                  <div className="space-y-6">
                    <div data-tour="tips"><HealthTips onShowAll={() => { setTab("tips"); window.scrollTo(0, 0); }} /></div>
                    <div data-tour="chart"><DayChart meals={summary.meals} /></div>
                    <div data-tour="water"><WaterCard goalMl={user.goalWaterMl ?? 2000} /></div>
                    <SupplementsTable />
                    <div data-tour="stats"><StatsCard goalKcal={user.goalKcal} /></div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : tab === "tips" ? (
            <motion.div key="tips" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <div data-tour="tips-full"><HealthTipsExpanded /></div>
            </motion.div>
          ) : (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {/* MOBILE */}
              <div className="sm:hidden space-y-4">
                <div data-tour="heatmap"><MonthHeatmap goalKcal={user.goalKcal} /></div>
                <div data-tour="history"><HistoryList history={history} /></div>
                <SupplementsTable />
                <div data-tour="trend"><TrendCharts userId={user.id} /></div>
              </div>
              {/* DESKTOP: meal list | chart side by side, heatmap below */}
              <div className="hidden sm:block space-y-6">
                <div className={`grid ${histCols} gap-6 items-start`}>
                  <div data-tour="history"><HistoryList history={history} /></div>
                  <div data-tour="trend"><TrendCharts userId={user.id} /></div>
                </div>
                <div data-tour="heatmap"><MonthHeatmap goalKcal={user.goalKcal} /></div>
                <SupplementsTable />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Beta modals */}
        <ManualMealModal open={showManual} onClose={() => setShowManual(false)} onSaved={refresh} autoMeal={user.autoMeal} />
        <BarcodeScan open={showBarcode} onClose={() => setShowBarcode(false)} onSaved={refresh} autoMeal={user.autoMeal} onManual={() => { setShowBarcode(false); setShowManual(true); }} />
        <PortionEditModal meal={portionMeal} onClose={() => setPortionMeal(null)} onSaved={() => refresh()} />
        <IntroTour open={introOpen} onClose={closeIntro} onTabChange={(t)=> setTab(t as any)} />
      </main>
    </div>
  );
}


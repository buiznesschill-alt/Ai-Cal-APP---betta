"use client";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { BUS, onBus } from "@/lib/bus";
import type { Meal } from "@/lib/types";
import { InfoHint } from "@/components/InfoHint";

const DAY_LABELS_SK = ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"];
const DAY_LABELS_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function MonthHeatmap({ goalKcal }: { goalKcal: number }) {
  const { t, locale } = useI18n();
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [totals, setTotals] = useState<Map<string, number>>(new Map());
  const [sicknesses, setSicknesses] = useState<{ startDate: string; endDate: string | null }[]>([]);
  // single floating window, always centered in the calendar
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<Record<string, Meal[]>>({});
  const [loadingDays, setLoadingDays] = useState<Record<string, boolean>>({});

  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  function fetchTotals() {
    fetch(`/api/meals?summary=month&month=${monthKey}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setTotals(new Map((d.totals || []).map((x: any) => [x.date, x.totalKcal]))))
      .catch(() => {});
  }
  function fetchSickness() {
    fetch("/api/sickness").then(r=>r.ok?r.json():Promise.reject()).then(d=> setSicknesses(d.sicknesses||[])).catch(()=>{});
  }

  useEffect(() => {
    fetchTotals();
    fetchSickness();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  // live: refresh month totals when any meal is added/removed/deleted elsewhere
  useEffect(() => {
    const off1 = onBus(BUS.meals, fetchTotals);
    const off2 = onBus(BUS.sickness, fetchSickness);
    return () => { off1(); off2(); };
  }, [monthKey]);

  // stale pixel anchor after month switch
  useEffect(() => {
    setOpenDay(null);
  }, [monthKey]);

  function toggleDay(date: string) {
    setOpenDay((prev) => {
      if (!prev) return date; // open
      if (prev === date) return null; // same day → close
      return null; // switching days: first click only closes the current one
    });
    if (!dayDetails[date] && !loadingDays[date]) {
      setLoadingDays((p) => ({ ...p, [date]: true }));
      fetch(`/api/meals?date=${date}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => setDayDetails((p) => ({ ...p, [date]: d.meals || [] })))
        .catch(() => setDayDetails((p) => ({ ...p, [date]: [] })))
        .finally(() => setLoadingDays((p) => ({ ...p, [date]: false })));
    }
  }

  function closeDay() {
    setOpenDay(null);
  }
  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Monday-first index
    let lead = first.getDay() - 1;
    if (lead < 0) lead = 6;
    const arr: (null | { day: number; date: string })[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ day: d, date: `${monthKey}-${String(d).padStart(2, "0")}` });
    }
    return arr;
  }, [year, month, monthKey]);

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function isFreeze(date: string): boolean {
    return sicknesses.some(s => date >= s.startDate && (s.endDate == null || date <= s.endDate));
  }
  function cellColor(kcal?: number, date?: string): string {
    if (date && isFreeze(date)) return "bg-blue-500 text-white";
    if (kcal == null) {
      // prázdny deň od prvého jedla = biela -1 (pokiaľ nie je freeze)
      if (date) {
        const today = new Date().toISOString().slice(0,10);
        const first = Array.from(totals.keys()).sort()[0];
        if (first && date < today && date >= first) return "bg-white dark:bg-zinc-100 text-zinc-700 border border-zinc-300";
      }
      return "bg-zinc-100 dark:bg-zinc-800 text-zinc-400";
    }
    // biele = low day (goal - 500 a menej)
    if (kcal <= goalKcal - 500) return "bg-white dark:bg-zinc-100 text-zinc-700 border border-zinc-300";
    // zelená = v cieli (goal - 499 až goal + 100)
    if (kcal <= goalKcal + 100) return "bg-emerald-500 text-white";
    // červená = nad cieľom (goal + 101 a viac)
    return "bg-red-500 text-white";
  }

  const monthName = new Date(year, month, 1).toLocaleDateString(locale === "sk" ? "sk-SK" : "en-GB", { month: "long", year: "numeric" });

  return (
    <div id="month-calendar" className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-4 sm:p-6 scroll-mt-24">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <h3 className="font-extrabold text-sm sm:text-base">📅 {t("cal.title")}</h3>
          <InfoHint text={t("cal.info")} label={t("cal.title")} />
        </span>
        <div className="flex items-center gap-1.5">
          <button onClick={() => shift(-1)} aria-label="<" className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-fitcal-mintLight dark:hover:bg-emerald-500/10 flex items-center justify-center font-black text-zinc-600 dark:text-zinc-300 transition">
            ←
          </button>
          <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 min-w-[110px] text-center capitalize" suppressHydrationWarning>
            {monthName}
          </span>
          <button onClick={() => !isCurrentMonth && shift(1)} disabled={isCurrentMonth} aria-label=">" className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-fitcal-mintLight dark:hover:bg-emerald-500/10 flex items-center justify-center font-black text-zinc-600 dark:text-zinc-300 transition disabled:opacity-30">
            →
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-1.5 relative">
        {(locale === "sk" ? DAY_LABELS_SK : DAY_LABELS_EN).map((d) => (
          <div key={d} className="text-center text-[10px] font-bold tracking-widest text-zinc-400 uppercase pb-1">
            {d}
          </div>
        ))}
        {cells.map((c, i) => {
          if (!c) return <div key={`e-${i}`} />;
          const kcal = totals.get(c.date);
          const freeze = isFreeze(c.date);
          const isToday = c.date === new Date().toISOString().slice(0, 10);
          const isOpen = openDay === c.date;
          return (
            <div
              key={c.date}
              role="button"
              tabIndex={0}
              onClick={() => toggleDay(c.date)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleDay(c.date)}
              title={freeze ? `${c.date}: freeze` : kcal != null ? `${c.date}: ${kcal} kcal` : c.date}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center transition cursor-pointer select-none ${cellColor(kcal, c.date)} ${isToday ? "ring-2 ring-blue-500" : ""} ${isOpen ? "ring-2 ring-fitcal-mintDark dark:ring-emerald-400 scale-105 shadow-md" : ""}`}
            >
              <span className="text-[11px] sm:text-xs font-bold leading-none">{c.day}</span>
              {kcal != null && <span className="text-[8px] sm:text-[9px] font-bold opacity-80 mt-0.5 leading-none">{kcal}</span>}
            </div>
          );
        })}

        {/* Floating window – always centered over the calendar */}
        {openDay && (() => {
          const date = openDay;
          const meals = dayDetails[date];
          const loading = loadingDays[date];
          const total = (meals || []).reduce((s, m) => s + m.kcal, 0);
          const p = (meals || []).reduce((s, m) => s + m.protein, 0);
          const cb = (meals || []).reduce((s, m) => s + m.carbs, 0);
          const f = (meals || []).reduce((s, m) => s + m.fat, 0);
          const label = new Date(year, month, Number(date.slice(-2))).toLocaleDateString(locale === "sk" ? "sk-SK" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
          const over = total > goalKcal;
          return (
            <div
              key={`win-${date}`}
              onClick={(e) => e.stopPropagation()}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 rounded-2xl border shadow-xl p-3 text-xs font-bold"
              style={{
                minWidth: 200,
                maxWidth: 260,
                backgroundColor: dark ? "#18181B" : "#ffffff",
                borderColor: dark ? "#3F3F46" : "#e5e7eb",
                color: dark ? "#F4F4F5" : "#1A1C1E",
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-extrabold capitalize" suppressHydrationWarning>{label}</span>
                <button
                  onClick={closeDay}
                  aria-label={locale === "sk" ? "Zavrieť" : "Close"}
                  className="h-5 w-5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-red-500 hover:text-white text-zinc-500 dark:text-zinc-300 flex items-center justify-center text-[11px] font-black leading-none transition shrink-0"
                >
                  ✕
                </button>
              </div>
              {loading ? (
                <div className="flex items-center gap-2 py-2 text-zinc-500">
                  <span className="h-3 w-3 border-2 border-zinc-300 border-t-zinc-500 rounded-full animate-spin block" /> …
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-base font-black">{total} {t("nut.kcal")}</span>
                    {meals && meals.length > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${over ? "bg-orange-400/20 text-orange-600 dark:text-orange-300" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"}`}>
                        {over ? "+" : ""}{total - goalKcal}
                      </span>
                    )}
                  </div>
                  {meals && meals.length > 0 && (
                    <div className="flex gap-1 mb-2 flex-wrap">
                      <span title={`${t("dash.protein")} (g)`} className="flex items-center gap-1 text-[10px] font-black rounded-full px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{t("dash.protein")} <span className="tabular-nums">{p} g</span>
                      </span>
                      <span title={`${t("dash.carbs")} (g)`} className="flex items-center gap-1 text-[10px] font-black rounded-full px-2 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{t("dash.carbs")} <span className="tabular-nums">{cb} g</span>
                      </span>
                      <span title={`${t("dash.fat")} (g)`} className="flex items-center gap-1 text-[10px] font-black rounded-full px-2 py-1 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />{t("dash.fat")} <span className="tabular-nums">{f} g</span>
                      </span>
                    </div>
                  )}
                  {!meals || meals.length === 0 ? (
                    <div className="text-[11px] font-semibold text-zinc-500 py-1">{t("cal.noMeals")}</div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1 -mr-1">
                      {meals.map((m) => (
                        <div key={m.id} className="flex items-start justify-between gap-2 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl px-2 py-1.5">
                          <div className="min-w-0">
                            <div className="line-clamp-1">{m.dish}</div>
                            <div className="flex gap-1.5 mt-0.5 text-[9px] font-bold">
                              <span title={`${t("dash.protein")} (g)`} className="text-emerald-600 dark:text-emerald-400">B {m.protein}g</span>
                              <span title={`${t("dash.carbs")} (g)`} className="text-amber-600 dark:text-amber-400">S {m.carbs}g</span>
                              <span title={`${t("dash.fat")} (g)`} className="text-orange-600 dark:text-orange-400">T {m.fat}g</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-zinc-500 shrink-0">{m.kcal}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}
      </div>

      <div className="mt-3 flex items-center justify-center gap-3 flex-wrap text-[10px] font-bold text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-white border border-zinc-400 dark:bg-zinc-100 inline-block" /> {t("cal.legendUnder")} (≤ {goalKcal - 500})
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" /> {t("cal.legendOk")}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" /> {t("cal.legendOver")} (≥ {goalKcal + 101})
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" /> freeze
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700 inline-block" /> {t("cal.legendNone")}
        </span>
      </div>
    </div>
  );
}

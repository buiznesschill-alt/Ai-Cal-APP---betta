"use client";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { MealType } from "@/lib/types";
import { MealTypeIcon } from "@/components/MealTypeIcon";

const TYPES: (MealType | "all")[] = ["all", "breakfast", "lunch", "dinner", "snack"];

export function HistoryList({ history }: { history: { date: string; meals: any[] }[] }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<MealType | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history
      .map((g) => ({
        ...g,
        // chronological within the day: first meal of the day on top, last at the bottom
        meals: g.meals
          .filter((m) => {
            if (typeFilter !== "all" && m.mealType !== typeFilter) return false;
            if (q && !(`${m.dish} ${m.description}`.toLowerCase().includes(q))) return false;
            return true;
          })
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      }))
      .filter((g) => g.meals.length > 0);
  }, [history, query, typeFilter]);

  if (!history || history.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-card border border-zinc-100 dark:border-zinc-800 p-6 text-center">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg mb-2">📅</div>
        <p className="text-xs font-medium text-zinc-500">{t("hist.empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Beta: search + meal type filter */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-card border border-zinc-100 dark:border-zinc-800 p-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("hist.search")}
          className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fitcal-mint/30"
        />
        <div className="mt-2 flex gap-1 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
          {TYPES.map((tp) => (
            <button
              key={tp}
              onClick={() => setTypeFilter(tp)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                typeFilter === tp ? "bg-fitcal-mint text-white shadow-sm" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {tp === "all" ? t("hist.all") : (
                <span className="inline-flex items-center gap-1">
                  <MealTypeIcon type={tp} className="h-6 w-6 rounded-lg object-contain" />
                  {t(`meal.${tp}`)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-card border border-zinc-100 dark:border-zinc-800 p-6 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg mb-2">🔍</div>
          <p className="text-xs font-medium text-zinc-500">{t("hist.empty")}</p>
        </div>
      ) : (
        filtered.map((g) => (
          <div key={g.date} className="bg-white dark:bg-zinc-900 rounded-3xl shadow-card border border-zinc-100 dark:border-zinc-800 overflow-hidden">
            <div className="px-3 py-2.5 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-100 dark:border-zinc-800">
              <div className="font-bold text-xs" suppressHydrationWarning>
                {new Date(g.date).toLocaleDateString(locale === "sk" ? "sk-SK" : "en-GB", { weekday: "short", day: "numeric", month: "short" })}
              </div>
              <div className="text-[11px] font-black">
                {g.meals.reduce((s: number, m: any) => s + m.kcal, 0)} {t("hist.kcal")}
              </div>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-56 overflow-y-auto">
              {g.meals.map((m: any) => (
                <div key={m.id} className="flex gap-2 p-2.5">
                  {m.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.thumbnail} alt={m.dish} className="h-10 w-10 rounded-xl object-cover bg-zinc-100 dark:bg-zinc-800 shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                      <MealTypeIcon type={m.mealType} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs line-clamp-1">{m.dish}</div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {t(`meal.${m.mealType}`)} • {m.kcal} {t("hist.kcal")}
                    </div>
                  </div>
                  <span suppressHydrationWarning className="text-[10px] font-bold text-zinc-400 self-center">
                    {new Date(m.createdAt).toLocaleTimeString(locale === "sk" ? "sk-SK" : "en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

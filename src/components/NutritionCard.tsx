"use client";
import { motion } from "framer-motion";
import type { NutritionResult, MealType } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { MealTypeIcon } from "@/components/MealTypeIcon";

export function NutritionCard({
  result,
  thumbnail,
  onSave,
  onCancel,
  saving,
  showTips = true,
  mealType,
  foodClass,
}: {
  result: NutritionResult;
  thumbnail: string | null;
  onSave: () => void;
  onCancel?: () => void;
  saving?: boolean;
  showTips?: boolean;
  mealType?: MealType;
  foodClass?: "main" | "snack";
}) {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 overflow-hidden"
    >
      {thumbnail && (
        <div className="h-40 sm:h-48 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          <img src={thumbnail} alt={result.dish} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              {mealType && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white px-2 py-1 rounded-full">
                  <MealTypeIcon type={mealType} className="h-3 w-3" /> {t(`meal.${mealType}`)}
                </span>
              )}
              {foodClass && (
                <span className={`text-[10px] font-black px-2 py-1 rounded-full ${foodClass === "snack" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"}`}>
                  {foodClass === "snack" ? "Snack" : "Hlavné jedlo"}
                </span>
              )}
              {result.source && (
                <span className="text-[10px] font-bold bg-fitcal-mintLight text-fitcal-mintDark px-2 py-1 rounded-full truncate max-w-[120px]">{result.source}</span>
              )}
            </div>
            <h3 className="text-lg font-extrabold leading-tight">{result.dish}</h3>
            <p className="text-sm text-zinc-500 mt-1">{result.description}</p>
          </div>
          <span className="shrink-0 text-xs font-bold bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white px-2.5 py-1 rounded-full">
            {Math.round(result.confidence * 100)}% {t("nut.confidence")}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="col-span-3 flex items-baseline justify-between bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl px-4 py-3">
            <span className="text-xs font-bold tracking-widest text-zinc-500">{t("nut.calories").toUpperCase()}</span>
            <span className="text-2xl font-black">{result.kcal} <span className="text-sm font-bold text-zinc-500">{t("nut.kcal")}</span></span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { label: t("nut.protein"), value: result.protein, color: "bg-emerald-500" },
            { label: t("nut.carbs"), value: result.carbs, color: "bg-amber-500" },
            { label: t("nut.fat"), value: result.fat, color: "bg-orange-500" },
          ].map((m) => (
            <div key={m.label} className="bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl py-3">
              <div className={`mx-auto h-1.5 w-8 rounded-full ${m.color} mb-1`} />
              <div className="text-sm font-black">{m.value}g</div>
              <div className="text-[11px] font-bold text-zinc-500">{m.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl py-2">
            <div className="font-black">{result.fiber}g</div>
            <div className="text-[11px] font-semibold text-zinc-500">{t("nut.fiber")}</div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl py-2">
            <div className="font-black">{result.sugar}g</div>
            <div className="text-[11px] font-semibold text-zinc-500">{t("nut.sugar")}</div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl py-2">
            <div className="font-black">{result.salt}g</div>
            <div className="text-[11px] font-semibold text-zinc-500">{t("nut.salt")}</div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs font-semibold text-zinc-500">
          <span>{t("nut.portion")} ~{result.portion_g}g</span>
          <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full">{result.kcal} {t("nut.kcal")}</span>
        </div>

        {/* Všetky živiny — rovnako ako na hlavnej (9 krúžkov) */}
        <div className="mt-4">
          <h4 className="font-bold text-xs mb-2 flex items-center gap-1.5">🥗 {t("dash.macros")} — {t("nut.portion")}</h4>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: t("nut.protein"), value: `${result.protein}g`, sub: `${Math.round((result.protein*4/ Math.max(result.kcal,1))*100)}%`, color: "bg-emerald-500" },
              { label: t("nut.carbs"), value: `${result.carbs}g`, sub: `${Math.round((result.carbs*4/ Math.max(result.kcal,1))*100)}%`, color: "bg-amber-500" },
              { label: t("nut.fat"), value: `${result.fat}g`, sub: `${Math.round((result.fat*9/ Math.max(result.kcal,1))*100)}%`, color: "bg-orange-500" },
              { label: t("nut.fiber"), value: `${result.fiber}g`, sub: "30g cieľ", color: "bg-cyan-500" },
              { label: t("nut.sugar"), value: `${result.sugar}g`, sub: "50g cieľ", color: "bg-pink-500" },
              { label: t("nut.salt"), value: `${result.salt}g`, sub: "6g cieľ", color: "bg-violet-500" },
              { label: t("nut.iron"), value: result.iron != null ? `${result.iron} mg` : "—", sub: "železo", color: "bg-amber-600" },
              { label: t("nut.potassium"), value: result.potassium != null ? `${result.potassium} mg` : "—", sub: "draslík", color: "bg-lime-500" },
              { label: t("nut.portion"), value: `${result.portion_g}g`, sub: t("nut.kcal"), color: "bg-zinc-800 dark:bg-zinc-700" },
            ].map((m) => (
              <div key={m.label} className="bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl py-2.5">
                <div className={`mx-auto h-1.5 w-8 rounded-full ${m.color} mb-1`} />
                <div className="text-xs font-black">{m.value}</div>
                <div className="text-[10px] font-bold text-zinc-500 leading-tight">{m.label}</div>
                <div className="text-[9px] font-semibold text-zinc-400">{m.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {showTips && result.tips && (
          <div className="mt-4 bg-fitcal-mintLight dark:bg-emerald-500/10 rounded-2xl p-3 flex gap-2">
            <span className="text-fitcal-mintDark">💡</span>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 leading-snug">{result.tips}</p>
          </div>
        )}

        <div className={`mt-4 flex gap-2 ${onCancel ? "" : ""}`}>
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={!!saving}
              title={t("common.cancel")}
              aria-label={t("common.cancel")}
              className="rounded-2xl bg-red-500 text-white font-black text-lg px-6 py-3.5 hover:bg-red-600 active:scale-95 transition disabled:opacity-60 shrink-0"
            >
              ✕
            </button>
          )}
          <button
            onClick={onSave}
            disabled={!!saving}
            className="flex-1 rounded-2xl bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold py-3.5 hover:bg-black dark:hover:bg-zinc-100 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t("dash.saving")}
              </>
            ) : (
              t("nut.save")
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

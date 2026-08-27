"use client";
import { motion } from "framer-motion";
import type { NutritionResult } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

export function NutritionCard({
  result,
  thumbnail,
  onSave,
  onCancel,
  saving,
  showTips = true,
}: {
  result: NutritionResult;
  thumbnail: string | null;
  onSave: () => void;
  onCancel?: () => void;
  saving?: boolean;
  showTips?: boolean;
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
          <div>
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

        {(!!result.iron || !!result.potassium) && (
          <div className="mt-2 flex gap-1.5 flex-wrap">
            {!!result.iron && (
              <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-full">
                {t("nut.iron")} {result.iron} mg
              </span>
            )}
            {!!result.potassium && (
              <span className="text-[10px] font-bold bg-lime-50 dark:bg-lime-500/10 text-lime-700 dark:text-lime-300 px-2 py-1 rounded-full">
                {t("nut.potassium")} {result.potassium} mg
              </span>
            )}
          </div>
        )}

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

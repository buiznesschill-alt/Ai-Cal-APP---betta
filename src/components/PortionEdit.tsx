"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { ClientPortal } from "@/components/ClientPortal";
import { NumField } from "@/components/NumField";
import type { Meal } from "@/lib/types";

export function PortionEditModal({ meal, onClose, onSaved }: { meal: Meal | null; onClose: () => void; onSaved: (meal: Meal) => void }) {
  const { t } = useI18n();
  const [portion, setPortion] = useState<number>(meal?.portion_g ?? 100);
  const [saving, setSaving] = useState(false);
  if (!meal) return null;

  const ratio = portion / (meal.portion_g || 1);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/meals?id=${meal!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portion_g: portion }),
      });
      if (res.ok) {
        const d = await res.json();
        onSaved(d.meal);
        onClose();
      }
    } catch {}
    setSaving(false);
  }

  return (
      <ClientPortal active={!!meal}>
      <AnimatePresence>
        {meal && (
          <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl max-w-sm w-full shadow-2xl p-4 sm:p-5"
          >
            <h3 className="font-extrabold text-sm sm:text-base">✎ {t("meal.editPortion")}</h3>
            <p className="font-bold text-sm mt-1 line-clamp-1">{meal.dish}</p>

            <label className="block mt-3 text-xs font-bold tracking-widest text-zinc-500">
              {t("meal.newPortion")} • {t("dash.original")} {meal.portion_g} g
            </label>
            <input
              type="range"
              min={10}
              max={Math.max(1000, meal.portion_g * 2)}
              step={10}
              value={portion}
              onChange={(e) => setPortion(Number(e.target.value))}
              className="w-full mt-2 accent-fitcal-mint"
            />
            <div className="flex items-center gap-2 mt-1">
              <NumField value={portion} min={1} onChange={setPortion} className="flex-1 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fitcal-mint/30" />
              <span className="text-xs font-bold text-zinc-400">g</span>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 py-2">
                <div className="text-sm font-black">{Math.round(meal.kcal * ratio)}</div>
                <div className="text-[9px] font-bold text-zinc-500">kcal</div>
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 py-2">
                <div className="text-sm font-black">{Math.round(meal.protein * ratio * 10) / 10}</div>
                <div className="text-[9px] font-bold text-zinc-500">B</div>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 py-2">
                <div className="text-sm font-black">{Math.round(meal.carbs * ratio * 10) / 10}</div>
                <div className="text-[9px] font-bold text-zinc-500">S</div>
              </div>
              <div className="rounded-xl bg-orange-50 dark:bg-orange-500/10 py-2">
                <div className="text-sm font-black">{Math.round(meal.fat * ratio * 10) / 10}</div>
                <div className="text-[9px] font-bold text-zinc-500">T</div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold py-2.5">
                {t("common.cancel")}
              </button>
              <button onClick={save} disabled={saving || portion <= 0} className="flex-1 rounded-2xl bg-fitcal-mint text-white font-bold py-2.5 disabled:opacity-60">
                {saving ? t("dash.saving") : t("settings.save")}
              </button>
            </div>
          </motion.div>
        </motion.div>
          </>
        )}
      </AnimatePresence>
    </ClientPortal>
  );
}

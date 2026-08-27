"use client";
import { useState, useEffect } from "react";
import { resolveAutoMeal } from "@/lib/autoMeal";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { ClientPortal } from "@/components/ClientPortal";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

const inputCls =
  "w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fitcal-mint/30";

// number field that can be fully cleared while typing; on blur it falls back to the numeric value (min 0)
function NumField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [raw, setRaw] = useState<string | null>(null);
  return (
    <input
      type="number"
      min={0}
      inputMode="decimal"
      value={raw ?? String(value)}
      onChange={(e) => {
        const v = e.target.value;
        setRaw(v);
        if (v === "") {
          onChange(0);
          return;
        }
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0) onChange(Math.round(n * 10) / 10);
      }}
      onBlur={() => setRaw(null)}
      className={inputCls}
    />
  );
}

export function ManualMealModal({ open, onClose, onSaved, autoMeal }: { open: boolean; onClose: () => void; onSaved: () => void; autoMeal?: any }) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    dish: "",
    description: "",
    portion_g: 200,
    kcal: 400,
    protein: 20,
    carbs: 40,
    fat: 12,
    fiber: 3,
    sugar: 4,
    salt: 1,
    iron: 0,
    potassium: 0,
    mealType: "snack" as (typeof MEAL_TYPES)[number],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // auto-preselect typu jedla podľa času pri otvorení – len keď je zapnutý Auto v Scan meal
  useEffect(() => {
    if (!open || !autoMeal?.enabled) return;
    let autoFlag = false;
    try {
      autoFlag = localStorage.getItem("fitcal_auto_scan") === "1";
    } catch {}
    if (!autoFlag) return;
    const mt = resolveAutoMeal(autoMeal);
    if (mt) setForm((f) => ({ ...f, mealType: mt }));
  }, [open, autoMeal]);

  async function submit() {
    if (!form.dish.trim()) {
      setError(t("meal.dish"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "manual" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error");
      }
      onSaved();
      onClose();
      setForm((f) => ({ ...f, dish: "", description: "" }));
    } catch (e: any) {
      setError(e.message || "Error");
    }
    setSaving(false);
  }

  return (
    <ClientPortal active={open}>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl"
          >
            <div className="sticky top-0 bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-t-4xl p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
              <h3 className="font-extrabold">✍️ {t("meal.manualTitle")}</h3>
              <button onClick={onClose} className="h-8 w-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center font-bold shrink-0">✕</button>
            </div>
            <div className="p-4 sm:p-5 space-y-3">
              <div>
                <label className="text-xs font-bold tracking-widest text-zinc-500">{t("meal.dish")}</label>
                <input value={form.dish} onChange={(e) => setForm({ ...form, dish: e.target.value })} className={`mt-1 ${inputCls}`} placeholder={t("meal.dish")} />
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest text-zinc-500">{t("meal.desc")}</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`mt-1 ${inputCls}`} />
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest text-zinc-500">{t("dash.mealType") || "Typ jedla"}</label>
                <select value={form.mealType} onChange={(e) => setForm({ ...form, mealType: e.target.value as any })} className={`mt-1 ${inputCls}`}>
                  {MEAL_TYPES.map((m) => (
                    <option key={m} value={m}>
                      {t(`meal.${m}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold tracking-widest text-zinc-500">{t("meal.portion")}</label>
                  <div className="mt-1"><NumField value={form.portion_g} onChange={(v) => setForm({ ...form, portion_g: v })} /></div>
                </div>
                <div>
                  <label className="text-xs font-bold tracking-widest text-zinc-500">{t("nut.calories")}</label>
                  <div className="mt-1"><NumField value={form.kcal} onChange={(v) => setForm({ ...form, kcal: v })} /></div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {([
                  ["protein", t("dash.protein")],
                  ["carbs", t("dash.carbs")],
                  ["fat", t("dash.fat")],
                  ["fiber", t("nut.fiber")],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">{label}</label>
                    <div className="mt-1"><NumField value={form[key]} onChange={(v) => setForm({ ...form, [key]: v })} /></div>
                  </div>
                ))}
              </div>

              {/* voliteľné mikroživiny */}
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["iron", t("nut.iron")],
                  ["potassium", t("nut.potassium")],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">{label} (mg)</label>
                    <div className="mt-1"><NumField value={form[key]} onChange={(v) => setForm({ ...form, [key]: v })} /></div>
                  </div>
                ))}
              </div>

              {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{error}</p>}

              <button onClick={submit} disabled={saving} className="w-full rounded-2xl bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold py-3 hover:bg-black dark:hover:bg-zinc-100 transition disabled:opacity-60">
                {saving ? t("dash.saving") : t("meal.add")}
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

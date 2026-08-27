"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InfoHint } from "@/components/InfoHint";

export function WaterCard({ goalMl = 2000 }: { goalMl?: number }) {
  const { t } = useI18n();
  const [ml, setMl] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/water")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setMl(d.ml || 0))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function update(delta: number) {
    if (busy) return;
    const next = Math.max(0, ml + delta);
    if (next === ml) return;
    setBusy(true);
    setMl(next);
    try {
      await fetch("/api/water", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ml: next }) });
    } catch {}
    setBusy(false);
  }

  const rawPct = goalMl > 0 ? Math.round((ml / goalMl) * 100) : 0; // keeps counting past 100%
  const fillPct = Math.min(100, rawPct); // bar can only be full
  const done = ml >= goalMl;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <h3 className="font-extrabold text-sm sm:text-base">💧 {t("water.title")}</h3>
          <InfoHint text={t("water.info")} label={t("water.title")} />
        </span>
        <span className={`text-xs font-black px-2.5 py-1 rounded-full ${done ? "bg-sky-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"}`}>
          {loaded ? `${ml} / ${goalMl} ml` : "…"}
        </span>
      </div>

      <div className="mt-3 h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${done ? "bg-sky-500" : "bg-sky-400"}`} style={{ width: `${fillPct}%` }} />
      </div>
      <p className={`text-[10px] font-bold mt-1 text-right ${rawPct > 100 ? "text-sky-600 dark:text-sky-300" : "text-zinc-400"}`}>
        {rawPct}% • {t("water.goal")} {goalMl} ml
      </p>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <button onClick={() => update(-250)} disabled={busy || ml === 0} className="rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-bold py-2.5 text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition disabled:opacity-40">
          −250
        </button>
        <button onClick={() => update(250)} disabled={busy} className="rounded-2xl bg-sky-500 text-white font-bold py-2.5 text-sm hover:bg-sky-600 transition disabled:opacity-60">
          +250 ml
        </button>
        <button onClick={() => update(500)} disabled={busy} className="rounded-2xl bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold py-2.5 text-sm hover:bg-sky-200 dark:hover:bg-sky-500/30 transition disabled:opacity-60">
          +500 ml
        </button>
      </div>
    </div>
  );
}

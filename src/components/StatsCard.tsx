"use client";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { BUS, onBus } from "@/lib/bus";
import { InfoHint } from "@/components/InfoHint";

function monthStart(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type Trend = {
  dir: "down" | "flat" | "up";
  delta: number;
};

export function StatsCard({ goalKcal }: { goalKcal: number }) {
  const { t, locale } = useI18n();
  const [totals, setTotals] = useState<{ date: string; totalKcal: number }[]>([]);
  const [weights, setWeights] = useState<{ date: string; kg: number }[]>([]);

  useEffect(() => {
    const load = () => {
      const month = monthStart(new Date());
      fetch(`/api/meals?summary=month&month=${month}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => setTotals(Array.isArray(d.totals) ? d.totals : []))
        .catch(() => {});
      fetch(`/api/weights?limit=60`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => setWeights(Array.isArray(d.weights) ? d.weights : []))
        .catch(() => {});
    };
    load();
    // instant refresh when a meal is added/edited/deleted anywhere in the app
    return onBus(BUS.meals, load);
  }, []);

  const avg7 = useMemo(() => {
    const byDate = new Map(totals.map((x) => [x.date, x.totalKcal]));
    const last7: number[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      last7.push(byDate.get(key) ?? 0);
    }
    return Math.round(last7.reduce((s, v) => s + v, 0) / 7);
  }, [totals]);

  // Trend vahy: priemer novšej polovice vs. staršej polovice posledných 14 dní
  const trend = useMemo<Trend | null>(() => {
    const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 4) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const inWindow = sorted.filter((w) => new Date(w.date + "T00:00:00") >= cutoff);
    const arr = inWindow.length >= 4 ? inWindow : sorted.slice(-4);
    const half = Math.floor(arr.length / 2);
    const mean = (xs: { kg: number }[]) => xs.reduce((s, x) => s + x.kg, 0) / xs.length;
    const delta = mean(arr.slice(arr.length - half)) - mean(arr.slice(0, half));
    const dir: Trend["dir"] = delta <= -0.3 ? "down" : delta >= 0.3 ? "up" : "flat";
    return { dir, delta: Math.round(delta * 10) / 10 };
  }, [weights]);

  const trendVisual = trend
    ? trend.dir === "down"
      ? { icon: "↓", cls: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300", label: t("stats.losing"), value: `${trend.delta.toFixed(1)} kg` }
      : trend.dir === "up"
        ? { icon: "↑", cls: "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-300", label: t("stats.gaining"), value: `+${trend.delta.toFixed(1)} kg` }
        : { icon: "→", cls: "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300", label: t("stats.flat"), value: "" }
    : null;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-4 sm:p-5">
      <h3 className="font-extrabold text-sm sm:text-base">🔥 {t("stats.title")}</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="relative rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 px-2 py-3">
          <div className="absolute top-1.5 right-1.5"><InfoHint text={t("stats.weightInfo")} label={t("stats.weightTrend")} /></div>
          <div className="text-[10px] font-bold tracking-widest text-zinc-500">{t("stats.weightTrend")}</div>
          {trendVisual ? (
            <>
              <div className={`text-xl font-black leading-tight ${trendVisual.cls.split(" ").slice(2).join(" ")}`}>
                {trendVisual.value} {trendVisual.icon}
              </div>
              <div className={`text-[10px] font-bold leading-tight ${trendVisual.cls.split(" ").slice(2).join(" ")}`}>{trendVisual.label}</div>
            </>
          ) : (
            <div className="text-xs font-bold text-zinc-400 py-2">{t("stats.noWeight")}</div>
          )}
        </div>
        <div className="relative rounded-2xl bg-blue-50 dark:bg-blue-500/10 px-2 py-3">
          <div className="absolute top-1.5 right-1.5"><InfoHint text={t("stats.avg7Info")} label={t("stats.avg7")} /></div>
          <div className="text-[10px] font-bold tracking-widest text-zinc-500">{t("stats.avg7")}</div>
          <div className="text-xl font-black text-blue-600 dark:text-blue-300">{totals.length ? avg7 : "…"}</div>
          <div className="text-[10px] font-bold text-zinc-400">kcal</div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 mt-2">
        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
        <span className="text-[10px] font-medium text-zinc-400">
          {t("stats.zone")}: {goalKcal - 499}–{goalKcal + 100} kcal
        </span>
      </div>
    </div>
  );
}

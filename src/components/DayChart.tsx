"use client";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { InfoHint } from "@/components/InfoHint";

const MEAL_COLORS: Record<string, string> = {
  breakfast: "#10B981",
  lunch: "#3B82F6",
  dinner: "#8B5CF6",
  snack: "#F59E0B",
};

const INTERVALS = [1, 2, 3, 4] as const;

export function DayChart({ meals }: { meals: any[] }) {
  const { t } = useI18n();
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  const [mode, setMode] = useState<"type" | "hours">("type");
  const [interval, setInterval] = useState<(typeof INTERVALS)[number]>(3);

  // By meal type (default)
  const typeData = useMemo(
    () =>
      (["breakfast", "lunch", "dinner", "snack"] as const).map((type) => {
        const ms = (meals || []).filter((m) => m.mealType === type);
        return { name: t(`meal.${type}`), kcal: ms.reduce((s, m) => s + m.kcal, 0), type };
      }),
    [meals, t]
  );

  // By hours – buckets of `interval` from 0:00 up to last activity today
  const hourData = useMemo(() => {
    const list = meals || [];
    const nowHour = new Date().getHours();
    const lastMealHour = list.reduce((max, m) => {
      const h = new Date(m.createdAt).getHours();
      return Number.isFinite(h) ? Math.max(max, h) : max;
    }, -1);
    const lastHour = Math.max(nowHour, lastMealHour, 0);
    const buckets: { name: string; kcal: number }[] = [];
    for (let h = 0; h <= lastHour; h += interval) {
      const from = h;
      const to = h + interval;
      const kcal = list.reduce((s, m) => {
        const mh = new Date(m.createdAt).getHours();
        return mh >= from && mh < to ? s + m.kcal : s;
      }, 0);
      buckets.push({ name: `${String(from).padStart(2, "0")}`, kcal });
    }
    return buckets;
  }, [meals, interval]);

  const data: { name: string; kcal: number; type?: string }[] = mode === "type" ? typeData : hourData;
  const total = typeData.reduce((s, d) => s + d.kcal, 0);

  const segBtn = (active: boolean) =>
    `px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold transition ${
      active ? "bg-white dark:bg-zinc-950 shadow text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
    }`;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="font-extrabold text-sm sm:text-base">{t("chart.today")}</h3>
          <InfoHint text={t("chart.info")} label={t("chart.today")} />
          <span className="text-xs font-black bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white px-2.5 py-1 rounded-full">
            {total} {t("nut.kcal")}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {mode === "hours" && (
            <select
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value) as (typeof INTERVALS)[number])}
              aria-label={t("chart.interval")}
              title={t("chart.interval")}
              className="text-[10px] sm:text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-full px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-fitcal-mint/40"
            >
              {INTERVALS.map((i) => (
                <option key={i} value={i}>
                  {i} h
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-full">
            <button onClick={() => setMode("type")} className={segBtn(mode === "type")} title={t("chart.byType")}>
              🍽️
            </button>
            <button onClick={() => setMode("hours")} className={segBtn(mode === "hours")} title={t("chart.byHours")}>
              🕐
            </button>
          </div>
        </div>
      </div>
      {total === 0 ? (
        <div className="text-center py-6">
          <div className="mx-auto h-10 w-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-base mb-2">📊</div>
          <p className="text-xs font-medium text-zinc-500">{t("chart.empty")}</p>
        </div>
      ) : (
        <div className="h-40 sm:h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#27272A" : "#f3f4f6"} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fontWeight: 600, fill: dark ? "#A1A1AA" : "#3F3F46" }}
                axisLine={false}
                tickLine={false}
                interval={mode === "hours" && data.length > 8 ? Math.floor(data.length / 8) : 0}
              />
              <YAxis tick={{ fontSize: 10, fill: dark ? "#A1A1AA" : "#3F3F46" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: 14,
                  border: dark ? "1px solid #3F3F46" : "1px solid #e5e7eb",
                  fontSize: 12,
                  fontWeight: 600,
                  backgroundColor: dark ? "#18181B" : "#ffffff",
                  color: dark ? "#F4F4F5" : "#1A1C1E",
                }}
                itemStyle={{ color: dark ? "#F4F4F5" : "#1A1C1E", fontWeight: 700 }}
                labelStyle={{ color: dark ? "#A1A1AA" : "#71717A", fontWeight: 700, marginBottom: 4 }}
                cursor={{ fill: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}
                labelFormatter={(l) => (mode === "hours" ? `${l}:00 – ${Number(l) + interval}:00` : l)}
              />
              <Bar dataKey="kcal" radius={mode === "type" ? [8, 8, 0, 0] : [4, 4, 0, 0]} maxBarSize={mode === "type" ? 44 : 28}>
                {mode === "type"
                  ? data.map((d: any) => <Cell key={d.type} fill={MEAL_COLORS[d.type]} />)
                  : data.map((_: any, i: number) => <Cell key={i} fill="#00C896" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

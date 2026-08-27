"use client";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { InfoHint } from "@/components/InfoHint";

export function MacroRing({
  label,
  value,
  goal,
  color,
  unit = "g",
  info,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
  unit?: string;
  info?: string;
}) {
  const { t } = useI18n();
  const { resolved } = useTheme();
  const track = resolved === "dark" ? "#27272A" : "#F3F4F6";
  const rawPct = goal > 0 ? Math.round((value / goal) * 100) : 0; // keeps counting past 100%
  const fillPct = Math.min(100, rawPct); // ring itself can only be full
  const circumference = 2 * Math.PI * 42;
  const offset = circumference * (1 - fillPct / 100);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-20 w-20 sm:h-24 sm:w-24">
        <svg className="h-20 w-20 sm:h-24 sm:w-24 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="42" stroke={track} strokeWidth="8" fill="none" />
          <motion.circle
            cx="48"
            cy="48"
            r="42"
            stroke={color}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base sm:text-lg font-extrabold tracking-tight">{Math.round(value)}</span>
          <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-500">/ {goal}{unit}</span>
        </div>
      </div>
      <span className="flex items-center justify-center gap-1 max-w-full">
        <span className="text-[11px] sm:text-xs font-bold text-zinc-600 dark:text-zinc-300 text-center line-clamp-1">{label}</span>
        {info && <InfoHint text={info} label={label} />}
      </span>
      <span className={`text-[10px] sm:text-[11px] font-semibold ${rawPct > 100 ? "text-fitcal-orange dark:text-orange-300" : "text-zinc-400"}`}>{rawPct}%</span>
    </div>
  );
}

export function DailyRing({ consumed, goal }: { consumed: number; goal: number }) {
  const { t } = useI18n();
  const { resolved } = useTheme();
  const track = resolved === "dark" ? "#3F3F46" : "#E5E7EB";
  const pct = Math.min(100, Math.round((consumed / goal) * 100));
  const remaining = Math.max(0, goal - consumed);
  const circumference = 2 * Math.PI * 68;
  const offset = circumference * (1 - pct / 100);
  const over = consumed > goal;

  // farba kruhu: ≤100 biele (skoro nič), 101 až cieľ−500 ŽLTÁ (je zjedené, ale málo),
  // cieľ−500 až cieľ+100 zelená (rank zóna), do +50 % oranžová, viac červená
  const ringColor =
    consumed <= 100
      ? "#FFFFFF"
      : consumed < goal - 500
        ? "#FACC15"
        : consumed <= goal + 100
          ? "#10B981"
          : consumed <= goal * 1.5
            ? "#FF8A3D"
            : "#EF4444";

  return (
    <div className="relative h-[180px] w-[180px] sm:h-[216px] sm:w-[216px] lg:h-[236px] lg:w-[236px] mx-auto">
      <svg className="h-[180px] w-[180px] sm:h-[216px] sm:w-[216px] lg:h-[236px] lg:w-[236px] -rotate-90" viewBox="0 0 192 192">
        <circle cx="96" cy="96" r="68" stroke={track} strokeWidth="12" fill="none" />
        <motion.circle
          cx="96"
          cy="96"
          r="68"
          stroke={ringColor}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
        <span className="text-3xl sm:text-4xl font-black tracking-tighter leading-none">{Math.round(consumed)}</span>
        <span className="text-[10px] sm:text-xs font-bold tracking-widest text-zinc-500">/ {goal} KCAL</span>
        <span
          className={`mt-0.5 text-[11px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 rounded-full ${
            consumed <= 100
              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400" // skoro nič
              : consumed < goal - 500
                ? "bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-300" // žltá zóna
                : consumed <= goal + 100
                  ? "bg-fitcal-mintLight dark:bg-emerald-500/10 text-fitcal-mintDark dark:text-emerald-300" // v cieli
                  : consumed <= goal * 1.5
                    ? "bg-fitcal-orangeLight dark:bg-orange-500/10 text-fitcal-orange dark:text-orange-300" // oranžová
                    : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" // červená
          }`}
        >
          {consumed > goal ? `+${Math.round(consumed - goal)} ${t("dash.over")}` : `${remaining} ${t("dash.remaining")}`}
        </span>
      </div>
    </div>
  );
}

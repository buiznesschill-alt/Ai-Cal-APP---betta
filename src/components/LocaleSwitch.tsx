"use client";
import { useI18n } from "@/lib/i18n";

export function LocaleSwitch() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 p-1 text-xs font-semibold">
      {(["sk", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`rounded-full px-3 py-1.5 transition ${locale === l ? "bg-white shadow text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

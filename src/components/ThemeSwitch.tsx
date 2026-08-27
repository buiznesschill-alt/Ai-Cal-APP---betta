"use client";
import { useI18n } from "@/lib/i18n";
import { useTheme, ThemeMode } from "@/lib/theme";

export function ThemeSwitch() {
  const { locale } = useI18n();
  const { mode, setMode } = useTheme();
  const items: { id: ThemeMode; label: string; icon: string }[] = [
    { id: "light", label: locale === "sk" ? "Svetlý" : "Light", icon: "☀️" },
    { id: "dark", label: locale === "sk" ? "Tmavý" : "Dark", icon: "🌙" },
    { id: "system", label: locale === "sk" ? "Systémové" : "System", icon: "💻" },
  ];
  return (
    <div className="flex w-full gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 p-1">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => setMode(it.id)}
          aria-label={it.label}
          title={it.label}
          className={`flex-1 whitespace-nowrap rounded-full px-1 py-1.5 text-[11px] sm:text-xs font-semibold transition flex items-center justify-center gap-1 ${
            mode === it.id ? "bg-white shadow text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <span>{it.icon}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

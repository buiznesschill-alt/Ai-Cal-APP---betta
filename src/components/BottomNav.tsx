"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";

export function BottomNav({ mobileTab, onTabChange }: { mobileTab?: string; onTabChange?: (tab: any) => void } = {}) {
  const pathname = usePathname();
  const { t } = useI18n();
  // Mobile single-page tabs (within one window, no navigation)
  const mobileItems = [
    { id: "today", label: t("nav.today"), icon: "◉" },
    { id: "history", label: t("nav.history"), icon: "◐" },
    { id: "trends", label: t("trends.title"), icon: "📈" },
    { id: "tips", label: t("tips.title"), icon: "💚" },
  ];
  const desktopItems = [
    { href: "/", label: t("nav.today"), icon: "◉" },
    { href: "/history", label: t("nav.history"), icon: "◐" },
    { href: "/tips", label: t("nav.tips"), icon: "💚" },
    { href: "/settings", label: t("nav.settings"), icon: "⚙" },
  ];

  // If mobileTab is provided, use it for mobile (single-page mode)
  if (mobileTab && onTabChange) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-100 dark:border-zinc-800 sm:hidden pb-safe" suppressHydrationWarning>
        <div className="flex">
          {mobileItems.map((it) => {
            const active = mobileTab === it.id;
            return (
              <button
                key={it.id}
                onClick={() => {
                  onTabChange(it.id);
                  document.getElementById(`mob-${it.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`flex-1 flex flex-col items-center py-2 text-[11px] font-semibold ${active ? "text-fitcal-mintDark dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`}
              >
                <span className={`text-base ${active ? "scale-110" : ""} transition`}>{it.icon}</span>
                {it.label}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-100 dark:border-zinc-800 sm:hidden pb-safe" suppressHydrationWarning>
      <div className="flex">
        {desktopItems.map((it) => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex-1 flex flex-col items-center py-2 sm:py-3 text-[11px] sm:text-xs font-semibold ${active ? "text-fitcal-mintDark dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`}
            >
              <span className={`text-base sm:text-lg ${active ? "scale-110" : ""} transition`}>{it.icon}</span>
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function DesktopNav({ showAlways, hideSettings = false }: { showAlways?: boolean; hideSettings?: boolean } = {}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const items = [
    { href: "/history", label: t("nav.history") },
    { href: "/", label: t("nav.today") },
    { href: "/tips", label: t("nav.tips") },
    ...(hideSettings ? [] : [{ href: "/settings", label: t("nav.settings") }]),
  ];
  return (
    <div className={`${showAlways ? "flex" : "hidden sm:flex"} gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full p-1 shadow-sm`}>
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={`px-5 py-2 rounded-full text-sm font-bold transition ${
            pathname === it.href ? "bg-blue-500 text-white shadow" : "text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
          }`}
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}

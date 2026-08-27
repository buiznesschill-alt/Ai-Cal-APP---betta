"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { StreakFlame } from "@/components/StreakFlame";

export function Header({ username, displayName }: { username?: string; displayName?: string }) {
  const { t } = useI18n();
  const initial = (displayName || username || "P").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-zinc-900" suppressHydrationWarning>
      <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3">
        {/* 7 = logo */}
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-fitcal-mint flex items-center justify-center text-white font-black text-base sm:text-lg">F</div>
          <span className="font-extrabold text-base sm:text-lg tracking-tight text-white">FitCal</span>
          <span className="text-[10px] sm:text-xs bg-fitcal-mint/20 text-fitcal-mint px-1.5 sm:px-2 py-0.5 rounded-full font-bold">AI</span>
          <span className="text-[10px] sm:text-xs bg-blue-500 text-white px-1.5 sm:px-2 py-0.5 rounded-full font-black tracking-wider">BETA</span>
        </Link>

        <div className="flex items-center gap-2.5 sm:gap-3" data-tour="rank">
          {/* Beta: Duolingo-style streak flame */}
          <StreakFlame />

          {/* 6 = profile avatar */}
          <Link
            href="/settings"
            className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-white text-zinc-900 flex items-center justify-center font-black text-sm sm:text-base hover:scale-105 active:scale-95 transition shadow"
            title={t("settings.title")}
          >
            {initial}
          </Link>
        </div>
      </div>
    </header>
  );
}

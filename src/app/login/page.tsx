"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { useI18n } from "@/lib/i18n";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || t("auth.errorLogin"));
      return;
    }
    const next = params.get("next") || "/";
    router.push(next);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-fitcal-mint flex items-center justify-center text-white font-black">F</div>
          <div>
            <h1 className="font-black text-xl leading-none">FitCal</h1>
            <p className="text-xs font-semibold text-zinc-500">AI Calorie Tracker</p>
          </div>
        </div>
        <LocaleSwitch />
      </div>

      <h2 className="text-2xl font-black tracking-tight">{t("auth.login")}</h2>
      <p className="text-sm text-zinc-500 mt-1">{t("auth.loginHint")}</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="text-xs font-bold tracking-widest text-zinc-500">{t("auth.username")}</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("auth.placeholderUsername")}
            className="mt-1 w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 px-4 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-fitcal-mint/30 focus:border-fitcal-mint"
            required
          />
        </div>
        <div>
          <label className="text-xs font-bold tracking-widest text-zinc-500">{t("auth.password")}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 px-4 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-fitcal-mint/30 focus:border-fitcal-mint"
            required
          />
        </div>

        {error && <p className="text-sm font-semibold text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold py-3.5 hover:bg-black dark:hover:bg-zinc-100 transition disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
          {t("auth.loginBtn")}
        </button>
      </form>

      <p className="text-sm text-center mt-6 text-zinc-600 dark:text-zinc-300">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="font-bold text-fitcal-mintDark hover:underline">
          {t("auth.register")}
        </Link>
      </p>

      <div className="mt-6 bg-fitcal-mintLight dark:bg-emerald-500/10 rounded-2xl p-3">
        <p className="text-xs font-bold text-fitcal-mintDark dark:text-emerald-300">🔒 {t("auth.secure")}</p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{t("auth.secureNote")}</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <Suspense fallback={<div className="text-sm font-semibold text-zinc-500">Načítavam...</div>}>
          <LoginForm />
        </Suspense>
      </div>
      <p className="text-center text-xs text-zinc-400 pb-4">© 2026 FitCal • YAZIO-inspired • PWA ready</p>
    </main>
  );
}

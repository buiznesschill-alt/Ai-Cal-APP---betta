"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { useI18n } from "@/lib/i18n";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, displayName: displayName || username }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || t("auth.errorLogin"));
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-fitcal-mint flex items-center justify-center text-white font-black">F</div>
            <div>
              <h1 className="font-black text-xl leading-none">FitCal</h1>
              <p className="text-xs font-semibold text-zinc-500">{t("auth.register")}</p>
            </div>
          </div>
          <LocaleSwitch />
        </div>

        <h2 className="text-2xl font-black tracking-tight">{t("auth.register")}</h2>
        <p className="text-sm text-zinc-500 mt-1">{t("auth.registerHint")}</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-bold tracking-widest text-zinc-500">{t("auth.username")}</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("auth.placeholderUsername")} className="mt-1 w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 px-4 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-fitcal-mint/30" required />
            <p className="text-[11px] font-semibold text-zinc-400 mt-1">{t("auth.usernameHint")}</p>
          </div>
          <div>
            <label className="text-xs font-bold tracking-widest text-zinc-500">{t("auth.displayName")} (voliteľné)</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ján" className="mt-1 w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 px-4 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-fitcal-mint/30" />
          </div>
          <div>
            <label className="text-xs font-bold tracking-widest text-zinc-500">{t("auth.password")}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 px-4 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-fitcal-mint/30" required />
            <p className="text-[11px] font-semibold text-zinc-400 mt-1">Min. 8 {t("auth.password").toLowerCase()}</p>
          </div>

          {error && <p className="text-sm font-semibold text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{error}</p>}

          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-fitcal-mint text-white font-bold py-3.5 hover:bg-fitcal-mintDark transition disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            {t("auth.registerBtn")}
          </button>
        </form>

        <p className="text-sm text-center mt-6 text-zinc-600 dark:text-zinc-300">
          {t("auth.hasAccount")}{" "}
          <Link href="/login" className="font-bold text-fitcal-mintDark hover:underline">
            {t("auth.login")}
          </Link>
        </p>
      </motion.div>
    </main>
  );
}

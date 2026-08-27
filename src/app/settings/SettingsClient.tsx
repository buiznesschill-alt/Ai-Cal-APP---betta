"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { PageHeader } from "@/components/PageHeader";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import dynamic from "next/dynamic";
const QRCodePanel = dynamic(() => import("@/components/QRCodePanel").then((m) => m.QRCodePanel), { ssr: false });
import { useI18n } from "@/lib/i18n";
import { normalizeAutoMeal } from "@/lib/autoMeal";
import { BUS, emitBus } from "@/lib/bus";

function SicknessPanel() {
  const { t } = useI18n();
  const [active, setActive] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const load = async () => {
    try {
      const r = await fetch("/api/sickness");
      if (!r.ok) return;
      const j = await r.json();
      setActive(j.active || null);
      setHistory(j.sicknesses || []);
    } catch {}
  };
  useEffect(() => { load(); }, []);
  const activate = async () => {
    if (note.trim().length < 3) return;
    setBusy(true);
    const r = await fetch("/api/sickness", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
    const j = await r.json().catch(()=>({}));
    setBusy(false);
    if (!r.ok) { alert(j.error || "Chyba"); return; }
    setNote("");
    setShowInfo(true);
    await load();
    emitBus(BUS.sickness);
  };
  const deactivate = async () => {
    setBusy(true);
    const r = await fetch("/api/sickness", { method: "DELETE" });
    setBusy(false);
    if (!r.ok) { const j=await r.json().catch(()=>({})); alert(j.error||"Chyba"); return; }
    await load();
    emitBus(BUS.sickness);
  };
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-5 sm:p-6 space-y-3">
      <h2 className="font-extrabold flex items-center gap-2">🏥 Choroba / Freeze</h2>
      <p className="text-xs font-medium text-zinc-500">Počas choroby sa ti nebudú počítať hodnoty ani body (modrá 0), aj keď budeš jesť. Freeze platí od dnes dokým ho nevypneš. -1 od prvého jedla inak.</p>
      {active ? (
        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-2xl p-3">
          <p className="text-sm font-bold text-blue-700 dark:text-blue-300">🔵 Aktívna choroba od {active.startDate}</p>
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-1">Dôvod: {active.note}</p>
          <button onClick={deactivate} disabled={busy} className="mt-3 w-full rounded-2xl bg-blue-600 text-white font-bold py-2.5 hover:bg-blue-700 disabled:opacity-60">{busy?"...":"Vypnúť chorobu (ukončiť freeze)"}</button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea value={note} onChange={(e)=>setNote(e.target.value.slice(0,200))} rows={2} placeholder="Napíš aká choroba (napr. chrípka, angína...)" className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm" />
          <button onClick={activate} disabled={busy || note.trim().length<3} className="w-full rounded-2xl bg-blue-600 text-white font-bold py-2.5 hover:bg-blue-700 disabled:opacity-60">Aktivovať freeze (modrá 0)</button>
        </div>
      )}
      {showInfo && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-3">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-300">ℹ️ Počas freezu sa ti hodnoty nebudú počítať aj keď budeš jesť, ale nebude sa ti odpočítavať body z ranku.</p>
          <button onClick={()=>setShowInfo(false)} className="mt-2 text-xs font-bold text-zinc-500">Zavrieť</button>
        </div>
      )}
      {history.length>0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-bold tracking-widest text-zinc-500 uppercase">História chorôb</h3>
          <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
            {history.slice(0,10).map((s:any)=>(
              <div key={s.id} className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${s.endDate==null?"bg-blue-500 text-white":"bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}>
                <span className="font-bold">{s.startDate} → {s.endDate || "aktívna"}</span>
                <span className="truncate ml-2 max-w-[120px]">{s.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsClient({ user: initial }: { user: any }) {
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const [user, setUser] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [form, setForm] = useState({
    displayName: initial.displayName || "",
    heightCm: initial.heightCm || "",
    weightKg: initial.weightKg || "",
    age: initial.age || "",
    sex: initial.sex || "",
    activity: initial.activity || "moderate",
    goalType: initial.goalType || "maintain",
    goalKcal: initial.goalKcal,
    goalProtein: initial.goalProtein,
    goalCarbs: initial.goalCarbs,
    goalFat: initial.goalFat,
    keepThumbnails: initial.keepThumbnails ?? true,
    autoMeal: normalizeAutoMeal(initial.autoMeal),
  });
  const [pass, setPass] = useState({ oldPassword: "", newPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [fakeToday, setFakeToday] = useState(0);
  const [fakeTotal, setFakeTotal] = useState(0);
  const [fakeBusy, setFakeBusy] = useState<"add" | "remove" | null>(null);
  const [autoSaved, setAutoSaved] = useState(false);

  async function loadFakeStats() {
    try {
      const res = await fetch("/api/fake-data");
      if (!res.ok) return;
      const d = await res.json();
      setFakeToday(d.fakeToday ?? 0);
      setFakeTotal(d.fakeTotal ?? 0);
    } catch {}
  }

  useEffect(() => {
    loadFakeStats();
  }, []);

  async function addFakeData() {
    setFakeBusy("add");
    try {
      await fetch("/api/fake-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 4 }) });
      await loadFakeStats();
      router.refresh();
    } finally {
      setFakeBusy(null);
    }
  }

  async function removeFakeData() {
    setFakeBusy("remove");
    try {
      await fetch("/api/fake-data", { method: "DELETE" });
      await loadFakeStats();
      router.refresh();
    } finally {
      setFakeBusy(null);
    }
  }

  // Beta: Mifflin-St Jeor BMR × activity ± goal, macros 30/40/30
  function autoCalcGoals() {
    const h = Number(form.heightCm);
    const w = Number(form.weightKg);
    const a = Number(form.age);
    if (!h || !w || !a || !form.sex || form.sex === "other") {
      setError(t("goals.missingData"));
      return;
    }
    const bmr = 10 * w + 6.25 * h - 5 * a + (form.sex === "male" ? 5 : -161);
    const factors: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
    const tdee = bmr * (factors[form.activity] ?? 1.55);
    let kcal = Math.round(tdee);
    if (form.goalType === "lose") kcal -= 500;
    if (form.goalType === "gain") kcal += 300;
    kcal = Math.max(1200, kcal);
    const protein = Math.round((kcal * 0.3) / 4);
    const carbs = Math.round((kcal * 0.4) / 4);
    const fat = Math.round((kcal * 0.3) / 9);
    setForm((f) => ({ ...f, goalKcal: kcal, goalProtein: protein, goalCarbs: carbs, goalFat: fat }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const payload: any = {
      displayName: form.displayName,
      heightCm: form.heightCm ? Number(form.heightCm) : null,
      weightKg: form.weightKg ? Number(form.weightKg) : null,
      age: form.age ? Number(form.age) : null,
      sex: form.sex || null,
      activity: form.activity || null,
      goalType: form.goalType || null,
      goalKcal: Number(form.goalKcal),
      goalProtein: Number(form.goalProtein),
      goalCarbs: Number(form.goalCarbs),
      goalFat: Number(form.goalFat),
      keepThumbnails: form.keepThumbnails,
      autoMeal: form.autoMeal,
    };
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error);
      return false;
    }
    // Beta: weight change in Profile also logs a weight entry (keeps the trend chart alive)
    if (payload.weightKg && payload.weightKg !== (user.weightKg ?? null)) {
      fetch("/api/weights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kg: payload.weightKg }) }).catch(() => {});
    }
    setUser(data.user);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    return true;
  }

  async function changePassword() {
    if (!pass.oldPassword || !pass.newPassword) {
      setError(t("settings.fillBoth"));
      return;
    }
    setSaving(true);
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pass) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setPass({ oldPassword: "", newPassword: "" });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function clearOld() {
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clearThumbnails" }) });
    const data = await res.json();
    alert(`${t("settings.cleared")} ${data.cleared} ${t("settings.thumbnails")}`);
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen pb-10 sm:pb-0">
      <Header username={user.username} />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-6">
        <PageHeader />

        {error && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 rounded-2xl px-4 py-3 font-semibold text-sm">{error}</div>}
        {saved && <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 rounded-2xl px-4 py-3 font-semibold text-sm">{t("settings.saved")}</div>}

        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Profile */}
              <div className="bg-white dark:bg-zinc-900 rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-5 sm:p-6 space-y-4">
                <h2 className="font-extrabold flex items-center gap-2">👤 {t("settings.profile")}</h2>

                <div>
                  <label className="text-xs font-bold tracking-widest text-zinc-500">{t("settings.lang")}</label>
                  <div className="mt-1 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl px-4 py-3">
                    <span className="font-semibold text-sm">{t("settings.lang")} / Language</span>
                    <LocaleSwitch />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold tracking-widest text-zinc-500">{t("settings.theme")}</label>
                  <div className="mt-1 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl px-2.5 py-2">
                    <ThemeSwitch />
                  </div>
                </div>

            <div>
              <label className="text-xs font-bold tracking-widest text-zinc-500">{t("settings.username")}</label>
              <input value={user.username} disabled className="mt-1 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400" />
            </div>
            <div>
              <label className="text-xs font-bold tracking-widest text-zinc-500">{t("auth.displayName")}</label>
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="mt-1 w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 px-4 py-3 font-medium focus:ring-2 focus:ring-fitcal-mint/30 focus:outline-none" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold tracking-widest text-zinc-500">{t("settings.height")}</label>
                <input type="number" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} className="mt-1 w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 px-3 py-3" />
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest text-zinc-500">{t("settings.weight")}</label>
                <input type="number" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} className="mt-1 w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 px-3 py-3" />
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest text-zinc-500">{t("settings.age")}</label>
                <input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className="mt-1 w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 px-3 py-3" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold tracking-widest text-zinc-500">{t("settings.sex")}</label>
                <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })} className="mt-1 w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 px-3 py-3 font-medium">
                  <option value="">{t("common.cancel")}</option>
                  <option value="male">{t("settings.male")}</option>
                  <option value="female">{t("settings.female")}</option>
                  <option value="other">{t("settings.other")}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest text-zinc-500">{t("settings.activity")}</label>
                <select value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} className="mt-1 w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 px-3 py-3 font-medium">
                  <option value="sedentary">{t("settings.sedentary")}</option>
                  <option value="light">{t("settings.light")}</option>
                  <option value="moderate">{t("settings.moderate")}</option>
                  <option value="active">{t("settings.active")}</option>
                  <option value="very_active">{t("settings.very_active")}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest text-zinc-500">{t("settings.goalType")}</label>
                <select value={form.goalType} onChange={(e) => setForm({ ...form, goalType: e.target.value })} className="mt-1 w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 px-3 py-3 font-medium">
                  <option value="lose">{t("settings.lose")}</option>
                  <option value="maintain">{t("settings.maintain")}</option>
                  <option value="gain">{t("settings.gain")}</option>
                </select>
              </div>
            </div>

            <button onClick={save} disabled={saving} className="w-full rounded-2xl bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold py-3 hover:bg-black dark:hover:bg-zinc-100 transition disabled:opacity-60">
              {saving ? t("dash.saving") : t("settings.save")}
            </button>
          </div>

          {/* Goals */}
          <div className="bg-white dark:bg-zinc-900 rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-5 sm:p-6 space-y-4">
            <h2 className="font-extrabold">🎯 {t("settings.goals")}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold tracking-widest text-zinc-500">{t("settings.kcal")}</label>
                <input type="number" value={form.goalKcal} onChange={(e) => setForm({ ...form, goalKcal: e.target.value })} className="mt-1 w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 px-4 py-3 font-black text-lg" />
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest text-zinc-500">{t("dash.protein")} (g)</label>
                <input type="number" value={form.goalProtein} onChange={(e) => setForm({ ...form, goalProtein: e.target.value })} className="mt-1 w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 px-4 py-3 font-bold" />
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest text-zinc-500">{t("dash.carbs")} (g)</label>
                <input type="number" value={form.goalCarbs} onChange={(e) => setForm({ ...form, goalCarbs: e.target.value })} className="mt-1 w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 px-4 py-3 font-bold" />
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest text-zinc-500">{t("dash.fat")} (g)</label>
                <input type="number" value={form.goalFat} onChange={(e) => setForm({ ...form, goalFat: e.target.value })} className="mt-1 w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 px-4 py-3 font-bold" />
              </div>
            </div>
            <p className="text-xs font-medium text-zinc-500">{t("goals.autoCalcHint")}</p>

            {/* Beta: Mifflin-St Jeor auto-calc */}
            <button onClick={autoCalcGoals} className="w-full rounded-2xl bg-fitcal-mint text-white font-bold py-3 hover:brightness-95 transition flex items-center justify-center gap-2">
              🧮 {t("goals.autoCalc")}
            </button>

            <label className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl px-4 py-3 cursor-pointer">
              <input type="checkbox" checked={form.keepThumbnails} onChange={(e) => setForm({ ...form, keepThumbnails: e.target.checked })} className="h-5 w-5 accent-zinc-900" />
              <span className="text-sm font-semibold">{t("settings.keepThumbs")}</span>
            </label>

            <button onClick={save} disabled={saving} className="w-full rounded-2xl bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold py-3.5 hover:bg-black dark:hover:bg-zinc-100 transition disabled:opacity-60">
              {saving ? t("dash.saving") : t("settings.save")}
            </button>

            <button onClick={clearOld} className="w-full rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold py-3 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
              {t("settings.clearOld")}
            </button>
          </div>
        </div>

          {/* Password */}
          <div className="bg-white dark:bg-zinc-900 rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-5 sm:p-6">
            <h2 className="font-extrabold mb-4">🔒 {t("settings.changePass")}</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <input type="password" placeholder={t("settings.oldPass")} value={pass.oldPassword} onChange={(e) => setPass({ ...pass, oldPassword: e.target.value })} className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 px-4 py-3" />
              <input type="password" placeholder={t("settings.newPass")} value={pass.newPassword} onChange={(e) => setPass({ ...pass, newPassword: e.target.value })} className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 px-4 py-3" />
            </div>
            <button onClick={changePassword} disabled={saving} className="mt-3 w-full sm:w-auto rounded-2xl bg-zinc-900 text-white font-bold px-6 py-3 hover:bg-black transition">
              {t("settings.changePassBtn")}
            </button>
          </div>

          {/* Beta: data export */}
          <div className="bg-white dark:bg-zinc-900 rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-5 sm:p-6 space-y-3">
            <h2 className="font-extrabold">📤 {t("export.title")}</h2>
            <p className="text-xs font-medium text-zinc-500">{t("export.desc")}</p>
            <div className="grid grid-cols-2 gap-2">
              <a href="/api/export?format=csv" download className="rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold py-3 text-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                ⬇️ CSV
              </a>
              <a href="/api/export?format=json" download className="rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold py-3 text-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                ⬇️ JSON
              </a>
            </div>
          </div>

          {/* Beta: fake/demo data */}
          <div className="bg-white dark:bg-zinc-900 rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-5 sm:p-6 space-y-3">
            <h2 className="font-extrabold">🧪 {t("settings.fakeTitle")}</h2>
            <p className="text-xs font-medium text-zinc-500">{t("settings.fakeDesc")}</p>
            <div className="text-xs font-bold text-zinc-500">
              {t("settings.fakeToday")}: <span className="text-zinc-900 dark:text-zinc-100">{fakeToday}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button onClick={addFakeData} disabled={fakeBusy !== null} className="rounded-2xl bg-fitcal-mint text-white font-bold py-3 hover:brightness-95 transition disabled:opacity-60">
                {fakeBusy === "add" ? "…" : `🧪 ${t("settings.fakeAdd")}`}
              </button>
              <button onClick={removeFakeData} disabled={fakeBusy !== null || fakeTotal === 0} className="rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold py-3 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition disabled:opacity-60">
                {fakeBusy === "remove" ? "…" : `🗑️ ${t("settings.fakeRemove")}`}
              </button>
            </div>
          </div>
          {/* Beta: automatické skenovanie – auto typ jedla podľa času */}
          <div className="bg-white dark:bg-zinc-900 rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-extrabold">⚙️ {t("settings.autoScan")}</h2>
              <input
                type="checkbox"
                checked={form.autoMeal.enabled}
                onChange={(e) => setForm({ ...form, autoMeal: { ...form.autoMeal, enabled: e.target.checked } })}
                className="h-5 w-5 accent-fitcal-mint"
              />
            </div>
            <p className="text-xs font-medium text-zinc-500">{t("settings.autoScanHint")}</p>

            <div className={`space-y-2 ${form.autoMeal.enabled ? "" : "opacity-50 pointer-events-none"}`}>
              {([
                { key: "breakfast" as const, label: t("meal.breakfast") },
                { key: "lunch" as const, label: t("meal.lunch") },
                { key: "dinner" as const, label: t("meal.dinner") },
              ]).map((row) => {
                const r = form.autoMeal[row.key];
                return (
                  <div key={row.key} className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl px-3 py-2">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={(e) => setForm({ ...form, autoMeal: { ...form.autoMeal, [row.key]: { ...r, enabled: e.target.checked } } })}
                      className="h-4 w-4 accent-fitcal-mint shrink-0"
                    />
                    <span className="text-xs font-bold flex-1">{row.label}</span>
                    <input type="time" value={r.from} onChange={(e) => setForm({ ...form, autoMeal: { ...form.autoMeal, [row.key]: { ...r, from: e.target.value } } })} className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-xs font-bold" />
                    <span className="text-zinc-400 text-xs font-bold">–</span>
                    <input type="time" value={r.to} onChange={(e) => setForm({ ...form, autoMeal: { ...form.autoMeal, [row.key]: { ...r, to: e.target.value } } })} className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-xs font-bold" />
                  </div>
                );
              })}

              {/* Snack – 3 rozsahy */}
              <div className="flex items-center gap-2 bg-fitcal-mintLight dark:bg-emerald-500/10 rounded-2xl px-3 py-2">
                <input
                  type="checkbox"
                  checked={form.autoMeal.snackMorning.enabled || form.autoMeal.snackLunch.enabled || form.autoMeal.snackNight.enabled}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setForm({
                      ...form,
                      autoMeal: {
                        ...form.autoMeal,
                        snackMorning: { ...form.autoMeal.snackMorning, enabled: on },
                        snackLunch: { ...form.autoMeal.snackLunch, enabled: on },
                        snackNight: { ...form.autoMeal.snackNight, enabled: on },
                      },
                    });
                  }}
                  className="h-4 w-4 accent-fitcal-mint shrink-0"
                />
                <span className="text-xs font-black">{t("meal.snack")}</span>
              </div>
              {([
                { key: "snackMorning" as const, label: t("meal.snackMorning") },
                { key: "snackLunch" as const, label: t("meal.snackLunch") },
                { key: "snackNight" as const, label: t("meal.snackNight") },
              ]).map((row) => {
                const r = form.autoMeal[row.key];
                return (
                  <div key={row.key} className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl px-3 py-2 ml-5">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={(e) => setForm({ ...form, autoMeal: { ...form.autoMeal, [row.key]: { ...r, enabled: e.target.checked } } })}
                      className="h-4 w-4 accent-fitcal-mint shrink-0"
                    />
                    <span className="text-xs font-bold flex-1">{row.label}</span>
                    <input type="time" value={r.from} onChange={(e) => setForm({ ...form, autoMeal: { ...form.autoMeal, [row.key]: { ...r, from: e.target.value } } })} className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-xs font-bold" />
                    <span className="text-zinc-400 text-xs font-bold">–</span>
                    <input type="time" value={r.to} onChange={(e) => setForm({ ...form, autoMeal: { ...form.autoMeal, [row.key]: { ...r, to: e.target.value } } })} className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-xs font-bold" />
                  </div>
                );
              })}
            </div>

            {autoSaved && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold text-center py-2"
              >
                ✓ {t("settings.autoScan")} – {t("settings.saved")}
              </motion.div>
            )}

            <button
              onClick={async () => {
                const ok = await save();
                if (ok) {
                  setAutoSaved(true);
                  setTimeout(() => setAutoSaved(false), 2500);
                }
              }}
              disabled={saving}
              className="w-full rounded-2xl bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold py-3 hover:bg-black dark:hover:bg-zinc-100 transition disabled:opacity-60"
            >
              {saving ? t("dash.saving") : t("settings.save")}
            </button>
          </div>

          {/* Intro sprievodca */}
          <div className="bg-white dark:bg-zinc-900 rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-5 sm:p-6 space-y-3">
            <h2 className="font-extrabold flex items-center gap-2">👋 Sprievodca aplikáciou</h2>
            <p className="text-xs font-medium text-zinc-500">Avatar ťa prevedie celou aplikáciou a ukáže kde čo je a ako sa meria.</p>
            <button
              onClick={() => {
                try { localStorage.removeItem("fitcal_intro_seen"); } catch {}
                router.push("/");
                setTimeout(() => {
                  try { localStorage.removeItem("fitcal_intro_seen"); } catch {}
                  window.dispatchEvent(new CustomEvent("fitcal:startIntro"));
                }, 600);
              }}
              className="w-full rounded-2xl bg-fitcal-mint text-white font-bold py-3 hover:brightness-95 transition"
            >
              Spustiť sprievodcu
            </button>
          </div>

          {/* Choroba / freeze — modrá 0 */}
          <SicknessPanel />
          </div>
          <div className="lg:col-span-4 space-y-6">
            <QRCodePanel />
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          disabled={loggingOut}
          className="w-full rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 font-bold py-3.5 hover:bg-red-100 dark:hover:bg-red-500/20 transition disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loggingOut ? (
            <>
              <span className="h-4 w-4 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" /> {t("auth.logout")}…
            </>
          ) : (
            <>{t("auth.logout")}</>
          )}
        </button>
      </main>
    </div>
  );
}

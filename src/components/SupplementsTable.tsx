"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { BUS, onBus, emitBus } from "@/lib/bus";

export function SupplementsTable({ date }: { date?: string }) {
  const { t } = useI18n();
  const today = date || new Date().toISOString().slice(0,10);
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [time, setTime] = useState(new Date().toTimeString().slice(0,5));

  const load = async () => {
    try {
      const r = await fetch(`/api/supplements?date=${today}`);
      if (!r.ok) return;
      const j = await r.json();
      setList(j.supplements || []);
    } catch {}
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [today]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onBus(BUS.supplements, load), [today]);

  const add = async () => {
    if (!name.trim()) return;
    const r = await fetch("/api/supplements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: today, name, amount, time }) });
    if (r.ok) { setName(""); setAmount(""); emitBus(BUS.supplements); load(); }
  };
  const del = async (id: string) => {
    await fetch(`/api/supplements?id=${id}`, { method: "DELETE" });
    emitBus(BUS.supplements); load();
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-card border border-zinc-100 dark:border-zinc-800 p-4 sm:p-6">
      <h3 className="font-extrabold text-sm flex items-center gap-1.5">💊 Doplnky stravy</h3>
      <p className="text-xs font-medium text-zinc-500 mt-1">Denne užívanie — zobrazuje sa v tabuľkách vedľa jedál.</p>
      <div className="mt-3 flex gap-2 flex-wrap">
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Názov (napr. Vitamín D)" className="flex-1 min-w-[120px] rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm" />
        <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Dávka (1 tbl.)" className="w-28 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm" />
        <input type="time" value={time} onChange={e=>setTime(e.target.value)} className="w-28 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-2 text-sm" />
        <button onClick={add} className="rounded-xl bg-fitcal-mint text-white font-bold px-4 py-2 text-sm">Pridať</button>
      </div>
      {list.length===0 ? (
        <p className="text-xs font-medium text-zinc-500 mt-3">Žiadne doplnky dnes.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-zinc-500 font-bold"><th className="text-left py-1">Názov</th><th className="text-left py-1">Dávka</th><th className="text-left py-1">Čas</th><th></th></tr></thead>
            <tbody>
              {list.map((s:any)=>(
                <tr key={s.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 font-semibold">{s.name}</td>
                  <td className="py-2">{s.amount}</td>
                  <td className="py-2">{s.time}</td>
                  <td className="py-2 text-right"><button onClick={()=>del(s.id)} className="text-red-500 font-bold px-2">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

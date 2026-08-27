"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { PageHeader } from "@/components/PageHeader";
import { HistoryList } from "@/components/HistoryView";
import { useSectionDisplay } from "@/lib/display";
import dynamic from "next/dynamic";

const TrendCharts = dynamic(() => import("@/components/TrendCharts").then((m) => m.TrendCharts), { ssr: false, loading: () => <div className="h-40 bg-zinc-50 dark:bg-zinc-800/60 rounded-3xl animate-pulse" /> });

export default function HistoryClient({ user, grouped }: { user: any; grouped: { date: string; meals: any[] }[] }) {
  const router = useRouter();
  const histCols = useSectionDisplay("history-page")[0] === "split" ? "lg:grid-cols-2" : "";

  // live sync: instantly reload server-rendered history when meals change on any device
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource("/api/events");
    es.addEventListener("meals", () => {
      router.refresh();
    });
    return () => es.close();
  }, [router]);

  return (
    <div className="min-h-screen pb-10 sm:pb-0">
      <Header username={user.username} displayName={user.displayName} />
      <main className="px-3 sm:px-6 py-3 sm:py-6 space-y-4 sm:space-y-6">
        <PageHeader toggleSection="history-page" hideSettings />

        {/* Same layout as the dashboard history tab: meal list | trend charts */}
        <div className={`grid ${histCols} gap-6 items-start`}>
          <HistoryList history={grouped} />
          <TrendCharts userId={user.id} />
        </div>
      </main>
    </div>
  );
}

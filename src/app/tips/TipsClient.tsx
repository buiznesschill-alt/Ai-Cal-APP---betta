"use client";
import { Header } from "@/components/Header";
import { PageHeader } from "@/components/PageHeader";
import dynamic from "next/dynamic";

const HealthTipsExpanded = dynamic(() => import("@/components/HealthTips").then((m) => m.HealthTipsExpanded), { ssr: false });

export default function TipsClient({ user }: { user: any }) {
  return (
    <div className="min-h-screen pb-10 sm:pb-0">
      <Header username={user.username} displayName={user.displayName} />
      <main className="px-3 sm:px-6 py-3 sm:py-6 space-y-4 sm:space-y-6">
        <PageHeader toggleSection="tips" hideSettings />
        <HealthTipsExpanded />
      </main>
    </div>
  );
}

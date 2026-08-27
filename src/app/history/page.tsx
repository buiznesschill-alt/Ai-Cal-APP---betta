import { getCurrentUser } from "@/lib/serverAuth";
import { getMealsGroupedByDate } from "@/lib/db";
import { redirect } from "next/navigation";
import HistoryClient from "./HistoryClient";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const grouped = await getMealsGroupedByDate(user.id, 30);
  return <HistoryClient user={user} grouped={grouped} />;
}

import { getCurrentUser, getToday } from "@/lib/serverAuth";
import { getDaySummary, getMealsGroupedByDate } from "@/lib/db";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const today = getToday();
  const summary = await getDaySummary(user.id, today);
  const history = await getMealsGroupedByDate(user.id, 7);

  return <DashboardClient user={user} initialSummary={summary} initialHistory={history} />;
}

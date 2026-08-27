import { getCurrentUser } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import TipsClient from "./TipsClient";

export default async function TipsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <TipsClient user={user} />;
}

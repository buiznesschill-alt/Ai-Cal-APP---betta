import { cookies } from "next/headers";
import { verifyToken } from "./auth";
import { findUserById } from "./db";

export async function getCurrentUser() {
  const cookieStore = cookies();
  const token = cookieStore.get("fitcal_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const user = await findUserById(payload.userId);
  return user;
}

export function getToday() {
  return new Date().toISOString().slice(0, 10);
}

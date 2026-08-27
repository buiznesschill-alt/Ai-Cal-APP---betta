import * as jose from "jose";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.AUTH_SECRET || "dev-secret-change-me-32-chars-min-please!";
const COOKIE_NAME = "fitcal_token";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSecretKey() {
  // jose expects Uint8Array, pad to 32 chars
  const s = JWT_SECRET.padEnd(32, "0").slice(0, 64);
  return new TextEncoder().encode(s);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createToken(payload: { userId: string; username: string }): Promise<string> {
  const secret = getSecretKey();
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<{ userId: string; username: string } | null> {
  try {
    const secret = getSecretKey();
    const { payload } = await jose.jwtVerify(token, secret);
    return { userId: payload.userId as string, username: payload.username as string };
  } catch {
    return null;
  }
}

export function getAuthCookie(token: string, secure = false): string {
  // Secure cookie sa uklada len cez HTTPS – na http:// LAN adrese ho prehliadač zahodí
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure ? "; Secure" : ""}`;
}

export function getClearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;

export function getTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

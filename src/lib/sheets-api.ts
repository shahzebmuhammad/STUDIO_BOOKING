import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export type StudioSession = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  mustChangePassword: boolean;
  expiresAt: number;
};

const SESSION_COOKIE = "studio_session";
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function signature(payload: string) {
  return createHmac("sha256", requiredEnv("STUDIO_SESSION_SECRET")).update(payload).digest("base64url");
}

export function createSessionToken(user: Omit<StudioSession, "expiresAt">) {
  const session: StudioSession = { ...user, expiresAt: Date.now() + SESSION_LIFETIME_MS };
  const payload = base64Url(JSON.stringify(session));
  return `${payload}.${signature(payload)}`;
}

export function parseSessionToken(token: string | undefined): StudioSession | null {
  if (!token) return null;
  const [payload, providedSignature] = token.split(".");
  if (!payload || !providedSignature) return null;
  const expected = signature(payload);
  const left = Buffer.from(providedSignature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as StudioSession;
    if (session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getStudioSession() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return parseSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export function studioSessionCookie(token: string) {
  return { name: SESSION_COOKIE, value: token, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: SESSION_LIFETIME_MS / 1000 };
}

export async function callSheets(action: string, payload: Record<string, unknown>) {
  const response = await fetch(requiredEnv("GOOGLE_SHEETS_WEB_APP_URL"), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, payload, apiSecret: requiredEnv("GOOGLE_SHEETS_API_SECRET") }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json() as { ok?: boolean; data?: unknown; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error || `Sheets service returned ${response.status}.`);
  return result.data;
}

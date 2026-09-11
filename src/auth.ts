import { createHmac, timingSafeEqual, randomBytes, createHash } from "node:crypto";
import { env, isDemo } from "./config.js";

export const SESSION_COOKIE = "nc_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 h

export interface Session {
  exp: number;
  csrf: string;
}

/** Mot de passe attendu. En mode démo sans mot de passe défini, « demo ». */
export function expectedPassword(): string | undefined {
  return env("CONSOLE_PASSWORD") ?? (isDemo() ? "demo" : undefined);
}

function secret(): Buffer {
  const explicit = env("SESSION_SECRET");
  if (explicit) return Buffer.from(explicit, "utf8");
  // Repli documenté : dérivé du mot de passe. Changer le mot de passe invalide les sessions.
  const pw = expectedPassword() ?? "";
  return createHash("sha256").update("natais-console:" + pw).digest();
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", secret()).update(payload).digest());
}

export function createSession(): { token: string; session: Session } {
  const session: Session = { exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS, csrf: b64url(randomBytes(18)) };
  const payload = b64url(Buffer.from(JSON.stringify(session), "utf8"));
  return { token: `${payload}.${sign(payload)}`, session };
}

export function verifySession(token: string | undefined): Session | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (typeof session.exp !== "number" || typeof session.csrf !== "string") return null;
    if (session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function checkPassword(candidate: string): boolean {
  const expected = expectedPassword();
  if (!expected) return false;
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

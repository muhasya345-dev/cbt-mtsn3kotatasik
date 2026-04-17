import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { eq, and, gt } from "drizzle-orm";
import { users, sessions } from "@/db/schema";
import type { UserRole } from "@/types";
import type { Env } from "./context";
import type { Db } from "./db";
import type { Context } from "hono";

export const SESSION_COOKIE = "cbt_session";
export const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function createSessionInDb(db: Db, userId: string): Promise<{ id: string; expiresAt: Date }> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({ id: sessionId, userId, expiresAt });
  return { id: sessionId, expiresAt };
}

export async function setSessionCookie(c: Context<Env>, sessionId: string, expiresAt: Date) {
  const url = new URL(c.req.url);
  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(c: Context<Env>) {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export async function loadSession(c: Context<Env>) {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (!sessionId) return null;

  const db = c.get("db");
  const result = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      username: users.username,
      role: users.role,
      fullName: users.fullName,
      isActive: users.isActive,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (result.length === 0) return null;
  const row = result[0];
  if (!row.isActive) return null;

  return {
    id: row.userId,
    username: row.username,
    role: row.role as UserRole,
    fullName: row.fullName,
    sessionId: row.sessionId,
  };
}

export async function deleteSessionFromDb(db: Db, sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Middleware: load session if cookie exists, set in context. Does NOT enforce auth.
 */
export const sessionMiddleware = createMiddleware<Env>(async (c, next) => {
  const session = await loadSession(c);
  if (session) c.set("session", session);
  await next();
});

/**
 * Middleware: require a logged-in session. Returns 401 if none.
 */
export const requireAuth = createMiddleware<Env>(async (c, next) => {
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

/**
 * Middleware factory: require one of the given roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return createMiddleware<Env>(async (c, next) => {
    const session = c.get("session");
    if (!session) return c.json({ error: "Unauthorized" }, 401);
    if (!allowedRoles.includes(session.role)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
}

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { verifyPassword, hashPassword } from "../password";
import {
  createSessionInDb,
  setSessionCookie,
  clearSessionCookie,
  deleteSessionFromDb,
} from "../auth";
import type { Env } from "../context";

export const authRouter = new Hono<Env>();

authRouter.post("/login", async (c) => {
  try {
    const body = await c.req.json<{ username?: string; password?: string }>();
    const { username, password } = body;

    if (!username || !password) {
      return c.json({ error: "Username dan password wajib diisi" }, 400);
    }

    const db = c.get("db");
    const result = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (result.length === 0) {
      return c.json({ error: "Username atau password salah" }, 401);
    }

    const user = result[0];

    if (!user.isActive) {
      return c.json({ error: "Akun Anda tidak aktif. Hubungi admin." }, 403);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return c.json({ error: "Username atau password salah" }, 401);
    }

    const session = await createSessionInDb(db, user.id);
    await setSessionCookie(c, session.id, session.expiresAt);

    return c.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ error: "Terjadi kesalahan server" }, 500);
  }
});

authRouter.post("/logout", async (c) => {
  try {
    const session = c.get("session");
    if (session) {
      await deleteSessionFromDb(c.get("db"), session.sessionId);
    }
    await clearSessionCookie(c);
    return c.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return c.json({ error: "Terjadi kesalahan server" }, 500);
  }
});

authRouter.get("/me", async (c) => {
  const session = c.get("session");
  if (!session) return c.json({ user: null }, 401);
  return c.json({
    user: {
      id: session.id,
      username: session.username,
      role: session.role,
      fullName: session.fullName,
    },
  });
});

authRouter.post("/seed", async (c) => {
  try {
    const db = c.get("db");
    const existing = await db.select().from(users).limit(1);
    if (existing.length > 0) {
      return c.json({ success: true, message: "Admin sudah ada" });
    }

    const plainPwd = "1!Insyaallah sah";
    const passwordHash = await hashPassword(plainPwd);

    await db.insert(users).values({
      id: createId(),
      username: "199911222025051007",
      passwordHash,
      plainPassword: plainPwd,
      role: "admin",
      fullName: "Muhammad Sya'ban Nurul Fuad, S.Pd.",
      nip: "199911222025051007",
      isActive: true,
    });

    return c.json({ success: true, message: "Seed berhasil" });
  } catch (error) {
    console.error("Seed error:", error);
    return c.json({ error: "Gagal seed database" }, 500);
  }
});

import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";

export async function seedDefaultAdmin() {
  const db = await getDb();

  const existing = await db.select().from(users).limit(1);
  if (existing.length > 0) return;

  const passwordHash = await hashPassword("1!Insyaallah sah");

  await db.insert(users).values({
    id: createId(),
    username: "199911222025051007",
    passwordHash,
    role: "admin",
    fullName: "Muhammad Sya'ban Nurul Fuad, S.Pd.",
    nip: "199911222025051007",
    isActive: true,
  });
}

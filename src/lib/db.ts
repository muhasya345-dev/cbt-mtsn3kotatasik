import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CloudflareEnv } from "@/types";

export async function getDb() {
  const { env } = await getCloudflareContext<CloudflareEnv>();
  return drizzle(env.DB, { schema });
}

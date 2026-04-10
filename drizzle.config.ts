import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema/index.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/dbe9242a99d19889b112bcc1c1ded7d223e1c20740aca75a123fe9efebe56096.sqlite",
  },
});

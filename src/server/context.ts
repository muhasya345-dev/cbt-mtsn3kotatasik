import type { Context } from "hono";
import type { Db } from "./db";
import type { UserRole } from "@/types";

export interface Env {
  Bindings: {
    DB: D1Database;
  };
  Variables: {
    db: Db;
    session?: {
      id: string;
      username: string;
      role: UserRole;
      fullName: string;
      sessionId: string;
    };
  };
}

export type AppContext = Context<Env>;

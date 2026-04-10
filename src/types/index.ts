export type UserRole = "admin" | "guru" | "siswa";

export interface SessionUser {
  id: string;
  username: string;
  role: UserRole;
  fullName: string;
}

export interface CloudflareEnv {
  DB: D1Database;
}

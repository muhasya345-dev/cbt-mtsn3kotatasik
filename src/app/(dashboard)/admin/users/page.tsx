import { requireRole } from "@/lib/auth";
import { UsersPageContent } from "./users-content";

export default async function UsersPage() {
  await requireRole("admin");
  return <UsersPageContent />;
}

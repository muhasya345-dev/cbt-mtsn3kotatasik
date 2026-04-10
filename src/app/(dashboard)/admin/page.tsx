import { requireRole } from "@/lib/auth";
import { AdminDashboardContent } from "./dashboard-content";

export default async function AdminDashboardPage() {
  const session = await requireRole("admin");
  return <AdminDashboardContent fullName={session.fullName} />;
}

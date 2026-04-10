import { requireRole } from "@/lib/auth";
import { SiswaDashboardContent } from "./siswa-dashboard-content";

export default async function SiswaDashboardPage() {
  await requireRole("siswa");
  return <SiswaDashboardContent />;
}

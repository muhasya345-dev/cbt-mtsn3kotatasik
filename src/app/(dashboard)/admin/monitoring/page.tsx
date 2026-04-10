import { requireRole } from "@/lib/auth";
import { MonitoringPageContent } from "./monitoring-content";

export default async function MonitoringPage() {
  await requireRole("admin");
  return <MonitoringPageContent />;
}

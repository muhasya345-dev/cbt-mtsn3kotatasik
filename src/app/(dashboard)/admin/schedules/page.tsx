import { requireRole } from "@/lib/auth";
import { SchedulesPageContent } from "./schedules-content";

export default async function SchedulesPage() {
  await requireRole("admin");
  return <SchedulesPageContent />;
}

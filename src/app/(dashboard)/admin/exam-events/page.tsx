import { requireRole } from "@/lib/auth";
import { ExamEventsPageContent } from "./exam-events-content";

export default async function ExamEventsPage() {
  await requireRole("admin");
  return <ExamEventsPageContent />;
}

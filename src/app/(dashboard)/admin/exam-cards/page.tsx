import { requireRole } from "@/lib/auth";
import { ExamCardsContent } from "./exam-cards-content";

export default async function ExamCardsPage() {
  await requireRole("admin");
  return <ExamCardsContent />;
}

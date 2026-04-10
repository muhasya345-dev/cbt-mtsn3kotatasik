import { requireRole } from "@/lib/auth";
import { QuestionsPageContent } from "./questions-content";

export default async function QuestionsPage() {
  await requireRole("guru");
  return <QuestionsPageContent />;
}

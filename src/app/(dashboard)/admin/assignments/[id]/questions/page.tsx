import { requireRole } from "@/lib/auth";
import { AdminQuestionsContent } from "./questions-content";

export default async function AdminQuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  return <AdminQuestionsContent assignmentId={id} />;
}

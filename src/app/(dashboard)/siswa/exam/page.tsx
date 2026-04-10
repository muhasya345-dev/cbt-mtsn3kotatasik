import { requireRole } from "@/lib/auth";
import { ExamContent } from "./exam-content";

export default async function ExamPage() {
  await requireRole("siswa");
  return <ExamContent />;
}

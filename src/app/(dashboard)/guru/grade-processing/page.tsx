import { requireRole } from "@/lib/auth";
import { GradeProcessingContent } from "../../admin/grade-processing/grade-processing-content";

export default async function GuruGradeProcessingPage() {
  await requireRole("guru");
  return <GradeProcessingContent />;
}

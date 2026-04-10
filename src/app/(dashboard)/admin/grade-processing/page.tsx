import { requireRole } from "@/lib/auth";
import { GradeProcessingContent } from "./grade-processing-content";

export default async function GradeProcessingPage() {
  await requireRole("admin");
  return <GradeProcessingContent />;
}

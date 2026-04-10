import { requireRole } from "@/lib/auth";
import { GradeRecapContent } from "../../admin/grade-recap/grade-recap-content";

export default async function GuruGradeRecapPage() {
  await requireRole("guru");
  return <GradeRecapContent />;
}

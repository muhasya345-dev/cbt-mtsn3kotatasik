import { requireRole } from "@/lib/auth";
import { GradeRecapContent } from "./grade-recap-content";

export default async function GradeRecapPage() {
  await requireRole("admin");
  return <GradeRecapContent />;
}

import { requireRole } from "@/lib/auth";
import { StudentsPageContent } from "./students-content";

export default async function StudentsPage() {
  await requireRole("admin");
  return <StudentsPageContent />;
}

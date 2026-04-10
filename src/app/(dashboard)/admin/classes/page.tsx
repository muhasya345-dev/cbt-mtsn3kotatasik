import { requireRole } from "@/lib/auth";
import { ClassesPageContent } from "./classes-content";

export default async function ClassesPage() {
  await requireRole("admin");
  return <ClassesPageContent />;
}

import { requireRole } from "@/lib/auth";
import { SubjectsPageContent } from "./subjects-content";

export default async function SubjectsPage() {
  await requireRole("admin");
  return <SubjectsPageContent />;
}

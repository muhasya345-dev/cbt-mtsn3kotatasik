import { requireRole } from "@/lib/auth";
import { AssignmentsPageContent } from "./assignments-content";

export default async function AssignmentsPage() {
  await requireRole("admin");
  return <AssignmentsPageContent />;
}

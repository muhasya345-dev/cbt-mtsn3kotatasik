import { requireRole } from "@/lib/auth";
import { EssayGradingContent } from "./essay-grading-content";

export default async function EssayGradingPage() {
  await requireRole("guru");
  return <EssayGradingContent />;
}

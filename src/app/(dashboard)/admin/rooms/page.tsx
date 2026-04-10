import { requireRole } from "@/lib/auth";
import { RoomsPageContent } from "./rooms-content";

export default async function RoomsPage() {
  await requireRole("admin");
  return <RoomsPageContent />;
}

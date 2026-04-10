import { requireRole } from "@/lib/auth";
import { FadeIn } from "@/components/shared/motion-wrapper";

export default async function GuruDashboardPage() {
  const session = await requireRole("guru");

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Selamat Datang, {session.fullName}
          </h1>
          <p className="text-muted-foreground mt-1">
            Dashboard Guru — CBT MTsN 3 Kota Tasikmalaya
          </p>
        </div>
      </FadeIn>
    </div>
  );
}

"use client";

import { useAuth } from "@/lib/auth-client";
import { FadeIn } from "@/components/shared/motion-wrapper";

export default function GuruDashboardPage() {
  const { session } = useAuth();

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

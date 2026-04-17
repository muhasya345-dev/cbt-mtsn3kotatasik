"use client";

import { AuthProvider, useAuth } from "@/lib/auth-client";
import { DashboardShell } from "./dashboard-shell";

function DashboardInner({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  return (
    <DashboardShell role={session.role} fullName={session.fullName}>
      {children}
    </DashboardShell>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardInner>{children}</DashboardInner>
    </AuthProvider>
  );
}

"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";
import type { UserRole } from "@/types";

export function DashboardShell({
  role,
  fullName,
  children,
}: {
  role: UserRole;
  fullName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role={role} fullName={fullName} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header role={role} fullName={fullName} />
        <main className="flex-1 p-6">{children}</main>
      </div>
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}

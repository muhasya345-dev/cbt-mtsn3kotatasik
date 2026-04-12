"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme/theme-provider";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ThemeProvider>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar
          role={role}
          fullName={fullName}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            role={role}
            fullName={fullName}
            onMenuToggle={() => setSidebarOpen(true)}
          />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
        <Toaster position="top-right" richColors closeButton />
      </div>
    </ThemeProvider>
  );
}

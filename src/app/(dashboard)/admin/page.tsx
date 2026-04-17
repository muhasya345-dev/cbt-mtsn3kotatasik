"use client";

import { useAuth } from "@/lib/auth-client";
import { AdminDashboardContent } from "./dashboard-content";

export default function AdminDashboardPage() {
  const { session } = useAuth();
  return <AdminDashboardContent fullName={session.fullName} />;
}

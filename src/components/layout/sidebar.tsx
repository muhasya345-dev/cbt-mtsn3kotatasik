"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { UserRole } from "@/types";
import {
  Users,
  GraduationCap,
  CalendarDays,
  DoorOpen,
  FileText,
  PenTool,
  Clock,
  Monitor,
  BarChart3,
  Calculator,
  CreditCard,
  Settings,
  LogOut,
  Home,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "", icon: <Home size={18} />, roles: ["admin", "guru", "siswa"] },
  { label: "Manajemen User", href: "/users", icon: <Users size={18} />, roles: ["admin"] },
  { label: "Data Siswa", href: "/students", icon: <GraduationCap size={18} />, roles: ["admin"] },
  { label: "Event Ujian", href: "/exam-events", icon: <Settings size={18} />, roles: ["admin"] },
  { label: "Mata Pelajaran", href: "/subjects", icon: <BookOpen size={18} />, roles: ["admin"] },
  { label: "Ruangan Ujian", href: "/rooms", icon: <DoorOpen size={18} />, roles: ["admin"] },
  { label: "Penugasan Soal", href: "/assignments", icon: <FileText size={18} />, roles: ["admin"] },
  { label: "Pembuatan Soal", href: "/questions", icon: <PenTool size={18} />, roles: ["guru"] },
  { label: "Penilaian Essay", href: "/essay-grading", icon: <FileText size={18} />, roles: ["guru"] },
  { label: "Jadwal CBT", href: "/schedules", icon: <CalendarDays size={18} />, roles: ["admin"] },
  { label: "Monitoring CBT", href: "/monitoring", icon: <Monitor size={18} />, roles: ["admin"] },
  { label: "Ujian CBT", href: "/exam", icon: <Clock size={18} />, roles: ["siswa"] },
  { label: "Rekap Nilai", href: "/grade-recap", icon: <BarChart3 size={18} />, roles: ["admin", "guru"] },
  { label: "Olah Nilai", href: "/grade-processing", icon: <Calculator size={18} />, roles: ["admin", "guru"] },
  { label: "Kartu Ujian", href: "/exam-cards", icon: <CreditCard size={18} />, roles: ["admin"] },
];

export function Sidebar({ role, fullName }: { role: UserRole; fullName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const rolePrefix = `/${role}`;
  const filteredItems = navItems.filter((item) => item.roles.includes(role));

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Berhasil logout");
      router.push("/login");
    } catch {
      toast.error("Gagal logout");
    }
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-green-600 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white text-sm font-bold">CBT</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">MTsN 3 Tasikmalaya</p>
            <p className="text-xs text-muted-foreground capitalize">{role}</p>
          </div>
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredItems.map((item, index) => {
          const fullHref = `${rolePrefix}${item.href}`;
          const isActive = pathname === fullHref || (item.href !== "" && pathname.startsWith(fullHref + "/"));

          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                href={fullHref}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-blue-50 to-green-50 text-blue-700 shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className={isActive ? "text-blue-600" : "text-gray-400"}>
                  {item.icon}
                </span>
                {item.label}
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600"
                  />
                )}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      <Separator />

      {/* User info & logout */}
      <div className="p-3 space-y-2">
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-gray-900 truncate">{fullName}</p>
          <p className="text-xs text-muted-foreground capitalize">Role: {role}</p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
          onClick={handleLogout}
        >
          <LogOut size={18} className="mr-2" />
          Logout
        </Button>
      </div>
    </aside>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { UserRole } from "@/types";
import {
  useTheme, type ThemeColor, themeLabels, themePreviewColors,
} from "@/components/theme/theme-provider";
import {
  Users, GraduationCap, CalendarDays, DoorOpen, FileText,
  PenTool, Clock, Monitor, BarChart3, Calculator, CreditCard,
  Settings, LogOut, Home, BookOpen, Palette, Check, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

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

const allThemes: ThemeColor[] = ["blue", "green", "purple", "orange", "red", "teal", "indigo", "rose"];

export function Sidebar({
  role,
  fullName,
  open,
  onClose,
}: {
  role: UserRole;
  fullName: string;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [themeOpen, setThemeOpen] = useState(false);

  const rolePrefix = `/${role}`;
  const filteredItems = navItems.filter((item) => item.roles.includes(role));
  const canChangeTheme = role === "admin" || role === "guru";

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Berhasil logout");
      router.push("/login");
    } catch {
      toast.error("Gagal logout");
    }
  }

  const sidebarContent = (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-kemenag.png"
            alt="Logo Kemenag"
            className="w-10 h-10 object-contain"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">MTsN 3 Kota Tasikmalaya</p>
            <p className="text-xs text-muted-foreground capitalize">{role}</p>
          </div>
          {/* Close button - mobile only */}
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
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
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                style={
                  isActive
                    ? {
                        background: `linear-gradient(135deg, rgb(var(--theme-primary-light)), rgb(var(--theme-primary-light) / 0.5))`,
                        color: `rgb(var(--theme-primary-text))`,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                      }
                    : undefined
                }
                {...(!isActive && {
                  className: "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                })}
              >
                <span
                  style={isActive ? { color: `rgb(var(--theme-primary))` } : undefined}
                  className={isActive ? undefined : "text-gray-400"}
                >
                  {item.icon}
                </span>
                {item.label}
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: `rgb(var(--theme-primary))` }}
                  />
                )}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      <Separator />

      {/* User info, theme & logout */}
      <div className="p-3 space-y-2">
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-gray-900 truncate">{fullName}</p>
          <p className="text-xs text-muted-foreground capitalize">Role: {role}</p>
        </div>

        {/* Theme Selector - only for admin & guru */}
        {canChangeTheme && (
          <Popover open={themeOpen} onOpenChange={setThemeOpen}>
            <PopoverTrigger
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <Palette size={18} />
              Tema Warna
              <div
                className="ml-auto w-4 h-4 rounded-full border border-gray-300"
                style={{ backgroundColor: `rgb(var(--theme-primary))` }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" side="top" align="start">
              <p className="text-xs font-medium text-gray-500 mb-2">Pilih Warna Tema</p>
              <div className="grid grid-cols-4 gap-2">
                {allThemes.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTheme(t);
                      setThemeOpen(false);
                      toast.success(`Tema diubah ke ${themeLabels[t]}`);
                    }}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer ${themePreviewColors[t]} ${
                      theme === t ? "ring-2 ring-offset-2 ring-gray-400" : ""
                    }`}
                    title={themeLabels[t]}
                  >
                    {theme === t && <Check size={16} className="text-white" />}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

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

  return (
    <>
      {/* Desktop sidebar - always visible */}
      <div className="hidden md:block sticky top-0 h-screen">
        {sidebarContent}
      </div>

      {/* Mobile sidebar - overlay */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={onClose}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 z-50 h-screen md:hidden"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

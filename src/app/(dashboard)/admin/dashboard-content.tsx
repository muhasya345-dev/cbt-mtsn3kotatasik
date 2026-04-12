"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { FadeIn, StaggerContainer, StaggerItem, ScaleOnHover } from "@/components/shared/motion-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  GraduationCap,
  CalendarDays,
  FileText,
  Monitor,
  BarChart3,
  AlertCircle,
  Clock,
  BookOpen,
} from "lucide-react";
import Link from "next/link";

interface DashboardStats {
  totalUser: number;
  totalSiswa: number;
  jadwalUjian: number;
  bankSoal: number;
  ujianAktif: number;
  rekapNilai: number;
}

interface ActiveExam {
  id: string;
  examEventName: string;
  subjectName: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  token: string | null;
  inProgressCount: number;
}

export function AdminDashboardContent({ fullName }: { fullName: string }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeExams, setActiveExams] = useState<ActiveExam[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard-stats");
      const data = await res.json() as { stats: DashboardStats; activeExams: ActiveExam[] };
      setStats(data.stats);
      setActiveExams(data.activeExams || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const statsCards = [
    { title: "Total User", value: stats?.totalUser ?? "—", icon: <Users size={24} />, color: "from-blue-500 to-blue-600" },
    { title: "Total Siswa", value: stats?.totalSiswa ?? "—", icon: <GraduationCap size={24} />, color: "from-green-500 to-green-600" },
    { title: "Jadwal Ujian", value: stats?.jadwalUjian ?? "—", icon: <CalendarDays size={24} />, color: "from-purple-500 to-purple-600" },
    { title: "Bank Soal", value: stats?.bankSoal ?? "—", icon: <FileText size={24} />, color: "from-orange-500 to-orange-600" },
    { title: "Ujian Aktif", value: stats?.ujianAktif ?? "—", icon: <Monitor size={24} />, color: "from-red-500 to-red-600" },
    { title: "Rekap Nilai", value: stats?.rekapNilai ?? "—", icon: <BarChart3 size={24} />, color: "from-teal-500 to-teal-600" },
  ];

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Selamat Datang, {fullName}
          </h1>
          <p className="text-muted-foreground mt-1">
            Dashboard Admin — CBT MTsN 3 Kota Tasikmalaya
          </p>
        </div>
      </FadeIn>

      {/* Active Exam Notification Banner */}
      {activeExams.length > 0 && (
        <FadeIn>
          <div className="rounded-xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-green-500 animate-pulse" />
              <h3 className="font-semibold text-green-800">
                Ujian Sedang Berlangsung ({activeExams.length} jadwal aktif)
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeExams.map((exam) => (
                <Link
                  key={exam.id}
                  href="/admin/monitoring"
                  className="flex items-start gap-3 bg-white rounded-lg p-3 border border-green-200 hover:border-green-400 hover:shadow-sm transition-all"
                >
                  <div className="p-2 rounded-lg bg-green-100 text-green-700 mt-0.5">
                    <BookOpen size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {exam.subjectName} — {exam.className}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {exam.examEventName}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Clock size={12} />
                        {exam.startTime} - {exam.endTime}
                      </div>
                      {exam.token && (
                        <Badge className="bg-blue-100 text-blue-700 text-xs">
                          Token: {exam.token}
                        </Badge>
                      )}
                      {exam.inProgressCount > 0 && (
                        <Badge className="bg-orange-100 text-orange-700 text-xs">
                          {exam.inProgressCount} siswa mengerjakan
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <AlertCircle size={12} />
              Token otomatis diperbarui setiap 20 menit. Klik untuk buka Monitoring CBT.
            </p>
          </div>
        </FadeIn>
      )}

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statsCards.map((card) => (
          <StaggerItem key={card.title}>
            <ScaleOnHover>
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
                  <motion.div
                    className={`p-2 rounded-lg bg-gradient-to-br ${card.color} text-white`}
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.4 }}
                  >
                    {card.icon}
                  </motion.div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                </CardContent>
              </Card>
            </ScaleOnHover>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </div>
  );
}

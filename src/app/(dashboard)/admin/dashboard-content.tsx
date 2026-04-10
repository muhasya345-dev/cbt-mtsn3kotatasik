"use client";

import { motion } from "framer-motion";
import { FadeIn, StaggerContainer, StaggerItem, ScaleOnHover } from "@/components/shared/motion-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  GraduationCap,
  CalendarDays,
  FileText,
  Monitor,
  BarChart3,
} from "lucide-react";

const statsCards = [
  { title: "Total User", value: "—", icon: <Users size={24} />, color: "from-blue-500 to-blue-600" },
  { title: "Total Siswa", value: "—", icon: <GraduationCap size={24} />, color: "from-green-500 to-green-600" },
  { title: "Jadwal Ujian", value: "—", icon: <CalendarDays size={24} />, color: "from-purple-500 to-purple-600" },
  { title: "Bank Soal", value: "—", icon: <FileText size={24} />, color: "from-orange-500 to-orange-600" },
  { title: "Ujian Aktif", value: "—", icon: <Monitor size={24} />, color: "from-red-500 to-red-600" },
  { title: "Rekap Nilai", value: "—", icon: <BarChart3 size={24} />, color: "from-teal-500 to-teal-600" },
];

export function AdminDashboardContent({ fullName }: { fullName: string }) {
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

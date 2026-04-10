"use client";

import type { UserRole } from "@/types";
import { Badge } from "@/components/ui/badge";

const roleBadgeColor: Record<UserRole, string> = {
  admin: "bg-blue-100 text-blue-700",
  guru: "bg-green-100 text-green-700",
  siswa: "bg-orange-100 text-orange-700",
};

export function Header({ role, fullName }: { role: UserRole; fullName: string }) {
  return (
    <header className="h-14 border-b border-gray-200 bg-white/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-10">
      <div>
        <h2 className="text-sm font-medium text-gray-500">
          Sistem Ujian Berbasis Komputer
        </h2>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-700">{fullName}</span>
        <Badge className={`${roleBadgeColor[role]} capitalize font-medium`}>
          {role}
        </Badge>
      </div>
    </header>
  );
}

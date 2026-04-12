"use client";

import type { UserRole } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Menu } from "lucide-react";

export function Header({
  role,
  fullName,
  onMenuToggle,
}: {
  role: UserRole;
  fullName: string;
  onMenuToggle: () => void;
}) {
  return (
    <header className="h-14 border-b border-gray-200 bg-white/80 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
        >
          <Menu size={22} />
        </button>
        <h2 className="text-sm font-medium text-gray-500 hidden sm:block">
          Sistem Ujian Berbasis Komputer
        </h2>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <span className="text-sm text-gray-700 hidden sm:inline">{fullName}</span>
        <Badge
          className="capitalize font-medium text-white"
          style={{
            backgroundColor: `rgb(var(--theme-primary))`,
          }}
        >
          {role}
        </Badge>
      </div>
    </header>
  );
}

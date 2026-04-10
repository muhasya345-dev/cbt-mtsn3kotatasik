"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FadeIn } from "@/components/shared/motion-wrapper";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";

interface StudentData {
  id: string;
  userId: string;
  nis: string;
  nisn: string | null;
  fullName: string;
  username: string;
  gender: string;
  birthPlace: string | null;
  birthDate: string | null;
  classId: string;
  className: string;
  isActive: boolean;
}

interface ClassOption { id: string; name: string }

export function StudentsPageContent() {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [sRes, cRes] = await Promise.all([
        fetch("/api/students"), fetch("/api/classes"),
      ]);
      const sData = await sRes.json() as { students: StudentData[] };
      const cData = await cRes.json() as Record<string, unknown>;
      setStudents(sData.students || []);
      setClasses(((cData.classes || cData) as ClassOption[]));
    } catch {
      toast.error("Gagal memuat data siswa");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredStudents = useMemo(() => {
    if (selectedClass === "all") return students;
    return students.filter((s) => s.classId === selectedClass);
  }, [students, selectedClass]);

  const columns: ColumnDef<StudentData>[] = [
    {
      id: "no",
      header: "No",
      cell: ({ row }) => <span className="text-gray-500">{row.index + 1}</span>,
      size: 50,
    },
    {
      accessorKey: "nis",
      header: "NIS",
      cell: ({ row }) => <span className="font-mono">{row.original.nis}</span>,
    },
    {
      accessorKey: "nisn",
      header: "NISN",
      cell: ({ row }) => (
        <span className="font-mono text-gray-500">{row.original.nisn || "—"}</span>
      ),
    },
    {
      accessorKey: "fullName",
      header: "Nama Lengkap",
      cell: ({ row }) => <span className="font-medium">{row.original.fullName}</span>,
    },
    {
      accessorKey: "className",
      header: "Kelas",
      cell: ({ row }) => <Badge variant="secondary">{row.original.className}</Badge>,
    },
    {
      accessorKey: "gender",
      header: "L/P",
      cell: ({ row }) => (
        <Badge className={
          row.original.gender === "L"
            ? "bg-blue-100 text-blue-700 border-blue-200"
            : "bg-pink-100 text-pink-700 border-pink-200"
        }>
          {row.original.gender}
        </Badge>
      ),
    },
    {
      id: "birthInfo",
      header: "TTL",
      cell: ({ row }) => {
        const s = row.original;
        if (!s.birthPlace && !s.birthDate) return <span className="text-gray-400">—</span>;
        return (
          <span className="text-sm text-gray-600">
            {s.birthPlace || ""}{s.birthPlace && s.birthDate ? ", " : ""}{s.birthDate || ""}
          </span>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge className={
          row.original.isActive
            ? "bg-green-100 text-green-700 border-green-200"
            : "bg-red-100 text-red-700 border-red-200"
        }>
          {row.original.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
  ];

  return (
    <FadeIn>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <GraduationCap className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Data Siswa</h1>
              <p className="text-sm text-gray-500">
                Total {filteredStudents.length} siswa
                {selectedClass !== "all" ? " (difilter)" : ""}
              </p>
            </div>
          </div>
          <div className="w-48">
            <Select value={selectedClass} onValueChange={(v) => setSelectedClass(v ?? "all")}>
              <SelectTrigger><SelectValue placeholder="Filter kelas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DataTable columns={columns} data={filteredStudents} searchKey="fullName" searchPlaceholder="Cari nama siswa..." />
      </div>
    </FadeIn>
  );
}

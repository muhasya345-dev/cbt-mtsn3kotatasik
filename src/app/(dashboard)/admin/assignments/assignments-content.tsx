"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FadeIn } from "@/components/shared/motion-wrapper";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle, PenTool } from "lucide-react";

interface AssignmentData {
  id: string;
  examEventId: string;
  examEventName: string;
  teacherUserId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  classId: string;
  className: string;
  gradeLevel: number;
  status: string;
}

interface SelectOption {
  id: string;
  name: string;
  fullName?: string;
  code?: string;
  gradeLevel?: number;
}

const statusBadge: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  submitted: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
};

export function AssignmentsPageContent() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ examEventId: "", teacherUserId: "", subjectId: "", classId: "" });

  // Options for selects
  const [examEvents, setExamEvents] = useState<SelectOption[]>([]);
  const [teachers, setTeachers] = useState<SelectOption[]>([]);
  const [subjects, setSubjects] = useState<SelectOption[]>([]);
  const [classes, setClasses] = useState<SelectOption[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/assignments");
      const data = await res.json() as { assignments: AssignmentData[] };
      setAssignments(data.assignments || []);
    } catch { toast.error("Gagal memuat data penugasan"); }
    setLoading(false);
  }, []);

  const fetchOptions = useCallback(async () => {
    try {
      const [evRes, uRes, sRes, cRes] = await Promise.all([
        fetch("/api/exam-events"),
        fetch("/api/users"),
        fetch("/api/subjects"),
        fetch("/api/classes"),
      ]);
      const [evData, uData, sData, cData] = await Promise.all([
        evRes.json() as Promise<{ events: SelectOption[] }>,
        uRes.json() as Promise<{ users: { id: string; fullName: string; role: string }[] }>,
        sRes.json() as Promise<{ subjects: SelectOption[] }>,
        cRes.json() as Promise<{ classes: SelectOption[] }>,
      ]);
      setExamEvents(evData.events || []);
      setTeachers((uData.users || []).filter((u) => u.role === "guru" || u.role === "admin").map((u) => ({ id: u.id, name: `${u.fullName} (${u.role})` })));
      setSubjects(sData.subjects || []);
      setClasses(cData.classes || []);
    } catch { toast.error("Gagal memuat opsi"); }
  }, []);

  useEffect(() => { fetchData(); fetchOptions(); }, [fetchData, fetchOptions]);

  function openCreate() {
    setForm({ examEventId: "", teacherUserId: "", subjectId: "", classId: "" });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
      toast.success("Penugasan berhasil dibuat");
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat penugasan");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus penugasan ini? Semua soal terkait juga akan terhapus.")) return;
    try {
      await fetch(`/api/assignments/${id}`, { method: "DELETE" });
      toast.success("Penugasan dihapus");
      fetchData();
    } catch { toast.error("Gagal menghapus"); }
  }

  async function handleApprove(id: string) {
    try {
      await fetch(`/api/assignments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      toast.success("Soal disetujui!");
      fetchData();
    } catch { toast.error("Gagal menyetujui"); }
  }

  const columns: ColumnDef<AssignmentData>[] = [
    { accessorKey: "examEventName", header: "Event Ujian" },
    { accessorKey: "teacherName", header: "Guru" },
    {
      accessorKey: "subjectName", header: "Mata Pelajaran",
      cell: ({ row }) => (
        <span>{row.original.subjectName} <span className="text-xs text-muted-foreground">({row.original.subjectCode})</span></span>
      ),
    },
    {
      accessorKey: "className", header: "Kelas",
      cell: ({ row }) => <Badge variant="outline">{row.original.className}</Badge>,
    },
    {
      accessorKey: "status", header: "Status",
      cell: ({ row }) => (
        <Badge className={statusBadge[row.original.status] || ""}>{row.original.status}</Badge>
      ),
    },
    {
      id: "actions", header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700 cursor-pointer" onClick={() => router.push(`/admin/assignments/${row.original.id}/questions`)} title="Kelola Soal">
            <PenTool size={16} />
          </Button>
          {row.original.status === "submitted" && (
            <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700 cursor-pointer" onClick={() => handleApprove(row.original.id)}>
              <CheckCircle size={16} />
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 cursor-pointer" onClick={() => handleDelete(row.original.id)}>
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Penugasan Soal</h1>
            <p className="text-muted-foreground">Tugaskan guru untuk membuat soal per mata pelajaran dan kelas</p>
          </div>
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
            <Plus size={16} className="mr-2" /> Tambah Penugasan
          </Button>
        </div>
      </FadeIn>

      <DataTable columns={columns} data={assignments} searchKey="teacherName" searchPlaceholder="Cari guru..." />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Penugasan Soal</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Event Ujian</Label>
              <Select value={form.examEventId} onValueChange={(v) => setForm({ ...form, examEventId: v ?? "" })}>
                <SelectTrigger><SelectValue placeholder="Pilih event ujian" /></SelectTrigger>
                <SelectContent>
                  {examEvents.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Guru</Label>
              <Select value={form.teacherUserId} onValueChange={(v) => setForm({ ...form, teacherUserId: v ?? "" })}>
                <SelectTrigger><SelectValue placeholder="Pilih guru" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mata Pelajaran</Label>
              <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v ?? "" })}>
                <SelectTrigger><SelectValue placeholder="Pilih mapel" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kelas</Label>
              <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v ?? "" })}>
                <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 cursor-pointer">Simpan Penugasan</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

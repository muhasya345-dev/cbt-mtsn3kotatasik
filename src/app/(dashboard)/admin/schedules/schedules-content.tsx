"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Plus, Trash2, Power, Copy } from "lucide-react";

interface ScheduleData {
  id: string;
  examEventName: string;
  subjectName: string;
  subjectCode: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  proctorName: string | null;
  token: string | null;
  isActive: boolean;
}

interface SelectOption { id: string; name: string; code?: string; fullName?: string }

export function SchedulesPageContent() {
  const [schedules, setSchedules] = useState<ScheduleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    examEventId: "", subjectId: "", classId: "", date: "",
    startTime: "07:30", durationMinutes: "90", proctorUserId: "",
  });
  const [examEvents, setExamEvents] = useState<SelectOption[]>([]);
  const [subjects, setSubjects] = useState<SelectOption[]>([]);
  const [classes, setClasses] = useState<SelectOption[]>([]);
  const [proctors, setProctors] = useState<SelectOption[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/schedules");
      const data = await res.json() as { schedules: ScheduleData[] };
      setSchedules(data.schedules || []);
    } catch { toast.error("Gagal memuat jadwal"); }
    setLoading(false);
  }, []);

  const fetchOptions = useCallback(async () => {
    try {
      const [evRes, sRes, cRes, uRes] = await Promise.all([
        fetch("/api/exam-events"), fetch("/api/subjects"), fetch("/api/classes"), fetch("/api/users"),
      ]);
      const [evData, sData, cData, uData] = await Promise.all([
        evRes.json() as Promise<{ events: SelectOption[] }>,
        sRes.json() as Promise<{ subjects: SelectOption[] }>,
        cRes.json() as Promise<{ classes: SelectOption[] }>,
        uRes.json() as Promise<{ users: { id: string; fullName: string; role: string }[] }>,
      ]);
      setExamEvents(evData.events || []);
      setSubjects(sData.subjects || []);
      setClasses(cData.classes || []);
      setProctors((uData.users || []).filter((u) => u.role === "guru").map((u) => ({ id: u.id, name: u.fullName })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchData(); fetchOptions(); }, [fetchData, fetchOptions]);

  function openCreate() {
    setForm({ examEventId: "", subjectId: "", classId: "", date: "", startTime: "07:30", durationMinutes: "90", proctorUserId: "" });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, durationMinutes: parseInt(form.durationMinutes) }),
      });
      if (!res.ok) { const err = await res.json() as { error: string }; throw new Error(err.error); }
      toast.success("Jadwal berhasil dibuat");
      setDialogOpen(false);
      fetchData();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Gagal membuat jadwal"); }
  }

  async function handleToggleActive(id: string, current: boolean) {
    try {
      await fetch(`/api/schedules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !current }),
      });
      toast.success(!current ? "Jadwal diaktifkan" : "Jadwal dinonaktifkan");
      fetchData();
    } catch { toast.error("Gagal mengubah status"); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus jadwal ini?")) return;
    try {
      await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      toast.success("Jadwal dihapus");
      fetchData();
    } catch { toast.error("Gagal menghapus"); }
  }

  function copyToken(token: string) {
    navigator.clipboard.writeText(token);
    toast.success(`Token ${token} disalin!`);
  }

  const columns: ColumnDef<ScheduleData>[] = [
    { accessorKey: "date", header: "Tanggal", cell: ({ row }) => new Date(row.original.date).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) },
    { accessorKey: "subjectName", header: "Mapel", cell: ({ row }) => <span>{row.original.subjectName} <span className="text-xs text-muted-foreground">({row.original.subjectCode})</span></span> },
    { accessorKey: "className", header: "Kelas" },
    { accessorKey: "startTime", header: "Waktu", cell: ({ row }) => `${row.original.startTime} - ${row.original.endTime}` },
    { accessorKey: "durationMinutes", header: "Durasi", cell: ({ row }) => `${row.original.durationMinutes} menit` },
    {
      accessorKey: "token", header: "Token",
      cell: ({ row }) => row.original.token ? (
        <div className="flex items-center gap-1">
          <code className="bg-gray-100 px-2 py-0.5 rounded text-sm font-mono font-bold">{row.original.token}</code>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 cursor-pointer" onClick={() => copyToken(row.original.token!)}>
            <Copy size={12} />
          </Button>
        </div>
      ) : "-",
    },
    {
      accessorKey: "isActive", header: "Status",
      cell: ({ row }) => (
        <Badge className={row.original.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
          {row.original.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
    {
      id: "actions", header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className={`cursor-pointer ${row.original.isActive ? "text-orange-600" : "text-green-600"}`}
            onClick={() => handleToggleActive(row.original.id, row.original.isActive)} title={row.original.isActive ? "Nonaktifkan" : "Aktifkan"}>
            <Power size={16} />
          </Button>
          <Button size="sm" variant="ghost" className="text-red-600 cursor-pointer" onClick={() => handleDelete(row.original.id)}>
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
            <h1 className="text-2xl font-bold">Jadwal CBT</h1>
            <p className="text-muted-foreground">Atur jadwal ujian, durasi, dan token akses</p>
          </div>
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
            <Plus size={16} className="mr-2" /> Tambah Jadwal
          </Button>
        </div>
      </FadeIn>

      <DataTable columns={columns} data={schedules} searchKey="subjectName" searchPlaceholder="Cari mapel..." />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Tambah Jadwal CBT</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Event Ujian</Label>
              <Select value={form.examEventId} onValueChange={(v) => setForm({ ...form, examEventId: v ?? "" })}>
                <SelectTrigger><SelectValue placeholder="Pilih event" /></SelectTrigger>
                <SelectContent>{examEvents.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mata Pelajaran</Label>
                <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v ?? "" })}>
                  <SelectTrigger><SelectValue placeholder="Pilih mapel" /></SelectTrigger>
                  <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kelas</Label>
                <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v ?? "" })}>
                  <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                  <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Tanggal</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Jam Mulai</Label>
                <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Durasi (menit)</Label>
                <Input type="number" min="10" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pengawas (opsional)</Label>
              <Select value={form.proctorUserId} onValueChange={(v) => setForm({ ...form, proctorUserId: v ?? "" })}>
                <SelectTrigger><SelectValue placeholder="Pilih pengawas" /></SelectTrigger>
                <SelectContent>{proctors.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 cursor-pointer">Simpan Jadwal</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

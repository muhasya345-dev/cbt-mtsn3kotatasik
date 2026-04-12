"use client";

import { useState, useEffect, useCallback } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { FadeIn } from "@/components/shared/motion-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Star } from "lucide-react";

interface ExamEvent {
  id: string;
  name: string;
  semester: "ganjil" | "genap";
  academicYear: string;
  isActive: boolean;
}

export function ExamEventsPageContent() {
  const [events, setEvents] = useState<ExamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExamEvent | null>(null);
  const [form, setForm] = useState({ name: "", semester: "ganjil" as string, academicYear: "2025/2026" });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/exam-events");
      const data = await res.json() as { events: ExamEvent[] };
      setEvents(data.events || []);
    } catch { toast.error("Gagal memuat data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", semester: "ganjil", academicYear: "2025/2026" });
    setDialogOpen(true);
  }

  function openEdit(item: ExamEvent) {
    setEditing(item);
    setForm({ name: item.name, semester: item.semester, academicYear: item.academicYear });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) {
        const res = await fetch(`/api/exam-events/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        if (!res.ok) throw new Error();
        toast.success("Event ujian berhasil diperbarui!");
      } else {
        const res = await fetch("/api/exam-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, isActive: false }) });
        if (!res.ok) throw new Error();
        toast.success("Event ujian berhasil ditambahkan!");
      }
      setDialogOpen(false);
      fetchData();
    } catch { toast.error("Gagal menyimpan"); }
  }

  async function handleSetActive(id: string) {
    try {
      await fetch(`/api/exam-events/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      toast.success("Event ujian diaktifkan!");
      fetchData();
    } catch { toast.error("Gagal mengaktifkan event"); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus event "${name}"?`)) return;
    try {
      await fetch(`/api/exam-events/${id}`, { method: "DELETE" });
      toast.success(`"${name}" berhasil dihapus!`);
      fetchData();
    } catch { toast.error("Gagal menghapus"); }
  }

  const columns: ColumnDef<ExamEvent>[] = [
    { accessorKey: "name", header: "Nama Event" },
    {
      accessorKey: "semester", header: "Semester",
      cell: ({ row }) => <span className="capitalize">{row.original.semester}</span>,
    },
    { accessorKey: "academicYear", header: "Tahun Ajaran" },
    {
      accessorKey: "isActive", header: "Status",
      cell: ({ row }) => row.original.isActive
        ? <Badge className="bg-green-100 text-green-700">Aktif</Badge>
        : <Badge className="bg-gray-100 text-gray-500">Nonaktif</Badge>,
    },
    {
      id: "actions", header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-1">
          {!row.original.isActive && (
            <Button variant="ghost" size="sm" onClick={() => handleSetActive(row.original.id)} className="cursor-pointer text-green-600" title="Aktifkan">
              <Star size={14} />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)} className="cursor-pointer"><Pencil size={14} /></Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(row.original.id, row.original.name)} className="cursor-pointer text-red-600"><Trash2 size={14} /></Button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Memuat data...</p></div>;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Event Ujian</h1>
            <p className="text-muted-foreground">Atur event ujian (PTS, PAS, dll)</p>
          </div>
          <Button onClick={openCreate} className="btn-theme-gradient cursor-pointer">
            <Plus size={16} className="mr-2" /> Tambah Event
          </Button>
        </div>
      </FadeIn>

      <DataTable columns={columns} data={events} searchKey="name" searchPlaceholder="Cari event..." />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Event Ujian" : "Tambah Event Ujian"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Event</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Ujian Akhir Semester" />
            </div>
            <div className="space-y-2">
              <Label>Semester</Label>
              <Select value={form.semester} onValueChange={(v) => setForm({ ...form, semester: v ?? "ganjil" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ganjil">Ganjil</SelectItem>
                  <SelectItem value="genap">Genap</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tahun Ajaran</Label>
              <Input value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} required placeholder="2025/2026" />
            </div>
            <Button type="submit" className="w-full btn-theme-gradient cursor-pointer">
              {editing ? "Simpan Perubahan" : "Tambah Event"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FadeIn } from "@/components/shared/motion-wrapper";
import { toast } from "sonner";
import { Plus, Trash2, Edit2 } from "lucide-react";

interface RoomData {
  id: string;
  name: string;
  capacity: number;
  examEventId: string;
  examEventName: string;
}

interface SelectOption { id: string; name: string }

export function RoomsPageContent() {
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RoomData | null>(null);
  const [form, setForm] = useState({ name: "", capacity: "30", examEventId: "" });
  const [examEvents, setExamEvents] = useState<SelectOption[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms");
      const data = await res.json() as { rooms: RoomData[] };
      setRooms(data.rooms || []);
    } catch { toast.error("Gagal memuat ruangan"); }
    setLoading(false);
  }, []);

  const fetchOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/exam-events");
      const data = await res.json() as { events: SelectOption[] };
      setExamEvents(data.events || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchData(); fetchOptions(); }, [fetchData, fetchOptions]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", capacity: "30", examEventId: "" });
    setDialogOpen(true);
  }

  function openEdit(room: RoomData) {
    setEditing(room);
    setForm({ name: room.name, capacity: String(room.capacity), examEventId: room.examEventId });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = editing ? `/api/rooms/${editing.id}` : "/api/rooms";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, capacity: parseInt(form.capacity), examEventId: form.examEventId }),
      });
      if (!res.ok) { const err = await res.json() as { error: string }; throw new Error(err.error); }
      toast.success(editing ? "Ruangan diperbarui" : "Ruangan berhasil dibuat");
      setDialogOpen(false);
      fetchData();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Gagal menyimpan"); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus ruangan ini?")) return;
    try {
      await fetch(`/api/rooms/${id}`, { method: "DELETE" });
      toast.success("Ruangan dihapus");
      fetchData();
    } catch { toast.error("Gagal menghapus"); }
  }

  const columns: ColumnDef<RoomData>[] = [
    { accessorKey: "name", header: "Nama Ruangan" },
    { accessorKey: "capacity", header: "Kapasitas", cell: ({ row }) => `${row.original.capacity} siswa` },
    { accessorKey: "examEventName", header: "Event Ujian" },
    {
      id: "actions", header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openEdit(row.original)}><Edit2 size={16} /></Button>
          <Button size="sm" variant="ghost" className="text-red-600 cursor-pointer" onClick={() => handleDelete(row.original.id)}><Trash2 size={16} /></Button>
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
            <h1 className="text-2xl font-bold">Ruangan Ujian</h1>
            <p className="text-muted-foreground">Kelola ruangan dan kapasitas untuk ujian</p>
          </div>
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
            <Plus size={16} className="mr-2" /> Tambah Ruangan
          </Button>
        </div>
      </FadeIn>

      <DataTable columns={columns} data={rooms} searchKey="name" searchPlaceholder="Cari ruangan..." />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Ruangan" : "Tambah Ruangan Baru"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Ruangan</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Lab Komputer 1" required />
            </div>
            <div className="space-y-2">
              <Label>Kapasitas</Label>
              <Input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required />
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label>Event Ujian</Label>
                <Select value={form.examEventId} onValueChange={(v) => setForm({ ...form, examEventId: v ?? "" })}>
                  <SelectTrigger><SelectValue placeholder="Pilih event" /></SelectTrigger>
                  <SelectContent>{examEvents.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 cursor-pointer">
              {editing ? "Perbarui" : "Simpan Ruangan"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

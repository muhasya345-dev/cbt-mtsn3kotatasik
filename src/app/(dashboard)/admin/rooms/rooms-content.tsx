"use client";

import { useState, useEffect, useCallback } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/shared/motion-wrapper";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, FileText, FileSpreadsheet, DoorOpen, Users } from "lucide-react";
import {
  generateRoomParticipantsPdf,
  type RoomPdfData,
} from "@/lib/generate-room-participants-pdf";
import {
  generateRoomParticipantsExcel,
  type RoomExcelData,
} from "@/lib/generate-room-participants-excel";

interface RoomData {
  id: string;
  name: string;
  capacity: number;
  examEventId: string;
  examEventName: string;
}

interface ExamEventOption {
  id: string;
  name: string;
  academicYear?: string;
  semester?: string;
}

interface RoomParticipantsResponse {
  examEvent: {
    id: string;
    name: string;
    semester: string;
    academicYear: string;
  };
  rooms: {
    roomId: string;
    roomName: string;
    capacity: number;
    participants: {
      nis: string;
      nisn: string;
      fullName: string;
      className: string;
    }[];
  }[];
}

export function RoomsPageContent() {
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RoomData | null>(null);
  const [form, setForm] = useState({ name: "", capacity: "30", examEventId: "" });
  const [examEvents, setExamEvents] = useState<ExamEventOption[]>([]);

  // Print-daftar-peserta dialog
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printEventId, setPrintEventId] = useState("");
  const [printing, setPrinting] = useState<"pdf" | "xlsx" | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms");
      const data = (await res.json()) as { rooms: RoomData[] };
      setRooms(data.rooms || []);
    } catch {
      toast.error("Gagal memuat ruangan");
    }
    setLoading(false);
  }, []);

  const fetchOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/exam-events");
      const data = (await res.json()) as { events: ExamEventOption[] };
      setExamEvents(data.events || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchOptions();
  }, [fetchData, fetchOptions]);

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
        body: JSON.stringify({
          name: form.name,
          capacity: parseInt(form.capacity),
          examEventId: form.examEventId,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error);
      }
      toast.success(editing ? "Ruangan diperbarui" : "Ruangan berhasil dibuat");
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus ruangan ini?")) return;
    try {
      await fetch(`/api/rooms/${id}`, { method: "DELETE" });
      toast.success("Ruangan dihapus");
      fetchData();
    } catch {
      toast.error("Gagal menghapus");
    }
  }

  function openPrintDialog() {
    setPrintEventId("");
    setPrintDialogOpen(true);
  }

  async function fetchParticipantsData(): Promise<RoomParticipantsResponse | null> {
    if (!printEventId) {
      toast.error("Pilih event ujian terlebih dahulu");
      return null;
    }
    const res = await fetch(`/api/room-participants?examEventId=${printEventId}`);
    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: "Gagal memuat data" }))) as {
        error: string;
      };
      toast.error(err.error || "Gagal memuat data");
      return null;
    }
    const data = (await res.json()) as RoomParticipantsResponse;
    if (!data.rooms.length) {
      toast.error("Tidak ada ruangan untuk event ini");
      return null;
    }
    const totalParticipants = data.rooms.reduce((sum, r) => sum + r.participants.length, 0);
    if (totalParticipants === 0) {
      toast.error(
        "Belum ada peserta yang ditempatkan di ruangan. Lakukan penempatan duduk terlebih dahulu.",
      );
      return null;
    }
    return data;
  }

  async function handlePrintPdf() {
    setPrinting("pdf");
    try {
      const data = await fetchParticipantsData();
      if (!data) return;
      const roomsForPdf: RoomPdfData[] = data.rooms.map((r) => ({
        roomName: r.roomName,
        participants: r.participants,
      }));
      await generateRoomParticipantsPdf({
        examEventName: data.examEvent.name,
        academicYear: data.examEvent.academicYear,
        semester: data.examEvent.semester,
        rooms: roomsForPdf,
      });
      toast.success("PDF daftar peserta berhasil dibuat");
      setPrintDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Gagal membuat PDF");
    }
    setPrinting(null);
  }

  async function handlePrintExcel() {
    setPrinting("xlsx");
    try {
      const data = await fetchParticipantsData();
      if (!data) return;
      const roomsForXlsx: RoomExcelData[] = data.rooms.map((r) => ({
        roomName: r.roomName,
        participants: r.participants,
      }));
      generateRoomParticipantsExcel({
        examEventName: data.examEvent.name,
        academicYear: data.examEvent.academicYear,
        semester: data.examEvent.semester,
        rooms: roomsForXlsx,
      });
      toast.success("Excel daftar peserta berhasil dibuat");
      setPrintDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Gagal membuat Excel");
    }
    setPrinting(null);
  }

  const columns: ColumnDef<RoomData>[] = [
    {
      accessorKey: "name",
      header: "Nama Ruangan",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
            <DoorOpen size={14} />
          </div>
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "capacity",
      header: "Kapasitas",
      cell: ({ row }) => (
        <Badge variant="secondary" className="font-mono">
          <Users size={12} className="mr-1" />
          {row.original.capacity} siswa
        </Badge>
      ),
    },
    { accessorKey: "examEventName", header: "Event Ujian" },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="cursor-pointer"
            onClick={() => openEdit(row.original)}
          >
            <Edit2 size={16} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600 cursor-pointer"
            onClick={() => handleDelete(row.original.id)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ];

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );

  // Count rooms per event for a nice hint
  const roomCountByEvent = rooms.reduce<Record<string, number>>((acc, r) => {
    acc[r.examEventId] = (acc[r.examEventId] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
              Ruangan Ujian
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Kelola ruangan, kapasitas, dan cetak daftar peserta per ruangan
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={openPrintDialog}
              variant="outline"
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
            >
              <FileText size={16} className="mr-2" /> Cetak Daftar Peserta
            </Button>
            <Button
              onClick={openCreate}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm cursor-pointer"
            >
              <Plus size={16} className="mr-2" /> Tambah Ruangan
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Summary card */}
      <FadeIn>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-emerald-50">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white shadow-sm">
              <DoorOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Ruangan</p>
              <p className="text-2xl font-bold text-gray-900">{rooms.length}</p>
            </div>
            <div className="h-10 border-l border-gray-200 mx-2" />
            <div>
              <p className="text-xs text-muted-foreground">Total Kapasitas</p>
              <p className="text-2xl font-bold text-gray-900">
                {rooms.reduce((sum, r) => sum + r.capacity, 0)}{" "}
                <span className="text-sm font-normal text-muted-foreground">siswa</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <DataTable
        columns={columns}
        data={rooms}
        searchKey="name"
        searchPlaceholder="Cari ruangan..."
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Ruangan" : "Tambah Ruangan Baru"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Ruangan</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ruang 1"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Kapasitas</Label>
              <Input
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                required
              />
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label>Event Ujian</Label>
                <Select
                  value={form.examEventId}
                  onValueChange={(v) => setForm({ ...form, examEventId: v ?? "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih event" />
                  </SelectTrigger>
                  <SelectContent>
                    {examEvents.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white cursor-pointer"
            >
              {editing ? "Perbarui" : "Simpan Ruangan"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Print Dialog — Daftar Peserta */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Cetak Daftar Peserta
            </DialogTitle>
            <DialogDescription>
              Cetak daftar peserta ujian per ruangan dalam format PDF atau Excel.
              Pastikan penempatan duduk sudah dilakukan sebelum mencetak.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Event Ujian</Label>
              <Select value={printEventId} onValueChange={(v) => setPrintEventId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih event ujian" />
                </SelectTrigger>
                <SelectContent>
                  {examEvents.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {printEventId && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm text-emerald-900">
                <div className="flex items-center gap-2">
                  <DoorOpen size={14} />
                  <span>
                    <b>{roomCountByEvent[printEventId] || 0}</b> ruangan terdaftar untuk event ini
                  </span>
                </div>
                <p className="text-xs text-emerald-700 mt-1">
                  Setiap ruangan akan menjadi 1 halaman (PDF) atau 1 sheet (Excel).
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                onClick={handlePrintPdf}
                disabled={!printEventId || printing !== null}
                className="bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white cursor-pointer"
              >
                <FileText size={16} className="mr-2" />
                {printing === "pdf" ? "Membuat..." : "Download PDF"}
              </Button>
              <Button
                onClick={handlePrintExcel}
                disabled={!printEventId || printing !== null}
                className="bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white cursor-pointer"
              >
                <FileSpreadsheet size={16} className="mr-2" />
                {printing === "xlsx" ? "Membuat..." : "Download Excel"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

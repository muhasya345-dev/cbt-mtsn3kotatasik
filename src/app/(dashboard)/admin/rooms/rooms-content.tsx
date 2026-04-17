"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FadeIn } from "@/components/shared/motion-wrapper";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Edit2,
  FileText,
  FileSpreadsheet,
  DoorOpen,
  Users,
  Settings,
  Shuffle,
  Sparkles,
} from "lucide-react";
import {
  generateRoomParticipantsPdf,
  type RoomPdfData,
} from "@/lib/generate-room-participants-pdf";
import {
  generateRoomParticipantsExcel,
  type RoomExcelData,
} from "@/lib/generate-room-participants-excel";
import { formatEventLabel } from "@/lib/format-event";

interface RoomData {
  id: string;
  name: string;
  capacity: number;
  tableCapacity: number;
  mixGrades: boolean;
  sortMode: "class-order" | "shuffle";
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
      participantNumber?: string;
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
  const [form, setForm] = useState({
    name: "",
    capacity: "30",
    examEventId: "",
    tableCapacity: 2,
    mixGrades: true,
  });
  const [examEvents, setExamEvents] = useState<ExamEventOption[]>([]);

  // Print-daftar-peserta dialog
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printEventId, setPrintEventId] = useState("");
  const [printing, setPrinting] = useState<"pdf" | "xlsx" | null>(null);

  // Rules/Placement dialog
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
  const [rulesEventId, setRulesEventId] = useState("");
  const [rulesForm, setRulesForm] = useState({
    tableCapacity: 2,
    mixGrades: true,
    sortMode: "class-order" as "class-order" | "shuffle",
  });
  const [generating, setGenerating] = useState(false);

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
    setForm({
      name: "",
      capacity: "30",
      examEventId: "",
      tableCapacity: 2,
      mixGrades: true,
    });
    setDialogOpen(true);
  }

  function openEdit(room: RoomData) {
    setEditing(room);
    setForm({
      name: room.name,
      capacity: String(room.capacity),
      examEventId: room.examEventId,
      tableCapacity: room.tableCapacity,
      mixGrades: room.mixGrades,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = editing ? `/api/rooms/${editing.id}` : "/api/rooms";
      const method = editing ? "PUT" : "POST";
      const payload: Record<string, unknown> = {
        name: form.name,
        capacity: parseInt(form.capacity),
        tableCapacity: form.tableCapacity,
        mixGrades: form.mixGrades,
      };
      if (!editing) payload.examEventId = form.examEventId;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  function openRulesDialog() {
    setRulesEventId("");
    setRulesForm({ tableCapacity: 2, mixGrades: true, sortMode: "class-order" });
    setRulesDialogOpen(true);
  }

  // Saat user ganti event di rules dialog → preload rules dari ruangan pertama event itu
  useEffect(() => {
    if (!rulesEventId) return;
    const rs = rooms.filter((r) => r.examEventId === rulesEventId);
    if (rs.length > 0) {
      const first = rs[0];
      setRulesForm({
        tableCapacity: first.tableCapacity,
        mixGrades: first.mixGrades,
        sortMode: first.sortMode,
      });
    }
  }, [rulesEventId, rooms]);

  async function handleGeneratePlacement() {
    if (!rulesEventId) {
      toast.error("Pilih event ujian");
      return;
    }
    const eventRooms = rooms.filter((r) => r.examEventId === rulesEventId);
    if (eventRooms.length === 0) {
      toast.error("Belum ada ruangan untuk event ini");
      return;
    }
    if (
      !confirm(
        "Generate penempatan akan MENGHAPUS penempatan lama untuk event ini dan membuat ulang. Lanjutkan?",
      )
    )
      return;

    setGenerating(true);
    try {
      // 1. Simpan rules ke semua ruangan event ini
      const ruleRes = await fetch("/api/rooms/bulk/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examEventId: rulesEventId,
          tableCapacity: rulesForm.tableCapacity,
          mixGrades: rulesForm.mixGrades,
          sortMode: rulesForm.sortMode,
        }),
      });
      if (!ruleRes.ok) throw new Error("Gagal menyimpan aturan");

      // 2. Generate placement
      const genRes = await fetch("/api/rooms/generate-placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examEventId: rulesEventId }),
      });
      const genData = (await genRes.json()) as {
        success?: boolean;
        placed?: number;
        unplaced?: number;
        warnings?: string[];
        totalStudents?: number;
        totalRooms?: number;
        error?: string;
      };
      if (!genRes.ok || !genData.success) {
        throw new Error(genData.error || "Gagal generate penempatan");
      }

      toast.success(
        `Penempatan selesai: ${genData.placed} siswa di ${genData.totalRooms} ruangan${
          genData.unplaced ? ` (${genData.unplaced} siswa tidak kebagian kursi)` : ""
        }`,
      );
      if (genData.warnings && genData.warnings.length > 0) {
        toast.warning(`${genData.warnings.length} peringatan rule. Cek konsol.`);
        console.warn("Placement warnings:", genData.warnings);
      }
      setRulesDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal generate");
    } finally {
      setGenerating(false);
    }
  }

  async function handleResetPlacement() {
    if (!rulesEventId) {
      toast.error("Pilih event ujian");
      return;
    }
    if (!confirm("Hapus semua penempatan siswa untuk event ini?")) return;
    try {
      const res = await fetch("/api/rooms/reset-placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examEventId: rulesEventId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Penempatan direset");
    } catch {
      toast.error("Gagal reset");
    }
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
        "Belum ada peserta yang ditempatkan. Lakukan Generate Penempatan terlebih dahulu.",
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
          {row.original.capacity}
        </Badge>
      ),
    },
    {
      accessorKey: "tableCapacity",
      header: "Per Meja",
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.tableCapacity} kursi
        </Badge>
      ),
    },
    {
      accessorKey: "mixGrades",
      header: "Rule",
      cell: ({ row }) =>
        row.original.mixGrades ? (
          <Badge className="bg-emerald-100 text-emerald-700 text-xs">Beda Angkatan</Badge>
        ) : (
          <Badge variant="outline" className="text-xs">Bebas</Badge>
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

  const roomCountByEvent = useMemo(
    () =>
      rooms.reduce<Record<string, number>>((acc, r) => {
        acc[r.examEventId] = (acc[r.examEventId] || 0) + 1;
        return acc;
      }, {}),
    [rooms],
  );

  const selectedEvent = examEvents.find((e) => e.id === printEventId);
  const rulesSelectedEvent = examEvents.find((e) => e.id === rulesEventId);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
              Ruangan Ujian
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Kelola ruangan, aturan penempatan, generate nomor peserta, dan cetak daftar
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={openRulesDialog}
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50 cursor-pointer"
            >
              <Settings size={16} className="mr-2" /> Atur & Generate Penempatan
            </Button>
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
              <p className="text-xs text-muted-foreground">
                Gunakan angka di nama (misal &quot;Ruang 1&quot;) — sistem ambil untuk kode ruang (01).
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kapasitas (siswa)</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Kursi per Meja</Label>
                <Select
                  value={String(form.tableCapacity)}
                  onValueChange={(v) =>
                    setForm({ ...form, tableCapacity: parseInt(v || "2") })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 kursi (lab individu)</SelectItem>
                    <SelectItem value="2">2 kursi (default)</SelectItem>
                    <SelectItem value="3">3 kursi</SelectItem>
                    <SelectItem value="4">4 kursi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center justify-between rounded-lg border p-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium">Beda angkatan per meja</p>
                <p className="text-xs text-muted-foreground">
                  Satu meja tidak boleh berisi siswa dengan grade yang sama
                </p>
              </div>
              <Switch
                checked={form.mixGrades}
                onCheckedChange={(v) => setForm({ ...form, mixGrades: v })}
              />
            </label>
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
                        {formatEventLabel(e)}
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

      {/* Print Dialog */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Cetak Daftar Peserta
            </DialogTitle>
            <DialogDescription>
              Cetak daftar peserta per ruangan (PDF / Excel). Pastikan penempatan sudah
              di-generate.
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
                      {formatEventLabel(e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedEvent && (
                <p className="text-xs text-muted-foreground">
                  {formatEventLabel(selectedEvent)}
                </p>
              )}
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

      {/* Rules & Placement Dialog */}
      <Dialog open={rulesDialogOpen} onOpenChange={setRulesDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-amber-600" />
              Atur & Generate Penempatan
            </DialogTitle>
            <DialogDescription>
              Tentukan aturan lalu generate nomor peserta otomatis. Nomor peserta akan langsung
              tertaut ke Kartu Ujian dan Daftar Peserta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Event Ujian</Label>
              <Select value={rulesEventId} onValueChange={(v) => setRulesEventId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih event ujian" />
                </SelectTrigger>
                <SelectContent>
                  {examEvents.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {formatEventLabel(e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {rulesSelectedEvent && (
                <p className="text-xs text-muted-foreground">
                  {formatEventLabel(rulesSelectedEvent)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kursi per Meja</Label>
                <Select
                  value={String(rulesForm.tableCapacity)}
                  onValueChange={(v) =>
                    setRulesForm({ ...rulesForm, tableCapacity: parseInt(v || "2") })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 kursi</SelectItem>
                    <SelectItem value="2">2 kursi</SelectItem>
                    <SelectItem value="3">3 kursi</SelectItem>
                    <SelectItem value="4">4 kursi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mode Urutan</Label>
                <Select
                  value={rulesForm.sortMode}
                  onValueChange={(v) =>
                    setRulesForm({
                      ...rulesForm,
                      sortMode: (v as "class-order" | "shuffle") ?? "class-order",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class-order">Urut Kelas (rapih)</SelectItem>
                    <SelectItem value="shuffle">Acak</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <label className="flex items-center justify-between rounded-lg border p-3 cursor-pointer bg-slate-50">
              <div>
                <p className="text-sm font-medium">Beda angkatan per meja</p>
                <p className="text-xs text-muted-foreground">
                  Contoh: kursi 1 = kelas 7, kursi 2 = kelas 8
                </p>
              </div>
              <Switch
                checked={rulesForm.mixGrades}
                onCheckedChange={(v) => setRulesForm({ ...rulesForm, mixGrades: v })}
              />
            </label>

            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
              <p className="font-semibold mb-1 flex items-center gap-1">
                <Sparkles size={12} /> Format Nomor Peserta
              </p>
              <p>
                <code className="bg-white px-1 rounded">YYYY-Kelas-RR### </code> — contoh{" "}
                <code className="bg-white px-1 rounded font-mono">2526-7A-01001</code>
                <br />
                (TA 2025/2026, Kelas 7A, Ruang 01, nomor urut 001)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleResetPlacement}
                disabled={!rulesEventId || generating}
                className="cursor-pointer border-red-200 text-red-600 hover:bg-red-50"
              >
                <Shuffle size={16} className="mr-2" /> Reset
              </Button>
              <Button
                onClick={handleGeneratePlacement}
                disabled={!rulesEventId || generating}
                className="bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white cursor-pointer"
              >
                <Sparkles size={16} className="mr-2" />
                {generating ? "Memproses..." : "Generate"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

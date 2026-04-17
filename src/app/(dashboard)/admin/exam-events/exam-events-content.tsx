"use client";

import { useState, useEffect, useCallback } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { FadeIn } from "@/components/shared/motion-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { semesterLabel } from "@/lib/format-event";

type Semester = "ganjil" | "genap" | "none";

interface ExamEvent {
  id: string;
  name: string;
  semester: Semester;
  academicYear: string;
  participatingClassIds: string[] | null;
  isActive: boolean;
}

interface ClassOption {
  id: string;
  name: string;
  gradeLevel: number;
  academicYear: string;
}

export function ExamEventsPageContent() {
  const [events, setEvents] = useState<ExamEvent[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExamEvent | null>(null);
  const [form, setForm] = useState({
    name: "",
    semester: "ganjil" as Semester,
    academicYear: "2025/2026",
    participatingClassIds: null as string[] | null,
  });
  const [allClasses, setAllClasses] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/exam-events");
      const data = (await res.json()) as { events: ExamEvent[] };
      setEvents(data.events || []);
    } catch {
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/classes");
      const data = (await res.json()) as { classes: ClassOption[] };
      setClasses(data.classes || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchClasses();
  }, [fetchData, fetchClasses]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      semester: "ganjil",
      academicYear: "2025/2026",
      participatingClassIds: null,
    });
    setAllClasses(true);
    setDialogOpen(true);
  }

  function openEdit(item: ExamEvent) {
    setEditing(item);
    setForm({
      name: item.name,
      semester: item.semester,
      academicYear: item.academicYear,
      participatingClassIds: item.participatingClassIds,
    });
    setAllClasses(!item.participatingClassIds || item.participatingClassIds.length === 0);
    setDialogOpen(true);
  }

  function toggleClass(id: string, checked: boolean) {
    setForm((f) => {
      const cur = f.participatingClassIds ?? [];
      const next = checked ? Array.from(new Set([...cur, id])) : cur.filter((x) => x !== id);
      return { ...f, participatingClassIds: next };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      semester: form.semester,
      academicYear: form.academicYear,
      participatingClassIds: allClasses ? null : form.participatingClassIds ?? [],
    };
    try {
      if (editing) {
        const res = await fetch(`/api/exam-events/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        toast.success("Event ujian berhasil diperbarui!");
      } else {
        const res = await fetch("/api/exam-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, isActive: false }),
        });
        if (!res.ok) throw new Error();
        toast.success("Event ujian berhasil ditambahkan!");
      }
      setDialogOpen(false);
      fetchData();
    } catch {
      toast.error("Gagal menyimpan");
    }
  }

  async function handleSetActive(id: string) {
    try {
      await fetch(`/api/exam-events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      toast.success("Event ujian diaktifkan!");
      fetchData();
    } catch {
      toast.error("Gagal mengaktifkan event");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus event "${name}"?`)) return;
    try {
      await fetch(`/api/exam-events/${id}`, { method: "DELETE" });
      toast.success(`"${name}" berhasil dihapus!`);
      fetchData();
    } catch {
      toast.error("Gagal menghapus");
    }
  }

  const columns: ColumnDef<ExamEvent>[] = [
    { accessorKey: "name", header: "Nama Event" },
    {
      accessorKey: "semester",
      header: "Semester",
      cell: ({ row }) => {
        const lbl = semesterLabel(row.original.semester);
        return lbl ? (
          <span>{lbl}</span>
        ) : (
          <span className="text-muted-foreground italic text-xs">tanpa semester</span>
        );
      },
    },
    { accessorKey: "academicYear", header: "Tahun Ajaran" },
    {
      id: "classes",
      header: "Kelas Peserta",
      cell: ({ row }) => {
        const ids = row.original.participatingClassIds;
        if (!ids || ids.length === 0)
          return <Badge variant="outline" className="text-xs">Semua kelas</Badge>;
        return (
          <Badge className="bg-blue-100 text-blue-700 text-xs">
            {ids.length} kelas dipilih
          </Badge>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge className="bg-green-100 text-green-700">Aktif</Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-500">Nonaktif</Badge>
        ),
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-1">
          {!row.original.isActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSetActive(row.original.id)}
              className="cursor-pointer text-green-600"
              title="Aktifkan"
            >
              <Star size={14} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEdit(row.original)}
            className="cursor-pointer"
          >
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(row.original.id, row.original.name)}
            className="cursor-pointer text-red-600"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Memuat data...</p>
      </div>
    );

  // Group classes by grade for the checkbox list
  const byGrade = classes.reduce<Record<number, ClassOption[]>>((acc, c) => {
    (acc[c.gradeLevel] = acc[c.gradeLevel] || []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
              Event Ujian
            </h1>
            <p className="text-muted-foreground">
              Atur event ujian (PTS, PAS, Try Out, dll) dan filter kelas peserta
            </p>
          </div>
          <Button onClick={openCreate} className="btn-theme-gradient cursor-pointer">
            <Plus size={16} className="mr-2" /> Tambah Event
          </Button>
        </div>
      </FadeIn>

      <DataTable
        columns={columns}
        data={events}
        searchKey="name"
        searchPlaceholder="Cari event..."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Event Ujian" : "Tambah Event Ujian"}</DialogTitle>
            <DialogDescription>
              Isi detail event, pilih semester, dan tentukan kelas yang ikut.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Event</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Ujian Akhir Semester"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Semester</Label>
                <Select
                  value={form.semester}
                  onValueChange={(v) =>
                    setForm({ ...form, semester: (v as Semester) ?? "ganjil" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ganjil">Ganjil</SelectItem>
                    <SelectItem value="genap">Genap</SelectItem>
                    <SelectItem value="none">Tanpa Semester</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tahun Ajaran</Label>
                <Input
                  value={form.academicYear}
                  onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                  required
                  placeholder="2025/2026"
                />
              </div>
            </div>

            {/* Filter kelas peserta */}
            <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Kelas Peserta</Label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={allClasses}
                    onCheckedChange={(v) => setAllClasses(!!v)}
                  />
                  <span>Semua kelas</span>
                </label>
              </div>
              {!allClasses && (
                <div className="space-y-3 pt-2 max-h-52 overflow-y-auto">
                  {Object.keys(byGrade).length === 0 && (
                    <p className="text-xs text-muted-foreground">Belum ada kelas terdaftar.</p>
                  )}
                  {Object.entries(byGrade)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([grade, list]) => (
                      <div key={grade}>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">
                          Kelas {grade}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {list.map((cls) => {
                            const checked =
                              form.participatingClassIds?.includes(cls.id) ?? false;
                            return (
                              <label
                                key={cls.id}
                                className="flex items-center gap-2 text-sm cursor-pointer"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => toggleClass(cls.id, !!v)}
                                />
                                <span>{cls.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}
              {allClasses && (
                <p className="text-xs text-muted-foreground">
                  Semua siswa dari semua kelas akan terdaftar untuk event ini.
                </p>
              )}
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

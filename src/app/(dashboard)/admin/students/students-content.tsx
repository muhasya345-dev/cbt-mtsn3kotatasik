"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FadeIn } from "@/components/shared/motion-wrapper";
import { toast } from "sonner";
import {
  GraduationCap, Plus, Download, Upload, Pencil, Trash2,
  Eye, EyeOff, UserCheck, UserX, FileSpreadsheet,
} from "lucide-react";

interface StudentData {
  id: string;
  userId: string;
  nis: string;
  nisn: string | null;
  fullName: string;
  username: string;
  plainPassword: string | null;
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
  const [showPasswords, setShowPasswords] = useState(false);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentData | null>(null);
  const [form, setForm] = useState({
    fullName: "", nis: "", nisn: "", classId: "", gender: "L",
    birthPlace: "", birthDate: "", password: "",
  });

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

  function openCreate() {
    setEditingStudent(null);
    setForm({ fullName: "", nis: "", nisn: "", classId: classes[0]?.id || "", gender: "L", birthPlace: "", birthDate: "", password: "" });
    setDialogOpen(true);
  }

  function openEdit(student: StudentData) {
    setEditingStudent(student);
    setForm({
      fullName: student.fullName, nis: student.nis, nisn: student.nisn || "",
      classId: student.classId, gender: student.gender,
      birthPlace: student.birthPlace || "", birthDate: student.birthDate || "", password: "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingStudent) {
        const body: Record<string, unknown> = {
          fullName: form.fullName, nis: form.nis, nisn: form.nisn,
          classId: form.classId, gender: form.gender,
          birthPlace: form.birthPlace, birthDate: form.birthDate,
        };
        if (form.password) body.password = form.password;
        const res = await fetch(`/api/students/${editingStudent.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) { const d = await res.json() as { error: string }; throw new Error(d.error); }
        toast.success("Data siswa berhasil diperbarui!");
      } else {
        const res = await fetch("/api/students", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: form.fullName, nis: form.nis, nisn: form.nisn,
            classId: form.classId, gender: form.gender,
            birthPlace: form.birthPlace, birthDate: form.birthDate,
          }),
        });
        if (!res.ok) { const d = await res.json() as { error: string }; throw new Error(d.error); }
        const data = await res.json() as { username: string; password: string };
        toast.success(`Siswa ditambahkan! Username: ${data.username}, Password: ${data.password}`);
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus siswa "${name}" beserta akun loginnya?`)) return;
    try {
      await fetch(`/api/students/${id}`, { method: "DELETE" });
      toast.success(`Siswa "${name}" berhasil dihapus!`);
      fetchData();
    } catch { toast.error("Gagal menghapus siswa"); }
  }

  async function toggleActive(student: StudentData) {
    try {
      await fetch(`/api/students/${student.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !student.isActive }),
      });
      toast.success(`Siswa ${student.isActive ? "dinonaktifkan" : "diaktifkan"}!`);
      fetchData();
    } catch { toast.error("Gagal mengubah status"); }
  }

  async function handleExportData() {
    const res = await fetch("/api/students/export");
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "data-siswa.xlsx";
    a.click();
    toast.success("Data siswa berhasil diexport!");
  }

  async function handleExportTemplate() {
    const res = await fetch("/api/students/export?mode=template");
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "template-import-siswa.xlsx";
    a.click();
    toast.success("Template import berhasil diunduh!");
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    try {
      const res = await fetch("/api/students/import", { method: "POST", body: formData });
      const data = await res.json() as { imported: number; skipped: number; errors: string[] };
      toast.success(`Berhasil import ${data.imported} siswa, ${data.skipped} dilewati`);
      if (data.errors?.length) {
        data.errors.slice(0, 5).forEach((err: string) => toast.warning(err));
        if (data.errors.length > 5) toast.warning(`...dan ${data.errors.length - 5} pesan lainnya`);
      }
      setImportDialogOpen(false);
      fetchData();
    } catch { toast.error("Gagal import file"); }
  }

  const columns: ColumnDef<StudentData>[] = [
    {
      id: "no", header: "No",
      cell: ({ row }) => <span className="text-gray-500">{row.index + 1}</span>,
      size: 50,
    },
    {
      accessorKey: "nis", header: "NIS",
      cell: ({ row }) => <span className="font-mono">{row.original.nis}</span>,
    },
    {
      accessorKey: "nisn", header: "NISN",
      cell: ({ row }) => <span className="font-mono text-gray-500">{row.original.nisn || "—"}</span>,
    },
    {
      accessorKey: "fullName", header: "Nama Lengkap",
      cell: ({ row }) => <span className="font-medium">{row.original.fullName}</span>,
    },
    {
      accessorKey: "className", header: "Kelas",
      cell: ({ row }) => <Badge variant="secondary">{row.original.className}</Badge>,
    },
    {
      accessorKey: "gender", header: "L/P",
      cell: ({ row }) => (
        <Badge className={row.original.gender === "L" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-pink-100 text-pink-700 border-pink-200"}>
          {row.original.gender}
        </Badge>
      ),
    },
    {
      accessorKey: "username", header: "Username",
      cell: ({ row }) => <span className="font-mono text-sm text-emerald-700">{row.original.username}</span>,
    },
    {
      accessorKey: "plainPassword", header: "Password",
      cell: ({ row }) => {
        const pwd = row.original.plainPassword;
        if (!pwd) return <span className="text-gray-400 italic text-xs">—</span>;
        return <span className="font-mono text-sm">{showPasswords ? pwd : "••••••••"}</span>;
      },
    },
    {
      accessorKey: "isActive", header: "Status",
      cell: ({ row }) => (
        <Badge className={row.original.isActive ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}>
          {row.original.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
    {
      id: "actions", header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)} className="cursor-pointer">
            <Pencil size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toggleActive(row.original)} className="cursor-pointer">
            {row.original.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(row.original.id, row.original.fullName)} className="cursor-pointer text-red-600">
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Memuat data...</p></div>;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <GraduationCap className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Data Siswa</h1>
              <p className="text-sm text-gray-500">
                Total {filteredStudents.length} siswa — Username & password otomatis dibuat oleh sistem
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowPasswords(!showPasswords)} className="cursor-pointer">
              {showPasswords ? <EyeOff size={14} className="mr-1" /> : <Eye size={14} className="mr-1" />}
              {showPasswords ? "Sembunyikan" : "Tampilkan"} Password
            </Button>
            <Select value={selectedClass} onValueChange={(v) => setSelectedClass(v ?? "all")}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Filter kelas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={handleExportData} className="cursor-pointer">
            <Download size={14} className="mr-1" /> Export Data Siswa
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportTemplate} className="cursor-pointer">
            <FileSpreadsheet size={14} className="mr-1" /> Download Template Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} className="cursor-pointer">
            <Upload size={14} className="mr-1" /> Import dari Excel
          </Button>
          <Button size="sm" onClick={openCreate} className="btn-theme-gradient cursor-pointer">
            <Plus size={14} className="mr-1" /> Tambah Siswa
          </Button>
        </div>
      </FadeIn>

      <DataTable columns={columns} data={filteredStudents} searchKey="fullName" searchPlaceholder="Cari nama siswa..." />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStudent ? "Edit Data Siswa" : "Tambah Siswa Baru"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Nama Lengkap *</Label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>NIS *</Label>
                <Input value={form.nis} onChange={(e) => setForm({ ...form, nis: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>NISN</Label>
                <Input value={form.nisn} onChange={(e) => setForm({ ...form, nisn: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Kelas *</Label>
                <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v ?? "" })}>
                  <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Jenis Kelamin *</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v ?? "L" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Laki-laki</SelectItem>
                    <SelectItem value="P">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tempat Lahir</Label>
                <Input value={form.birthPlace} onChange={(e) => setForm({ ...form, birthPlace: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tanggal Lahir</Label>
                <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
              </div>
            </div>
            {editingStudent && (
              <div className="space-y-2 border-t pt-3">
                <Label>Reset Password (kosongkan jika tidak diubah)</Label>
                <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password baru..." />
              </div>
            )}
            {!editingStudent && (
              <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                Username (12 karakter) dan Password (8 karakter) akan otomatis di-generate oleh sistem.
              </p>
            )}
            <Button type="submit" className="w-full btn-theme-gradient cursor-pointer">
              {editingStudent ? "Simpan Perubahan" : "Tambah Siswa"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Siswa dari Excel</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleImport} className="space-y-4">
            <div className="space-y-2">
              <Label>File Excel (.xlsx)</Label>
              <Input type="file" name="file" accept=".xlsx,.xls" required />
            </div>
            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded space-y-1">
              <p className="font-medium">Kolom yang diperlukan:</p>
              <p>• <b>Nama Lengkap</b> (wajib)</p>
              <p>• <b>NIS</b> (wajib, harus unik)</p>
              <p>• <b>Kelas</b> (wajib, harus cocok dengan data kelas)</p>
              <p>• NISN, Jenis Kelamin (L/P), Tempat Lahir, Tanggal Lahir</p>
              <p className="mt-2 text-blue-600">Username & password otomatis di-generate untuk setiap siswa.</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleExportTemplate} className="cursor-pointer">
                <FileSpreadsheet size={14} className="mr-1" /> Download Template
              </Button>
            </div>
            <Button type="submit" className="w-full btn-theme-gradient cursor-pointer">
              <Upload size={14} className="mr-2" /> Import Siswa
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

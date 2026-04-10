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
import { Plus, Pencil, Trash2 } from "lucide-react";

interface ClassData {
  id: string;
  name: string;
  gradeLevel: number;
  academicYear: string;
}

const gradeBadge: Record<number, string> = {
  7: "bg-blue-100 text-blue-700",
  8: "bg-green-100 text-green-700",
  9: "bg-purple-100 text-purple-700",
};

export function ClassesPageContent() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClassData | null>(null);
  const [form, setForm] = useState({ name: "", gradeLevel: "7", academicYear: "2025/2026" });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/classes");
      const data = await res.json() as { classes: ClassData[] };
      setClasses(data.classes || []);
    } catch { toast.error("Gagal memuat data kelas"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", gradeLevel: "7", academicYear: "2025/2026" });
    setDialogOpen(true);
  }

  function openEdit(item: ClassData) {
    setEditing(item);
    setForm({ name: item.name, gradeLevel: String(item.gradeLevel), academicYear: item.academicYear });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = { name: form.name, gradeLevel: parseInt(form.gradeLevel), academicYear: form.academicYear };
    try {
      if (editing) {
        const res = await fetch(`/api/classes/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error();
        toast.success("Kelas berhasil diperbarui!");
      } else {
        const res = await fetch("/api/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error();
        toast.success("Kelas berhasil ditambahkan!");
      }
      setDialogOpen(false);
      fetchData();
    } catch { toast.error("Gagal menyimpan data kelas"); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus kelas "${name}"?`)) return;
    try {
      await fetch(`/api/classes/${id}`, { method: "DELETE" });
      toast.success(`Kelas "${name}" berhasil dihapus!`);
      fetchData();
    } catch { toast.error("Gagal menghapus kelas"); }
  }

  const columns: ColumnDef<ClassData>[] = [
    { accessorKey: "name", header: "Nama Kelas" },
    {
      accessorKey: "gradeLevel", header: "Tingkat",
      cell: ({ row }) => (
        <Badge className={gradeBadge[row.original.gradeLevel] || ""}>{`Kelas ${row.original.gradeLevel}`}</Badge>
      ),
    },
    { accessorKey: "academicYear", header: "Tahun Ajaran" },
    {
      id: "actions", header: "Aksi",
      cell: ({ row }) => (
        <div className="flex gap-1">
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
            <h1 className="text-2xl font-bold text-gray-900">Data Kelas</h1>
            <p className="text-muted-foreground">Kelola kelas 7, 8, dan 9</p>
          </div>
          <Button onClick={openCreate} className="bg-gradient-to-r from-blue-600 to-green-600 text-white cursor-pointer">
            <Plus size={16} className="mr-2" /> Tambah Kelas
          </Button>
        </div>
      </FadeIn>

      <DataTable columns={columns} data={classes} searchKey="name" searchPlaceholder="Cari kelas..." />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Kelas" : "Tambah Kelas Baru"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Kelas (contoh: 7A, 8B)</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="7A" />
            </div>
            <div className="space-y-2">
              <Label>Tingkat Kelas</Label>
              <Select value={form.gradeLevel} onValueChange={(v) => setForm({ ...form, gradeLevel: v ?? "7" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Kelas 7</SelectItem>
                  <SelectItem value="8">Kelas 8</SelectItem>
                  <SelectItem value="9">Kelas 9</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tahun Ajaran</Label>
              <Input value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} required placeholder="2025/2026" />
            </div>
            <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white cursor-pointer">
              {editing ? "Simpan Perubahan" : "Tambah Kelas"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

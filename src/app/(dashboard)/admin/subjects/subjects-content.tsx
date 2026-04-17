"use client";

import { useState, useEffect, useCallback } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { FadeIn } from "@/components/shared/motion-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Subject {
  id: string;
  name: string;
  code: string;
}

export function SubjectsPageContent() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState({ name: "", code: "" });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/subjects");
      const data = await res.json() as { subjects: Subject[] };
      setSubjects(data.subjects || []);
    } catch { toast.error("Gagal memuat data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", code: "" });
    setDialogOpen(true);
  }

  function openEdit(item: Subject) {
    setEditing(item);
    setForm({ name: item.name, code: item.code });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) {
        const res = await fetch(`/api/subjects/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        if (!res.ok) { const d = await res.json() as { error: string }; throw new Error(d.error); }
        toast.success("Mata pelajaran berhasil diperbarui!");
      } else {
        const res = await fetch("/api/subjects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        if (!res.ok) { const d = await res.json() as { error: string }; throw new Error(d.error); }
        toast.success("Mata pelajaran berhasil ditambahkan!");
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Gagal menyimpan"); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus mata pelajaran "${name}"?`)) return;
    try {
      await fetch(`/api/subjects/${id}`, { method: "DELETE" });
      toast.success(`"${name}" berhasil dihapus!`);
      fetchData();
    } catch { toast.error("Gagal menghapus"); }
  }

  const columns: ColumnDef<Subject>[] = [
    { accessorKey: "code", header: "Kode" },
    { accessorKey: "name", header: "Nama Mata Pelajaran" },
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
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">Mata Pelajaran</h1>
            <p className="text-muted-foreground">Kelola daftar mata pelajaran</p>
          </div>
          <Button onClick={openCreate} className="btn-theme-gradient cursor-pointer">
            <Plus size={16} className="mr-2" /> Tambah Mapel
          </Button>
        </div>
      </FadeIn>

      <DataTable columns={columns} data={subjects} searchKey="name" searchPlaceholder="Cari mata pelajaran..." />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Mata Pelajaran" : "Tambah Mata Pelajaran"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Kode (contoh: MTK, BIN, IPA)</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required placeholder="MTK" />
            </div>
            <div className="space-y-2">
              <Label>Nama Mata Pelajaran</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Matematika" />
            </div>
            <Button type="submit" className="w-full btn-theme-gradient cursor-pointer">
              {editing ? "Simpan Perubahan" : "Tambah Mapel"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

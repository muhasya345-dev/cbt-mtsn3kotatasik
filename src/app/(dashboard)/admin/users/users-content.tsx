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
import { Plus, Download, Upload, Pencil, Trash2, UserCheck, UserX, Eye, EyeOff } from "lucide-react";

interface User {
  id: string;
  username: string;
  plainPassword: string | null;
  fullName: string;
  role: "admin" | "guru";
  nip: string | null;
  isActive: boolean;
  createdAt: string;
}

const roleBadge: Record<string, string> = {
  admin: "bg-blue-100 text-blue-700",
  guru: "bg-green-100 text-green-700",
};

export function UsersPageContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({ username: "", password: "", fullName: "", role: "guru" as string, nip: "" });
  const [showPasswords, setShowPasswords] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json() as { users: User[] };
      setUsers(data.users || []);
    } catch {
      toast.error("Gagal memuat data user");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function openCreate() {
    setEditingUser(null);
    setForm({ username: "", password: "", fullName: "", role: "guru", nip: "" });
    setDialogOpen(true);
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setForm({ username: user.username, password: "", fullName: user.fullName, role: user.role, nip: user.nip || "" });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingUser) {
        const body: Record<string, string> = { fullName: form.fullName, username: form.username, role: form.role, nip: form.nip };
        if (form.password) body.password = form.password;
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) { const d = await res.json() as { error: string }; throw new Error(d.error); }
        toast.success("User berhasil diperbarui!");
      } else {
        if (!form.password) { toast.error("Password wajib diisi"); return; }
        const res = await fetch("/api/users", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form }),
        });
        if (!res.ok) { const d = await res.json() as { error: string }; throw new Error(d.error); }
        toast.success("User berhasil ditambahkan!");
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus user "${name}"?`)) return;
    try {
      await fetch(`/api/users/${id}`, { method: "DELETE" });
      toast.success(`User "${name}" berhasil dihapus!`);
      fetchUsers();
    } catch { toast.error("Gagal menghapus user"); }
  }

  async function toggleActive(user: User) {
    try {
      await fetch(`/api/users/${user.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      toast.success(`User ${user.isActive ? "dinonaktifkan" : "diaktifkan"}!`);
      fetchUsers();
    } catch { toast.error("Gagal mengubah status"); }
  }

  async function handleExport() {
    const res = await fetch("/api/users/export");
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "users-admin-guru.xlsx";
    a.click();
    toast.success("File Excel berhasil diunduh!");
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    try {
      const res = await fetch("/api/users/import", { method: "POST", body: formData });
      const data = await res.json() as { imported: number; skipped: number; errors: string[] };
      toast.success(`Berhasil import ${data.imported} user, ${data.skipped} dilewati`);
      if (data.errors?.length) data.errors.forEach((err: string) => toast.warning(err));
      setImportDialogOpen(false);
      fetchUsers();
    } catch { toast.error("Gagal import file"); }
  }

  const columns: ColumnDef<User>[] = [
    { accessorKey: "fullName", header: "Nama Lengkap", cell: ({ row }) => <span className="font-medium">{row.original.fullName}</span> },
    { accessorKey: "username", header: "Username", cell: ({ row }) => <span className="font-mono">{row.original.username}</span> },
    {
      accessorKey: "plainPassword", header: "Password",
      cell: ({ row }) => {
        const pwd = row.original.plainPassword;
        if (!pwd) return <span className="text-gray-400 italic text-xs">tidak tersedia</span>;
        return (
          <span className="font-mono text-sm">
            {showPasswords ? pwd : "••••••••"}
          </span>
        );
      },
    },
    {
      accessorKey: "role", header: "Role",
      cell: ({ row }) => (
        <Badge className={`${roleBadge[row.original.role]} capitalize`}>{row.original.role}</Badge>
      ),
    },
    { accessorKey: "nip", header: "NIP", cell: ({ row }) => <span className="font-mono text-gray-600">{row.original.nip || "—"}</span> },
    {
      accessorKey: "isActive", header: "Status",
      cell: ({ row }) => (
        <Badge className={row.original.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
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
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">Manajemen User</h1>
            <p className="text-muted-foreground">Kelola akun Admin & Guru</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPasswords(!showPasswords)}
              className="cursor-pointer"
            >
              {showPasswords ? <EyeOff size={16} className="mr-2" /> : <Eye size={16} className="mr-2" />}
              {showPasswords ? "Sembunyikan" : "Tampilkan"} Password
            </Button>
            <Button variant="outline" onClick={handleExport} className="cursor-pointer">
              <Download size={16} className="mr-2" /> Export Excel
            </Button>
            <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="cursor-pointer">
              <Upload size={16} className="mr-2" /> Import Excel
            </Button>
            <Button onClick={openCreate} className="btn-theme-gradient cursor-pointer">
              <Plus size={16} className="mr-2" /> Tambah User
            </Button>
          </div>
        </div>
      </FadeIn>

      <DataTable columns={columns} data={users} searchKey="fullName" searchPlaceholder="Cari nama user..." />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Tambah User Baru"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Lengkap</Label>
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Username / NIP</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>{editingUser ? "Password (kosongkan jika tidak diubah)" : "Password"}</Label>
              <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingUser} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v ?? "guru" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="guru">Guru</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>NIP</Label>
              <Input value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} />
            </div>
            <Button type="submit" className="w-full btn-theme-gradient cursor-pointer">
              {editingUser ? "Simpan Perubahan" : "Tambah User"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Admin/Guru dari Excel</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleImport} className="space-y-4">
            <div className="space-y-2">
              <Label>Role untuk user yang diimport</Label>
              <Select name="role" defaultValue="guru">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="guru">Guru</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>File Excel (.xlsx)</Label>
              <Input type="file" name="file" accept=".xlsx,.xls" required />
              <p className="text-xs text-muted-foreground">
                Kolom: Username/NIP, Nama Lengkap, Password
              </p>
            </div>
            <Button type="submit" className="w-full btn-theme-gradient cursor-pointer">
              <Upload size={16} className="mr-2" /> Import
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

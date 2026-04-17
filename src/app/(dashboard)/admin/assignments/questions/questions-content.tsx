"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/shared/motion-wrapper";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, FileText, ChevronLeft } from "lucide-react";

interface QuestionData {
  id: string;
  assignmentId: string;
  orderNumber: number;
  type: "multiple_choice" | "true_false" | "essay";
  content: string;
  options: string | null;
  correctAnswer: string | null;
  points: number;
}

const typeLabel: Record<string, string> = {
  multiple_choice: "Pilihan Ganda",
  true_false: "Benar/Salah",
  essay: "Esai",
};

export function AdminQuestionsContent({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionData | null>(null);
  const [form, setForm] = useState({
    type: "multiple_choice" as "multiple_choice" | "true_false" | "essay",
    content: "",
    optionA: "", optionB: "", optionC: "", optionD: "",
    correctAnswer: "",
    points: "1",
  });

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/questions?assignmentId=${assignmentId}`);
      const data = await res.json() as { questions: QuestionData[] };
      setQuestions(data.questions || []);
    } catch { toast.error("Gagal memuat soal"); }
    setLoading(false);
  }, [assignmentId]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  function openCreate() {
    setEditing(null);
    setForm({ type: "multiple_choice", content: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "", points: "1" });
    setDialogOpen(true);
  }

  function openEdit(q: QuestionData) {
    setEditing(q);
    let optionA = "", optionB = "", optionC = "", optionD = "";
    if (q.options) {
      try {
        const opts = JSON.parse(q.options) as string[];
        optionA = opts[0] || ""; optionB = opts[1] || ""; optionC = opts[2] || ""; optionD = opts[3] || "";
      } catch { /* ignore */ }
    }
    setForm({
      type: q.type, content: q.content,
      optionA, optionB, optionC, optionD,
      correctAnswer: q.correctAnswer || "", points: String(q.points),
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const options = form.type === "multiple_choice"
      ? JSON.stringify([form.optionA, form.optionB, form.optionC, form.optionD])
      : form.type === "true_false" ? JSON.stringify(["Benar", "Salah"]) : null;

    const body = {
      assignmentId,
      orderNumber: editing ? editing.orderNumber : questions.length + 1,
      type: form.type, content: form.content, options,
      correctAnswer: form.type === "essay" ? null : form.correctAnswer,
      points: parseFloat(form.points) || 1,
    };

    try {
      const url = editing ? `/api/questions/${editing.id}` : "/api/questions";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json() as { error: string }; throw new Error(err.error); }
      toast.success(editing ? "Soal diperbarui" : "Soal ditambahkan");
      setDialogOpen(false);
      fetchQuestions();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Gagal menyimpan soal"); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus soal ini?")) return;
    try {
      await fetch(`/api/questions/${id}`, { method: "DELETE" });
      toast.success("Soal dihapus");
      fetchQuestions();
    } catch { toast.error("Gagal menghapus"); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/admin/assignments")} className="cursor-pointer">
              <ChevronLeft size={16} />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Kelola Soal</h1>
              <p className="text-muted-foreground">{questions.length} soal dalam penugasan ini</p>
            </div>
          </div>
          <Button onClick={openCreate} className="btn-theme-gradient cursor-pointer">
            <Plus size={16} className="mr-2" /> Tambah Soal
          </Button>
        </div>
      </FadeIn>

      {questions.length === 0 ? (
        <FadeIn delay={0.1}>
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p>Belum ada soal. Klik &quot;Tambah Soal&quot; untuk mulai.</p>
          </CardContent></Card>
        </FadeIn>
      ) : (
        <StaggerContainer className="space-y-3">
          {questions.map((q) => (
            <StaggerItem key={q.id}>
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">{q.orderNumber}</Badge>
                        <Badge className="text-xs bg-purple-100 text-purple-800">{typeLabel[q.type]}</Badge>
                        <span className="text-xs text-muted-foreground">({q.points} poin)</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{q.content}</p>
                      {q.options && (
                        <div className="mt-2 space-y-1">
                          {(JSON.parse(q.options) as string[]).map((opt, idx) => (
                            <div key={idx} className={`text-sm px-2 py-1 rounded ${q.correctAnswer === String.fromCharCode(65 + idx) ? "bg-green-50 text-green-700 font-medium" : "text-muted-foreground"}`}>
                              {String.fromCharCode(65 + idx)}. {opt}
                            </div>
                          ))}
                        </div>
                      )}
                      {q.type === "true_false" && q.correctAnswer && (
                        <p className="mt-1 text-sm text-green-600 font-medium">Jawaban: {q.correctAnswer === "true" ? "Benar" : "Salah"}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(q)} className="cursor-pointer"><Edit2 size={14} /></Button>
                      <Button size="sm" variant="ghost" className="text-red-600 cursor-pointer" onClick={() => handleDelete(q.id)}><Trash2 size={14} /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Soal" : "Tambah Soal Baru"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipe Soal</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: (v ?? "multiple_choice") as "multiple_choice" | "true_false" | "essay" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Pilihan Ganda</SelectItem>
                    <SelectItem value="true_false">Benar/Salah</SelectItem>
                    <SelectItem value="essay">Esai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bobot Poin</Label>
                <Input type="number" min="0.5" step="0.5" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pertanyaan</Label>
              <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Tuliskan pertanyaan di sini..." rows={4} required />
            </div>
            {form.type === "multiple_choice" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {(["A", "B", "C", "D"] as const).map((letter) => {
                    const key = `option${letter}` as "optionA" | "optionB" | "optionC" | "optionD";
                    return (
                      <div key={letter} className="space-y-1">
                        <Label className="text-sm">Opsi {letter}</Label>
                        <Input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={`Jawaban ${letter}`} required />
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  <Label>Jawaban Benar</Label>
                  <Select value={form.correctAnswer} onValueChange={(v) => setForm({ ...form, correctAnswer: v ?? "" })}>
                    <SelectTrigger><SelectValue placeholder="Pilih jawaban benar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem><SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem><SelectItem value="D">D</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {form.type === "true_false" && (
              <div className="space-y-2">
                <Label>Jawaban Benar</Label>
                <Select value={form.correctAnswer} onValueChange={(v) => setForm({ ...form, correctAnswer: v ?? "" })}>
                  <SelectTrigger><SelectValue placeholder="Pilih jawaban" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Benar</SelectItem><SelectItem value="false">Salah</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" className="w-full btn-theme-gradient cursor-pointer">
              {editing ? "Perbarui Soal" : "Simpan Soal"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

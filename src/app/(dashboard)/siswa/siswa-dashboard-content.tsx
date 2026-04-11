"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/shared/motion-wrapper";
import { toast } from "sonner";
import { Clock, BookOpen, KeyRound, CheckCircle2, Loader2 } from "lucide-react";

interface ScheduleData {
  id: string;
  examEventName: string;
  subjectName: string;
  subjectCode: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  isActive: boolean;
  sessionStatus: string | null;
  sessionId: string | null;
  essayUngraded: number;
  totalScore: number | null;
}

export function SiswaDashboardContent() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<ScheduleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokenDialog, setTokenDialog] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleData | null>(null);
  const [token, setToken] = useState("");
  const [starting, setStarting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/exam/active");
      const data = await res.json() as { schedules: ScheduleData[] };
      setSchedules(data.schedules || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openTokenDialog(schedule: ScheduleData) {
    setSelectedSchedule(schedule);
    setToken("");
    setTokenDialog(true);
  }

  async function handleStartExam() {
    if (!selectedSchedule || !token.trim()) {
      toast.error("Masukkan token ujian");
      return;
    }

    setStarting(true);
    try {
      const res = await fetch("/api/exam/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: selectedSchedule.id, token: token.trim() }),
      });
      const data = await res.json() as { error?: string; sessionId: string; timeRemaining: number; resumed: boolean };
      if (!res.ok) {
        toast.error(data.error || "Gagal memulai ujian");
        setStarting(false);
        return;
      }

      toast.success(data.resumed ? "Melanjutkan ujian..." : "Ujian dimulai!");
      setTokenDialog(false);
      router.push(`/siswa/exam?sessionId=${data.sessionId}`);
    } catch {
      toast.error("Gagal memulai ujian");
      setStarting(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  const activeSchedules = schedules.filter((s) => !s.sessionStatus || s.sessionStatus === "in_progress");
  const completedSchedules = schedules.filter((s) => s.sessionStatus === "submitted" || s.sessionStatus === "auto_submitted");

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-bold">Dashboard Siswa</h1>
        <p className="text-muted-foreground">CBT MTsN 3 Kota Tasikmalaya</p>
      </FadeIn>

      {/* Active exams */}
      <FadeIn delay={0.1}>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock size={20} className="text-blue-600" /> Ujian Aktif
        </h2>
      </FadeIn>

      {activeSchedules.length === 0 ? (
        <FadeIn delay={0.2}>
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
            <p>Tidak ada ujian aktif saat ini.</p>
          </CardContent></Card>
        </FadeIn>
      ) : (
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeSchedules.map((s) => (
            <StaggerItem key={s.id}>
              <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{s.subjectName}</CardTitle>
                    {s.sessionStatus === "in_progress" && (
                      <Badge className="bg-yellow-100 text-yellow-800">Sedang Dikerjakan</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    <p>Event: <span className="text-foreground font-medium">{s.examEventName}</span></p>
                    <p>Kelas: <span className="text-foreground font-medium">{s.className}</span></p>
                    <p>Waktu: <span className="text-foreground font-medium">{s.startTime} - {s.endTime}</span></p>
                    <p>Durasi: <span className="text-foreground font-medium">{s.durationMinutes} menit</span></p>
                  </div>
                  <Button
                    onClick={() => {
                      if (s.sessionStatus === "in_progress" && s.sessionId) {
                        router.push(`/siswa/exam?sessionId=${s.sessionId}`);
                      } else {
                        openTokenDialog(s);
                      }
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 cursor-pointer"
                  >
                    <KeyRound size={16} className="mr-2" />
                    {s.sessionStatus === "in_progress" ? "Lanjutkan Ujian" : "Masukkan Token"}
                  </Button>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {/* Completed exams */}
      {completedSchedules.length > 0 && (
        <>
          <FadeIn delay={0.3}>
            <h2 className="text-lg font-semibold flex items-center gap-2 mt-6">
              <CheckCircle2 size={20} className="text-green-600" /> Ujian Selesai
            </h2>
          </FadeIn>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedSchedules.map((s) => {
              const isPending = s.essayUngraded > 0;
              return (
                <StaggerItem key={s.id}>
                  <Card className={`border-l-4 ${isPending ? "border-l-yellow-500" : "border-l-green-500"}`}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{s.subjectName}</p>
                          <p className="text-sm text-muted-foreground">{s.examEventName}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {isPending ? (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              <Loader2 size={12} className="mr-1 animate-spin" />
                              Menunggu Penilaian
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle2 size={12} className="mr-1" />
                              Selesai
                            </Badge>
                          )}
                          {isPending ? (
                            <p className="text-xs text-yellow-600">
                              {s.essayUngraded} soal essay belum dinilai guru
                            </p>
                          ) : s.totalScore !== null ? (
                            <p className="text-lg font-bold text-green-600">{s.totalScore}</p>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </>
      )}

      {/* Token Dialog */}
      <Dialog open={tokenDialog} onOpenChange={setTokenDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Masukkan Token Ujian</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {selectedSchedule && (
              <div className="bg-blue-50 p-3 rounded-lg text-sm">
                <p className="font-semibold">{selectedSchedule.subjectName}</p>
                <p className="text-muted-foreground">{selectedSchedule.examEventName} — {selectedSchedule.durationMinutes} menit</p>
              </div>
            )}
            <div className="space-y-2">
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                placeholder="Masukkan token 6 karakter"
                maxLength={6}
                className="text-center text-2xl font-mono tracking-widest h-14"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleStartExam(); }}
              />
            </div>
            <Button
              onClick={handleStartExam}
              disabled={starting || token.length < 6}
              className="w-full bg-blue-600 hover:bg-blue-700 cursor-pointer"
            >
              {starting ? "Memulai..." : "Mulai Ujian"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

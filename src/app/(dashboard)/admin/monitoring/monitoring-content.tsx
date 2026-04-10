"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FadeIn } from "@/components/shared/motion-wrapper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Monitor, Users, CheckCircle2, AlertTriangle, Clock, Eye,
  ArrowLeft, RefreshCw, Send, Wifi, WifiOff,
} from "lucide-react";

interface ActiveSchedule {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  token: string | null;
  isActive: boolean;
  subjectName: string;
  className: string;
  proctorName: string | null;
  totalSessions: number;
  inProgress: number;
  submitted: number;
}

interface SessionDetail {
  sessionId: string;
  studentId: string;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  violationCount: number;
  timeRemaining: number | null;
  studentName: string;
  nis: string;
  totalQuestions: number;
  answeredQuestions: number;
  recentViolations: { type: string; timestamp: string }[];
}

export function MonitoringPageContent() {
  const [schedules, setSchedules] = useState<ActiveSchedule[]>([]);
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<ActiveSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forceSubmitDialog, setForceSubmitDialog] = useState<SessionDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/monitoring");
      if (!res.ok) throw new Error();
      const data = await res.json() as ActiveSchedule[];
      setSchedules(data);
    } catch {
      toast.error("Gagal memuat data monitoring");
    }
    setLoading(false);
  }, []);

  const fetchSessions = useCallback(async (scheduleId: string, silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch(`/api/monitoring?scheduleId=${scheduleId}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as SessionDetail[];
      setSessions(data);
    } catch {
      if (!silent) toast.error("Gagal memuat sesi ujian");
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Auto-refresh every 10 seconds when viewing sessions
  useEffect(() => {
    if (selectedSchedule) {
      fetchSessions(selectedSchedule.id);
      intervalRef.current = setInterval(() => {
        fetchSessions(selectedSchedule.id, true);
      }, 10000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedSchedule, fetchSessions]);

  const handleForceSubmit = async () => {
    if (!forceSubmitDialog) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/monitoring/force-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: forceSubmitDialog.sessionId }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
      toast.success(`Ujian ${forceSubmitDialog.studentName} berhasil di-submit paksa`);
      setForceSubmitDialog(null);
      if (selectedSchedule) fetchSessions(selectedSchedule.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal force submit");
    }
    setSubmitting(false);
  };

  const handleBack = () => {
    setSelectedSchedule(null);
    setSessions([]);
    fetchSchedules();
  };

  const formatTime = (seconds: number | null) => {
    if (seconds === null || seconds <= 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><Clock className="w-3 h-3 mr-1" />Mengerjakan</Badge>;
      case "submitted":
        return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />Selesai</Badge>;
      case "auto_submitted":
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200"><Send className="w-3 h-3 mr-1" />Auto Submit</Badge>;
      case "violation":
        return <Badge className="bg-red-100 text-red-700 border-red-200"><AlertTriangle className="w-3 h-3 mr-1" />Pelanggaran</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // --- Schedule List View ---
  if (!selectedSchedule) {
    return (
      <FadeIn>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Monitoring CBT</h1>
              <p className="text-sm text-gray-500 mt-1">Pantau ujian yang sedang berlangsung secara real-time</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchSchedules(); }}>
              <RefreshCw className="w-4 h-4 mr-2" />Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
            </div>
          ) : schedules.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <WifiOff className="w-12 h-12 text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">Tidak ada ujian aktif saat ini</p>
                <p className="text-sm text-gray-400 mt-1">Aktifkan jadwal ujian di menu Jadwal CBT</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {schedules.map((sch, i) => (
                  <motion.div
                    key={sch.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.08 }}
                  >
                    <Card
                      className="cursor-pointer hover:shadow-lg hover:border-emerald-300 transition-all duration-200 group"
                      onClick={() => setSelectedSchedule(sch)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base group-hover:text-emerald-700 transition-colors">
                              {sch.subjectName}
                            </CardTitle>
                            <p className="text-sm text-gray-500 mt-1">{sch.className}</p>
                          </div>
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                            <Wifi className="w-3 h-3 mr-1" />Aktif
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center text-sm text-gray-600">
                            <Clock className="w-4 h-4 mr-2 text-gray-400" />
                            {sch.date} &middot; {sch.startTime} - {sch.endTime}
                          </div>
                          {sch.proctorName && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Eye className="w-4 h-4 mr-2 text-gray-400" />
                              {sch.proctorName}
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                            <div className="text-center">
                              <p className="text-lg font-bold text-gray-900">{sch.totalSessions}</p>
                              <p className="text-xs text-gray-500">Total</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-blue-600">{sch.inProgress}</p>
                              <p className="text-xs text-gray-500">Aktif</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-green-600">{sch.submitted}</p>
                              <p className="text-xs text-gray-500">Selesai</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </FadeIn>
    );
  }

  // --- Session Detail View ---
  const inProgressCount = sessions.filter((s) => s.status === "in_progress").length;
  const submittedCount = sessions.filter((s) => s.status !== "in_progress").length;
  const highViolation = sessions.filter((s) => s.violationCount >= 3).length;

  return (
    <FadeIn>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedSchedule.subjectName} — {selectedSchedule.className}
              </h1>
              <p className="text-sm text-gray-500">
                {selectedSchedule.date} &middot; {selectedSchedule.startTime} - {selectedSchedule.endTime}
                {selectedSchedule.proctorName && ` &middot; Pengawas: ${selectedSchedule.proctorName}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm text-emerald-600">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Auto-refresh 10s
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={refreshing}
              onClick={() => fetchSessions(selectedSchedule.id)}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100"><Users className="w-5 h-5 text-gray-600" /></div>
              <div>
                <p className="text-2xl font-bold">{sessions.length}</p>
                <p className="text-xs text-gray-500">Total Peserta</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><Monitor className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{inProgressCount}</p>
                <p className="text-xs text-gray-500">Sedang Mengerjakan</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-2xl font-bold text-green-600">{submittedCount}</p>
                <p className="text-xs text-gray-500">Sudah Selesai</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-2xl font-bold text-red-600">{highViolation}</p>
                <p className="text-xs text-gray-500">Pelanggaran Tinggi</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Student Sessions Table */}
        {sessions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Users className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">Belum ada siswa yang memulai ujian</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50/80">
                      <th className="text-left p-3 font-medium text-gray-600">No</th>
                      <th className="text-left p-3 font-medium text-gray-600">NIS</th>
                      <th className="text-left p-3 font-medium text-gray-600">Nama Siswa</th>
                      <th className="text-center p-3 font-medium text-gray-600">Status</th>
                      <th className="text-center p-3 font-medium text-gray-600">Progress</th>
                      <th className="text-center p-3 font-medium text-gray-600">Sisa Waktu</th>
                      <th className="text-center p-3 font-medium text-gray-600">Pelanggaran</th>
                      <th className="text-center p-3 font-medium text-gray-600">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {sessions.map((s, i) => {
                        const progressPct = s.totalQuestions > 0
                          ? Math.round((s.answeredQuestions / s.totalQuestions) * 100)
                          : 0;
                        return (
                          <motion.tr
                            key={s.sessionId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: i * 0.03 }}
                            className={`border-b hover:bg-gray-50/50 transition-colors ${
                              s.violationCount >= 3 ? "bg-red-50/30" : ""
                            }`}
                          >
                            <td className="p-3 text-gray-500">{i + 1}</td>
                            <td className="p-3 font-mono text-gray-600">{s.nis}</td>
                            <td className="p-3 font-medium text-gray-900">{s.studentName}</td>
                            <td className="p-3 text-center">{getStatusBadge(s.status)}</td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      progressPct === 100 ? "bg-green-500" : "bg-blue-500"
                                    }`}
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                  {s.answeredQuestions}/{s.totalQuestions}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              {s.status === "in_progress" ? (
                                <span className={`font-mono text-sm font-bold ${
                                  (s.timeRemaining ?? 0) <= 300 ? "text-red-600" :
                                  (s.timeRemaining ?? 0) <= 600 ? "text-yellow-600" : "text-gray-700"
                                }`}>
                                  {formatTime(s.timeRemaining)}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {s.violationCount > 0 ? (
                                <Badge
                                  className={`${
                                    s.violationCount >= 3
                                      ? "bg-red-100 text-red-700 border-red-200"
                                      : "bg-yellow-100 text-yellow-700 border-yellow-200"
                                  }`}
                                  title={s.recentViolations.map((v) => v.type).join(", ")}
                                >
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  {s.violationCount}x
                                </Badge>
                              ) : (
                                <span className="text-gray-400">0</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {s.status === "in_progress" && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setForceSubmitDialog(s)}
                                >
                                  <Send className="w-3 h-3 mr-1" />
                                  Paksa Submit
                                </Button>
                              )}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Force Submit Confirmation Dialog */}
        <Dialog open={!!forceSubmitDialog} onOpenChange={() => setForceSubmitDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                Konfirmasi Paksa Submit
              </DialogTitle>
            </DialogHeader>
            {forceSubmitDialog && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Apakah Anda yakin ingin memaksa submit ujian siswa berikut?
                </p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  <p className="font-medium">{forceSubmitDialog.studentName}</p>
                  <p className="text-sm text-gray-500">NIS: {forceSubmitDialog.nis}</p>
                  <p className="text-sm text-gray-500">
                    Progress: {forceSubmitDialog.answeredQuestions}/{forceSubmitDialog.totalQuestions} soal dijawab
                  </p>
                  <p className="text-sm text-gray-500">
                    Pelanggaran: {forceSubmitDialog.violationCount}x
                  </p>
                </div>
                <p className="text-xs text-red-500">
                  Tindakan ini tidak dapat dibatalkan. Jawaban siswa akan langsung dikoreksi otomatis untuk soal PG dan Benar/Salah.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setForceSubmitDialog(null)}>Batal</Button>
              <Button variant="destructive" disabled={submitting} onClick={handleForceSubmit}>
                {submitting ? "Memproses..." : "Ya, Paksa Submit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </FadeIn>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FadeIn } from "@/components/shared/motion-wrapper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BarChart3, Search, Download, AlertCircle, CheckCircle2 } from "lucide-react";

interface SelectOption { id: string; name: string }

interface SessionScore {
  sessionId: string;
  studentId: string;
  status: string;
  violationCount: number;
  studentName: string;
  nis: string;
  rawScore: number;
  maxScore: number;
  totalScore: number;
  totalAnswered: number;
  totalQuestions: number;
  essayUngraded: number;
}

interface ScheduleRecap {
  scheduleId: string;
  subjectName: string;
  className: string;
  date: string;
  sessions: SessionScore[];
}

export function GradeRecapContent() {
  const [examEvents, setExamEvents] = useState<SelectOption[]>([]);
  const [subjects, setSubjects] = useState<SelectOption[]>([]);
  const [classes, setClasses] = useState<SelectOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [recapData, setRecapData] = useState<ScheduleRecap[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchOptions() {
      try {
        const [evRes, sRes, cRes] = await Promise.all([
          fetch("/api/exam-events"), fetch("/api/subjects"), fetch("/api/classes"),
        ]);
        const [evData, sData, cData] = await Promise.all([evRes.json(), sRes.json(), cRes.json()]) as [Record<string, unknown>, Record<string, unknown>, Record<string, unknown>];
        setExamEvents(((evData.events || []) as SelectOption[]));
        setSubjects(((sData.subjects || []) as SelectOption[]));
        setClasses(((cData.classes || []) as SelectOption[]));
      } catch {
        toast.error("Gagal memuat data");
      }
    }
    fetchOptions();
  }, []);

  const handleSearch = async () => {
    if (!selectedEvent) {
      toast.error("Pilih event ujian terlebih dahulu");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ examEventId: selectedEvent });
      if (selectedSubject) params.set("subjectId", selectedSubject);
      if (selectedClass) params.set("classId", selectedClass);

      const res = await fetch(`/api/grade-recap?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as ScheduleRecap[];
      setRecapData(data);
      if (data.length === 0) toast.info("Tidak ada data untuk filter ini");
    } catch {
      toast.error("Gagal memuat rekap nilai");
    }
    setLoading(false);
  };

  const exportCSV = () => {
    if (recapData.length === 0) return;
    const rows: string[] = ["No,NIS,Nama Siswa,Mapel,Kelas,Nilai Mentah,Status,Soal Dijawab,Essay Belum Dinilai"];
    let no = 1;
    for (const sch of recapData) {
      for (const s of sch.sessions) {
        rows.push(`${no},${s.nis},"${s.studentName}",${sch.subjectName},${sch.className},${s.rawScore},${s.status},${s.totalAnswered}/${s.totalQuestions},${s.essayUngraded}`);
        no++;
      }
    }
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rekap-nilai-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("File CSV berhasil diunduh");
  };

  return (
    <FadeIn>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rekap Nilai</h1>
            <p className="text-sm text-gray-500 mt-1">Lihat hasil nilai ujian siswa per event/mapel/kelas</p>
          </div>
          {recapData.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-2" />Export CSV
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label>Event Ujian *</Label>
                <Select value={selectedEvent} onValueChange={(v) => setSelectedEvent(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Pilih event" /></SelectTrigger>
                  <SelectContent>
                    {examEvents.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mata Pelajaran</Label>
                <Select value={selectedSubject} onValueChange={(v) => setSelectedSubject(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Semua mapel" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kelas</Label>
                <Select value={selectedClass} onValueChange={(v) => setSelectedClass(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Semua kelas" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSearch} disabled={loading}>
                <Search className="w-4 h-4 mr-2" />
                {loading ? "Memuat..." : "Cari"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <AnimatePresence>
          {recapData.map((sch, idx) => (
            <motion.div
              key={sch.scheduleId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.1 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-600" />
                      {sch.subjectName} — {sch.className}
                    </CardTitle>
                    <Badge variant="secondary">{sch.date}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50/80">
                          <th className="text-left p-3 font-medium text-gray-600">No</th>
                          <th className="text-left p-3 font-medium text-gray-600">NIS</th>
                          <th className="text-left p-3 font-medium text-gray-600">Nama</th>
                          <th className="text-center p-3 font-medium text-gray-600">Nilai</th>
                          <th className="text-center p-3 font-medium text-gray-600">Jawaban</th>
                          <th className="text-center p-3 font-medium text-gray-600">Status</th>
                          <th className="text-center p-3 font-medium text-gray-600">Pelanggaran</th>
                          <th className="text-center p-3 font-medium text-gray-600">Essay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sch.sessions.map((s, i) => (
                          <motion.tr
                            key={s.sessionId}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.03 }}
                            className="border-b hover:bg-gray-50/50"
                          >
                            <td className="p-3 text-gray-500">{i + 1}</td>
                            <td className="p-3 font-mono text-gray-600">{s.nis}</td>
                            <td className="p-3 font-medium">{s.studentName}</td>
                            <td className="p-3 text-center">
                              <span className={`font-bold text-lg ${
                                s.rawScore >= 75 ? "text-green-600" :
                                s.rawScore >= 50 ? "text-yellow-600" : "text-red-600"
                              }`}>
                                {s.rawScore}
                              </span>
                            </td>
                            <td className="p-3 text-center text-gray-600">
                              {s.totalAnswered}/{s.totalQuestions}
                            </td>
                            <td className="p-3 text-center">
                              <Badge className={
                                s.status === "submitted"
                                  ? "bg-green-100 text-green-700 border-green-200"
                                  : "bg-orange-100 text-orange-700 border-orange-200"
                              }>
                                {s.status === "submitted" ? "Submit" : "Auto"}
                              </Badge>
                            </td>
                            <td className="p-3 text-center">
                              {s.violationCount > 0 ? (
                                <Badge className="bg-red-100 text-red-700 border-red-200">
                                  {s.violationCount}x
                                </Badge>
                              ) : (
                                <span className="text-gray-400">0</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {s.essayUngraded > 0 ? (
                                <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  {s.essayUngraded} belum
                                </Badge>
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                              )}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Summary */}
                  {sch.sessions.length > 0 && (
                    <div className="border-t bg-gray-50/50 px-3 py-2 flex items-center gap-6 text-sm text-gray-600">
                      <span>Peserta: <b>{sch.sessions.length}</b></span>
                      <span>Rata-rata: <b className="text-emerald-600">
                        {(sch.sessions.reduce((a, b) => a + b.rawScore, 0) / sch.sessions.length).toFixed(1)}
                      </b></span>
                      <span>Tertinggi: <b className="text-green-600">
                        {Math.max(...sch.sessions.map((s) => s.rawScore))}
                      </b></span>
                      <span>Terendah: <b className="text-red-600">
                        {Math.min(...sch.sessions.map((s) => s.rawScore))}
                      </b></span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </FadeIn>
  );
}

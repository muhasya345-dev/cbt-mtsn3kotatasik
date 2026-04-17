"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FadeIn } from "@/components/shared/motion-wrapper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calculator, Save, Search, TrendingUp } from "lucide-react";

interface SelectOption { id: string; name: string }

interface GradeRow {
  studentId: string;
  studentName: string;
  nis: string;
  rawScore: number | null;
  scaledScore: number | null;
  dailyGrade: number | null;
  finalGrade: number | null;
}

export function GradeProcessingContent() {
  const [examEvents, setExamEvents] = useState<SelectOption[]>([]);
  const [subjects, setSubjects] = useState<SelectOption[]>([]);
  const [classes, setClasses] = useState<SelectOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [gradeRows, setGradeRows] = useState<GradeRow[]>([]);
  const [dailyGrades, setDailyGrades] = useState<Record<string, string>>({});
  const [scalingTarget, setScalingTarget] = useState("75");
  const [dailyWeight, setDailyWeight] = useState("0.5");
  const [examWeight, setExamWeight] = useState("0.5");
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [hasData, setHasData] = useState(false);

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

  // Auto-adjust exam weight when daily weight changes
  const handleDailyWeightChange = (val: string) => {
    setDailyWeight(val);
    const dw = parseFloat(val);
    if (!isNaN(dw) && dw >= 0 && dw <= 1) {
      setExamWeight((1 - dw).toFixed(2));
    }
  };

  const handleSearch = async () => {
    if (!selectedEvent || !selectedSubject || !selectedClass) {
      toast.error("Pilih event, mapel, dan kelas");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        examEventId: selectedEvent,
        subjectId: selectedSubject,
        classId: selectedClass,
      });

      // First try existing grades
      const gradeRes = await fetch(`/api/grade-processing?${params}`);
      const existingGrades = await gradeRes.json() as GradeRow[];

      if (existingGrades.length > 0) {
        setGradeRows(existingGrades);
        const dg: Record<string, string> = {};
        for (const g of existingGrades) {
          if (g.dailyGrade !== null) dg[g.studentId] = String(g.dailyGrade);
        }
        setDailyGrades(dg);
        setHasData(true);
        toast.success(`${existingGrades.length} data nilai ditemukan`);
      } else {
        // Fetch from recap (raw scores)
        const recapRes = await fetch(`/api/grade-recap?${params}`);
        const recapData = await recapRes.json() as Array<{
          sessions: Array<{
            studentId: string;
            studentName: string;
            nis: string;
            rawScore: number;
          }>;
        }>;

        const rows: GradeRow[] = [];
        for (const sch of recapData) {
          for (const s of sch.sessions) {
            rows.push({
              studentId: s.studentId,
              studentName: s.studentName,
              nis: s.nis,
              rawScore: s.rawScore,
              scaledScore: null,
              dailyGrade: null,
              finalGrade: null,
            });
          }
        }
        setGradeRows(rows);
        setDailyGrades({});
        setHasData(rows.length > 0);
        if (rows.length === 0) toast.info("Belum ada siswa yang mengikuti ujian ini");
        else toast.success(`${rows.length} siswa ditemukan`);
      }
    } catch {
      toast.error("Gagal memuat data");
    }
    setLoading(false);
  };

  const handleProcess = async () => {
    if (!selectedEvent || !selectedSubject || !selectedClass) return;
    setProcessing(true);
    try {
      const dg: Record<string, number> = {};
      for (const [sid, val] of Object.entries(dailyGrades)) {
        const num = parseFloat(val);
        if (!isNaN(num)) dg[sid] = num;
      }

      const res = await fetch("/api/grade-processing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examEventId: selectedEvent,
          subjectId: selectedSubject,
          classId: selectedClass,
          scalingTarget: parseFloat(scalingTarget) || undefined,
          dailyWeight: parseFloat(dailyWeight),
          examWeight: parseFloat(examWeight),
          dailyGrades: dg,
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }

      toast.success("Nilai berhasil diproses!");
      // Re-fetch to show updated values
      handleSearch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memproses nilai");
    }
    setProcessing(false);
  };

  return (
    <FadeIn>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Olah Nilai</h1>
          <p className="text-sm text-gray-500 mt-1">Proses scaling, bobot nilai harian & ujian, hitung nilai akhir</p>
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
                <Label>Mata Pelajaran *</Label>
                <Select value={selectedSubject} onValueChange={(v) => setSelectedSubject(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Pilih mapel" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kelas *</Label>
                <Select value={selectedClass} onValueChange={(v) => setSelectedClass(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSearch} disabled={loading}>
                <Search className="w-4 h-4 mr-2" />
                {loading ? "Memuat..." : "Cari Data"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Processing Settings */}
        {hasData && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-blue-600" />
                  Pengaturan Olah Nilai
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Target Scaling (KKM)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={scalingTarget}
                      onChange={(e) => setScalingTarget(e.target.value)}
                      placeholder="75"
                    />
                    <p className="text-xs text-gray-400">Nilai tertinggi akan di-scale ke target ini</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Bobot Harian</Label>
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={dailyWeight}
                      onChange={(e) => handleDailyWeightChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bobot Ujian</Label>
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={examWeight}
                      onChange={(e) => setExamWeight(e.target.value)}
                      disabled
                    />
                  </div>
                  <Button onClick={handleProcess} disabled={processing} className="bg-emerald-600 hover:bg-emerald-700">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    {processing ? "Memproses..." : "Proses Nilai"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Grade Table */}
        {hasData && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50/80">
                        <th className="text-left p-3 font-medium text-gray-600">No</th>
                        <th className="text-left p-3 font-medium text-gray-600">NIS</th>
                        <th className="text-left p-3 font-medium text-gray-600">Nama</th>
                        <th className="text-center p-3 font-medium text-gray-600">Nilai Mentah</th>
                        <th className="text-center p-3 font-medium text-gray-600">Nilai Scaling</th>
                        <th className="text-center p-3 font-medium text-gray-600 w-32">Nilai Harian</th>
                        <th className="text-center p-3 font-medium text-gray-600">Nilai Akhir</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {gradeRows.map((g, i) => (
                          <motion.tr
                            key={g.studentId}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.02 }}
                            className="border-b hover:bg-gray-50/50"
                          >
                            <td className="p-3 text-gray-500">{i + 1}</td>
                            <td className="p-3 font-mono text-gray-600">{g.nis}</td>
                            <td className="p-3 font-medium">{g.studentName}</td>
                            <td className="p-3 text-center">
                              <span className={`font-semibold ${
                                (g.rawScore ?? 0) >= 75 ? "text-green-600" : "text-red-600"
                              }`}>
                                {g.rawScore ?? "—"}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {g.scaledScore !== null ? (
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                                  {g.scaledScore}
                                </Badge>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                className="w-20 mx-auto text-center h-8"
                                value={dailyGrades[g.studentId] ?? ""}
                                onChange={(e) =>
                                  setDailyGrades((prev) => ({ ...prev, [g.studentId]: e.target.value }))
                                }
                                placeholder="—"
                              />
                            </td>
                            <td className="p-3 text-center">
                              {g.finalGrade !== null ? (
                                <span className={`text-lg font-bold ${
                                  g.finalGrade >= 75 ? "text-green-600" :
                                  g.finalGrade >= 50 ? "text-yellow-600" : "text-red-600"
                                }`}>
                                  {g.finalGrade}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
                {/* Stats */}
                {gradeRows.some((g) => g.finalGrade !== null) && (
                  <div className="border-t bg-gray-50/50 px-3 py-2 flex items-center gap-6 text-sm text-gray-600">
                    <span>Peserta: <b>{gradeRows.length}</b></span>
                    <span>Rata-rata Akhir: <b className="text-emerald-600">
                      {(gradeRows.filter((g) => g.finalGrade !== null)
                        .reduce((a, b) => a + (b.finalGrade ?? 0), 0) /
                        gradeRows.filter((g) => g.finalGrade !== null).length).toFixed(1)}
                    </b></span>
                    <span>Tuntas (≥75): <b className="text-green-600">
                      {gradeRows.filter((g) => (g.finalGrade ?? 0) >= 75).length}
                    </b></span>
                    <span>Belum Tuntas: <b className="text-red-600">
                      {gradeRows.filter((g) => g.finalGrade !== null && g.finalGrade < 75).length}
                    </b></span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </FadeIn>
  );
}

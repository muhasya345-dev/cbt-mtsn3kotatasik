"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FadeIn } from "@/components/shared/motion-wrapper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  FileCheck, ArrowLeft, CheckCircle2, Clock, AlertCircle,
  ChevronRight, Send, User,
} from "lucide-react";

interface EssayAnswer {
  answerId: string;
  answerContent: string | null;
  score: number | null;
  isCorrect: boolean | null;
  questionId: string;
  questionContent: string;
  questionPoints: number;
  orderNumber: number;
  sessionId: string;
  studentName: string;
  nis: string;
  sessionStatus: string;
}

interface AssignmentGroup {
  assignmentId: string;
  subjectName: string;
  className: string;
  examEventName: string;
  totalEssayAnswers: number;
  ungradedCount: number;
  gradedCount: number;
  answers: EssayAnswer[];
}

export function EssayGradingContent() {
  const [groups, setGroups] = useState<AssignmentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<AssignmentGroup | null>(null);
  const [gradingAnswer, setGradingAnswer] = useState<EssayAnswer | null>(null);
  const [scoreInput, setScoreInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/essay-grading");
      if (!res.ok) throw new Error();
      const data = await res.json() as AssignmentGroup[];
      setGroups(data);

      // Refresh selected group if exists
      if (selectedGroup) {
        const updated = data.find((g) => g.assignmentId === selectedGroup.assignmentId);
        if (updated) setSelectedGroup(updated);
      }
    } catch {
      toast.error("Gagal memuat data penilaian essay");
    }
    setLoading(false);
  }, [selectedGroup]);

  useEffect(() => { fetchData(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenGrading = (answer: EssayAnswer) => {
    setGradingAnswer(answer);
    setScoreInput(answer.score !== null ? String(answer.score) : "");
  };

  const handleSubmitScore = async () => {
    if (!gradingAnswer) return;
    const score = parseFloat(scoreInput);
    if (isNaN(score) || score < 0) {
      toast.error("Masukkan nilai yang valid (minimal 0)");
      return;
    }
    if (score > gradingAnswer.questionPoints) {
      toast.error(`Nilai maksimal adalah ${gradingAnswer.questionPoints}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/essay-grading", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answerId: gradingAnswer.answerId,
          score,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
      toast.success(`Nilai ${score} berhasil disimpan untuk ${gradingAnswer.studentName}`);
      setGradingAnswer(null);
      setScoreInput("");
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan nilai");
    }
    setSubmitting(false);
  };

  // Parse question content (TipTap JSON or plain text)
  function renderQuestionText(content: string): string {
    try {
      const parsed = JSON.parse(content);
      // Extract text from TipTap JSON
      function extractText(node: Record<string, unknown>): string {
        if (node.text) return node.text as string;
        if (node.content && Array.isArray(node.content)) {
          return (node.content as Record<string, unknown>[]).map(extractText).join("");
        }
        return "";
      }
      return extractText(parsed);
    } catch {
      return content;
    }
  }

  // --- Assignment List View ---
  if (!selectedGroup) {
    return (
      <FadeIn>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Penilaian Essay</h1>
            <p className="text-sm text-gray-500 mt-1">Nilai jawaban essay siswa dari penugasan soal Anda</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
            </div>
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FileCheck className="w-12 h-12 text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">Tidak ada jawaban essay yang perlu dinilai</p>
                <p className="text-sm text-gray-400 mt-1">Jawaban essay akan muncul setelah siswa mengumpulkan ujian</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {groups.map((g, i) => (
                  <motion.div
                    key={g.assignmentId}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.08 }}
                  >
                    <Card
                      className="cursor-pointer hover:shadow-lg hover:border-emerald-300 transition-all duration-200 group"
                      onClick={() => setSelectedGroup(g)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">
                                {g.subjectName}
                              </h3>
                              <Badge variant="secondary">{g.className}</Badge>
                            </div>
                            <p className="text-sm text-gray-500">{g.examEventName}</p>
                            <div className="flex items-center gap-4 mt-3">
                              {g.ungradedCount > 0 ? (
                                <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {g.ungradedCount} belum dinilai
                                </Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-700 border-green-200">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Semua sudah dinilai
                                </Badge>
                              )}
                              <span className="text-sm text-gray-500">
                                {g.gradedCount}/{g.totalEssayAnswers} dinilai
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
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

  // --- Detail Grading View ---
  // Group answers by student
  const studentAnswers = selectedGroup.answers.reduce<
    Record<string, { studentName: string; nis: string; answers: EssayAnswer[] }>
  >((acc, ans) => {
    const key = ans.nis;
    if (!acc[key]) {
      acc[key] = { studentName: ans.studentName, nis: ans.nis, answers: [] };
    }
    acc[key].answers.push(ans);
    return acc;
  }, {});

  return (
    <FadeIn>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedGroup(null); fetchData(); }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedGroup.subjectName} — {selectedGroup.className}
            </h1>
            <p className="text-sm text-gray-500">
              {selectedGroup.examEventName} &middot;
              {selectedGroup.ungradedCount > 0
                ? ` ${selectedGroup.ungradedCount} jawaban belum dinilai`
                : " Semua sudah dinilai ✓"}
            </p>
          </div>
        </div>

        {/* Student cards */}
        {Object.entries(studentAnswers).map(([nis, data], idx) => {
          const allGraded = data.answers.every((a) => a.score !== null);
          const ungradedHere = data.answers.filter((a) => a.score === null).length;

          return (
            <motion.div
              key={nis}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className={allGraded ? "border-green-200 bg-green-50/30" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      {data.studentName}
                      <span className="text-gray-400 font-normal">({nis})</span>
                    </CardTitle>
                    {allGraded ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200">
                        <CheckCircle2 className="w-3 h-3 mr-1" />Selesai
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                        <AlertCircle className="w-3 h-3 mr-1" />{ungradedHere} belum
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.answers
                      .sort((a, b) => a.orderNumber - b.orderNumber)
                      .map((ans) => (
                        <div
                          key={ans.answerId}
                          className={`p-3 rounded-lg border ${
                            ans.score !== null
                              ? "bg-white border-green-200"
                              : "bg-yellow-50/50 border-yellow-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-500 mb-1 font-medium">
                                Soal No. {ans.orderNumber} (Maks: {ans.questionPoints} poin)
                              </p>
                              <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                                {renderQuestionText(ans.questionContent)}
                              </p>
                              <div className="bg-gray-50 rounded p-2 border">
                                <p className="text-xs text-gray-500 mb-1">Jawaban Siswa:</p>
                                <p className="text-sm text-gray-900 whitespace-pre-wrap">
                                  {ans.answerContent || <span className="text-gray-400 italic">Tidak dijawab</span>}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {ans.score !== null ? (
                                <div className="text-center">
                                  <span className="text-lg font-bold text-green-600">{ans.score}</span>
                                  <span className="text-xs text-gray-500">/{ans.questionPoints}</span>
                                </div>
                              ) : null}
                              <Button
                                size="sm"
                                variant={ans.score !== null ? "outline" : "default"}
                                onClick={() => handleOpenGrading(ans)}
                              >
                                {ans.score !== null ? "Edit" : "Nilai"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {/* Grading Dialog */}
        <Dialog open={!!gradingAnswer} onOpenChange={() => { setGradingAnswer(null); setScoreInput(""); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                Penilaian Soal Essay
              </DialogTitle>
            </DialogHeader>
            {gradingAnswer && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{gradingAnswer.studentName}</span>
                  <span className="text-gray-400">({gradingAnswer.nis})</span>
                </div>

                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-blue-600 font-medium mb-1">
                    Soal No. {gradingAnswer.orderNumber}
                  </p>
                  <p className="text-sm text-gray-800">
                    {renderQuestionText(gradingAnswer.questionContent)}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 border">
                  <p className="text-xs text-gray-500 font-medium mb-1">Jawaban Siswa:</p>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {gradingAnswer.answerContent || (
                      <span className="text-gray-400 italic">Tidak dijawab</span>
                    )}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span>Nilai</span>
                    <span className="text-xs text-gray-400">Maks: {gradingAnswer.questionPoints} poin</span>
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min="0"
                      max={gradingAnswer.questionPoints}
                      step="0.5"
                      value={scoreInput}
                      onChange={(e) => setScoreInput(e.target.value)}
                      placeholder="0"
                      className="w-28 text-center text-lg font-bold"
                      autoFocus
                    />
                    <span className="text-gray-500">/ {gradingAnswer.questionPoints}</span>
                    {/* Quick buttons */}
                    <div className="flex gap-1 ml-auto">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => setScoreInput("0")}
                      >0</Button>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => setScoreInput(String(gradingAnswer.questionPoints / 2))}
                      >½</Button>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => setScoreInput(String(gradingAnswer.questionPoints))}
                      >Full</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setGradingAnswer(null); setScoreInput(""); }}>
                Batal
              </Button>
              <Button
                onClick={handleSubmitScore}
                disabled={submitting || !scoreInput}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Send className="w-4 h-4 mr-2" />
                {submitting ? "Menyimpan..." : "Simpan Nilai"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </FadeIn>
  );
}

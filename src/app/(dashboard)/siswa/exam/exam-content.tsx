"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Clock, ChevronLeft, ChevronRight, Send, AlertTriangle } from "lucide-react";

interface QuestionItem {
  answerId: string;
  questionId: string;
  orderNumber: number;
  type: "multiple_choice" | "true_false" | "essay";
  content: string;
  options: string | null;
  points: number;
  answerContent: string | null;
}

const typeLabel: Record<string, string> = {
  multiple_choice: "Pilihan Ganda",
  true_false: "Benar/Salah",
  essay: "Esai",
};

export function ExamContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("sessionId") || "";

  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [violationWarning, setViolationWarning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch questions
  const fetchQuestions = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/exam/questions?sessionId=${sessionId}`);
      const data = await res.json() as { questions: QuestionItem[]; timeRemaining: number; status: string; error?: string };
      if (!res.ok) {
        toast.error(data.error || "Gagal memuat soal");
        router.push("/siswa");
        return;
      }
      setQuestions(data.questions || []);
      setTimeRemaining(data.timeRemaining || 0);

      // Initialize local answers
      const ans: Record<string, string> = {};
      for (const q of data.questions || []) {
        ans[q.answerId] = q.answerContent || "";
      }
      setLocalAnswers(ans);
    } catch { toast.error("Gagal memuat soal"); }
    setLoading(false);
  }, [sessionId, router]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  // Timer countdown
  useEffect(() => {
    if (loading || submitted || timeRemaining <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Auto submit
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, submitted]);

  // Anti-cheat: detect tab switch / window blur
  useEffect(() => {
    if (submitted) return;

    function handleVisibilityChange() {
      if (document.hidden && !submitted) {
        logViolation("tab_switch", "Siswa berpindah tab");
        setViolationWarning(true);
        setTimeout(() => setViolationWarning(false), 5000);
      }
    }

    function handleBlur() {
      if (!submitted) {
        logViolation("window_blur", "Jendela kehilangan fokus");
        setViolationWarning(true);
        setTimeout(() => setViolationWarning(false), 5000);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  // Disable right click and copy
  useEffect(() => {
    if (submitted) return;
    function preventContext(e: MouseEvent) { e.preventDefault(); }
    function preventCopy(e: ClipboardEvent) { e.preventDefault(); }
    document.addEventListener("contextmenu", preventContext);
    document.addEventListener("copy", preventCopy);
    return () => {
      document.removeEventListener("contextmenu", preventContext);
      document.removeEventListener("copy", preventCopy);
    };
  }, [submitted]);

  async function logViolation(type: string, details: string) {
    try {
      await fetch("/api/exam/violation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, type, details }),
      });
    } catch { /* ignore */ }
  }

  function selectAnswer(answerId: string, value: string) {
    setLocalAnswers((prev) => ({ ...prev, [answerId]: value }));
    // Debounce save
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => saveAnswer(answerId, value), 500);
  }

  async function saveAnswer(answerId: string, value: string) {
    try {
      await fetch("/api/exam/answer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId, answerContent: value, sessionId, timeRemaining }),
      });
    } catch { /* ignore - will retry on next save */ }
  }

  async function handleSubmit(auto = false) {
    if (submitted) return;
    if (!auto && !confirm("Yakin ingin mengumpulkan jawaban? Tidak bisa diubah setelah dikumpulkan.")) return;

    // Save current answer first
    const current = questions[currentIndex];
    if (current) {
      await saveAnswer(current.answerId, localAnswers[current.answerId] || "");
    }

    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitted(true);

    try {
      await fetch("/api/exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, auto }),
      });
      toast.success(auto ? "Waktu habis! Jawaban otomatis dikumpulkan." : "Jawaban berhasil dikumpulkan!");
    } catch { toast.error("Gagal mengumpulkan jawaban"); }
  }

  // Format time
  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  if (submitted) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-4"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Send size={36} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold">Ujian Selesai!</h2>
          <p className="text-muted-foreground">Jawaban Anda telah berhasil dikumpulkan.</p>
          <Button onClick={() => router.push("/siswa")} className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
            Kembali ke Dashboard
          </Button>
        </motion.div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Tidak ada soal untuk ujian ini.</p>
        <Button onClick={() => router.push("/siswa")} variant="outline" className="mt-4 cursor-pointer">Kembali</Button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const isUrgent = timeRemaining <= 300; // 5 minutes
  const isCritical = timeRemaining <= 60; // 1 minute

  return (
    <div className="space-y-4">
      {/* Violation Warning */}
      <AnimatePresence>
        {violationWarning && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2"
          >
            <AlertTriangle size={20} />
            <span className="font-semibold">Peringatan! Jangan berpindah tab/aplikasi saat ujian.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header: Timer + Progress */}
      <div className="flex items-center justify-between bg-white rounded-lg border p-3 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm">
            Soal {currentIndex + 1} / {questions.length}
          </Badge>
          <Badge className="text-xs bg-purple-100 text-purple-800">{typeLabel[currentQ.type]}</Badge>
        </div>

        <motion.div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-bold ${
            isCritical ? "bg-red-100 text-red-700" : isUrgent ? "bg-yellow-100 text-yellow-700" : "bg-blue-50 text-blue-700"
          }`}
          animate={isCritical ? { scale: [1, 1.05, 1] } : {}}
          transition={isCritical ? { duration: 1, repeat: Infinity } : {}}
        >
          <Clock size={18} />
          {formatTime(timeRemaining)}
        </motion.div>

        <Button
          onClick={() => handleSubmit(false)}
          size="sm"
          className="bg-green-600 hover:bg-green-700 cursor-pointer"
        >
          <Send size={14} className="mr-1" /> Kumpulkan
        </Button>
      </div>

      {/* Question Navigation (number buttons) */}
      <div className="flex flex-wrap gap-2">
        {questions.map((q, i) => {
          const answered = !!localAnswers[q.answerId];
          return (
            <Button
              key={q.answerId}
              size="sm"
              variant={i === currentIndex ? "default" : "outline"}
              className={`w-9 h-9 p-0 cursor-pointer ${
                i === currentIndex
                  ? "bg-blue-600"
                  : answered
                    ? "bg-green-100 border-green-400 text-green-700"
                    : ""
              }`}
              onClick={() => setCurrentIndex(i)}
            >
              {i + 1}
            </Button>
          );
        })}
      </div>

      {/* Question Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQ.answerId}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <CardContent className="py-6">
              <div className="mb-1 text-xs text-muted-foreground">{currentQ.points} poin</div>
              <p className="text-base leading-relaxed whitespace-pre-wrap mb-6">{currentQ.content}</p>

              {/* Multiple Choice */}
              {currentQ.type === "multiple_choice" && currentQ.options && (
                <div className="space-y-2">
                  {(JSON.parse(currentQ.options) as string[]).map((opt, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    const selected = localAnswers[currentQ.answerId] === letter;
                    return (
                      <motion.button
                        key={letter}
                        whileTap={{ scale: 0.98 }}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all cursor-pointer ${
                          selected
                            ? "border-blue-500 bg-blue-50 text-blue-900"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                        onClick={() => selectAnswer(currentQ.answerId, letter)}
                      >
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full mr-3 text-sm font-bold ${
                          selected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                        }`}>
                          {letter}
                        </span>
                        {opt}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* True/False */}
              {currentQ.type === "true_false" && (
                <div className="grid grid-cols-2 gap-3">
                  {["true", "false"].map((val) => {
                    const selected = localAnswers[currentQ.answerId] === val;
                    return (
                      <motion.button
                        key={val}
                        whileTap={{ scale: 0.98 }}
                        className={`p-4 rounded-lg border-2 text-center font-semibold transition-all cursor-pointer ${
                          selected
                            ? "border-blue-500 bg-blue-50 text-blue-900"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                        onClick={() => selectAnswer(currentQ.answerId, val)}
                      >
                        {val === "true" ? "Benar" : "Salah"}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Essay */}
              {currentQ.type === "essay" && (
                <Textarea
                  value={localAnswers[currentQ.answerId] || ""}
                  onChange={(e) => selectAnswer(currentQ.answerId, e.target.value)}
                  placeholder="Tuliskan jawaban Anda di sini..."
                  rows={6}
                  className="resize-y"
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((p) => p - 1)}
          className="cursor-pointer"
        >
          <ChevronLeft size={16} className="mr-1" /> Sebelumnya
        </Button>
        <Button
          variant="outline"
          disabled={currentIndex === questions.length - 1}
          onClick={() => setCurrentIndex((p) => p + 1)}
          className="cursor-pointer"
        >
          Selanjutnya <ChevronRight size={16} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}

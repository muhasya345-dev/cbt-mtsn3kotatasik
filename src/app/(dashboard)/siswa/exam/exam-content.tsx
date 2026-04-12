"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Clock, ChevronLeft, ChevronRight, Send, AlertTriangle, WifiOff, Check } from "lucide-react";

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

const SYNC_INTERVAL = 60_000; // 60 detik
const STORAGE_KEY_PREFIX = "cbt-exam-";

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
  const [isOnline, setIsOnline] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dirtyRef = useRef<Set<string>>(new Set()); // track changed answers since last sync
  const localAnswersRef = useRef<Record<string, string>>({});
  const timeRef = useRef(0);
  const submittedRef = useRef(false);
  const wasHiddenRef = useRef(false);
  const hiddenTimestampRef = useRef(0);

  // Keep refs in sync
  useEffect(() => { localAnswersRef.current = localAnswers; }, [localAnswers]);
  useEffect(() => { timeRef.current = timeRemaining; }, [timeRemaining]);
  useEffect(() => { submittedRef.current = submitted; }, [submitted]);

  // === ONLINE/OFFLINE DETECTION ===
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      toast.success("Koneksi kembali tersambung");
      // Sync immediately when back online
      syncToServer();
    }
    function handleOffline() {
      setIsOnline(false);
      toast.warning("Koneksi internet terputus. Jawaban tersimpan lokal.", { duration: 5000 });
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === LOCALSTORAGE PERSISTENCE ===
  function saveToLocalStorage(answersToSave: Record<string, string>, time: number) {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${sessionId}`, JSON.stringify({
        answers: answersToSave,
        timeRemaining: time,
        savedAt: Date.now(),
      }));
    } catch { /* storage full, ignore */ }
  }

  function loadFromLocalStorage(): { answers: Record<string, string>; timeRemaining: number; savedAt: number } | null {
    try {
      const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
      if (!data) return null;
      return JSON.parse(data) as { answers: Record<string, string>; timeRemaining: number; savedAt: number };
    } catch { return null; }
  }

  function clearLocalStorage() {
    try { localStorage.removeItem(`${STORAGE_KEY_PREFIX}${sessionId}`); } catch { /* ignore */ }
  }

  // === SYNC TO SERVER (batch, every 60s) ===
  const syncToServer = useCallback(async () => {
    if (submittedRef.current || !navigator.onLine) return;
    const dirty = Array.from(dirtyRef.current);
    if (dirty.length === 0 && timeRef.current > 0) {
      // Still sync timeRemaining even if no answers changed
      try {
        await fetch("/api/exam/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            timeRemaining: timeRef.current,
            answers: [],
          }),
        });
        setLastSynced(new Date());
      } catch { /* offline, will retry */ }
      return;
    }

    setSyncing(true);
    try {
      const answersToSync = dirty.map((answerId) => ({
        answerId,
        answerContent: localAnswersRef.current[answerId] || "",
      }));

      const res = await fetch("/api/exam/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          timeRemaining: timeRef.current,
          answers: answersToSync,
        }),
      });

      if (res.ok) {
        dirtyRef.current.clear();
        setLastSynced(new Date());
      }
    } catch { /* offline, will retry next interval */ }
    setSyncing(false);
  }, [sessionId]);

  // === FETCH QUESTIONS ===
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

      // Check localStorage for saved answers (recovery after disconnect/refresh)
      const saved = loadFromLocalStorage();
      const ans: Record<string, string> = {};

      if (saved && saved.savedAt > Date.now() - 4 * 60 * 60 * 1000) {
        // Use localStorage answers if less than 4 hours old
        for (const q of data.questions || []) {
          ans[q.answerId] = saved.answers[q.answerId] ?? q.answerContent ?? "";
        }
        // Use the smaller timeRemaining (prevents time manipulation)
        const serverTime = data.timeRemaining || 0;
        const localTime = saved.timeRemaining || 0;
        setTimeRemaining(Math.min(serverTime, localTime));

        // Mark saved answers as dirty so they get synced
        for (const q of data.questions || []) {
          if (saved.answers[q.answerId] && saved.answers[q.answerId] !== (q.answerContent ?? "")) {
            dirtyRef.current.add(q.answerId);
          }
        }
      } else {
        // Fresh load from server
        for (const q of data.questions || []) {
          ans[q.answerId] = q.answerContent || "";
        }
        setTimeRemaining(data.timeRemaining || 0);
      }

      setLocalAnswers(ans);
    } catch { toast.error("Gagal memuat soal"); }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, router]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  // === TIMER (runs locally, independent of server) ===
  useEffect(() => {
    if (loading || submitted || timeRemaining <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, submitted]);

  // === PERIODIC SYNC (every 60 seconds) ===
  useEffect(() => {
    if (loading || submitted) return;
    syncRef.current = setInterval(syncToServer, SYNC_INTERVAL);
    return () => { if (syncRef.current) clearInterval(syncRef.current); };
  }, [loading, submitted, syncToServer]);

  // === SMART VIOLATION DETECTION ===
  // Only count deliberate tab switches, NOT:
  // - Screen lock / phone lock
  // - Connection loss
  // - Brief focus loss (< 2 seconds)
  useEffect(() => {
    if (submitted) return;

    function handleVisibilityChange() {
      if (document.hidden) {
        // Page became hidden — record timestamp, DON'T log yet
        wasHiddenRef.current = true;
        hiddenTimestampRef.current = Date.now();

        // Save to localStorage immediately when page hides (phone might lock)
        saveToLocalStorage(localAnswersRef.current, timeRef.current);
      } else if (wasHiddenRef.current) {
        // Page became visible again — check duration
        wasHiddenRef.current = false;
        const hiddenDuration = Date.now() - hiddenTimestampRef.current;

        // Only log violation if hidden for > 3 seconds AND < 5 minutes
        // > 5 minutes = probably screen lock/phone lock (not cheating)
        // < 3 seconds = accidental/notification popup (not cheating)
        if (hiddenDuration > 3000 && hiddenDuration < 300_000) {
          logViolation("tab_switch", `Berpindah tab selama ${Math.round(hiddenDuration / 1000)} detik`);
          setViolationWarning(true);
          setTimeout(() => setViolationWarning(false), 5000);
        }
        // If > 5 minutes: likely phone lock, screen off, or genuine disconnect
        // Don't count as violation — just continue exam normally
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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

  // Save to localStorage on beforeunload (browser close/refresh)
  useEffect(() => {
    function handleBeforeUnload() {
      saveToLocalStorage(localAnswersRef.current, timeRef.current);
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === ACTIONS ===
  async function logViolation(type: string, details: string) {
    if (!navigator.onLine) return; // Don't log if offline
    try {
      await fetch("/api/exam/violation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, type, details }),
      });
    } catch { /* ignore */ }
  }

  function selectAnswer(answerId: string, value: string) {
    setLocalAnswers((prev) => {
      const updated = { ...prev, [answerId]: value };
      // Save to localStorage immediately (optimistic)
      saveToLocalStorage(updated, timeRef.current);
      return updated;
    });
    // Mark as dirty — will be synced next interval
    dirtyRef.current.add(answerId);
  }

  async function handleSubmit(auto = false) {
    if (submitted) return;
    if (!auto && !confirm("Yakin ingin mengumpulkan jawaban? Tidak bisa diubah setelah dikumpulkan.")) return;

    if (timerRef.current) clearInterval(timerRef.current);
    if (syncRef.current) clearInterval(syncRef.current);
    setSubmitted(true);

    // Sync all remaining answers before submit
    const dirty = Array.from(dirtyRef.current);
    if (dirty.length > 0 && navigator.onLine) {
      try {
        await fetch("/api/exam/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            timeRemaining: 0,
            answers: dirty.map((answerId) => ({
              answerId,
              answerContent: localAnswersRef.current[answerId] || "",
            })),
          }),
        });
        dirtyRef.current.clear();
      } catch { /* will submit anyway */ }
    }

    try {
      await fetch("/api/exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, auto }),
      });
      toast.success(auto ? "Waktu habis! Jawaban otomatis dikumpulkan." : "Jawaban berhasil dikumpulkan!");
      clearLocalStorage();
    } catch {
      toast.error("Gagal mengumpulkan jawaban. Jawaban tersimpan lokal, hubungi pengawas.");
    }
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
          <Button onClick={() => router.push("/siswa")} className="btn-theme-gradient cursor-pointer">
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
  const isUrgent = timeRemaining <= 300;
  const isCritical = timeRemaining <= 60;

  return (
    <div className="space-y-4">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-900 px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
          <WifiOff size={16} />
          Koneksi terputus — jawaban tersimpan lokal, akan otomatis dikirim saat koneksi kembali
        </div>
      )}

      {/* Violation Warning */}
      <AnimatePresence>
        {violationWarning && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className={`fixed ${!isOnline ? "top-12" : "top-4"} left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2`}
          >
            <AlertTriangle size={20} />
            <span className="font-semibold">Peringatan! Jangan berpindah tab/aplikasi saat ujian.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header: Timer + Progress + Sync Status */}
      <div className={`flex flex-wrap items-center justify-between gap-2 bg-white rounded-lg border p-3 sticky ${!isOnline ? "top-10" : "top-0"} z-40`}>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            Soal {currentIndex + 1} / {questions.length}
          </Badge>
          <Badge className="text-xs bg-purple-100 text-purple-800">{typeLabel[currentQ.type]}</Badge>
          {/* Sync status indicator */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {syncing ? (
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : lastSynced ? (
              <Check size={12} className="text-green-500" />
            ) : null}
          </div>
        </div>

        <motion.div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-base md:text-lg font-bold ${
            isCritical ? "bg-red-100 text-red-700" : isUrgent ? "bg-yellow-100 text-yellow-700" : "bg-blue-50 text-blue-700"
          }`}
          animate={isCritical ? { scale: [1, 1.05, 1] } : {}}
          transition={isCritical ? { duration: 1, repeat: Infinity } : {}}
        >
          <Clock size={16} />
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
      <div className="flex flex-wrap gap-1.5 md:gap-2">
        {questions.map((q, i) => {
          const answered = !!localAnswers[q.answerId];
          return (
            <Button
              key={q.answerId}
              size="sm"
              variant={i === currentIndex ? "default" : "outline"}
              className={`w-8 h-8 md:w-9 md:h-9 p-0 text-xs md:text-sm cursor-pointer ${
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

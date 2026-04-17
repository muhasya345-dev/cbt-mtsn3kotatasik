"use client";

import { useState, useEffect } from "react";
import { FadeIn } from "@/components/shared/motion-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CreditCard, Printer, Users, FileText } from "lucide-react";
import { generateExamCardPdf } from "@/lib/generate-exam-card-pdf";

interface SelectOption { id: string; name: string; semester?: string; academicYear?: string }

interface CardData {
  participantNumber: string;
  studentName: string;
  nis: string;
  className: string;
  roomName: string;
}

export function ExamCardsContent() {
  const [examEvents, setExamEvents] = useState<SelectOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [cards, setCards] = useState<CardData[]>([]);
  const [eventInfo, setEventInfo] = useState<{
    name: string; semester: string; academicYear: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Config for PDF
  const [chairpersonName, setChairpersonName] = useState("Alien Kurnianingsih, M.Pd");
  const [chairpersonNip, setChairpersonNip] = useState("197605232005012001");
  const [printDate, setPrintDate] = useState(() => {
    const now = new Date();
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ];
    return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  });

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch("/api/exam-events");
        const data = await res.json() as Record<string, unknown>;
        setExamEvents((data.events || []) as SelectOption[]);
      } catch {
        toast.error("Gagal memuat event");
      }
    }
    fetchEvents();
  }, []);

  const handleFetchCards = async () => {
    if (!selectedEvent) {
      toast.error("Pilih event ujian terlebih dahulu");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/exam-cards?examEventId=${selectedEvent}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as {
        examEvent: { name: string; semester: string; academicYear: string };
        cards: CardData[];
      };
      setCards(data.cards);
      setEventInfo(data.examEvent);
      if (data.cards.length === 0) {
        toast.info("Belum ada penempatan siswa ke ruangan untuk event ini");
      } else {
        toast.success(`${data.cards.length} kartu ujian siap dicetak`);
      }
    } catch {
      toast.error("Gagal memuat data kartu ujian");
    }
    setLoading(false);
  };

  const handlePrint = async () => {
    if (cards.length === 0 || !eventInfo) return;
    setPrinting(true);
    try {
      await generateExamCardPdf(cards, {
        examEventName: eventInfo.name,
        semester: eventInfo.semester,
        academicYear: eventInfo.academicYear,
        chairpersonName,
        chairpersonNip,
        printDate,
      });
      toast.success("PDF kartu ujian berhasil dibuat!");
    } catch (error) {
      toast.error("Gagal membuat PDF");
      console.error(error);
    }
    setPrinting(false);
  };

  // Group cards by room for preview
  const roomGroups = cards.reduce<Record<string, CardData[]>>((acc, card) => {
    if (!acc[card.roomName]) acc[card.roomName] = [];
    acc[card.roomName].push(card);
    return acc;
  }, {});

  return (
    <FadeIn>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">Kartu Ujian</h1>
          <p className="text-sm text-gray-500 mt-1">Cetak kartu ujian siswa berdasarkan penempatan ruangan (8 kartu per halaman A4)</p>
        </div>

        {/* Select Event */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label>Event Ujian</Label>
                <Select value={selectedEvent} onValueChange={(v) => setSelectedEvent(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Pilih event" /></SelectTrigger>
                  <SelectContent>
                    {examEvents.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleFetchCards} disabled={loading}>
                <FileText className="w-4 h-4 mr-2" />
                {loading ? "Memuat..." : "Muat Data"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* PDF Settings */}
        {cards.length > 0 && eventInfo && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                Pengaturan Kartu Ujian
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Nama Ketua Panitia</Label>
                  <Input
                    value={chairpersonName}
                    onChange={(e) => setChairpersonName(e.target.value)}
                    placeholder="Nama Ketua"
                  />
                </div>
                <div className="space-y-2">
                  <Label>NIP Ketua</Label>
                  <Input
                    value={chairpersonNip}
                    onChange={(e) => setChairpersonNip(e.target.value)}
                    placeholder="NIP"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Cetak</Label>
                  <Input
                    value={printDate}
                    onChange={(e) => setPrintDate(e.target.value)}
                    placeholder="24 November 2025"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    Total: <b>{cards.length}</b> kartu
                  </span>
                  <span>
                    Halaman: <b>{Math.ceil(cards.length / 8)}</b>
                  </span>
                  <span>
                    Ruangan: <b>{Object.keys(roomGroups).length}</b>
                  </span>
                </div>
                <Button
                  onClick={handlePrint}
                  disabled={printing}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  {printing ? "Membuat PDF..." : "Cetak PDF Kartu Ujian"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview by room */}
        {Object.entries(roomGroups).map(([roomName, roomCards]) => (
          <Card key={roomName}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  {roomName}
                </CardTitle>
                <Badge variant="secondary">{roomCards.length} siswa</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50/80">
                      <th className="text-left p-2 pl-4 font-medium text-gray-600 w-12">No</th>
                      <th className="text-left p-2 font-medium text-gray-600">No. Peserta</th>
                      <th className="text-left p-2 font-medium text-gray-600">Nama Siswa</th>
                      <th className="text-left p-2 font-medium text-gray-600">Kelas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomCards.map((c, i) => (
                      <tr key={`${c.nis}-${i}`} className="border-b hover:bg-gray-50/50">
                        <td className="p-2 pl-4 text-gray-500">{i + 1}</td>
                        <td className="p-2 font-mono">{c.participantNumber}</td>
                        <td className="p-2">{c.studentName}</td>
                        <td className="p-2">{c.className}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </FadeIn>
  );
}

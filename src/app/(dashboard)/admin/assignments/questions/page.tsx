"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AdminQuestionsContent } from "./questions-content";

function Inner() {
  const params = useSearchParams();
  const id = params.get("id");
  if (!id) {
    return <div className="p-6 text-sm text-muted-foreground">ID penugasan tidak ditemukan.</div>;
  }
  return <AdminQuestionsContent assignmentId={id} />;
}

export default function AdminQuestionsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Memuat...</div>}>
      <Inner />
    </Suspense>
  );
}

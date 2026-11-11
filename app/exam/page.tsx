import { Suspense } from "react";
import { ExamRunner } from "./ExamRunner";

export const metadata = { title: "Practice exam" };

export default function ExamPage() {
  return (
    <Suspense fallback={<p className="text-center text-muted">Loading…</p>}>
      <ExamRunner />
    </Suspense>
  );
}

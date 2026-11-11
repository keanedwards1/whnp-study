import { Suspense } from "react";
import { QuizRunner } from "./QuizRunner";

export default function QuizPage() {
  return (
    <Suspense fallback={<p className="text-center text-muted">Loading…</p>}>
      <QuizRunner />
    </Suspense>
  );
}

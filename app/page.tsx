import { SetupForm } from "@/components/SetupForm";
import { allRows } from "@/lib/data";

export default function Home() {
  return <SetupForm totalConditions={allRows().length} />;
}

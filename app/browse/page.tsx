import Link from "next/link";
import { sections } from "@/lib/data";

export default function BrowsePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold sm:text-4xl">Study tables</h1>
        <p className="mt-1 text-muted">Source tables with images, as written.</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {sections.map((s) => (
          <li key={s.id}>
            <Link href={`/browse/${s.id}`} className="tile h-full p-5!">
              <span className="font-semibold">{s.title}</span>
              <span className="mt-1 text-sm text-muted">
                {s.empty ? "No content yet" : `${s.rows.length} conditions`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

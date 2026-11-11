import Link from "next/link";
import { notFound } from "next/navigation";
import { CellText } from "@/components/CellText";
import { RowImages } from "@/components/RowImages";
import { conditionLabel, getSection, sections } from "@/lib/data";

export function generateStaticParams() {
  return sections.map((s) => ({ section: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/browse/[section]">) {
  const { section } = await params;
  return { title: getSection(section)?.title ?? "Not found" };
}

export default async function SectionPage({ params }: PageProps<"/browse/[section]">) {
  const { section: id } = await params;
  const section = getSection(id);
  if (!section) notFound();

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
        <Link href="/browse" className="link text-sm font-medium">← All tables</Link>
        <h1 className="mt-3 font-serif text-2xl font-semibold leading-tight">{section.title}</h1>
        {section.rows.length > 1 && (
          <nav className="mt-4 hidden max-h-[60vh] overflow-y-auto lg:block" aria-label="Conditions">
            <ul className="space-y-0.5 border-l border-line">
              {section.rows.map((r) => (
                <li key={r.id}>
                  <a
                    href={`#${r.id}`}
                    className="-ml-px block border-l-2 border-transparent py-1.5 pl-3 text-sm text-muted transition hover:border-accent hover:text-text"
                  >
                    {conditionLabel(r)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </aside>

      <div className="space-y-5">
        {section.empty && <p className="text-muted">This section has no content in the source document.</p>}
        {section.notes.map((n, i) => (
          <p key={i} className="card whitespace-pre-line">{n}</p>
        ))}

        {section.rows.length > 1 && (
          <nav className="flex flex-wrap gap-2 lg:hidden">
            {section.rows.map((r) => (
              <a key={r.id} href={`#${r.id}`} className="chip">{conditionLabel(r)}</a>
            ))}
          </nav>
        )}

        <div className="grid gap-5 2xl:grid-cols-2">
          {section.rows.map((row) => (
            <article key={row.id} id={row.id} className="card scroll-mt-24">
              <h2 className="font-serif text-xl font-semibold"><CellText text={row.condition} /></h2>
              {/* Images in the condition column are pictures of the condition itself. */}
              <RowImages images={row.images.filter((im) => im.column === section.columns[0])} className="mt-3" />
              <dl className="mt-4 space-y-4">
                {section.columns.slice(1).map((col) => {
                  const imgs = row.images.filter((im) => im.column === col);
                  const text = row.cells[col] ?? "";
                  if (!text.trim() && !imgs.length) return null;
                  return (
                    <div key={col}>
                      <dt className="eyebrow">{col}</dt>
                      <dd className="mt-1 leading-relaxed">
                        {text.trim() && <CellText text={text} />}
                        <RowImages images={imgs} className="mt-2" />
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

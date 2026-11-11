/** Renders source text verbatim, keeping the doc's line breaks. */
export function CellText({ text, className = "" }: { text: string; className?: string }) {
  if (!text.trim()) return <span className="text-muted italic">(blank in source)</span>;
  return <span className={`whitespace-pre-line break-words ${className}`}>{text}</span>;
}

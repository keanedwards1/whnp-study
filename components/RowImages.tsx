/* eslint-disable @next/next/no-img-element -- small local images; plain <img> keeps this hosting-agnostic */
import type { ImageRef } from "@/lib/types";

export function RowImages({
  images,
  showCaption = true,
  className = "",
}: {
  images: ImageRef[];
  /** Captions often name the condition (e.g. "Lyme disease - Wikipedia"); hide them in image quizzes. */
  showCaption?: boolean;
  className?: string;
}) {
  if (!images.length) return null;
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {images.map((img) => (
        <figure key={img.file} className="max-w-full">
          <img
            src={img.file}
            alt={showCaption ? img.alt : "Clinical image"}
            loading="lazy"
            className="max-h-64 w-auto max-w-full rounded-[2px] border border-line bg-surface object-contain"
          />
          {showCaption && img.alt && (
            <figcaption className="mt-1 text-xs text-muted">{img.alt}</figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

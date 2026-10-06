import { Fragment } from 'react';
import type { MatchRange } from '@/core/text';

/**
 * Renderiza un texto resaltando los rangos dados (coincidencias de la
 * búsqueda). Los rangos deben venir en índices del texto original, ordenados y
 * sin solaparse (como los produce `findMatches`).
 */
interface HighlightProps {
  text: string;
  ranges: MatchRange[];
}

export function Highlight({ text, ranges }: HighlightProps) {
  if (ranges.length === 0) return <>{text}</>;

  const parts: Array<{ str: string; mark: boolean }> = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start > cursor) parts.push({ str: text.slice(cursor, r.start), mark: false });
    parts.push({ str: text.slice(r.start, r.end), mark: true });
    cursor = r.end;
  }
  if (cursor < text.length) parts.push({ str: text.slice(cursor), mark: false });

  return (
    <>
      {parts.map((p, i) =>
        p.mark ? (
          <mark className="word-hit" key={i}>
            {p.str}
          </mark>
        ) : (
          <Fragment key={i}>{p.str}</Fragment>
        ),
      )}
    </>
  );
}

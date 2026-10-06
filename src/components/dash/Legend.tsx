import { useTranslation } from 'react-i18next';
import { makeColorScale } from '@/core/theme';

/**
 * Leyenda de color reutilizable. Muestra una entrada por categoría con su
 * swatch de color (misma escala que las gráficas). Cuando no se divide por
 * autor, se muestra una única entrada "Todos" con el color de acento.
 */
interface LegendProps {
  categories: string[];
  /** true si las series están divididas por autor (una entrada por autor). */
  splitByAuthor: boolean;
}

export function Legend({ categories, splitByAuthor }: LegendProps) {
  const { t } = useTranslation();
  const color = makeColorScale(categories);

  const items = splitByAuthor
    ? categories.map((c) => ({ key: c, label: c, swatch: color(c) }))
    : [{ key: 'all', label: t('legend.allSeries'), swatch: 'var(--accent)' }];

  if (items.length === 0) return null;

  return (
    <div className="legend">
      {items.map((it) => (
        <span className="item" key={it.key}>
          <span className="swatch" style={{ background: it.swatch }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

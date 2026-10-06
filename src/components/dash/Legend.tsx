import { useTranslation } from 'react-i18next';
import { makeColorScale } from '@/core/theme';
import type { SeriesSplit } from '@/core/types';

/**
 * Leyenda de color reutilizable. Muestra una entrada por categoría con su
 * swatch de color (misma escala que las gráficas). Según el criterio de
 * división (`split`):
 *  - 'none': una única entrada "Todos" con el color de acento.
 *  - 'author': una entrada por persona.
 *  - 'weekday': una entrada por día de la semana (etiqueta traducida).
 */
interface LegendProps {
  categories: string[];
  /** Criterio de división de las series. */
  split: SeriesSplit;
}

export function Legend({ categories, split }: LegendProps) {
  const { t } = useTranslation();
  const color = makeColorScale(categories);

  const labelOf = (key: string) =>
    split === 'weekday' ? t(`weekday.${key}`) : key;

  const items =
    split === 'none'
      ? [{ key: 'all', label: t('legend.allSeries'), swatch: 'var(--accent)' }]
      : categories.map((c) => ({ key: c, label: labelOf(c), swatch: color(c) }));

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

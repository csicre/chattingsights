import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildWordTrend, computeSlang } from '@/core/dashboard';
import type { MessagePoint, SupportedLanguage, TimeGroup } from '@/core/types';
import { TrendPanel } from './TrendPanel';

/**
 * Solapa "Jerga".
 *
 * Para cada persona de la conversación mostramos sus palabras "especiales": los
 * términos que más la caracterizan frente al resto (muletillas, apodos,
 * expresiones propias), calculados con una medida de distintividad tipo TF-IDF.
 * Por cada palabra se dibuja un pequeño gráfico de evolución temporal que revela
 * cuándo la usa esa persona a lo largo del chat.
 *
 * La evolución se calcula sobre los mensajes de la persona seleccionada, con una
 * sola línea por palabra (sin desglose de leyenda), respetando la agrupación
 * temporal elegida en la columna de filtros.
 */
interface SlangPanelProps {
  points: MessagePoint[];
  timeGroup: TimeGroup;
  lang: SupportedLanguage;
}

/** Nº de palabras por persona (requisito: 5). */
const WORDS_PER_AUTHOR = 5;

export function SlangPanel({ points, timeGroup, lang }: SlangPanelProps) {
  const { t } = useTranslation();

  // Jerga por autor (memorizada): se recalcula al cambiar la selección/filtros.
  const slang = useMemo(
    () => computeSlang(points, lang, WORDS_PER_AUTHOR),
    [points, lang],
  );

  const authors = useMemo(() => slang.map((s) => s.author), [slang]);
  const [selected, setSelected] = useState<string>('');

  // Mantiene una selección válida cuando cambian los autores disponibles.
  useEffect(() => {
    if (authors.length === 0) {
      if (selected !== '') setSelected('');
      return;
    }
    if (!authors.includes(selected)) setSelected(authors[0]);
  }, [authors, selected]);

  const current = slang.find((s) => s.author === selected);

  // Puntos de la persona seleccionada (para la evolución de sus palabras).
  const authorPoints = useMemo(
    () => (selected ? points.filter((p) => p.author === selected) : []),
    [points, selected],
  );

  if (authors.length === 0) {
    return (
      <div className="chart-panel">
        <p className="status">{t('slang.noData')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="group">
        <h3>{t('slang.personLabel')}</h3>
        <div className="segmented slang-people">
          {authors.map((a) => (
            <button
              key={a}
              className={selected === a ? 'active' : ''}
              onClick={() => setSelected(a)}
            >
              {a}
            </button>
          ))}
        </div>
        <p className="hint">{t('slang.hint')}</p>
      </div>

      {!current || current.words.length === 0 ? (
        <div className="chart-panel">
          <p className="status">{t('slang.noWords', { person: selected })}</p>
        </div>
      ) : (
        <div className="aux-row slang-grid">
          {current.words.map((w) => (
            <SlangWordChart
              key={w.word}
              word={w.word}
              count={w.count}
              points={authorPoints}
              timeGroup={timeGroup}
            />
          ))}
        </div>
      )}
    </>
  );
}

/** Mini-gráfico de evolución temporal de una palabra de jerga de una persona. */
function SlangWordChart({
  word,
  count,
  points,
  timeGroup,
}: {
  word: string;
  count: number;
  points: MessagePoint[];
  timeGroup: TimeGroup;
}) {
  const { t } = useTranslation();
  // Una única serie 'all': la persona ya está fijada por el filtrado de puntos.
  const series = useMemo(
    () => buildWordTrend(points, timeGroup, 'none', word),
    [points, timeGroup, word],
  );

  return (
    <TrendPanel
      series={series}
      categories={[]}
      split="none"
      title={`«${word}»`}
      info={t('slang.chartInfo', { word, count })}
      unit={t('slang.unit')}
      decimals={0}
    />
  );
}

import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildWordBars,
  buildWordMatches,
  buildWordTrend,
  normalizeSearchTerm,
} from '@/core/dashboard';
import type { MessagePoint, SeriesSplit, TimeGroup } from '@/core/types';
import { useApp } from '@/state/AppContext';
import { TrendPanel } from './TrendPanel';
import { WordBars } from './WordBars';
import { Highlight } from './Highlight';

/**
 * Solapa "Buscador de palabras".
 *
 * El usuario introduce una expresión (una o varias palabras, p. ej.
 * "buenos días") y se dibuja la evolución temporal del número de veces que
 * aparece (media columna) junto a un diagrama de barras por serie (según la
 * leyenda). Debajo se lista cada mensaje donde aparece la expresión, con esta
 * resaltada. La búsqueda es insensible a mayúsculas y a tildes.
 */
interface WordSearchPanelProps {
  points: MessagePoint[];
  categories: string[];
  timeGroup: TimeGroup;
  split: SeriesSplit;
}

/** Máximo de mensajes a listar para no saturar la UI. */
const MATCH_LIMIT = 200;

export function WordSearchPanel({ points, categories, timeGroup, split }: WordSearchPanelProps) {
  const { t, i18n } = useTranslation();
  const { setSelectedMessageId } = useApp();
  const [term, setTerm] = useState('');
  // Difiere el término para no recalcular en cada pulsación.
  const deferredTerm = useDeferredValue(term);
  const normalized = normalizeSearchTerm(deferredTerm);

  const series = useMemo(
    () => buildWordTrend(points, timeGroup, split, deferredTerm),
    [points, timeGroup, split, deferredTerm],
  );

  const bars = useMemo(
    () => buildWordBars(points, split, deferredTerm),
    [points, split, deferredTerm],
  );

  const { matches, totalMessages, totalOccurrences } = useMemo(
    () => buildWordMatches(points, deferredTerm, MATCH_LIMIT),
    [points, deferredTerm],
  );

  const total = useMemo(
    () => series.reduce((sum, s) => sum + s.points.reduce((a, p) => a + p.value, 0), 0),
    [series],
  );

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language === 'es' ? 'es-ES' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [i18n.language],
  );

  const hasResults = series.length > 0;

  return (
    <>
      <div className="group">
        <h3>{t('wordSearch.title')}</h3>
        <input
          type="search"
          className="word-search-input"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t('wordSearch.placeholder')}
          aria-label={t('wordSearch.inputLabel')}
          autoComplete="off"
        />
        <p className="hint">{t('wordSearch.hint')}</p>
      </div>

      {!normalized ? (
        <div className="chart-panel">
          <p className="status">{t('wordSearch.prompt')}</p>
        </div>
      ) : !hasResults ? (
        <div className="chart-panel">
          <p className="status">{t('wordSearch.noMatches', { term: normalized })}</p>
        </div>
      ) : (
        <>
          <div className="aux-row">
            <TrendPanel
              series={series}
              categories={categories}
              split={split}
              title={t('wordSearch.chartTitle', { term: normalized })}
              info={t('wordSearch.chartInfo', { term: normalized, total })}
              unit={t('wordSearch.unit')}
              decimals={0}
            />
            <WordBars
              bars={bars}
              categories={categories}
              split={split}
              title={t('wordSearch.barsTitle', { term: normalized })}
              info={t('wordSearch.barsInfo', { term: normalized })}
              unit={t('wordSearch.unit')}
            />
          </div>

          <div className="chart-panel">
            <div className="chart-header">
              <div className="chart-title-row">
                <div className="chart-title">{t('wordSearch.listTitle', { term: normalized })}</div>
              </div>
              <p className="hint">
                {t('wordSearch.listSummary', {
                  messages: totalMessages,
                  occurrences: totalOccurrences,
                })}
              </p>
            </div>

            <ul className="word-hits">
              {matches.map((m) => (
                <li key={m.id} className="word-hit-row">
                  <button
                    className="word-hit-open"
                    onClick={() => setSelectedMessageId(m.id)}
                    title={t('dash.pointClickHint')}
                  >
                    <div className="word-hit-head">
                      <span className="word-hit-author">{m.author}</span>
                      <span className="word-hit-date">{dateFmt.format(m.timestamp)}</span>
                    </div>
                    <div className="word-hit-text">
                      <Highlight text={m.text} ranges={m.ranges} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {totalMessages > matches.length && (
              <p className="hint">
                {t('wordSearch.listTruncated', {
                  shown: matches.length,
                  total: totalMessages,
                })}
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}

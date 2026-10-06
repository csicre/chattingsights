import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/state/AppContext';
import {
  applyFilters,
  buildInitiativeTrend,
  buildMessagePoints,
  buildResponseTrend,
  buildTrendSeries,
  computeDashboardKpis,
  computeEmojiRanking,
  computeEmojiStats,
  deriveFilterOptions,
  seriesCategories,
  EMPTY_FILTERS,
} from '@/core/dashboard';
import { formatDate, formatNumber } from '@/core/format';
import type { ChatFilters, SeriesSplit, TimeGroup } from '@/core/types';
import { FiltersPanel } from './FiltersPanel';
import { KpiStrip, type KpiItem } from './KpiStrip';
import { HourHistogram } from './HourHistogram';
import { WeekdayBars } from './WeekdayBars';
import { TrendPanel } from './TrendPanel';
import { InitiativeBars } from './InitiativeBars';
import { ResponseBars } from './ResponseBars';
import { EmojiBars } from './EmojiBars';
import { WordSearchPanel } from './WordSearchPanel';
import { Tabs, type TabItem } from './Tabs';

type TabId = 'general' | 'schedule' | 'emojis' | 'response' | 'initiative' | 'words';

/** Opciones de hueco de inactividad (minutos) para separar conversaciones. */
const INITIATIVE_GAP_OPTIONS = [30, 60, 120, 240] as const;

/**
 * Dashboard interactivo con solapas. La columna de filtros (izquierda) y el
 * selector de agrupación temporal son comunes a todas las solapas. La zona de
 * KPIs + visualizaciones cambia según la solapa activa (General, Emojis,
 * Tiempos de respuesta).
 */
export function Dashboard() {
  const { t } = useTranslation();
  const { parsed, report } = useApp();

  const [filters, setFiltersState] = useState<ChatFilters>(EMPTY_FILTERS);
  const [timeGroup, setTimeGroup] = useState<TimeGroup>('day');
  const [split, setSplit] = useState<SeriesSplit>('none');
  const [tab, setTab] = useState<TabId>('general');
  // Hueco de inactividad (minutos) que separa una conversación de la siguiente.
  const [initiativeGap, setInitiativeGap] = useState<number>(60);

  const allPoints = useMemo(() => (parsed ? buildMessagePoints(parsed) : []), [parsed]);
  const options = useMemo(() => deriveFilterOptions(allPoints), [allPoints]);
  const points = useMemo(() => applyFilters(allPoints, filters), [allPoints, filters]);

  // Autores activos (dominio de color del scatter por autor de la solapa Horario).
  const authorCategories = useMemo(
    () => (filters.authors.length ? filters.authors : options.authors),
    [filters.authors, options.authors],
  );

  // Categorías de las series según el criterio de división de la leyenda.
  const categories = useMemo(
    () => seriesCategories(split, authorCategories),
    [split, authorCategories],
  );

  const lang = report?.language ?? 'es';

  // --- Métricas por solapa (memorizadas) ---
  const genKpis = useMemo(() => computeDashboardKpis(points), [points]);
  const emoji = useMemo(() => computeEmojiStats(points), [points]);
  // Ranking de emojis (top 5) desglosado según la leyenda elegida.
  const emojiRanking = useMemo(
    () => computeEmojiRanking(points, split, 5),
    [points, split],
  );

  const countSeries = useMemo(
    () => buildTrendSeries(points, timeGroup, 'count', split),
    [points, timeGroup, split],
  );
  const wordsSeries = useMemo(
    () => buildTrendSeries(points, timeGroup, 'avgWords', split),
    [points, timeGroup, split],
  );
  const emojiSeries = useMemo(
    () => buildTrendSeries(points, timeGroup, 'emojis', split),
    [points, timeGroup, split],
  );
  const responseSeries = useMemo(
    () => buildResponseTrend(points, timeGroup, split),
    [points, timeGroup, split],
  );
  const initiativeSeries = useMemo(
    () => buildInitiativeTrend(points, timeGroup, split, initiativeGap),
    [points, timeGroup, split, initiativeGap],
  );

  const setFilters = (updater: (prev: ChatFilters) => ChatFilters) =>
    setFiltersState((prev) => updater(prev));
  const resetFilters = () => setFiltersState(EMPTY_FILTERS);

  if (!parsed || !report) return null;

  const tabs: TabItem[] = [
    { id: 'general', label: t('tabs.general') },
    { id: 'schedule', label: t('tabs.schedule') },
    { id: 'emojis', label: t('tabs.emojis') },
    { id: 'response', label: t('tabs.response') },
    { id: 'initiative', label: t('tabs.initiative') },
    { id: 'words', label: t('tabs.words') },
  ];

  // KPIs de la solapa General.
  const generalKpis: KpiItem[] = [
    {
      value: formatNumber(genKpis.messages, lang),
      label: t('report.totalMessages'),
      info: t('kpi.messages.info'),
    },
    {
      value: options.minDate ? formatDate(new Date(`${options.minDate}T00:00:00`), lang) : '—',
      label: t('kpi.firstDate'),
      info: t('kpi.firstDate.info'),
    },
    {
      value: options.maxDate ? formatDate(new Date(`${options.maxDate}T00:00:00`), lang) : '—',
      label: t('kpi.lastDate'),
      info: t('kpi.lastDate.info'),
    },
    {
      value: formatNumber(genKpis.messagesPerDay, lang),
      label: t('report.avgPerDay'),
      info: t('kpi.perDay.info'),
    },
    {
      value: `${genKpis.avgWords.toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
        maximumFractionDigits: 1,
      })} ${t('dash.wordsUnit')}`,
      label: t('kpi.avgWords'),
      info: t('kpi.avgWords.info'),
    },
  ];

  // KPIs de la solapa Emojis.
  const emojiKpis: KpiItem[] = [
    {
      value: formatNumber(emoji.kpis.totalEmojis, lang),
      label: t('kpi.totalEmojis'),
      info: t('kpi.totalEmojis.info'),
    },
    {
      value: formatNumber(emoji.kpis.emojisPerMessage, lang),
      label: t('kpi.emojisPerMsg'),
      info: t('kpi.emojisPerMsg.info'),
    },
    {
      value: emoji.kpis.topEmoji,
      label: t('kpi.topEmoji'),
      info: t('kpi.topEmoji.info'),
    },
    {
      value: `${formatNumber(emoji.kpis.pctWithEmoji, lang)}%`,
      label: t('kpi.pctWithEmoji'),
      info: t('kpi.pctWithEmoji.info'),
    },
  ];

  const hasData = points.length > 0;

  return (
    <div className="layout">
      <FiltersPanel
        options={options}
        filters={filters}
        setFilters={setFilters}
        resetFilters={resetFilters}
        timeGroup={timeGroup}
        setTimeGroup={setTimeGroup}
        split={split}
        setSplit={setSplit}
      />

      <div className="main-col">
        <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as TabId)} />

        {!hasData ? (
          <div className="chart-panel">
            <p className="status">{t('dash.noData')}</p>
          </div>
        ) : tab === 'general' ? (
          <>
            <KpiStrip items={generalKpis} />
            <div className="aux-row">
              <TrendPanel
                series={countSeries}
                categories={categories}
                split={split}
                title={t('dash.trendCountTitle')}
                info={t('dash.trendCountInfo')}
                unit={t('dash.msgCount')}
                decimals={0}
              />
              <TrendPanel
                series={wordsSeries}
                categories={categories}
                split={split}
                title={t('dash.trendWordsTitle')}
                info={t('dash.trendWordsInfo')}
                unit={t('dash.wordsUnit')}
                decimals={1}
              />
            </div>
          </>
        ) : tab === 'schedule' ? (
          <>
            <div className="aux-row">
              <HourHistogram points={points} />
              <WeekdayBars points={points} />
            </div>
          </>
        ) : tab === 'emojis' ? (
          <>
            <KpiStrip items={emojiKpis} />
            <TrendPanel
              series={emojiSeries}
              categories={categories}
              split={split}
              title={t('dash.emojiTrendTitle')}
              info={t('dash.emojiTrendInfo')}
              unit={t('dash.emojiUnit')}
              decimals={0}
              fullWidth
            />
            <div className="aux-row">
              <EmojiBars
                rows={emojiRanking}
                categories={categories}
                split={split}
                title={t('dash.emojiTopTitle')}
                info={t('dash.emojiTopInfo')}
              />
            </div>
          </>
        ) : tab === 'response' ? (
          <>
            <TrendPanel
              series={responseSeries}
              categories={categories}
              split={split}
              title={t('dash.responseTrendTitle')}
              info={t('dash.responseTrendInfo')}
              unit={t('dash.minutesUnit')}
              decimals={1}
              fullWidth
            />
            <div className="aux-row">
              <ResponseBars
                points={points}
                categories={categories}
                split={split}
                title={t('dash.responseBarsTitle')}
                info={t('dash.responseBarsInfo')}
              />
            </div>
          </>
        ) : tab === 'words' ? (
          <WordSearchPanel
            points={points}
            categories={categories}
            timeGroup={timeGroup}
            split={split}
          />
        ) : (
          <>
            <div className="group">
              <h3>{t('dash.initiativeGapLabel')}</h3>
              <div className="segmented">
                {INITIATIVE_GAP_OPTIONS.map((min) => (
                  <button
                    key={min}
                    className={initiativeGap === min ? 'active' : ''}
                    onClick={() => setInitiativeGap(min)}
                  >
                    {min} min
                  </button>
                ))}
              </div>
            </div>
            <TrendPanel
              series={initiativeSeries}
              categories={categories}
              split={split}
              title={t('dash.initiativeTrendTitle')}
              info={t('dash.initiativeTrendInfo', { gap: initiativeGap })}
              unit={t('dash.initiativeUnit')}
              decimals={0}
              fullWidth
            />
            <InitiativeBars
              points={points}
              gapMinutes={initiativeGap}
              title={t('dash.initiativeBarsTitle')}
              info={t('dash.initiativeBarsInfo', { gap: initiativeGap })}
            />
          </>
        )}
      </div>
    </div>
  );
}

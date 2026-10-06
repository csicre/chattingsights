import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/state/AppContext';
import { BarChart } from './charts/BarChart';
import { WordCloud } from './charts/WordCloud';
import { RadarChart, type RadarSeries } from './charts/RadarChart';
import { Paywall } from './Paywall';
import { exportAsImage, exportAsPdf } from '@/services/exporter';
import { formatDate, formatNumber } from '@/core/format';
import type { AnalysisReport } from '@/core/types';

const AUTHOR_COLORS = ['#128C7E', '#34B7F1', '#f39c12', '#9b59b6', '#e74c3c', '#16a085'];

export function Report() {
  const { t } = useTranslation();
  const { report, isUnlocked, reset } = useApp();
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  if (!report) return null;
  const lang = report.language;

  const handleExport = async (kind: 'pdf' | 'image') => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      if (kind === 'pdf') await exportAsPdf(reportRef.current);
      else await exportAsImage(reportRef.current);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>{t('report.title')}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {t('report.from')} {formatDate(report.dateRange.start, lang)}{' '}
            {t('report.to')} {formatDate(report.dateRange.end, lang)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={reset}>
            ← {t('common.back')}
          </button>
          {isUnlocked && (
            <>
              <button className="btn btn-ghost" disabled={exporting} onClick={() => handleExport('image')}>
                {exporting ? t('exportReport.generating') : t('exportReport.image')}
              </button>
              <button className="btn btn-primary" disabled={exporting} onClick={() => handleExport('pdf')}>
                {exporting ? t('exportReport.generating') : t('exportReport.pdf')}
              </button>
            </>
          )}
        </div>
      </div>

      <div ref={reportRef}>
        <Overview report={report} />

        {/* --- Secciones gratis (preview) --- */}
        <div className="report-grid">
          <ChartCard title={t('report.sections.byHour')}>
            <BarChart
              data={report.messagesByHour.map((b) => ({ label: b.key, value: b.count }))}
            />
          </ChartCard>

          <ChartCard title={t('report.sections.byWeekday')}>
            <BarChart
              color="#34B7F1"
              data={report.messagesByWeekday.map((b) => ({
                label: t(`weekday.${b.key}`),
                value: b.count,
              }))}
            />
          </ChartCard>
        </div>

        {/* --- Secciones premium (gated) --- */}
        <Gated locked={!isUnlocked} lang={lang}>
          <ChartCard title={t('report.sections.emojis')}>
            {report.topEmojis.length ? (
              <BarChart
                color="#f39c12"
                rotateLabels
                data={report.topEmojis.slice(0, 15).map((e) => ({
                  label: e.emoji,
                  value: e.count,
                }))}
              />
            ) : (
              <p className="muted">{t('report.noData')}</p>
            )}
          </ChartCard>

          <ChartCard title={t('report.sections.wordmap')}>
            {report.topWords.length ? (
              <WordCloud words={report.topWords} />
            ) : (
              <p className="muted">{t('report.noData')}</p>
            )}
          </ChartCard>

          <div className="report-grid">
            <ChartCard title={t('report.sections.sentiment')}>
              <SentimentView report={report} />
            </ChartCard>

            <ChartCard title={t('report.sections.authors')}>
              <AuthorsView report={report} />
            </ChartCard>
          </div>

          <ChartCard title={t('report.sections.responseTime')}>
            <BarChart
              color="#9b59b6"
              data={report.authorStats.map((s) => ({
                label: s.author,
                value: Math.round(s.medianResponseTimeSec ?? 0),
              }))}
            />
            <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              {t('report.responseTimeLabel')} ({t('report.seconds')})
            </p>
          </ChartCard>

          <ChartCard title={t('report.sections.personality')}>
            <PersonalityView report={report} />
          </ChartCard>
        </Gated>
      </div>
    </section>
  );
}

function Overview({ report }: { report: AnalysisReport }) {
  const { t } = useTranslation();
  const lang = report.language;
  const stats = [
    { label: t('report.totalMessages'), value: formatNumber(report.totalMessages, lang) },
    { label: t('report.totalWords'), value: formatNumber(report.totalWords, lang) },
    { label: t('report.totalEmojis'), value: formatNumber(report.highlights.totalEmojis, lang) },
    { label: t('report.avgPerDay'), value: formatNumber(report.highlights.avgMessagesPerDay, lang) },
    { label: t('report.mostActive'), value: report.highlights.mostActiveAuthor },
    { label: t('report.busiestHour'), value: `${report.highlights.busiestHour}:00` },
  ];
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <h3 className="section-title">{t('report.overview')}</h3>
      <div className="stat-grid">
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <div className="value">{s.value}</div>
            <div className="label">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card">
      <h3 className="section-title">{title}</h3>
      {children}
    </div>
  );
}

/** Envoltorio que difumina y superpone el paywall cuando está bloqueado. */
function Gated({
  locked,
  lang,
  children,
}: {
  locked: boolean;
  lang: AnalysisReport['language'];
  children: ReactNode;
}) {
  if (!locked) return <>{children}</>;
  return (
    <div className="locked-wrap">
      <div className="locked-blur">{children}</div>
      <Paywall lang={lang} />
    </div>
  );
}

function SentimentView({ report }: { report: AnalysisReport }) {
  const { t } = useTranslation();
  return (
    <div>
      {report.sentiment.map((s) => {
        const pct = Math.round(((s.score + 1) / 2) * 100);
        return (
          <div key={s.author} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <strong>{s.author}</strong>
              <span className="muted">
                {t('sentiment.score')}: {pct}%
              </span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: '#eee', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, #e74c3c, #f39c12, #25D366)`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AuthorsView({ report }: { report: AnalysisReport }) {
  const { t } = useTranslation();
  const lang = report.language;
  return (
    <div>
      {report.authorStats.map((s) => (
        <div className="author-row" key={s.author}>
          <strong>{s.author}</strong>
          <span className="muted" style={{ fontSize: 14 }}>
            {formatNumber(s.messageCount, lang)} {t('report.messages')} ·{' '}
            {formatNumber(s.wordCount, lang)} {t('report.words')} · {s.emojiCount} 😊
          </span>
        </div>
      ))}
    </div>
  );
}

function PersonalityView({ report }: { report: AnalysisReport }) {
  const { t } = useTranslation();
  if (report.personality.length === 0) return <p className="muted">{t('report.noData')}</p>;

  const axes = report.personality[0].traits.map((tr) => t(`traits.${tr.key}`));
  const series: RadarSeries[] = report.personality.map((p, i) => ({
    name: p.author,
    values: p.traits.map((tr) => tr.score),
    color: AUTHOR_COLORS[i % AUTHOR_COLORS.length],
  }));

  return (
    <div>
      <RadarChart axes={axes} series={series} />
      <div className="legend">
        {series.map((s) => (
          <span className="legend-item" key={s.name}>
            <span className="legend-dot" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

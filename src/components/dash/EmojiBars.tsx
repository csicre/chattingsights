import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { theme, makeColorScale } from '@/core/theme';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import type { EmojiRankRow } from '@/core/dashboard';
import type { SeriesSplit } from '@/core/types';
import { InfoTip } from './InfoTip';
import { Legend } from './Legend';

/**
 * Barras horizontales con el ranking de emojis más usados. Horizontal porque
 * los emojis se leen mejor como etiqueta a la izquierda de cada barra.
 *
 * Obedece la leyenda (`split`): si se divide por persona/día de semana, cada
 * barra se apila por categoría con la escala de color categórica; si no, es una
 * barra única con el color de acento. Tooltip por segmento (conteo y % total).
 */
const MARGIN = { top: 8, right: 48, bottom: 8, left: 52 };

interface EmojiBarsProps {
  rows: EmojiRankRow[];
  categories: string[];
  split: SeriesSplit;
  title: string;
  info: string;
}

export function EmojiBars({ rows, categories, split, title, info }: EmojiBarsProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { width: hostWidth } = useResizeObserver(containerRef);

  // Alto proporcional al nº de barras (cada barra ~34px).
  const count = Math.max(1, rows.length);
  const WIDTH = theme.chart.fullWidth;
  const HEIGHT = MARGIN.top + MARGIN.bottom + count * 34;
  const INNER_W = WIDTH - MARGIN.left - MARGIN.right;
  const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom;

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3
      .select(svgRef.current)
      .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('width', '100%')
      .style('height', 'auto')
      .style('display', 'block');
    svg.selectAll('*').remove();

    if (rows.length === 0) return;

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const y = d3
      .scaleBand<string>()
      .domain(rows.map((d) => d.emoji))
      .range([0, INNER_H])
      .padding(0.22);
    const x = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (d) => d.count) ?? 1])
      .range([0, INNER_W]);

    const isSplit = split !== 'none';
    const color = makeColorScale(categories);
    // Orden de apilado: las categorías declaradas; si no hay split, serie 'all'.
    const stackKeys = isSplit ? categories : ['all'];
    const colorOf = (key: string) => (isSplit ? color(key) : theme.color.accent);

    const grandTotal = d3.sum(rows, (d) => d.count) || 1;
    const tooltipSel = d3.select(tooltipRef.current);

    const rowG = g
      .selectAll('g.row')
      .data(rows)
      .join('g')
      .attr('class', 'row')
      .attr('transform', (d) => `translate(0,${y(d.emoji) ?? 0})`);

    // Emoji como etiqueta a la izquierda (más grande).
    rowG
      .append('text')
      .attr('x', -12)
      .attr('y', y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('font-size', 24)
      .text((d) => d.emoji);

    // Segmentos apilados por categoría.
    rowG.each(function (d) {
      const rowSel = d3.select(this);
      let acc = 0;
      for (const key of stackKeys) {
        const v = d.bySeries[key] ?? 0;
        if (v <= 0) continue;
        const x0 = x(acc);
        const x1 = x(acc + v);
        acc += v;
        rowSel
          .append('rect')
          .attr('x', x0)
          .attr('y', 0)
          .attr('height', y.bandwidth())
          .attr('width', Math.max(0, x1 - x0))
          .attr('rx', 3)
          .attr('fill', colorOf(key))
          .style('cursor', 'default')
          .on('mousemove', (event: MouseEvent) => {
            const pct = ((v / grandTotal) * 100).toFixed(1);
            const seriesLabel = !isSplit
              ? t('legend.allSeries')
              : split === 'weekday'
                ? t(`weekday.${key}`)
                : key;
            tooltipSel
              .style('display', 'block')
              .style('left', `${event.clientX + 14}px`)
              .style('top', `${event.clientY + 14}px`)
              .html(
                `<div class="tt-title">${d.emoji}${isSplit ? ` · ${seriesLabel}` : ''}</div>` +
                  `<div class="tt-row"><span>${t('dash.emojiUnit')}</span><span>${v}</span></div>` +
                  `<div class="tt-row"><span>${t('dash.ofTotal')}</span><span>${pct}%</span></div>`,
              );
          })
          .on('mouseleave', () => tooltipSel.style('display', 'none'));
      }
    });

    // Valor total al final de la barra (más grande).
    rowG
      .append('text')
      .attr('x', (d) => x(d.count) + 8)
      .attr('y', y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('fill', theme.axis.textColor)
      .attr('font-size', 16)
      .attr('font-weight', 600)
      .text((d) => d.count);
  }, [rows, categories, split, hostWidth, WIDTH, HEIGHT, INNER_W, INNER_H, t]);

  return (
    <div className="chart-panel" ref={containerRef}>
      <div className="chart-header">
        <div className="chart-title-row">
          <div className="chart-title">{title}</div>
          <InfoTip text={info} />
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="status">{t('dash.noEmojis')}</p>
      ) : (
        <>
          <div className="chart-svg">
            <svg ref={svgRef} role="img" aria-label={title} />
          </div>
          <Legend categories={categories} split={split} />
        </>
      )}
      <div ref={tooltipRef} className="tooltip" style={{ display: 'none' }} />
    </div>
  );
}

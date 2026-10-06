import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { theme } from '@/core/theme';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import type { EmojiCount } from '@/core/dashboard';
import { InfoTip } from './InfoTip';

/**
 * Barras horizontales con el ranking de emojis más usados. Horizontal porque
 * los emojis se leen mejor como etiqueta a la izquierda de cada barra.
 * Cada barra muestra un tooltip al pasar el ratón (conteo y % sobre el total).
 */
const MARGIN = { top: 8, right: 40, bottom: 8, left: 44 };

interface EmojiBarsProps {
  data: EmojiCount[];
  title: string;
  info: string;
}

export function EmojiBars({ data, title, info }: EmojiBarsProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { width: hostWidth } = useResizeObserver(containerRef);

  // Alto proporcional al nº de barras (cada barra ~26px).
  const rows = Math.max(1, data.length);
  const WIDTH = theme.chart.fullWidth;
  const HEIGHT = MARGIN.top + MARGIN.bottom + rows * 26;
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

    if (data.length === 0) return;

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const y = d3
      .scaleBand<string>()
      .domain(data.map((d) => d.emoji))
      .range([0, INNER_H])
      .padding(0.22);
    const x = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.count) ?? 1])
      .range([0, INNER_W]);

    const total = d3.sum(data, (d) => d.count) || 1;
    const tooltipSel = d3.select(tooltipRef.current);

    const rowG = g
      .selectAll('g.row')
      .data(data)
      .join('g')
      .attr('class', 'row')
      .attr('transform', (d) => `translate(0,${y(d.emoji) ?? 0})`);

    // Emoji como etiqueta a la izquierda.
    rowG
      .append('text')
      .attr('x', -10)
      .attr('y', y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('font-size', 16)
      .text((d) => d.emoji);

    // Barra (con tooltip al hover).
    rowG
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('height', y.bandwidth())
      .attr('rx', 3)
      .attr('fill', theme.color.accent)
      .attr('width', (d) => x(d.count))
      .style('cursor', 'default')
      .on('mousemove', (event: MouseEvent, d) => {
        const pct = ((d.count / total) * 100).toFixed(1);
        tooltipSel
          .style('display', 'block')
          .style('left', `${event.clientX + 14}px`)
          .style('top', `${event.clientY + 14}px`)
          .html(
            `<div class="tt-title">${d.emoji}</div>` +
              `<div class="tt-row"><span>${t('dash.emojiUnit')}</span><span>${d.count}</span></div>` +
              `<div class="tt-row"><span>${t('dash.ofTotal')}</span><span>${pct}%</span></div>`,
          );
      })
      .on('mouseleave', () => tooltipSel.style('display', 'none'));

    // Valor al final de la barra.
    rowG
      .append('text')
      .attr('x', (d) => x(d.count) + 6)
      .attr('y', y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('fill', theme.axis.textColor)
      .attr('font-size', 12)
      .text((d) => d.count);
  }, [data, hostWidth, WIDTH, HEIGHT, INNER_W, INNER_H, t]);

  return (
    <div className="chart-panel" ref={containerRef}>
      <div className="chart-header">
        <div className="chart-title-row">
          <div className="chart-title">{title}</div>
          <InfoTip text={info} />
        </div>
      </div>
      {data.length === 0 ? (
        <p className="status">{t('dash.noEmojis')}</p>
      ) : (
        <>
          <div className="chart-svg">
            <svg ref={svgRef} role="img" aria-label={title} />
          </div>
          <div className="legend">
            <span className="item">
              <span className="swatch" style={{ background: 'var(--accent)' }} />
              {t('dash.emojiLegend')}
            </span>
          </div>
        </>
      )}
      <div ref={tooltipRef} className="tooltip" style={{ display: 'none' }} />
    </div>
  );
}

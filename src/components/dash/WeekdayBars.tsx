import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { theme } from '@/core/theme';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import { buildWeekdayBars } from '@/core/dashboard';
import type { MessagePoint, WeekdayBar } from '@/core/types';
import { InfoTip } from './InfoTip';

/**
 * Gráfico de columnas: nº de mensajes por día de la semana (lun..dom).
 * Tooltip por columna con el día y el conteo.
 */
const MARGIN = { top: 10, right: 14, bottom: 28, left: 42 };

interface Props {
  points: MessagePoint[];
}

export function WeekdayBars({ points }: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { width: hostWidth } = useResizeObserver(containerRef);

  const bars = useMemo(() => buildWeekdayBars(points), [points]);

  const WIDTH = theme.chart.auxWidth;
  const HEIGHT = theme.chart.auxHeight + 20;
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

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const x = d3
      .scaleBand<string>()
      .domain(bars.map((b) => b.key))
      .range([0, INNER_W])
      .padding(0.25);
    const maxCount = d3.max(bars, (b) => b.count) ?? 1;
    const y = d3
      .scaleLinear()
      .domain([0, maxCount * 1.05])
      .nice()
      .range([INNER_H, 0]);

    // Grid
    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickSize(-INNER_W).tickFormat(() => '') as never)
      .call((s) => s.select('.domain').remove())
      .call((s) => s.selectAll('line').attr('stroke', theme.axis.gridColor).attr('stroke-opacity', theme.axis.gridOpacity));

    // Eje X (día de la semana, traducido)
    g.append('g')
      .attr('transform', `translate(0,${INNER_H})`)
      .call(d3.axisBottom(x).tickFormat((k) => t(`weekday.${k}`)).tickSizeOuter(0) as never)
      .call((s) => s.selectAll('line,path').attr('stroke', theme.axis.lineColor))
      .call((s) => s.selectAll('text').attr('fill', theme.axis.textColor));

    // Eje Y
    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickSizeOuter(0) as never)
      .call((s) => s.selectAll('line,path').attr('stroke', theme.axis.lineColor))
      .call((s) => s.selectAll('text').attr('fill', theme.axis.textColor));

    // Columnas
    const tooltipSel = d3.select(tooltipRef.current);
    const total = d3.sum(bars, (b) => b.count) || 1;

    g.selectAll('rect.col')
      .data(bars)
      .join('rect')
      .attr('class', 'col')
      .attr('x', (d) => x(d.key) ?? 0)
      .attr('y', (d) => y(d.count))
      .attr('width', x.bandwidth())
      .attr('height', (d) => INNER_H - y(d.count))
      .attr('fill', theme.color.accent)
      .attr('fill-opacity', 0.85)
      .attr('rx', 3)
      .on('mousemove', (event: MouseEvent, d: WeekdayBar) => {
        const pct = ((d.count / total) * 100).toFixed(1);
        tooltipSel
          .style('display', 'block')
          .style('left', `${event.clientX + 14}px`)
          .style('top', `${event.clientY + 14}px`)
          .html(
            `<div class="tt-title">${t(`weekdayFull.${d.key}`)}</div>` +
            `<div class="tt-row"><span>${t('dash.msgCount')}</span><span>${d.count}</span></div>` +
            `<div class="tt-row"><span>${t('dash.ofTotal')}</span><span>${pct}%</span></div>`,
          );
      })
      .on('mouseleave', () => tooltipSel.style('display', 'none'));
  }, [bars, hostWidth, t, WIDTH, HEIGHT, INNER_W, INNER_H]);

  return (
    <div className="aux-panel" ref={containerRef}>
      <div className="aux-head">
        <div className="chart-title-row">
          <h4>{t('dash.weekdayTitle')}</h4>
          <InfoTip text={t('dash.weekdayInfo')} />
        </div>
      </div>
      <svg ref={svgRef} role="img" aria-label={t('dash.weekdayTitle')} />
      <div ref={tooltipRef} className="tooltip" style={{ display: 'none' }} />
    </div>
  );
}

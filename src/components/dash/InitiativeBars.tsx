import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { theme } from '@/core/theme';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import { buildInitiativeBars } from '@/core/dashboard';
import type { InitiativeBar, MessagePoint } from '@/core/types';
import { InfoTip } from './InfoTip';

/**
 * Gráfico de columnas: nº de conversaciones iniciadas por cada autor.
 * Una conversación se separa de la siguiente cuando pasa más de `gapMinutes`
 * de inactividad. El tooltip de cada columna muestra el conteo, el porcentaje
 * sobre el total y el parámetro de hueco usado.
 */
const MARGIN = { top: 10, right: 14, bottom: 48, left: 42 };

interface Props {
  points: MessagePoint[];
  gapMinutes: number;
  title: string;
  info: string;
}

export function InitiativeBars({ points, gapMinutes, title, info }: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { width: hostWidth } = useResizeObserver(containerRef);

  const bars = useMemo(
    () => buildInitiativeBars(points, gapMinutes),
    [points, gapMinutes],
  );

  const WIDTH = theme.chart.fullWidth;
  const HEIGHT = 300;
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
      .domain(bars.map((b) => b.author))
      .range([0, INNER_W])
      .padding(0.25);
    const maxCount = d3.max(bars, (b) => b.count) ?? 1;
    const y = d3
      .scaleLinear()
      .domain([0, maxCount * 1.05])
      .nice()
      .range([INNER_H, 0]);

    // Grid horizontal
    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickSize(-INNER_W).tickFormat(() => '') as never)
      .call((s) => s.select('.domain').remove())
      .call((s) =>
        s
          .selectAll('line')
          .attr('stroke', theme.axis.gridColor)
          .attr('stroke-opacity', theme.axis.gridOpacity),
      );

    // Eje X (autores)
    g.append('g')
      .attr('transform', `translate(0,${INNER_H})`)
      .call(d3.axisBottom(x).tickSizeOuter(0) as never)
      .call((s) => s.selectAll('line,path').attr('stroke', theme.axis.lineColor))
      .call((s) =>
        s
          .selectAll('text')
          .attr('fill', theme.axis.textColor)
          .attr('transform', 'rotate(-20)')
          .style('text-anchor', 'end'),
      );

    // Eje Y
    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickSizeOuter(0) as never)
      .call((s) => s.selectAll('line,path').attr('stroke', theme.axis.lineColor))
      .call((s) => s.selectAll('text').attr('fill', theme.axis.textColor));

    // Columnas
    const tooltipSel = d3.select(tooltipRef.current);
    g.selectAll('rect.col')
      .data(bars)
      .join('rect')
      .attr('class', 'col')
      .attr('x', (d) => x(d.author) ?? 0)
      .attr('y', (d) => y(d.count))
      .attr('width', x.bandwidth())
      .attr('height', (d) => INNER_H - y(d.count))
      .attr('fill', theme.color.accent)
      .attr('fill-opacity', 0.85)
      .attr('rx', 3)
      .on('mousemove', (event: MouseEvent, d: InitiativeBar) => {
        tooltipSel
          .style('display', 'block')
          .style('left', `${event.clientX + 14}px`)
          .style('top', `${event.clientY + 14}px`)
          .html(
            `<div class="tt-title">${d.author}</div>` +
              `<div class="tt-row"><span>${t('dash.initiativeCount')}</span><span>${d.count}</span></div>` +
              `<div class="tt-row"><span>${t('dash.ofTotal')}</span><span>${d.pct.toFixed(1)}%</span></div>` +
              `<div class="tt-row"><span>${t('dash.initiativeGap')}</span><span>${gapMinutes} min</span></div>`,
          );
      })
      .on('mouseleave', () => tooltipSel.style('display', 'none'));
  }, [bars, gapMinutes, hostWidth, t, WIDTH, HEIGHT, INNER_W, INNER_H]);

  return (
    <div className="chart-panel" ref={containerRef}>
      <div className="chart-header">
        <div className="chart-title-row">
          <div className="chart-title">{title}</div>
          <InfoTip text={info} />
        </div>
      </div>
      {bars.length === 0 ? (
        <p className="status">{t('dash.noData')}</p>
      ) : (
        <div className="chart-svg">
          <svg ref={svgRef} role="img" aria-label={title} />
        </div>
      )}
      <div ref={tooltipRef} className="tooltip" style={{ display: 'none' }} />
    </div>
  );
}

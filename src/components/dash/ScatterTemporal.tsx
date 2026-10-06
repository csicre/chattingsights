import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { theme, makeColorScale } from '@/core/theme';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import { buildTemporalScatter } from '@/core/dashboard';
import type { MessagePoint, TemporalPoint, TimeGroup } from '@/core/types';
import { InfoTip } from './InfoTip';
import { Legend } from './Legend';

/**
 * Scatter temporal: X = timestamp del periodo, Y = longitud media en palabras,
 * tamaño proporcional al nº de mensajes. Responde a la agrupación temporal y al
 * toggle de "Persona". Tooltip rico por punto y leyenda.
 */
const MARGIN = { top: 16, right: 20, bottom: 48, left: 56 };

interface Props {
  points: MessagePoint[];
  categories: string[];
  timeGroup: TimeGroup;
  splitByAuthor: boolean;
}

export function ScatterTemporal({ points, categories, timeGroup, splitByAuthor }: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { width: hostWidth } = useResizeObserver(containerRef);

  const WIDTH = theme.chart.fullWidth;
  const HEIGHT = theme.chart.height;
  const INNER_W = WIDTH - MARGIN.left - MARGIN.right;
  const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom;

  const data = useMemo(
    () => buildTemporalScatter(points, timeGroup, splitByAuthor),
    [points, timeGroup, splitByAuthor],
  );

  const color = useMemo(() => makeColorScale(categories), [categories]);

  const rScale = useMemo(() => {
    const maxC = d3.max(data, (d) => d.count) ?? 1;
    return d3.scaleSqrt().domain([1, maxC]).range([3, 16]);
  }, [data]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3
      .select<SVGSVGElement, unknown>(svgRef.current)
      .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('width', '100%')
      .style('height', 'auto')
      .style('display', 'block');
    svg.selectAll('*').remove();
    if (data.length === 0) return;

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const x = d3
      .scaleTime()
      .domain(d3.extent(data, (d) => d.t) as [Date, Date])
      .range([0, INNER_W]);
    const y = d3
      .scaleLinear()
      .domain([0, (d3.max(data, (d) => d.avgWords) ?? 1) * 1.1])
      .nice()
      .range([INNER_H, 0]);

    // Ejes
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${INNER_H})`)
      .call(d3.axisBottom(x).ticks(8).tickSizeOuter(0) as never)
      .call((s) => s.selectAll('line,path').attr('stroke', theme.axis.lineColor))
      .call((s) => s.selectAll('text').attr('fill', theme.axis.textColor));
    g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0) as never)
      .call((s) => s.selectAll('line,path').attr('stroke', theme.axis.lineColor))
      .call((s) => s.selectAll('text').attr('fill', theme.axis.textColor));

    // Grid
    g.selectAll('line.grid')
      .data(y.ticks(6))
      .join('line')
      .attr('x1', 0).attr('x2', INNER_W)
      .attr('y1', (d) => y(d)).attr('y2', (d) => y(d))
      .attr('stroke', theme.axis.gridColor).attr('stroke-opacity', theme.axis.gridOpacity);

    // Títulos de eje
    g.append('text')
      .attr('class', 'axis-label')
      .attr('x', INNER_W / 2).attr('y', INNER_H + 40)
      .attr('text-anchor', 'middle')
      .text(t('dash.temporalXLabel'));
    g.append('text')
      .attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -INNER_H / 2).attr('y', -42)
      .attr('text-anchor', 'middle')
      .text(t('dash.temporalYLabel'));

    // Puntos
    g.selectAll('circle.pt')
      .data(data)
      .join('circle')
      .attr('class', 'pt')
      .attr('cx', (d) => x(d.t))
      .attr('cy', (d) => y(d.avgWords))
      .attr('r', (d) => rScale(d.count))
      .attr('fill', (d) => splitByAuthor ? color(d.key) : theme.color.accent)
      .attr('fill-opacity', 0.6)
      .attr('stroke', theme.point.stroke)
      .attr('stroke-width', theme.point.strokeWidth);

    // Tooltip
    const tooltipSel = d3.select(tooltipRef.current);
    const fmtDate = (d: Date) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);

    g.selectAll<SVGCircleElement, TemporalPoint>('circle.pt')
      .on('mousemove', (event: MouseEvent, d) => {
        tooltipSel
          .style('display', 'block')
          .style('left', `${event.clientX + 14}px`)
          .style('top', `${event.clientY + 14}px`)
          .html(
            `<div class="tt-title">${fmtDate(d.t)}</div>` +
            (splitByAuthor ? `<div class="tt-row"><span>${t('detail.author')}</span><span>${d.key}</span></div>` : '') +
            `<div class="tt-row"><span>${t('dash.msgCount')}</span><span>${d.count}</span></div>` +
            `<div class="tt-row"><span>${t('dash.temporalYLabel')}</span><span>${d3.format(',.1f')(d.avgWords)}</span></div>`,
          );
      })
      .on('mouseleave', () => tooltipSel.style('display', 'none'));
  }, [data, color, rScale, splitByAuthor, hostWidth, t, WIDTH, HEIGHT, INNER_W, INNER_H]);

  return (
    <div className="chart-panel" ref={containerRef}>
      <div className="chart-header">
        <div className="chart-title-row">
          <div className="chart-title">{t('dash.temporalTitle')}</div>
          <InfoTip text={t('dash.temporalInfo')} />
        </div>
      </div>
      {data.length === 0 ? (
        <p className="status">{t('dash.noData')}</p>
      ) : (
        <div className="chart-svg">
          <svg ref={svgRef} role="img" aria-label={t('dash.temporalTitle')} />
        </div>
      )}
      <Legend categories={categories} splitByAuthor={splitByAuthor} />
      <div ref={tooltipRef} className="tooltip" style={{ display: 'none' }} />
    </div>
  );
}

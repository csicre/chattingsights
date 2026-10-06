import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { theme, makeColorScale } from '@/core/theme';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import { buildResponseBars, type ResponseBar } from '@/core/dashboard';
import type { MessagePoint, SeriesSplit } from '@/core/types';
import { InfoTip } from './InfoTip';
import { Legend } from './Legend';

/**
 * Gráfico de columnas: tiempo de respuesta medio (en minutos) por serie, según
 * la leyenda elegida (persona / día de semana / 'all'). Mismo criterio que la
 * evolución temporal: se descartan los huecos muy largos (nuevas conversaciones).
 * Tooltip por columna con la media y el nº de respuestas.
 */
const MARGIN = { top: 10, right: 14, bottom: 48, left: 46 };

interface Props {
  points: MessagePoint[];
  categories: string[];
  split: SeriesSplit;
  title: string;
  info: string;
}

export function ResponseBars({ points, categories, split, title, info }: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { width: hostWidth } = useResizeObserver(containerRef);

  const bars = useMemo(() => buildResponseBars(points, split), [points, split]);

  const WIDTH = theme.chart.fullWidth;
  const HEIGHT = 300;
  const INNER_W = WIDTH - MARGIN.left - MARGIN.right;
  const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom;

  const labelOf = (key: string) =>
    split === 'none' ? t('legend.allSeries') : split === 'weekday' ? t(`weekday.${key}`) : key;

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

    if (bars.length === 0) return;

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const x = d3
      .scaleBand<string>()
      .domain(bars.map((b) => b.key))
      .range([0, INNER_W])
      .padding(0.25);
    const maxVal = d3.max(bars, (b) => b.avgMinutes) ?? 1;
    const y = d3
      .scaleLinear()
      .domain([0, maxVal * 1.05 || 1])
      .nice()
      .range([INNER_H, 0]);

    const isSplit = split !== 'none';
    const color = makeColorScale(categories);
    const colorOf = (key: string) => (isSplit ? color(key) : theme.color.accent);

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

    // Eje X (series)
    g.append('g')
      .attr('transform', `translate(0,${INNER_H})`)
      .call(d3.axisBottom(x).tickFormat((k) => labelOf(k)).tickSizeOuter(0) as never)
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
      .attr('x', (d) => x(d.key) ?? 0)
      .attr('y', (d) => y(d.avgMinutes))
      .attr('width', x.bandwidth())
      .attr('height', (d) => INNER_H - y(d.avgMinutes))
      .attr('fill', (d) => colorOf(d.key))
      .attr('fill-opacity', 0.85)
      .attr('rx', 3)
      .on('mousemove', (event: MouseEvent, d: ResponseBar) => {
        tooltipSel
          .style('display', 'block')
          .style('left', `${event.clientX + 14}px`)
          .style('top', `${event.clientY + 14}px`)
          .html(
            `<div class="tt-title">${labelOf(d.key)}</div>` +
              `<div class="tt-row"><span>${t('dash.minutesUnit')}</span><span>${d.avgMinutes.toFixed(1)}</span></div>` +
              `<div class="tt-row"><span>${t('dash.responseCount')}</span><span>${d.count}</span></div>`,
          );
      })
      .on('mouseleave', () => tooltipSel.style('display', 'none'));
  }, [bars, categories, split, hostWidth, t, WIDTH, HEIGHT, INNER_W, INNER_H]);

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

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { theme, makeColorScale } from '@/core/theme';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import type { WordBar } from '@/core/dashboard';
import type { SeriesSplit } from '@/core/types';
import { InfoTip } from './InfoTip';
import { Legend } from './Legend';

/**
 * Diagrama de barras (compacto, media columna) del nº TOTAL de apariciones de
 * la palabra buscada por serie, según la leyenda (persona / día de semana /
 * 'all'). Comparte el conteo con la evolución temporal del buscador.
 */
const MARGIN = { top: 10, right: 12, bottom: 46, left: 40 };

interface Props {
  bars: WordBar[];
  categories: string[];
  split: SeriesSplit;
  title: string;
  info: string;
  unit: string;
}

export function WordBars({ bars, categories, split, title, info, unit }: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { width: hostWidth } = useResizeObserver(containerRef);

  const WIDTH = theme.chart.auxWidth;
  const HEIGHT = 260;
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
    const maxVal = d3.max(bars, (b) => b.count) ?? 1;
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
      .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('d')).tickSizeOuter(0) as never)
      .call((s) => s.selectAll('line,path').attr('stroke', theme.axis.lineColor))
      .call((s) => s.selectAll('text').attr('fill', theme.axis.textColor));

    // Columnas
    const tooltipSel = d3.select(tooltipRef.current);
    g.selectAll('rect.col')
      .data(bars)
      .join('rect')
      .attr('class', 'col')
      .attr('x', (d) => x(d.key) ?? 0)
      .attr('y', (d) => y(d.count))
      .attr('width', x.bandwidth())
      .attr('height', (d) => INNER_H - y(d.count))
      .attr('fill', (d) => colorOf(d.key))
      .attr('fill-opacity', 0.85)
      .attr('rx', 3)
      .on('mousemove', (event: MouseEvent, d: WordBar) => {
        tooltipSel
          .style('display', 'block')
          .style('left', `${event.clientX + 14}px`)
          .style('top', `${event.clientY + 14}px`)
          .html(
            `<div class="tt-title">${labelOf(d.key)}</div>` +
              `<div class="tt-row"><span>${unit}</span><span>${d.count}</span></div>`,
          );
      })
      .on('mouseleave', () => tooltipSel.style('display', 'none'));
  }, [bars, categories, split, unit, hostWidth, t, WIDTH, HEIGHT, INNER_W, INNER_H]);

  return (
    <div className="aux-panel" ref={containerRef}>
      <div className="aux-head">
        <div className="chart-title-row">
          <h4>{title}</h4>
          <InfoTip text={info} />
        </div>
      </div>
      {bars.length === 0 ? (
        <p className="status">{t('dash.noData')}</p>
      ) : (
        <>
          <svg ref={svgRef} role="img" aria-label={title} />
          <Legend categories={categories} split={split} />
        </>
      )}
      <div ref={tooltipRef} className="tooltip" style={{ display: 'none' }} />
    </div>
  );
}

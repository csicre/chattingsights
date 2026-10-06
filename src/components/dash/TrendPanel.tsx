import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { theme, makeColorScale } from '@/core/theme';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import type { TrendSeries } from '@/core/types';
import { InfoTip } from './InfoTip';
import { Legend } from './Legend';

/**
 * Panel de evolución temporal reutilizable. Recibe las SERIES ya calculadas
 * (una por autor, o una única 'all') y dibuja una línea por serie con tooltip
 * por punto. Agnóstico de la métrica: el padre decide qué serie pasar.
 *
 * props:
 *  - series: series temporales ya calculadas.
 *  - unit: unidad para el tooltip (p. ej. "mensajes", "palabras", "min").
 *  - decimals: nº de decimales a mostrar en el tooltip.
 *  - fullWidth: si true, usa el viewBox a ancho completo (panel grande); si no,
 *    el compacto de la fila auxiliar.
 */
const MARGIN = { top: 12, right: 16, bottom: 24, left: 44 };

interface TrendPanelProps {
  series: TrendSeries[];
  categories: string[];
  splitByAuthor: boolean;
  title: string;
  info: string;
  unit: string;
  decimals?: number;
  fullWidth?: boolean;
}

export function TrendPanel({
  series,
  categories,
  splitByAuthor,
  title,
  info,
  unit,
  decimals = 1,
  fullWidth = false,
}: TrendPanelProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { width: hostWidth } = useResizeObserver(containerRef);

  const WIDTH = fullWidth ? theme.chart.fullWidth : theme.chart.auxWidth;
  const HEIGHT = fullWidth ? 260 : theme.chart.auxHeight;
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
    const gXAxis = g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${INNER_H})`);
    const gYAxis = g.append('g').attr('class', 'y-axis');
    const gLines = g.append('g').attr('class', 'lines');

    const allPts = series.flatMap((s) => s.points);

    const x = d3
      .scaleTime()
      .domain(allPts.length ? (d3.extent(allPts, (d) => d.t) as [Date, Date]) : [new Date(), new Date()])
      .range([0, INNER_W]);
    const y = d3
      .scaleLinear()
      .domain([0, (d3.max(allPts, (d) => d.value) ?? 0) * 1.1 || 1])
      .nice()
      .range([INNER_H, 0]);

    const color = makeColorScale(categories);
    const lineColor = splitByAuthor ? null : theme.color.accent;

    gXAxis.call(d3.axisBottom(x).ticks(5).tickSizeOuter(0) as never);
    gYAxis.call(d3.axisLeft(y).ticks(4).tickSizeOuter(0) as never);
    gXAxis.selectAll('line,path').attr('stroke', theme.axis.lineColor);
    gXAxis.selectAll('text').attr('fill', theme.axis.textColor);
    gYAxis.selectAll('line,path').attr('stroke', theme.axis.lineColor);
    gYAxis.selectAll('text').attr('fill', theme.axis.textColor);

    const line = d3
      .line<{ t: Date; value: number }>()
      .x((d) => x(d.t))
      .y((d) => y(d.value))
      .curve(d3.curveMonotoneX);

    const groups = gLines
      .selectAll('g.serie')
      .data(series, (s) => (s as TrendSeries).key)
      .join((enter) => {
        const gg = enter.append('g').attr('class', 'serie');
        gg.append('path').attr('class', 'trend-line').attr('fill', 'none').attr('stroke-width', 1.8);
        return gg;
      });

    groups
      .select<SVGPathElement>('path.trend-line')
      .attr('stroke', (s) => lineColor ?? color(s.key))
      .attr('d', (s) => line(s.points));

    // Puntos + hit-testing manual para el tooltip.
    const tooltipSel = d3.select(tooltipRef.current);
    const hit: { cx: number; cy: number; key: string; value: number; t: Date }[] = [];

    groups.each(function (s) {
      d3.select(this)
        .selectAll('circle')
        .data(s.points)
        .join('circle')
        .attr('cx', (d) => x(d.t))
        .attr('cy', (d) => y(d.value))
        .attr('r', 2.5)
        .attr('fill', lineColor ?? color(s.key));
      for (const pt of s.points) {
        hit.push({ cx: x(pt.t), cy: y(pt.value), key: s.key, value: pt.value, t: pt.t });
      }
    });

    const fmtDate = (d: Date) =>
      new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);
    const fmtVal = d3.format(`,.${decimals}f`);

    svg
      .on('mousemove.tip', (event: MouseEvent) => {
        const [mx, my] = d3.pointer(event, g.node());
        let best = -1;
        let bestD = Infinity;
        for (let i = 0; i < hit.length; i++) {
          const dx = hit[i].cx - mx;
          const dy = hit[i].cy - my;
          const dist = dx * dx + dy * dy;
          if (dist < bestD) {
            bestD = dist;
            best = i;
          }
        }
        if (best < 0 || bestD > 20 * 20) {
          tooltipSel.style('display', 'none');
          return;
        }
        const h = hit[best];
        tooltipSel
          .style('display', 'block')
          .style('left', `${event.clientX + 14}px`)
          .style('top', `${event.clientY + 14}px`)
          .html(
            `<div class="tt-title">${fmtDate(h.t)}</div>` +
              (splitByAuthor && h.key !== 'all'
                ? `<div class="tt-row"><span>serie</span><span>${h.key}</span></div>`
                : '') +
              `<div class="tt-row"><span>${unit}</span><span>${fmtVal(h.value)}</span></div>`,
          );
      })
      .on('mouseleave.tip', () => tooltipSel.style('display', 'none'));

    return () => {
      svg.on('mousemove.tip', null).on('mouseleave.tip', null);
      svg.selectAll('*').remove();
    };
  }, [series, categories, splitByAuthor, unit, decimals, hostWidth, INNER_W, INNER_H, WIDTH, HEIGHT]);

  return (
    <div className={fullWidth ? 'chart-panel' : 'aux-panel'} ref={containerRef}>
      <div className={fullWidth ? 'chart-header' : 'aux-head'}>
        <div className="chart-title-row">
          {fullWidth ? <div className="chart-title">{title}</div> : <h4>{title}</h4>}
          <InfoTip text={info} />
        </div>
      </div>
      {series.length === 0 ? (
        <p className="status">{t('dash.noData')}</p>
      ) : (
        <>
          {fullWidth ? (
            <div className="chart-svg">
              <svg ref={svgRef} role="img" aria-label={title} />
            </div>
          ) : (
            <svg ref={svgRef} role="img" aria-label={title} />
          )}
          <Legend categories={categories} splitByAuthor={splitByAuthor} />
        </>
      )}
      <div ref={tooltipRef} className="tooltip" style={{ display: 'none' }} />
    </div>
  );
}

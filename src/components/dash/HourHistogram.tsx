import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { theme } from '@/core/theme';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import { buildHourHistogram, hourBinLabel } from '@/core/dashboard';
import type { HourBin, MessagePoint } from '@/core/types';
import { InfoTip } from './InfoTip';

/**
 * Histograma de mensajes por franja horaria del día. El usuario puede elegir el
 * tamaño del bin (15 / 30 / 60 min) con un segmented en la cabecera.
 * Tooltip por barra con la franja y el conteo.
 */
const MARGIN = { top: 10, right: 14, bottom: 40, left: 42 };
const BIN_OPTIONS = [15, 30, 60] as const;

interface Props {
  points: MessagePoint[];
}

export function HourHistogram({ points }: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { width: hostWidth } = useResizeObserver(containerRef);
  const [binMinutes, setBinMinutes] = useState<number>(30);

  const bins = useMemo(() => buildHourHistogram(points, binMinutes), [points, binMinutes]);

  const WIDTH = theme.chart.auxWidth;
  const HEIGHT = theme.chart.auxHeight + 20; // algo más alto para los ticks rotados
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

    if (bins.length === 0) return;

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const x = d3
      .scaleLinear()
      .domain([0, 1440])
      .range([0, INNER_W]);
    const maxCount = d3.max(bins, (b) => b.count) ?? 1;
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

    // Eje X: ticks cada 3h, formato hh:mm
    const xTicks = d3.range(0, 1441, 180);
    const fmtMin = (m: number) => {
      const hh = Math.floor(m / 60);
      const mm = m % 60;
      return `${hh}:${mm < 10 ? '0' : ''}${mm}`;
    };
    g.append('g')
      .attr('transform', `translate(0,${INNER_H})`)
      .call(d3.axisBottom(x).tickValues(xTicks).tickFormat((d) => fmtMin(d as number)).tickSizeOuter(0) as never)
      .call((s) => s.selectAll('line,path').attr('stroke', theme.axis.lineColor))
      .call((s) => s.selectAll('text').attr('fill', theme.axis.textColor)
        .attr('transform', 'rotate(-30)').style('text-anchor', 'end'));

    // Eje Y
    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickSizeOuter(0) as never)
      .call((s) => s.selectAll('line,path').attr('stroke', theme.axis.lineColor))
      .call((s) => s.selectAll('text').attr('fill', theme.axis.textColor));

    // Barras
    const barW = INNER_W / bins.length;
    const tooltipSel = d3.select(tooltipRef.current);
    const total = d3.sum(bins, (b) => b.count) || 1;

    g.selectAll('rect.bar')
      .data(bins)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(d.startMinute) + 1)
      .attr('y', (d) => y(d.count))
      .attr('width', Math.max(0, barW - 2))
      .attr('height', (d) => INNER_H - y(d.count))
      .attr('fill', theme.color.accent)
      .attr('fill-opacity', 0.8)
      .attr('rx', 2)
      .on('mousemove', (event: MouseEvent, d: HourBin) => {
        const pct = ((d.count / total) * 100).toFixed(1);
        tooltipSel
          .style('display', 'block')
          .style('left', `${event.clientX + 14}px`)
          .style('top', `${event.clientY + 14}px`)
          .html(
            `<div class="tt-title">${hourBinLabel(d)}</div>` +
            `<div class="tt-row"><span>${t('dash.msgCount')}</span><span>${d.count}</span></div>` +
            `<div class="tt-row"><span>${t('dash.ofTotal')}</span><span>${pct}%</span></div>`,
          );
      })
      .on('mouseleave', () => tooltipSel.style('display', 'none'));
  }, [bins, hostWidth, t, WIDTH, HEIGHT, INNER_W, INNER_H]);

  return (
    <div className="aux-panel" ref={containerRef}>
      <div className="aux-head">
        <div className="chart-title-row">
          <h4>{t('dash.histTitle')}</h4>
          <InfoTip text={t('dash.histInfo')} />
        </div>
        <div className="chart-toolbar">
          <div className="segmented" style={{ gap: 3 }}>
            {BIN_OPTIONS.map((b) => (
              <button
                key={b}
                className={binMinutes === b ? 'active' : ''}
                onClick={() => setBinMinutes(b)}
                style={{ padding: '3px 7px', fontSize: 11 }}
              >
                {b}{t('dash.binMin')}
              </button>
            ))}
          </div>
        </div>
      </div>
      <svg ref={svgRef} role="img" aria-label={t('dash.histTitle')} />
      <div ref={tooltipRef} className="tooltip" style={{ display: 'none' }} />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { theme, makeColorScale } from '@/core/theme';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import type { MessagePoint } from '@/core/types';
import { InfoTip } from './InfoTip';
import { Legend } from './Legend';

/**
 * Scatter plot (hora del mensaje × longitud) en d3 montado sobre React.
 * React controla datos y ciclo de vida; d3 dibuja el SVG.
 *
 * Interacción:
 *  - Hover: tooltip rico (autor, hora, longitud, extracto del texto).
 *  - Rueda: zoom in/out centrado en el cursor.
 *  - Arrastrar: caja de selección (brush) para hacer zoom a una región.
 *  - Mayús + arrastrar: desplazar (pan).
 *  - Clic en un punto: navega al detalle del mensaje (onPointClick).
 *
 * Colores por autor con la misma escala que las leyendas/tendencias.
 */
const MARGIN = { top: 16, right: 20, bottom: 48, left: 56 };
const TRANSITION_MS = 450;
const MAX_ZOOM = 40;

interface ScatterPlotProps {
  points: MessagePoint[];
  /** Autores presentes (dominio de color). */
  categories: string[];
  onPointClick: (p: MessagePoint) => void;
}

export function ScatterPlot({ points, categories, onPointClick }: ScatterPlotProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const clickRef = useRef(onPointClick);
  clickRef.current = onPointClick;

  const { width: hostWidth } = useResizeObserver(containerRef);
  const [zoomed, setZoomed] = useState(false);

  const WIDTH = theme.chart.fullWidth;
  const HEIGHT = theme.chart.height;
  const INNER_W = WIDTH - MARGIN.left - MARGIN.right;
  const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom;

  // 1) Estructura del SVG + handlers (una vez).
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3
      .select<SVGSVGElement, unknown>(svgRef.current)
      .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('width', '100%')
      .style('height', 'auto')
      .style('display', 'block');

    const clipId = `scatter-clip-${Math.random().toString(36).slice(2, 8)}`;
    svg
      .append('defs')
      .append('clipPath')
      .attr('id', clipId)
      .append('rect')
      .attr('width', INNER_W)
      .attr('height', INNER_H);

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);
    const gGrid = g.append('g').attr('class', 'grid');
    const gXAxis = g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${INNER_H})`);
    const gYAxis = g.append('g').attr('class', 'y-axis');
    const plot = g.append('g').attr('clip-path', `url(#${clipId})`);
    const gPoints = plot.append('g').attr('class', 'points');
    const gBrush = plot.append('g').attr('class', 'brush');

    g.append('text')
      .attr('class', 'axis-label x-title')
      .attr('x', INNER_W / 2)
      .attr('y', INNER_H + 40)
      .attr('text-anchor', 'middle');
    g.append('text')
      .attr('class', 'axis-label y-title')
      .attr('transform', 'rotate(-90)')
      .attr('x', -INNER_H / 2)
      .attr('y', -42)
      .attr('text-anchor', 'middle');

    const x = d3.scaleLinear().domain([0, 24]).range([0, INNER_W]);
    const y = d3.scaleLinear().range([INNER_H, 0]);

    const scene: Scene = {
      svg,
      x,
      y,
      gGrid,
      gXAxis,
      gYAxis,
      gPoints,
      tX: { k: 1, t: 0 },
      tY: { k: 1, t: 0 },
      hovered: null,
      tree: null,
      zx: x,
      zy: y,
      render: () => {},
    };
    sceneRef.current = scene;

    const refreshZoomed = () =>
      setZoomed(scene.tX.k !== 1 || scene.tX.t !== 0 || scene.tY.k !== 1 || scene.tY.t !== 0);

    const clampAxis = (a: Axis, size: number) => {
      a.k = Math.max(1, Math.min(MAX_ZOOM, a.k));
      const minT = size - a.k * size;
      a.t = Math.max(minT, Math.min(0, a.t));
    };

    // Rueda: zoom centrado en el cursor.
    svg.on('wheel.zoom', (event: WheelEvent) => {
      event.preventDefault();
      const [mx, my] = d3.pointer(event, gBrush.node());
      if (mx < 0 || mx > INNER_W || my < 0 || my > INNER_H) return;
      const factor = event.deltaY < 0 ? 1.2 : 1 / 1.2;
      const step = (a: Axis, p: number, size: number): Axis => {
        const kNew = Math.max(1, Math.min(MAX_ZOOM, a.k * factor));
        const ratio = kNew / a.k;
        const b: Axis = { k: kNew, t: p - ratio * (p - a.t) };
        clampAxis(b, size);
        return b;
      };
      scene.tX = step(scene.tX, mx, INNER_W);
      scene.tY = step(scene.tY, my, INNER_H);
      scene.render(false);
      refreshZoomed();
    });

    // Brush: zoom de caja; caja diminuta = clic (navega al punto bajo cursor).
    const brush = d3
      .brush<unknown>()
      .extent([
        [0, 0],
        [INNER_W, INNER_H],
      ])
      .filter((event) => !event.button && !event.shiftKey)
      .on('end', (event) => {
        const sel = event.selection as [[number, number], [number, number]] | null;
        if (!sel) {
          if (scene.hovered) clickRef.current(scene.hovered);
          return;
        }
        const [[x0, y0], [x1, y1]] = sel;
        gBrush.call(brush.move, null);
        if (Math.abs(x1 - x0) < 4 || Math.abs(y1 - y0) < 4) {
          if (scene.hovered) clickRef.current(scene.hovered);
          return;
        }
        const zx = scene.zx;
        const zy = scene.zy;
        const dxa = zx.invert(Math.min(x0, x1));
        const dxb = zx.invert(Math.max(x0, x1));
        const dya = zy.invert(Math.min(y0, y1));
        const dyb = zy.invert(Math.max(y0, y1));
        const fitAxis = (base: d3.ScaleLinear<number, number>, dA: number, dB: number, size: number): Axis => {
          let pA = base(dA);
          let pB = base(dB);
          if (pA > pB) [pA, pB] = [pB, pA];
          const k = size / (pB - pA || 1);
          const b: Axis = { k, t: -k * pA };
          clampAxis(b, size);
          return b;
        };
        scene.tX = fitAxis(x, dxa, dxb, INNER_W);
        scene.tY = fitAxis(y, dya, dyb, INNER_H);
        scene.render(true);
        refreshZoomed();
      });
    gBrush.call(brush);

    // Pan con Shift.
    const drag = d3
      .drag<SVGSVGElement, unknown>()
      .filter((event) => (event as MouseEvent).shiftKey && !(event as MouseEvent).button)
      .on('drag', (event) => {
        scene.tX = { k: scene.tX.k, t: scene.tX.t + event.dx };
        scene.tY = { k: scene.tY.k, t: scene.tY.t + event.dy };
        clampAxis(scene.tX, INNER_W);
        clampAxis(scene.tY, INNER_H);
        scene.render(false);
        refreshZoomed();
      });
    svg.call(drag);

    // Modo pan (cursor) con Shift.
    const brushOverlay = gBrush.select('.overlay');
    const setPan = (on: boolean) => {
      svg.classed('pan-mode', on);
      brushOverlay.style('pointer-events', on ? 'none' : 'all');
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setPan(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setPan(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Tooltip por hit-testing con quadtree.
    const tooltipSel = d3.select(tooltipRef.current);
    const HOVER_SLACK = 6;
    brushOverlay
      .on('mousemove.tip', (event: MouseEvent) => {
        if (!scene.tree) return;
        const [mx, my] = d3.pointer(event, gBrush.node());
        const r = theme.point.radius + HOVER_SLACK;
        const found = scene.tree.find(mx, my, r);
        if (!found) {
          tooltipSel.style('display', 'none');
          scene.hovered = null;
          scene.svg.classed('clickable', false);
          highlight(scene, null);
          return;
        }
        scene.hovered = found;
        scene.svg.classed('clickable', !scene.svg.classed('pan-mode'));
        highlight(scene, found);
        tooltipSel
          .style('display', 'block')
          .style('left', `${event.clientX + 14}px`)
          .style('top', `${event.clientY + 14}px`)
          .html(tooltipHtml(found, t));
      })
      .on('mouseleave.tip', () => {
        tooltipSel.style('display', 'none');
        scene.hovered = null;
        scene.svg.classed('clickable', false);
        highlight(scene, null);
      });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      d3.select(svgRef.current).selectAll('*').remove();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [WIDTH, HEIGHT, INNER_W, INNER_H]);

  // 2) Actualización de datos/tema.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const color = makeColorScale(categories);
    const { x, y, gGrid, gXAxis, gYAxis, gPoints } = scene;

    const maxLen = d3.max(points, (p) => p.length) ?? 10;
    y.domain([0, maxLen * 1.05]).nice();

    scene.render = (animate: boolean) => {
      const rescale = (base: d3.ScaleLinear<number, number>, a: Axis) => {
        const [r0, r1] = base.range();
        return base.copy().domain([base.invert((r0 - a.t) / a.k), base.invert((r1 - a.t) / a.k)]);
      };
      const zx = rescale(x, scene.tX);
      const zy = rescale(y, scene.tY);
      scene.zx = zx;
      scene.zy = zy;

      const tr = d3.transition().duration(animate ? TRANSITION_MS : 0).ease(d3.easeCubicOut);

      // Ejes.
      gXAxis
        .transition(tr)
        .call(d3.axisBottom(zx).ticks(12).tickFormat((v) => `${v}h`) as never);
      gYAxis.transition(tr).call(d3.axisLeft(zy).ticks(6) as never);
      gXAxis.selectAll('line,path').attr('stroke', theme.axis.lineColor);
      gXAxis.selectAll('text').attr('fill', theme.axis.textColor);
      gYAxis.selectAll('line,path').attr('stroke', theme.axis.lineColor);
      gYAxis.selectAll('text').attr('fill', theme.axis.textColor);

      // Grid horizontal.
      gGrid
        .selectAll<SVGLineElement, number>('line')
        .data(zy.ticks(6))
        .join('line')
        .attr('x1', 0)
        .attr('x2', INNER_W)
        .attr('y1', (d) => zy(d))
        .attr('y2', (d) => zy(d))
        .attr('stroke', theme.axis.gridColor)
        .attr('stroke-opacity', theme.axis.gridOpacity);

      // Puntos.
      gPoints
        .selectAll<SVGCircleElement, MessagePoint>('circle.pt')
        .data(points, (d) => d.id)
        .join('circle')
        .attr('class', 'pt')
        .attr('cx', (d) => zx(d.hourOfDay))
        .attr('cy', (d) => zy(d.length))
        .attr('r', theme.point.radius)
        .attr('fill', (d) => color(d.author))
        .attr('fill-opacity', theme.point.fillOpacity)
        .attr('stroke', theme.point.stroke)
        .attr('stroke-width', theme.point.strokeWidth);

      // Quadtree en coordenadas de pantalla para el hover.
      scene.tree = d3
        .quadtree<MessagePoint>()
        .x((d) => zx(d.hourOfDay))
        .y((d) => zy(d.length))
        .addAll(points);
    };

    // Títulos de eje.
    scene.svg.select('.x-title').text(t('dash.scatterXLabel'));
    scene.svg.select('.y-title').text(t('dash.scatterYLabel'));

    scene.render(false);
  }, [points, categories, hostWidth, t, INNER_W]);

  const resetZoom = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.tX = { k: 1, t: 0 };
    scene.tY = { k: 1, t: 0 };
    scene.render(true);
    setZoomed(false);
  };

  return (
    <div className="chart-panel" ref={containerRef}>
      <div className="chart-header">
        <div className="chart-title-row">
          <div className="chart-title">{t('dash.scatterTitle')}</div>
          <InfoTip text={t('dash.scatterInfo')} />
        </div>
        <div className="chart-toolbar">
          <button className="link-btn ui-tip" onClick={resetZoom} disabled={!zoomed} data-tip={t('dash.fullView')}>
            {t('dash.resetZoom')}
          </button>
        </div>
      </div>
      <div className="chart-svg">
        <svg ref={svgRef} role="img" aria-label={t('dash.scatterTitle')} />
      </div>
      <Legend categories={categories} splitByAuthor />
      <div ref={tooltipRef} className="tooltip" style={{ display: 'none' }} />
    </div>
  );
}

/* ---- Tipos internos de la escena d3 ---- */
interface Axis {
  k: number;
  t: number;
}
interface Scene {
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  x: d3.ScaleLinear<number, number>;
  y: d3.ScaleLinear<number, number>;
  gGrid: d3.Selection<SVGGElement, unknown, null, undefined>;
  gXAxis: d3.Selection<SVGGElement, unknown, null, undefined>;
  gYAxis: d3.Selection<SVGGElement, unknown, null, undefined>;
  gPoints: d3.Selection<SVGGElement, unknown, null, undefined>;
  tX: Axis;
  tY: Axis;
  hovered: MessagePoint | null;
  tree: d3.Quadtree<MessagePoint> | null;
  zx: d3.ScaleLinear<number, number>;
  zy: d3.ScaleLinear<number, number>;
  render: (animate: boolean) => void;
}

function highlight(scene: Scene, d: MessagePoint | null) {
  const id = d ? d.id : null;
  scene.gPoints
    .selectAll<SVGCircleElement, MessagePoint>('circle.pt')
    .attr('stroke', (c) => (c.id === id ? theme.color.text : theme.point.stroke))
    .attr('stroke-width', (c) => (c.id === id ? theme.point.strokeWidth + 1.5 : theme.point.strokeWidth));
}

/** HTML del tooltip de un mensaje. */
function tooltipHtml(d: MessagePoint, t: (k: string, o?: Record<string, unknown>) => string): string {
  const date = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d.timestamp);
  const excerpt = d.text.length > 90 ? `${d.text.slice(0, 90)}…` : d.text;
  const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] ?? c);
  return (
    `<div class="tt-title">${esc(d.author)}</div>` +
    `<div class="tt-row"><span>${t('detail.date')}</span><span>${esc(date)}</span></div>` +
    `<div class="tt-row"><span>${t('detail.length')}</span><span>${d.length} ${t('detail.chars')}</span></div>` +
    `<div class="tt-row"><span>${t('detail.words')}</span><span>${d.words}</span></div>` +
    `<div class="tt-text">${esc(excerpt)}</div>` +
    `<div class="tt-hint">${t('dash.scatterInfo').split('.')[0]}.</div>`
  );
}

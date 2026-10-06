/**
 * Gráfico de barras genérico con D3, responsivo.
 * D3 calcula escalas y ejes; React renderiza el SVG a partir de esos cálculos
 * (patrón "D3 for math, React for DOM"), lo que evita conflictos de control del DOM.
 */

import { useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { CountDatum } from '@/core/types';
import { useResizeObserver } from '@/hooks/useResizeObserver';

interface BarChartProps {
  data: CountDatum[];
  color?: string;
  /** Rota las etiquetas del eje X (útil con muchas barras). */
  rotateLabels?: boolean;
  height?: number;
}

export function BarChart({
  data,
  color = '#128C7E',
  rotateLabels = false,
  height = 260,
}: BarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width } = useResizeObserver(containerRef);

  const margin = { top: 12, right: 12, bottom: rotateLabels ? 56 : 28, left: 40 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = height - margin.top - margin.bottom;

  const { y, bars, yTicks } = useMemo(() => {
    const x = d3
      .scaleBand<string>()
      .domain(data.map((d) => d.label))
      .range([0, innerW])
      .padding(0.2);

    const maxVal = d3.max(data, (d) => d.value) ?? 0;
    const y = d3.scaleLinear().domain([0, maxVal || 1]).nice().range([innerH, 0]);

    const bars = data.map((d) => ({
      label: d.label,
      value: d.value,
      x: x(d.label) ?? 0,
      y: y(d.value),
      width: x.bandwidth(),
      height: innerH - y(d.value),
    }));

    return { y, bars, yTicks: y.ticks(5) };
  }, [data, innerW, innerH]);

  if (width === 0) {
    return <div ref={containerRef} style={{ width: '100%', height }} />;
  }

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <svg width={width} height={height} role="img">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Grid + eje Y */}
          {yTicks.map((t) => (
            <g key={t} transform={`translate(0,${y(t)})`}>
              <line x1={0} x2={innerW} stroke="#eee" />
              <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill="#666">
                {t}
              </text>
            </g>
          ))}

          {/* Barras */}
          {bars.map((b) => (
            <rect
              key={b.label}
              x={b.x}
              y={b.y}
              width={b.width}
              height={Math.max(0, b.height)}
              fill={color}
              rx={3}
            >
              <title>{`${b.label}: ${b.value}`}</title>
            </rect>
          ))}

          {/* Eje X */}
          <g transform={`translate(0,${innerH})`}>
            {bars.map((b) => (
              <text
                key={b.label}
                x={b.x + b.width / 2}
                y={rotateLabels ? 10 : 16}
                textAnchor={rotateLabels ? 'end' : 'middle'}
                transform={
                  rotateLabels
                    ? `rotate(-45,${b.x + b.width / 2},12)`
                    : undefined
                }
                fontSize={11}
                fill="#666"
              >
                {b.label}
              </text>
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}

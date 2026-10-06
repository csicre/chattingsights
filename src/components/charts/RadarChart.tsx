/**
 * Gráfico de radar (araña) con D3 para los perfiles de personalidad.
 * Dibuja un polígono por autor sobre ejes radiales normalizados 0..1.
 */

import { useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { useResizeObserver } from '@/hooks/useResizeObserver';

export interface RadarSeries {
  name: string;
  /** Valores 0..1 en el mismo orden que `axes`. */
  values: number[];
  color: string;
}

interface RadarChartProps {
  axes: string[];
  series: RadarSeries[];
  height?: number;
}

export function RadarChart({ axes, series, height = 360 }: RadarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width } = useResizeObserver(containerRef);

  const geom = useMemo(() => {
    if (width === 0) return null;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 60;
    const angleSlice = (Math.PI * 2) / axes.length;

    const point = (value: number, i: number) => {
      const angle = i * angleSlice - Math.PI / 2;
      return [cx + radius * value * Math.cos(angle), cy + radius * value * Math.sin(angle)] as const;
    };

    const rings = [0.25, 0.5, 0.75, 1].map((r) =>
      axes.map((_, i) => point(r, i)),
    );

    const axisEnds = axes.map((_, i) => point(1, i));

    const polygons = series.map((s) => ({
      ...s,
      path:
        d3.line()(s.values.map((v, i) => point(v, i) as [number, number])) ?? '',
    }));

    return { cx, cy, radius, rings, axisEnds, polygons, point };
  }, [width, height, axes, series]);

  if (!geom) {
    return <div ref={containerRef} style={{ width: '100%', height }} />;
  }

  const toPolyPoints = (pts: readonly (readonly [number, number])[]) =>
    pts.map((p) => p.join(',')).join(' ');

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <svg width={width} height={height} role="img">
        {/* Anillos de referencia */}
        {geom.rings.map((ring, i) => (
          <polygon
            key={i}
            points={toPolyPoints(ring)}
            fill="none"
            stroke="#e5e5e5"
          />
        ))}

        {/* Ejes y etiquetas */}
        {geom.axisEnds.map((end, i) => (
          <g key={i}>
            <line x1={geom.cx} y1={geom.cy} x2={end[0]} y2={end[1]} stroke="#ddd" />
            <text
              x={end[0]}
              y={end[1]}
              dy={end[1] < geom.cy ? -6 : 14}
              fontSize={11}
              fill="#555"
              textAnchor="middle"
            >
              {axes[i]}
            </text>
          </g>
        ))}

        {/* Polígonos por autor */}
        {geom.polygons.map((p) => (
          <path
            key={p.name}
            d={p.path}
            fill={p.color}
            fillOpacity={0.18}
            stroke={p.color}
            strokeWidth={2}
          />
        ))}
      </svg>
    </div>
  );
}

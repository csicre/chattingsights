/**
 * Mapa de palabras (word cloud) con D3.
 * Implementación propia y ligera (sin d3-cloud): coloca las palabras en espiral
 * y escala el tamaño de fuente según frecuencia. Determinista y sin dependencias extra.
 */

import { useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { WordDatum } from '@/core/types';
import { useResizeObserver } from '@/hooks/useResizeObserver';

interface WordCloudProps {
  words: WordDatum[];
  height?: number;
  max?: number;
}

const PALETTE = ['#128C7E', '#25D366', '#075E54', '#34B7F1', '#128C7E', '#1a9e8f'];

interface PlacedWord {
  text: string;
  size: number;
  x: number;
  y: number;
  color: string;
}

export function WordCloud({ words, height = 320, max = 60 }: WordCloudProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width } = useResizeObserver(containerRef);

  const placed = useMemo<PlacedWord[]>(() => {
    if (width === 0 || words.length === 0) return [];
    const top = words.slice(0, max);
    const counts = top.map((w) => w.count);
    const sizeScale = d3
      .scaleSqrt()
      .domain([d3.min(counts) ?? 1, d3.max(counts) ?? 1])
      .range([13, 54]);

    // Colocación en espiral de Arquímedes desde el centro.
    const cx = width / 2;
    const cy = height / 2;
    const result: PlacedWord[] = [];

    top.forEach((w, i) => {
      const size = sizeScale(w.count);
      const angle = i * 0.9;
      const radius = 6 * Math.sqrt(i);
      result.push({
        text: w.word,
        size,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        color: PALETTE[i % PALETTE.length],
      });
    });

    return result;
  }, [words, width, height, max]);

  if (width === 0) {
    return <div ref={containerRef} style={{ width: '100%', height }} />;
  }

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <svg width={width} height={height} role="img">
        {placed.map((p) => (
          <text
            key={p.text}
            x={p.x}
            y={p.y}
            fontSize={p.size}
            fontWeight={600}
            fill={p.color}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {p.text}
          </text>
        ))}
      </svg>
    </div>
  );
}

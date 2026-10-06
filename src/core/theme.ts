/**
 * Tokens de estilo de las visualizaciones.
 *
 * Fuente única de verdad sin duplicar: los COLORES se definen en theme.css
 * (:root) y se leen aquí en runtime con getComputedStyle, de modo que un cambio
 * en el CSS (o el cambio de tema) se propaga a las gráficas d3. Los tokens
 * no-color (radios, ticks, esquema categórico) viven aquí.
 */

import * as d3 from 'd3';

function cssVar(name: string, fallback = ''): string {
  if (typeof window === 'undefined' || !document?.documentElement) return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return (v || '').trim() || fallback;
}

export const theme = {
  color: {
    get bg() {
      return cssVar('--bg');
    },
    get panel() {
      return cssVar('--panel');
    },
    get panel2() {
      return cssVar('--panel-2');
    },
    get text() {
      return cssVar('--text');
    },
    get muted() {
      return cssVar('--muted');
    },
    get accent() {
      return cssVar('--accent');
    },
    get border() {
      return cssVar('--border');
    },
  },

  semantic: {
    get good() {
      return cssVar('--sem-good');
    },
    get warn() {
      return cssVar('--sem-warn');
    },
    get bad() {
      return cssVar('--sem-bad');
    },
    get info() {
      return cssVar('--sem-info');
    },
    get neutral() {
      return cssVar('--sem-neutral');
    },
  },

  axis: {
    get lineColor() {
      return cssVar('--chart-axis-line');
    },
    get textColor() {
      return cssVar('--chart-axis-text');
    },
    get labelColor() {
      return cssVar('--chart-axis-label');
    },
    get gridColor() {
      return cssVar('--chart-grid');
    },
    gridOpacity: 0.15,
    ticks: 8,
  },

  point: {
    radius: 3.5,
    minRadius: 4,
    maxRadius: 18,
    fillOpacity: 0.55,
    get stroke() {
      return cssVar('--chart-point-stroke');
    },
    strokeWidth: 0.75,
  },

  tooltip: {
    get bg() {
      return cssVar('--chart-tooltip-bg');
    },
  },

  /** Paleta categórica (una por autor/serie). */
  categoricalScheme: d3.schemeTableau10 as readonly string[],

  /** Geometría del viewBox de las gráficas (se escalan al ancho del panel). */
  chart: {
    fullWidth: 760,
    height: 320,
    auxWidth: 380,
    auxHeight: 170,
  },
};

/** Escala ordinal de color para las categorías dadas (misma en d3 y en la leyenda). */
export function makeColorScale(categories: string[]): d3.ScaleOrdinal<string, string> {
  return d3
    .scaleOrdinal<string, string>()
    .domain(categories)
    .range(theme.categoricalScheme as string[]);
}

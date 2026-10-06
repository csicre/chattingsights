/**
 * Capa de datos del dashboard interactivo.
 *
 * Transforma el ParsedChat en estructuras listas para las visualizaciones:
 *  - buildMessagePoints: mensajes individuales enriquecidos (scatter + detalle).
 *  - deriveFilterOptions: opciones para poblar los filtros.
 *  - applyFilters: filtra los puntos según el estado de filtros.
 *  - buildTrendSeries: series temporales agrupadas por periodo (y opcionalmente
 *    por autor), para los paneles de evolución.
 *
 * Todo determinista y en el cliente.
 */

import type {
  ChatFilters,
  FilterOptions,
  MessagePoint,
  ParsedChat,
  SeriesSplit,
  TimeGroup,
  TrendSeries,
} from './types';
import { charCount, countMatches, extractEmojis, findMatches, tokenize } from './text';
import type { MatchRange } from './text';

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Construye los puntos de mensaje a partir del chat parseado. Solo mensajes
 * reales (sin sistema ni adjuntos vacíos), con texto no vacío. El `id` es el
 * índice en el array original de mensajes, estable para el detalle.
 */
export function buildMessagePoints(parsed: ParsedChat): MessagePoint[] {
  const points: MessagePoint[] = [];
  parsed.messages.forEach((m, index) => {
    if (m.isSystem || m.isAttachment || !m.text) return;
    const d = m.timestamp;
    const hourOfDay = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    const day = d.getDay(); // 0 = domingo, 6 = sábado
    const emojis = extractEmojis(m.text);
    points.push({
      id: index,
      timestamp: d,
      author: m.author,
      text: m.text,
      hourOfDay,
      length: charCount(m.text),
      words: tokenize(m.text).length,
      emojiCount: emojis.length,
      emojis,
      isWeekend: day === 0 || day === 6,
    });
  });
  return points;
}

/** Deriva las opciones de los filtros a partir de los puntos. */
export function deriveFilterOptions(points: MessagePoint[]): FilterOptions {
  const authors = Array.from(new Set(points.map((p) => p.author))).sort((a, b) =>
    a.localeCompare(b),
  );
  if (points.length === 0) {
    return { authors, minDate: '', maxDate: '' };
  }
  let min = points[0].timestamp;
  let max = points[0].timestamp;
  for (const p of points) {
    if (p.timestamp < min) min = p.timestamp;
    if (p.timestamp > max) max = p.timestamp;
  }
  return { authors, minDate: toISODate(min), maxDate: toISODate(max) };
}

/** Estado de filtros vacío (todo incluido). */
export const EMPTY_FILTERS: ChatFilters = {
  from: '',
  to: '',
  authors: [],
  holiday: 'all',
};

/** Aplica los filtros a los puntos y devuelve el subconjunto que pasa. */
export function applyFilters(points: MessagePoint[], filters: ChatFilters): MessagePoint[] {
  // Interpretamos from/to como días completos en hora local.
  const fromTime = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : -Infinity;
  const toTime = filters.to ? new Date(`${filters.to}T23:59:59.999`).getTime() : Infinity;
  const authorSet = new Set(filters.authors);

  return points.filter((p) => {
    const t = p.timestamp.getTime();
    if (t < fromTime || t > toTime) return false;
    if (authorSet.size > 0 && !authorSet.has(p.author)) return false;
    if (filters.holiday === 'weekend' && !p.isWeekend) return false;
    if (filters.holiday === 'weekday' && p.isWeekend) return false;
    return true;
  });
}

/** Devuelve el inicio del cubo temporal (local) para una fecha y nivel.
 *  'points' se trata como 'day' para las funciones de series/tendencias. */
function bucketStart(d: Date, group: TimeGroup): Date {
  const g = group === 'points' ? 'day' : group;
  if (g === 'day') {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  if (g === 'week') {
    // Semana que empieza en lunes.
    const day = (d.getDay() + 6) % 7; // 0 = lunes
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    return start;
  }
  // month
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Días de la semana en orden lunes..domingo (claves i18n). */
export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** Clave i18n del día de la semana de una fecha (0=lun .. 6=dom). */
function weekdayKey(d: Date): string {
  return WEEKDAY_KEYS[(d.getDay() + 6) % 7];
}

/** Devuelve la clave de serie de un mensaje según el criterio de división. */
export function seriesKeyOf(p: MessagePoint, split: SeriesSplit): string {
  switch (split) {
    case 'author':
      return p.author;
    case 'weekday':
      return weekdayKey(p.timestamp);
    case 'none':
    default:
      return 'all';
  }
}

/**
 * Lista ordenada de categorías (claves de serie) para un criterio de división y
 * un conjunto de autores. Define el dominio de color y el orden de la leyenda.
 */
export function seriesCategories(split: SeriesSplit, authors: string[]): string[] {
  switch (split) {
    case 'author':
      return [...authors];
    case 'weekday':
      return [...WEEKDAY_KEYS];
    case 'none':
    default:
      return [];
  }
}

/** Métrica agregada de una serie temporal. */
export type TrendMetric =
  | 'count' // nº de mensajes del periodo
  | 'avgWords' // palabras medias por mensaje del periodo
  | 'avgLength' // longitud media (caracteres) por mensaje del periodo
  | 'emojis'; // nº total de emojis del periodo

/** Devuelve el valor que aporta un mensaje al sumatorio de una métrica. */
function metricValue(p: MessagePoint, metric: TrendMetric): number {
  switch (metric) {
    case 'avgWords':
      return p.words;
    case 'avgLength':
      return p.length;
    case 'emojis':
      return p.emojiCount;
    case 'count':
    default:
      return 1;
  }
}

/** true si la métrica es un promedio por mensaje (en vez de un total). */
function isAverage(metric: TrendMetric): boolean {
  return metric === 'avgWords' || metric === 'avgLength';
}

/** Ordena las series según el criterio de división (día de semana en orden
 *  natural; el resto, alfabético por clave). */
function sortSeries(series: TrendSeries[], split: SeriesSplit): void {
  if (split === 'weekday') {
    const idx = (k: string) => WEEKDAY_KEYS.indexOf(k as (typeof WEEKDAY_KEYS)[number]);
    series.sort((a, b) => idx(a.key) - idx(b.key));
  } else {
    series.sort((a, b) => a.key.localeCompare(b.key));
  }
}

/**
 * Construye series temporales. `split` decide cómo se dividen: una única serie
 * 'all', una por autor, o una por día de la semana.
 */
export function buildTrendSeries(
  points: MessagePoint[],
  group: TimeGroup,
  metric: TrendMetric,
  split: SeriesSplit,
): TrendSeries[] {
  // Mapa serieKey -> (bucketTime -> acumulador)
  const bySeries = new Map<string, Map<number, { sum: number; n: number }>>();

  for (const p of points) {
    const key = seriesKeyOf(p, split);
    const bt = bucketStart(p.timestamp, group).getTime();
    let buckets = bySeries.get(key);
    if (!buckets) {
      buckets = new Map();
      bySeries.set(key, buckets);
    }
    let acc = buckets.get(bt);
    if (!acc) {
      acc = { sum: 0, n: 0 };
      buckets.set(bt, acc);
    }
    acc.n += 1;
    acc.sum += metricValue(p, metric);
  }

  const avg = isAverage(metric);
  const series: TrendSeries[] = [];
  for (const [key, buckets] of bySeries) {
    const sorted = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
    series.push({
      key,
      points: sorted.map(([bt, acc]) => ({
        t: new Date(bt),
        value: avg ? (acc.n ? acc.sum / acc.n : 0) : acc.sum,
      })),
    });
  }
  sortSeries(series, split);
  return series;
}

/**
 * Normaliza un término de búsqueda para mostrarlo (minúsculas y recortado).
 * El conteo real usa `countMatches` (insensible a mayúsculas y tildes).
 */
export function normalizeSearchTerm(term: string): string {
  return term.trim().toLowerCase();
}

/**
 * Serie temporal de la FRECUENCIA DE UNA EXPRESIÓN por periodo.
 *
 * Cuenta cuántas veces aparece el término buscado en los mensajes de cada
 * periodo, mediante coincidencia de subcadena insensible a mayúsculas y a
 * tildes. Admite CUALQUIER expresión escrita por el usuario, incluidas varias
 * palabras con espacios (p. ej. "buenos días"). Respeta la agrupación temporal
 * (`group`) y el criterio de división de la leyenda (`split`).
 *
 * Si el término está vacío, devuelve una lista vacía de series.
 *
 * @param term expresión a buscar.
 */
export function buildWordTrend(
  points: MessagePoint[],
  group: TimeGroup,
  split: SeriesSplit,
  term: string,
): TrendSeries[] {
  if (!term.trim()) return [];

  // Mapa serieKey -> (bucketTime -> nº de apariciones)
  const bySeries = new Map<string, Map<number, number>>();

  for (const p of points) {
    const occurrences = countMatches(p.text, term);
    if (occurrences === 0) continue;

    const key = seriesKeyOf(p, split);
    const bt = bucketStart(p.timestamp, group).getTime();
    let buckets = bySeries.get(key);
    if (!buckets) {
      buckets = new Map();
      bySeries.set(key, buckets);
    }
    buckets.set(bt, (buckets.get(bt) ?? 0) + occurrences);
  }

  const series: TrendSeries[] = [];
  for (const [key, buckets] of bySeries) {
    const sorted = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
    series.push({
      key,
      points: sorted.map(([bt, count]) => ({ t: new Date(bt), value: count })),
    });
  }
  sortSeries(series, split);
  return series;
}

/** Una barra del diagrama del buscador de palabras (una por serie). */
export interface WordBar {
  /** Clave de la serie (autor, día de semana o 'all'). */
  key: string;
  /** Nº total de apariciones de la palabra en esa serie. */
  count: number;
}

/**
 * Barras del nº TOTAL de apariciones de una palabra por serie (según la
 * leyenda). Mismo criterio de conteo que `buildWordTrend` pero sin agrupar por
 * periodo: suma todas las apariciones de cada categoría.
 *
 * @param term palabra a buscar (se normaliza internamente).
 */
export function buildWordBars(
  points: MessagePoint[],
  split: SeriesSplit,
  term: string,
): WordBar[] {
  if (!term.trim()) return [];

  const bySeries = new Map<string, number>();

  for (const p of points) {
    const occurrences = countMatches(p.text, term);
    if (occurrences === 0) continue;
    const key = seriesKeyOf(p, split);
    bySeries.set(key, (bySeries.get(key) ?? 0) + occurrences);
  }

  const bars: WordBar[] = Array.from(bySeries.entries()).map(([key, count]) => ({ key, count }));
  sortBars(bars, split);
  return bars;
}

/** Un mensaje donde aparece la expresión buscada, con los rangos a resaltar. */
export interface WordMatch {
  /** Id estable del mensaje (índice en el chat parseado). */
  id: number;
  timestamp: Date;
  author: string;
  text: string;
  /** Nº de apariciones de la expresión en este mensaje. */
  occurrences: number;
  /** Rangos [start,end) sobre `text` donde aparece la expresión. */
  ranges: MatchRange[];
}

/**
 * Lista de mensajes donde aparece la expresión buscada, ordenados
 * cronológicamente, con los rangos de coincidencia para resaltarla. Misma
 * semántica de coincidencia que `buildWordTrend`/`buildWordBars`.
 *
 * @param term expresión a buscar.
 * @param limit nº máximo de mensajes a devolver (para no saturar la UI).
 */
export function buildWordMatches(
  points: MessagePoint[],
  term: string,
  limit = 200,
): { matches: WordMatch[]; totalMessages: number; totalOccurrences: number } {
  if (!term.trim()) return { matches: [], totalMessages: 0, totalOccurrences: 0 };

  const all: WordMatch[] = [];
  let totalOccurrences = 0;

  for (const p of points) {
    const ranges = findMatches(p.text, term);
    if (ranges.length === 0) continue;
    totalOccurrences += ranges.length;
    all.push({
      id: p.id,
      timestamp: p.timestamp,
      author: p.author,
      text: p.text,
      occurrences: ranges.length,
      ranges,
    });
  }

  all.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return {
    matches: all.slice(0, limit),
    totalMessages: all.length,
    totalOccurrences,
  };
}

/**
 * Serie temporal del TIEMPO DE RESPUESTA medio por periodo.
 *
 * Un "tiempo de respuesta" es el hueco (en segundos) entre un mensaje y el
 * inmediatamente anterior cuando los autores son distintos (una persona responde
 * a otra), descartando huecos demasiado largos (que no son respuestas sino
 * nuevas conversaciones). Se promedia por periodo.
 *
 * Importante: para que los huecos sean correctos, `points` debe venir ORDENADO
 * cronológicamente y SIN filtrar por autor (si se filtra por autor, la serie
 * refleja los tiempos con los que ESE autor responde).
 *
 * @param maxGapMinutes huecos mayores a esto no cuentan como respuesta.
 */
export function buildResponseTrend(
  points: MessagePoint[],
  group: TimeGroup,
  split: SeriesSplit,
  maxGapMinutes = 180,
): TrendSeries[] {
  const ordered = [...points].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const bySeries = new Map<string, Map<number, { sum: number; n: number }>>();
  const maxGapSec = maxGapMinutes * 60;

  for (let i = 1; i < ordered.length; i++) {
    const cur = ordered[i];
    const prev = ordered[i - 1];
    if (cur.author === prev.author) continue; // no es una respuesta a otra persona
    const gapSec = (cur.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
    if (gapSec <= 0 || gapSec > maxGapSec) continue;

    // La respuesta se atribuye a quien responde (cur).
    const key = seriesKeyOf(cur, split);
    const bt = bucketStart(cur.timestamp, group).getTime();
    let buckets = bySeries.get(key);
    if (!buckets) {
      buckets = new Map();
      bySeries.set(key, buckets);
    }
    let acc = buckets.get(bt);
    if (!acc) {
      acc = { sum: 0, n: 0 };
      buckets.set(bt, acc);
    }
    acc.n += 1;
    acc.sum += gapSec;
  }

  const series: TrendSeries[] = [];
  for (const [key, buckets] of bySeries) {
    const sorted = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
    series.push({
      key,
      // Valor en MINUTOS (más legible que segundos para la gráfica).
      points: sorted.map(([bt, acc]) => ({
        t: new Date(bt),
        value: acc.n ? acc.sum / acc.n / 60 : 0,
      })),
    });
  }
  sortSeries(series, split);
  return series;
}

/** Una barra del gráfico de tiempos de respuesta (una por serie). */
export interface ResponseBar {
  /** Clave de la serie (autor, día de semana o 'all'). */
  key: string;
  /** Tiempo de respuesta medio en MINUTOS. */
  avgMinutes: number;
  /** Nº de respuestas consideradas (para el tooltip). */
  count: number;
}

/**
 * Barras del TIEMPO DE RESPUESTA medio por serie (según la leyenda).
 *
 * Usa el mismo criterio que `buildResponseTrend`: un "tiempo de respuesta" es el
 * hueco (en segundos) entre un mensaje y el inmediatamente anterior cuando los
 * autores son distintos, descartando huecos demasiado largos (nuevas
 * conversaciones). La respuesta se atribuye a quien responde.
 *
 * @param maxGapMinutes huecos mayores a esto no cuentan como respuesta.
 */
export function buildResponseBars(
  points: MessagePoint[],
  split: SeriesSplit,
  maxGapMinutes = 180,
): ResponseBar[] {
  const ordered = [...points].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const maxGapSec = maxGapMinutes * 60;
  const bySeries = new Map<string, { sum: number; n: number }>();

  for (let i = 1; i < ordered.length; i++) {
    const cur = ordered[i];
    const prev = ordered[i - 1];
    if (cur.author === prev.author) continue;
    const gapSec = (cur.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
    if (gapSec <= 0 || gapSec > maxGapSec) continue;

    const key = seriesKeyOf(cur, split);
    let acc = bySeries.get(key);
    if (!acc) {
      acc = { sum: 0, n: 0 };
      bySeries.set(key, acc);
    }
    acc.n += 1;
    acc.sum += gapSec;
  }

  const bars: ResponseBar[] = Array.from(bySeries.entries()).map(([key, acc]) => ({
    key,
    avgMinutes: acc.n ? acc.sum / acc.n / 60 : 0,
    count: acc.n,
  }));
  sortBars(bars, split);
  return bars;
}

/** Ordena las barras según el criterio de división (día de semana en orden
 *  natural; el resto, alfabético por clave). Genérico: solo necesita `key`. */
function sortBars<T extends { key: string }>(bars: T[], split: SeriesSplit): void {
  if (split === 'weekday') {
    const idx = (k: string) => WEEKDAY_KEYS.indexOf(k as (typeof WEEKDAY_KEYS)[number]);
    bars.sort((a, b) => idx(a.key) - idx(b.key));
  } else {
    bars.sort((a, b) => a.key.localeCompare(b.key));
  }
}

/** KPIs agregados sobre un conjunto de puntos (ya filtrados). */
export interface DashboardKpis {
  messages: number;
  words: number;
  avgLength: number;
  messagesPerDay: number;
  /** Media de palabras por mensaje (tamaño medio del mensaje). */
  avgWords: number;
  topAuthor: string;
  busiestHour: number;
}

/** Calcula los KPIs del dashboard sobre los puntos dados. */
export function computeDashboardKpis(points: MessagePoint[]): DashboardKpis {
  if (points.length === 0) {
    return {
      messages: 0,
      words: 0,
      avgLength: 0,
      messagesPerDay: 0,
      avgWords: 0,
      topAuthor: '—',
      busiestHour: 0,
    };
  }

  let words = 0;
  let totalLength = 0;
  const byAuthor = new Map<string, number>();
  const byHour = new Array<number>(24).fill(0);
  const days = new Set<string>();

  for (const p of points) {
    words += p.words;
    totalLength += p.length;
    byAuthor.set(p.author, (byAuthor.get(p.author) ?? 0) + 1);
    byHour[Math.floor(p.hourOfDay)] += 1;
    days.add(toISODate(p.timestamp));
  }

  let topAuthor = '—';
  let topCount = -1;
  for (const [a, c] of byAuthor) {
    if (c > topCount) {
      topCount = c;
      topAuthor = a;
    }
  }

  let busiestHour = 0;
  let busiestCount = -1;
  byHour.forEach((c, h) => {
    if (c > busiestCount) {
      busiestCount = c;
      busiestHour = h;
    }
  });

  return {
    messages: points.length,
    words,
    avgLength: totalLength / points.length,
    messagesPerDay: points.length / Math.max(1, days.size),
    avgWords: words / points.length,
    topAuthor,
    busiestHour,
  };
}

/** KPIs de la solapa de emojis. */
export interface EmojiKpis {
  totalEmojis: number;
  emojisPerMessage: number;
  topEmoji: string;
  /** Porcentaje de mensajes que contienen al menos un emoji (0..100). */
  pctWithEmoji: number;
}

/** Conteo de un emoji concreto (para el top). */
export interface EmojiCount {
  emoji: string;
  count: number;
}

/** Un emoji del ranking con su conteo total y el desglose por serie. */
export interface EmojiRankRow {
  emoji: string;
  /** Conteo total (suma de todas las series). Define el orden del ranking. */
  count: number;
  /** Conteo por clave de serie (autor / día de semana / 'all'). */
  bySeries: Record<string, number>;
}

/**
 * Ranking de emojis desglosado por serie según el criterio de la leyenda.
 * El orden lo marca el conteo TOTAL de cada emoji; cada fila incluye el reparto
 * por categoría (`bySeries`) para poder dibujar barras apiladas.
 *
 * @param limit nº máximo de emojis del ranking.
 */
export function computeEmojiRanking(
  points: MessagePoint[],
  split: SeriesSplit,
  limit = 15,
): EmojiRankRow[] {
  const totals = new Map<string, number>();
  const bySeries = new Map<string, Record<string, number>>();

  for (const p of points) {
    if (p.emojiCount === 0) continue;
    const key = seriesKeyOf(p, split);
    for (const e of p.emojis) {
      totals.set(e, (totals.get(e) ?? 0) + 1);
      let row = bySeries.get(e);
      if (!row) {
        row = {};
        bySeries.set(e, row);
      }
      row[key] = (row[key] ?? 0) + 1;
    }
  }

  return Array.from(totals.entries())
    .map(([emoji, count]) => ({ emoji, count, bySeries: bySeries.get(emoji) ?? {} }))
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji))
    .slice(0, limit);
}

/** Calcula los KPIs de emojis y el ranking (top) sobre los puntos dados. */
export function computeEmojiStats(points: MessagePoint[]): {
  kpis: EmojiKpis;
  top: EmojiCount[];
} {
  const counts = new Map<string, number>();
  let total = 0;
  let withEmoji = 0;

  for (const p of points) {
    if (p.emojiCount > 0) withEmoji += 1;
    total += p.emojiCount;
    for (const e of p.emojis) {
      counts.set(e, (counts.get(e) ?? 0) + 1);
    }
  }

  const top: EmojiCount[] = Array.from(counts.entries())
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const kpis: EmojiKpis = {
    totalEmojis: total,
    emojisPerMessage: points.length ? total / points.length : 0,
    topEmoji: top[0]?.emoji ?? '—',
    pctWithEmoji: points.length ? (withEmoji / points.length) * 100 : 0,
  };

  return { kpis, top };
}

/* ============================================================================
   Funciones de datos para las solapas General/Horario.
   ========================================================================== */

import type { HourBin, InitiativeBar, TemporalPoint, WeekdayBar } from './types';

/**
 * Scatter temporal: agrega mensajes por periodo y, opcionalmente, por autor.
 * Devuelve un punto por periodo×serie con X = instante del cubo, Y = media de
 * palabras de los mensajes del periodo.
 */
export function buildTemporalScatter(
  points: MessagePoint[],
  group: TimeGroup,
  split: SeriesSplit,
): TemporalPoint[] {
  // Modo 'puntos': sin agrupar. Cada mensaje es un punto independiente, con su
  // timestamp real (eje X), sus palabras (eje Y) y su id para navegar al detalle.
  if (group === 'points') {
    return points
      .map((p) => ({
        key: seriesKeyOf(p, split),
        t: p.timestamp,
        avgWords: p.words,
        count: 1,
        messageId: p.id,
      }))
      .sort((a, b) => a.t.getTime() - b.t.getTime());
  }

  const bySeries = new Map<string, Map<number, { sumW: number; n: number }>>();

  for (const p of points) {
    const key = seriesKeyOf(p, split);
    const bt = bucketStart(p.timestamp, group).getTime();
    let buckets = bySeries.get(key);
    if (!buckets) { buckets = new Map(); bySeries.set(key, buckets); }
    let acc = buckets.get(bt);
    if (!acc) { acc = { sumW: 0, n: 0 }; buckets.set(bt, acc); }
    acc.n += 1;
    acc.sumW += p.words;
  }

  const result: TemporalPoint[] = [];
  for (const [key, buckets] of bySeries) {
    for (const [bt, acc] of buckets) {
      result.push({
        key,
        t: new Date(bt),
        avgWords: acc.n ? acc.sumW / acc.n : 0,
        count: acc.n,
      });
    }
  }
  result.sort((a, b) => a.t.getTime() - b.t.getTime());
  return result;
}

/** Formatea un minuto-del-día a "hh:mm". */
function fmtMinute(m: number): string {
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${hh}:${mm < 10 ? '0' : ''}${mm}`;
}

/**
 * Histograma de mensajes por franja horaria. Divide el día (0..1440 min) en bins
 * de `binMinutes` y cuenta los mensajes que caen en cada bin.
 */
export function buildHourHistogram(
  points: MessagePoint[],
  binMinutes: number,
): HourBin[] {
  const nBins = Math.ceil(1440 / binMinutes);
  const bins: HourBin[] = Array.from({ length: nBins }, (_, i) => ({
    index: i,
    startMinute: i * binMinutes,
    endMinute: Math.min((i + 1) * binMinutes, 1440),
    count: 0,
  }));

  for (const p of points) {
    const minuteOfDay = p.timestamp.getHours() * 60 + p.timestamp.getMinutes();
    const idx = Math.min(Math.floor(minuteOfDay / binMinutes), nBins - 1);
    bins[idx].count += 1;
  }

  return bins;
}

/** Etiqueta legible de un bin horario. */
export function hourBinLabel(bin: HourBin): string {
  return `${fmtMinute(bin.startMinute)} – ${fmtMinute(bin.endMinute)}`;
}

const WEEKDAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Gráfico de columnas por día de la semana (lun..dom). */
export function buildWeekdayBars(points: MessagePoint[]): WeekdayBar[] {
  const counts = new Array<number>(7).fill(0);
  for (const p of points) {
    // getDay(): 0=dom .. 6=sáb → convertimos a 0=lun .. 6=dom
    const idx = (p.timestamp.getDay() + 6) % 7;
    counts[idx] += 1;
  }
  return WEEKDAY_ORDER.map((key, index) => ({ key, index, count: counts[index] }));
}

/* ============================================================================
   Iniciativa en la conversación.

   Una "conversación" se separa de la siguiente cuando pasa más de `gapMinutes`
   de inactividad (sin mensajes). El autor del primer mensaje tras ese silencio
   (o el primer mensaje del chat) es quien INICIA la conversación. Ambas
   funciones comparten exactamente este criterio y el parámetro `gapMinutes`.
   ========================================================================== */

/**
 * Detecta los mensajes que INICIAN una conversación: el primer mensaje del chat
 * y todo mensaje cuyo hueco con el anterior supera `gapMinutes`. Devuelve esos
 * puntos (ya ordenados cronológicamente) para que las visualizaciones los
 * agrupen como quieran.
 *
 * `points` se ordena internamente; para que los huecos sean correctos NO debe
 * filtrarse por autor antes de llamar (si se filtra, solo se verán los inicios
 * de ese autor y los huecos pueden quedar distorsionados).
 */
function initiationPoints(points: MessagePoint[], gapMinutes: number): MessagePoint[] {
  const ordered = [...points].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const gapSec = gapMinutes * 60;
  const starters: MessagePoint[] = [];
  for (let i = 0; i < ordered.length; i++) {
    if (i === 0) {
      starters.push(ordered[i]);
      continue;
    }
    const gap = (ordered[i].timestamp.getTime() - ordered[i - 1].timestamp.getTime()) / 1000;
    if (gap > gapSec) starters.push(ordered[i]);
  }
  return starters;
}

/**
 * Serie temporal de la INICIATIVA: nº de conversaciones iniciadas por periodo,
 * atribuidas a quien las inicia (según el criterio de división de la leyenda).
 *
 * @param gapMinutes huecos mayores a esto inician una nueva conversación.
 */
export function buildInitiativeTrend(
  points: MessagePoint[],
  group: TimeGroup,
  split: SeriesSplit,
  gapMinutes: number,
): TrendSeries[] {
  const starters = initiationPoints(points, gapMinutes);
  const bySeries = new Map<string, Map<number, number>>();

  for (const p of starters) {
    const key = seriesKeyOf(p, split);
    const bt = bucketStart(p.timestamp, group).getTime();
    let buckets = bySeries.get(key);
    if (!buckets) {
      buckets = new Map();
      bySeries.set(key, buckets);
    }
    buckets.set(bt, (buckets.get(bt) ?? 0) + 1);
  }

  const series: TrendSeries[] = [];
  for (const [key, buckets] of bySeries) {
    const sorted = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
    series.push({
      key,
      points: sorted.map(([bt, count]) => ({ t: new Date(bt), value: count })),
    });
  }
  sortSeries(series, split);
  return series;
}

/**
 * Barras de INICIATIVA: nº de conversaciones iniciadas por cada autor y su
 * porcentaje sobre el total. Ordenadas de más a menos iniciativa.
 *
 * @param gapMinutes huecos mayores a esto inician una nueva conversación.
 */
export function buildInitiativeBars(
  points: MessagePoint[],
  gapMinutes: number,
): InitiativeBar[] {
  const starters = initiationPoints(points, gapMinutes);
  const counts = new Map<string, number>();
  for (const p of starters) {
    counts.set(p.author, (counts.get(p.author) ?? 0) + 1);
  }
  const total = starters.length || 1;
  return Array.from(counts.entries())
    .map(([author, count]) => ({ author, count, pct: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count || a.author.localeCompare(b.author));
}

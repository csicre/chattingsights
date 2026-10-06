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
  TimeGroup,
  TrendSeries,
} from './types';
import { charCount, extractEmojis, tokenize } from './text';

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

/** Devuelve el inicio del cubo temporal (local) para una fecha y nivel. */
function bucketStart(d: Date, group: TimeGroup): Date {
  if (group === 'day') {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  if (group === 'week') {
    // Semana que empieza en lunes.
    const day = (d.getDay() + 6) % 7; // 0 = lunes
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    return start;
  }
  // month
  return new Date(d.getFullYear(), d.getMonth(), 1);
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

/**
 * Construye series temporales. Si `splitByAuthor` es true, genera una serie por
 * autor; si no, una única serie 'all'.
 */
export function buildTrendSeries(
  points: MessagePoint[],
  group: TimeGroup,
  metric: TrendMetric,
  splitByAuthor: boolean,
): TrendSeries[] {
  // Mapa serieKey -> (bucketTime -> acumulador)
  const bySeries = new Map<string, Map<number, { sum: number; n: number }>>();

  for (const p of points) {
    const key = splitByAuthor ? p.author : 'all';
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
  // Orden estable por nombre de serie.
  series.sort((a, b) => a.key.localeCompare(b.key));
  return series;
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
  splitByAuthor: boolean,
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

    // La respuesta se atribuye a quien responde (cur.author).
    const key = splitByAuthor ? cur.author : 'all';
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
  series.sort((a, b) => a.key.localeCompare(b.key));
  return series;
}

/** KPIs agregados sobre un conjunto de puntos (ya filtrados). */
export interface DashboardKpis {
  messages: number;
  words: number;
  avgLength: number;
  messagesPerDay: number;
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

import type { HourBin, TemporalPoint, WeekdayBar } from './types';

/**
 * Scatter temporal: agrega mensajes por periodo y, opcionalmente, por autor.
 * Devuelve un punto por periodo×serie con X = instante del cubo, Y = media de
 * palabras de los mensajes del periodo.
 */
export function buildTemporalScatter(
  points: MessagePoint[],
  group: TimeGroup,
  splitByAuthor: boolean,
): TemporalPoint[] {
  const bySeries = new Map<string, Map<number, { sumW: number; n: number }>>();

  for (const p of points) {
    const key = splitByAuthor ? p.author : 'all';
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

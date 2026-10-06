import { describe, it, expect } from 'vitest';
import {
  applyFilters,
  buildMessagePoints,
  buildResponseTrend,
  buildTrendSeries,
  computeEmojiStats,
  deriveFilterOptions,
  EMPTY_FILTERS,
} from './dashboard';
import { parseWhatsAppChat } from './parser';

const SAMPLE = [
  '06/03/2023, 09:00 - Ana: Hola buenos dias', // lunes
  '06/03/2023, 09:30 - Luis: Buenas',
  '11/03/2023, 20:00 - Ana: Que tal el finde', // sábado
  '11/03/2023, 20:05 - Luis: <Multimedia omitido>', // adjunto -> excluido
  '13/03/2023, 10:00 - Ana: Otra semana mas', // lunes siguiente
].join('\n');

const points = buildMessagePoints(parseWhatsAppChat(SAMPLE));

describe('buildMessagePoints', () => {
  it('excluye adjuntos y mensajes de sistema', () => {
    expect(points).toHaveLength(4);
  });

  it('calcula hora decimal y longitud', () => {
    const p = points[0];
    expect(p.hourOfDay).toBeCloseTo(9, 5);
    expect(p.length).toBeGreaterThan(0);
  });

  it('marca el fin de semana', () => {
    const sat = points.find((p) => p.text === 'Que tal el finde')!;
    expect(sat.isWeekend).toBe(true);
    expect(points[0].isWeekend).toBe(false);
  });

  it('asigna id estable (índice original)', () => {
    // El 3er punto real corresponde al índice 2 del array de mensajes.
    expect(points[2].id).toBe(2);
  });
});

describe('deriveFilterOptions', () => {
  it('lista autores ordenados y rango de fechas', () => {
    const opts = deriveFilterOptions(points);
    expect(opts.authors).toEqual(['Ana', 'Luis']);
    expect(opts.minDate).toBe('2023-03-06');
    expect(opts.maxDate).toBe('2023-03-13');
  });
});

describe('applyFilters', () => {
  it('sin filtros devuelve todo', () => {
    expect(applyFilters(points, EMPTY_FILTERS)).toHaveLength(4);
  });

  it('filtra por autor', () => {
    const res = applyFilters(points, { ...EMPTY_FILTERS, authors: ['Luis'] });
    expect(res).toHaveLength(1);
    expect(res[0].author).toBe('Luis');
  });

  it('filtra por fin de semana', () => {
    const res = applyFilters(points, { ...EMPTY_FILTERS, holiday: 'weekend' });
    expect(res).toHaveLength(1);
    expect(res[0].text).toBe('Que tal el finde');
  });

  it('filtra por rango de fechas', () => {
    const res = applyFilters(points, { ...EMPTY_FILTERS, from: '2023-03-13', to: '2023-03-13' });
    expect(res).toHaveLength(1);
    expect(res[0].text).toBe('Otra semana mas');
  });
});

describe('buildTrendSeries', () => {
  it('agrupa por semana contando mensajes (serie única)', () => {
    const series = buildTrendSeries(points, 'week', 'count', 'none');
    expect(series).toHaveLength(1);
    expect(series[0].key).toBe('all');
    // Semana 1 (6-12 mar): 2 mensajes del lunes + 1 del sábado = 3 (el adjunto
    // del sábado queda excluido). Semana 2 (13 mar): 1.
    expect(series[0].points).toHaveLength(2);
    expect(series[0].points[0].value).toBe(3);
    expect(series[0].points[1].value).toBe(1);
  });

  it('divide por autor cuando se pide', () => {
    const series = buildTrendSeries(points, 'month', 'count', 'author');
    const keys = series.map((s) => s.key).sort();
    expect(keys).toEqual(['Ana', 'Luis']);
  });

  it('divide por día de la semana (orden natural lun..dom)', () => {
    const series = buildTrendSeries(points, 'day', 'count', 'weekday');
    // Las claves deben ser días de la semana, en orden natural.
    const keys = series.map((s) => s.key);
    const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    for (let i = 1; i < keys.length; i++) {
      expect(order.indexOf(keys[i])).toBeGreaterThan(order.indexOf(keys[i - 1]));
    }
    // Todas las claves son días válidos.
    expect(keys.every((k) => order.includes(k))).toBe(true);
  });

  it('calcula longitud media por periodo', () => {
    const series = buildTrendSeries(points, 'day', 'avgLength', 'none');
    for (const pt of series[0].points) {
      expect(pt.value).toBeGreaterThan(0);
    }
  });
});

const EMOJI_SAMPLE = [
  '06/03/2023, 09:00 - Ana: Hola 😀😀',
  '06/03/2023, 09:02 - Luis: Buenas ❤️',
  '06/03/2023, 09:05 - Ana: sin emoji aqui',
].join('\n');
const emojiPoints = buildMessagePoints(parseWhatsAppChat(EMOJI_SAMPLE));

describe('computeEmojiStats', () => {
  it('cuenta emojis totales y el ranking', () => {
    const { kpis, top } = computeEmojiStats(emojiPoints);
    expect(kpis.totalEmojis).toBe(3);
    expect(top[0].emoji).toBe('😀');
    expect(top[0].count).toBe(2);
  });

  it('calcula emojis por mensaje y % de mensajes con emoji', () => {
    const { kpis } = computeEmojiStats(emojiPoints);
    expect(kpis.emojisPerMessage).toBeCloseTo(1, 5); // 3 emojis / 3 mensajes
    expect(kpis.pctWithEmoji).toBeCloseTo((2 / 3) * 100, 5); // 2 de 3 con emoji
  });

  it('maneja el caso sin emojis', () => {
    const noEmoji = buildMessagePoints(parseWhatsAppChat('06/03/2023, 09:00 - Ana: hola'));
    const { kpis, top } = computeEmojiStats(noEmoji);
    expect(kpis.totalEmojis).toBe(0);
    expect(kpis.topEmoji).toBe('—');
    expect(top).toHaveLength(0);
  });
});

const RESP_SAMPLE = [
  '06/03/2023, 09:00 - Ana: Hola', // inicia
  '06/03/2023, 09:02 - Luis: Buenas', // responde a Ana en 2 min
  '06/03/2023, 09:04 - Ana: Que tal', // responde a Luis en 2 min
  '06/03/2023, 15:00 - Luis: Hey', // hueco > 180 min -> no cuenta
].join('\n');
const respPoints = buildMessagePoints(parseWhatsAppChat(RESP_SAMPLE));

describe('buildResponseTrend', () => {
  it('promedia tiempos de respuesta por periodo en minutos, descartando huecos largos', () => {
    const series = buildResponseTrend(respPoints, 'day', 'none', 180);
    expect(series).toHaveLength(1);
    // Dos respuestas de 2 min cada una; el hueco de ~6h se descarta.
    expect(series[0].points).toHaveLength(1);
    expect(series[0].points[0].value).toBeCloseTo(2, 5);
  });

  it('atribuye la respuesta a quien responde al dividir por autor', () => {
    const series = buildResponseTrend(respPoints, 'day', 'author', 180);
    const keys = series.map((s) => s.key).sort();
    expect(keys).toEqual(['Ana', 'Luis']);
  });
});

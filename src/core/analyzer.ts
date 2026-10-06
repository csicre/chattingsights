/**
 * Motor de análisis algorítmico (sin IA).
 *
 * Toma un ParsedChat y produce un AnalysisReport con todas las métricas que
 * consume la UI: frecuencia temporal, tiempos de respuesta, emojis, wordmap,
 * sentimiento léxico y un perfil de "personalidad" heurístico.
 *
 * Todo determinista y explicable: nada de cajas negras.
 */

import type {
  AnalysisReport,
  AuthorStats,
  ChatMessage,
  EmojiDatum,
  ParsedChat,
  PersonalityProfile,
  SentimentDatum,
  TimeBucket,
  WordDatum,
} from './types';
import { getLexicon } from './lexicons';
import { charCount, extractEmojis, tokenize } from './text';

/** Umbral (en minutos) para considerar que empieza una nueva conversación. */
const CONVERSATION_GAP_MIN = 60;

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Agrupa valores en buckets ordenados por clave. */
function bucketize(keys: string[]): TimeBucket[] {
  const map = new Map<string, number>();
  for (const k of keys) map.set(k, (map.get(k) ?? 0) + 1);
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Analiza un chat parseado y devuelve el informe completo.
 */
export function analyzeChat(parsed: ParsedChat): AnalysisReport {
  const lexicon = getLexicon(parsed.detectedLanguage);

  // Solo mensajes reales de usuarios (sin sistema), ordenados cronológicamente.
  const msgs = parsed.messages
    .filter((m) => !m.isSystem)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const authors = parsed.authors;

  // --- Acumuladores por autor ---
  const stats = new Map<string, MutableAuthorStats>();
  for (const a of authors) stats.set(a, newMutableStats(a));

  // --- Series temporales globales ---
  const hourKeys: string[] = [];
  const weekdayKeys: string[] = [];
  const monthKeys: string[] = [];
  const dayKeys: string[] = [];

  // --- Emojis y palabras globales ---
  const emojiCounts = new Map<string, number>();
  const wordCounts = new Map<string, number>();

  // --- Tiempos de respuesta y arranques de conversación ---
  const responseTimes = new Map<string, number[]>();
  for (const a of authors) responseTimes.set(a, []);

  let prevMsg: ChatMessage | null = null;

  for (const m of msgs) {
    const s = stats.get(m.author);
    if (!s) continue;

    // Frecuencia temporal.
    hourKeys.push(pad(m.timestamp.getHours()));
    weekdayKeys.push(WEEKDAY_KEYS[m.timestamp.getDay()]);
    monthKeys.push(monthKey(m.timestamp));
    dayKeys.push(dayKey(m.timestamp));

    s.messageCount++;

    if (!m.isAttachment && m.text) {
      const tokens = tokenize(m.text);
      s.wordCount += tokens.length;
      s.charCount += charCount(m.text);

      for (const t of tokens) {
        // Sentimiento.
        if (lexicon.positive.has(t)) s.positive++;
        else if (lexicon.negative.has(t)) s.negative++;
        else s.neutral++;

        // Wordmap (excluye stopwords y tokens muy cortos).
        if (!lexicon.stopwords.has(t) && t.length > 2) {
          wordCounts.set(t, (wordCounts.get(t) ?? 0) + 1);
        }
      }

      const emojis = extractEmojis(m.text);
      s.emojiCount += emojis.length;
      for (const e of emojis) {
        emojiCounts.set(e, (emojiCounts.get(e) ?? 0) + 1);
      }
    }

    // Tiempo de respuesta y arranque de conversación.
    if (prevMsg) {
      const gapSec = (m.timestamp.getTime() - prevMsg.timestamp.getTime()) / 1000;
      const gapMin = gapSec / 60;

      if (gapMin >= CONVERSATION_GAP_MIN) {
        // Silencio largo: este mensaje inicia conversación.
        s.conversationsStarted++;
      } else if (prevMsg.author !== m.author && gapSec >= 0) {
        // Respuesta a otro autor dentro de la misma conversación.
        responseTimes.get(m.author)?.push(gapSec);
      }
    } else {
      s.conversationsStarted++;
    }

    prevMsg = m;
  }

  // --- Consolidar stats por autor ---
  const authorStats: AuthorStats[] = authors.map((a) => {
    const s = stats.get(a)!;
    const rts = responseTimes.get(a) ?? [];
    const avgRt =
      rts.length > 0 ? rts.reduce((x, y) => x + y, 0) / rts.length : null;
    return {
      author: a,
      messageCount: s.messageCount,
      wordCount: s.wordCount,
      charCount: s.charCount,
      emojiCount: s.emojiCount,
      avgWordsPerMessage:
        s.messageCount > 0 ? s.wordCount / s.messageCount : 0,
      avgResponseTimeSec: avgRt,
      medianResponseTimeSec: median(rts),
      conversationsStarted: s.conversationsStarted,
    };
  });

  // --- Sentimiento por autor ---
  const sentiment: SentimentDatum[] = authors.map((a) => {
    const s = stats.get(a)!;
    const total = s.positive + s.negative + s.neutral;
    const score = total > 0 ? (s.positive - s.negative) / total : 0;
    return {
      author: a,
      score,
      positive: s.positive,
      negative: s.negative,
      neutral: s.neutral,
    };
  });

  // --- Top emojis y palabras ---
  const topEmojis: EmojiDatum[] = Array.from(emojiCounts.entries())
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const topWords: WordDatum[] = Array.from(wordCounts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 100);

  // --- Series temporales ---
  const messagesByHour = fillHourBuckets(bucketize(hourKeys));
  const messagesByWeekday = fillWeekdayBuckets(bucketize(weekdayKeys));
  const messagesByMonth = bucketize(monthKeys);
  const messagesByDay = bucketize(dayKeys);

  // --- Personalidad heurística ---
  const personality = buildPersonality(authorStats, sentiment);

  // --- Highlights ---
  const busiestDay = [...messagesByDay].sort((a, b) => b.count - a.count)[0];
  const busiestHour = [...messagesByHour].sort((a, b) => b.count - a.count)[0];
  const mostActiveAuthor = [...authorStats].sort(
    (a, b) => b.messageCount - a.messageCount,
  )[0];

  const dates = msgs.map((m) => m.timestamp.getTime());
  const start = new Date(Math.min(...dates));
  const end = new Date(Math.max(...dates));
  const spanDays = Math.max(1, (end.getTime() - start.getTime()) / 86_400_000);

  const totalEmojis = Array.from(emojiCounts.values()).reduce((a, b) => a + b, 0);

  return {
    language: parsed.detectedLanguage,
    dateRange: { start, end },
    totalMessages: msgs.length,
    totalWords: authorStats.reduce((a, s) => a + s.wordCount, 0),
    authors,
    authorStats,
    messagesByHour,
    messagesByWeekday,
    messagesByMonth,
    messagesByDay,
    topEmojis,
    topWords,
    sentiment,
    personality,
    highlights: {
      busiestDay: busiestDay?.key ?? '',
      busiestHour: busiestHour ? parseInt(busiestHour.key, 10) : 0,
      mostActiveAuthor: mostActiveAuthor?.author ?? '',
      totalEmojis,
      avgMessagesPerDay: msgs.length / spanDays,
    },
  };
}

interface MutableAuthorStats {
  author: string;
  messageCount: number;
  wordCount: number;
  charCount: number;
  emojiCount: number;
  positive: number;
  negative: number;
  neutral: number;
  conversationsStarted: number;
}

function newMutableStats(author: string): MutableAuthorStats {
  return {
    author,
    messageCount: 0,
    wordCount: 0,
    charCount: 0,
    emojiCount: 0,
    positive: 0,
    negative: 0,
    neutral: 0,
    conversationsStarted: 0,
  };
}

/** Rellena las 24 horas aunque algunas no tengan mensajes. */
function fillHourBuckets(buckets: TimeBucket[]): TimeBucket[] {
  const map = new Map(buckets.map((b) => [b.key, b.count]));
  return Array.from({ length: 24 }, (_, h) => ({
    key: pad(h),
    count: map.get(pad(h)) ?? 0,
  }));
}

/** Rellena los 7 días de la semana en orden lun..dom. */
function fillWeekdayBuckets(buckets: TimeBucket[]): TimeBucket[] {
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const map = new Map(buckets.map((b) => [b.key, b.count]));
  return order.map((key) => ({ key, count: map.get(key) ?? 0 }));
}

/**
 * Deriva rasgos de personalidad normalizados comparando autores entre sí.
 * No es psicometría: son indicadores lúdicos basados en comportamiento medible.
 */
function buildPersonality(
  authorStats: AuthorStats[],
  sentiment: SentimentDatum[],
): PersonalityProfile[] {
  const maxStarted = Math.max(1, ...authorStats.map((s) => s.conversationsStarted));
  const maxEmojiRate = Math.max(
    0.0001,
    ...authorStats.map((s) => (s.messageCount ? s.emojiCount / s.messageCount : 0)),
  );
  const maxWordsPerMsg = Math.max(1, ...authorStats.map((s) => s.avgWordsPerMessage));
  // Para rapidez: menor tiempo de respuesta => mayor puntuación.
  const responders = authorStats
    .map((s) => s.medianResponseTimeSec)
    .filter((v): v is number => v != null && v > 0);
  const maxResponse = Math.max(1, ...responders);

  const sentimentByAuthor = new Map(sentiment.map((s) => [s.author, s.score]));

  return authorStats.map((s) => {
    const emojiRate = s.messageCount ? s.emojiCount / s.messageCount : 0;
    const responseScore =
      s.medianResponseTimeSec != null && s.medianResponseTimeSec > 0
        ? 1 - s.medianResponseTimeSec / maxResponse
        : 0.5;
    const sScore = sentimentByAuthor.get(s.author) ?? 0;

    return {
      author: s.author,
      traits: [
        { key: 'trait.initiator', score: clamp01(s.conversationsStarted / maxStarted) },
        { key: 'trait.expressive', score: clamp01(emojiRate / maxEmojiRate) },
        { key: 'trait.talkative', score: clamp01(s.avgWordsPerMessage / maxWordsPerMsg) },
        { key: 'trait.responsive', score: clamp01(responseScore) },
        { key: 'trait.positive', score: clamp01((sScore + 1) / 2) },
      ],
    };
  });
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

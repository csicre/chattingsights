/**
 * Parser de exports de chats de WhatsApp.
 *
 * WhatsApp no tiene un formato único: cambia por sistema operativo (iOS/Android),
 * versión, locale (separadores de fecha, AM/PM vs 24h) y por los corchetes de iOS.
 * Este parser detecta el formato línea a línea con varias expresiones regulares y
 * reconstruye mensajes multilínea.
 *
 * Todo ocurre en el cliente. El texto nunca sale del navegador.
 */

import type {
  ChatFormat,
  ChatMessage,
  ParsedChat,
  SupportedLanguage,
} from './types';

/** Caracteres invisibles que WhatsApp mete en los exports (LRM, RLM, NBSP…). */
const INVISIBLE_CHARS = /[\u200e\u200f\u202a-\u202e\u00a0]/g;

/**
 * Cada patrón captura: fecha, hora, autor y texto.
 * Soportamos los dos grandes contenedores:
 *  - iOS:     [dd/mm/yy, hh:mm:ss] Autor: mensaje
 *  - Android: dd/mm/yy, hh:mm - Autor: mensaje
 * Con separadores de fecha / . -, horas 12h (AM/PM, incluido a.m./p.m.) y 24h.
 */
interface LinePattern {
  format: ChatFormat;
  regex: RegExp;
}

const PATTERNS: LinePattern[] = [
  // iOS con corchetes: [12/03/2023, 20:15:30] Autor: texto
  {
    format: 'ios-24h',
    regex:
      /^\[(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\]\s(.*?):\s([\s\S]*)$/,
  },
  // iOS 12h con corchetes: [12/03/2023, 8:15:30 p. m.] Autor: texto
  {
    format: 'ios-12h',
    regex:
      /^\[(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*[ap]\.?\s*m\.?)\]\s(.*?):\s([\s\S]*)$/i,
  },
  // Android 12h: 12/03/23, 8:15 p. m. - Autor: texto
  {
    format: 'android-12h',
    regex:
      /^(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*[ap]\.?\s*m\.?)\s[-–]\s(.*?):\s([\s\S]*)$/i,
  },
  // Android 24h: 12/03/23, 20:15 - Autor: texto
  {
    format: 'android-24h',
    regex:
      /^(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s[-–]\s(.*?):\s([\s\S]*)$/,
  },
];

/** Igual que PATTERNS pero sin "Autor:": son mensajes de sistema. */
const SYSTEM_PATTERNS: LinePattern[] = [
  {
    format: 'ios-24h',
    regex:
      /^\[(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?\s*m\.?)?)\]\s([\s\S]*)$/i,
  },
  {
    format: 'android-24h',
    regex:
      /^(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?\s*m\.?)?)\s[-–]\s([\s\S]*)$/i,
  },
];

/** Marcadores de adjuntos omitidos en varios idiomas. */
const ATTACHMENT_MARKERS = [
  'imagen omitida',
  'video omitido',
  'vídeo omitido',
  'audio omitido',
  'gif omitido',
  'sticker omitido',
  'documento omitido',
  'image omitted',
  'video omitted',
  'audio omitted',
  'gif omitted',
  'sticker omitted',
  'document omitted',
  '<multimedia omitido>',
  '<media omitted>',
  'contact card omitted',
];

interface MatchResult {
  format: ChatFormat;
  date: string;
  time: string;
  author: string;
  text: string;
}

/** Intenta casar una línea con un mensaje normal (con autor). */
function matchMessageLine(line: string): MatchResult | null {
  for (const { format, regex } of PATTERNS) {
    const m = regex.exec(line);
    if (m) {
      return { format, date: m[1], time: m[2], author: m[3].trim(), text: m[4] };
    }
  }
  return null;
}

/** Intenta casar una línea con un mensaje de sistema (sin autor). */
function matchSystemLine(line: string): { date: string; time: string; text: string } | null {
  for (const { regex } of SYSTEM_PATTERNS) {
    const m = regex.exec(line);
    if (m) {
      return { date: m[1], time: m[2], text: m[3] };
    }
  }
  return null;
}

/**
 * Convierte fecha + hora en Date. Maneja ambigüedad día/mes de forma heurística:
 * si el primer número > 12, es día (formato europeo). Si no, se asume d/m/y por
 * defecto (lo más común fuera de EE. UU.) pero se corrige si resulta inválido.
 */
function parseDateTime(dateStr: string, timeStr: string): Date | null {
  const dateParts = dateStr.split(/[./-]/).map((p) => parseInt(p, 10));
  if (dateParts.length !== 3 || dateParts.some(isNaN)) return null;

  let [a, b, c] = dateParts;

  // Normaliza el año (yy -> 20yy).
  const normalizeYear = (y: number) => (y < 100 ? 2000 + y : y);

  let day: number;
  let month: number;
  let year: number;

  if (a > 31) {
    // yyyy/mm/dd
    year = normalizeYear(a);
    month = b;
    day = c;
  } else if (a > 12) {
    // dd/mm/yy
    day = a;
    month = b;
    year = normalizeYear(c);
  } else if (b > 12) {
    // mm/dd/yy (EE. UU.)
    month = a;
    day = b;
    year = normalizeYear(c);
  } else {
    // Ambiguo: asumimos d/m/y (predominante en ES y la mayoría de locales).
    day = a;
    month = b;
    year = normalizeYear(c);
  }

  // Hora, con soporte 12h (AM/PM en varios formatos).
  const timeMatch = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?/i.exec(timeStr);
  if (!timeMatch) return null;

  let hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);
  const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
  const meridiem = timeMatch[4]?.toLowerCase();

  if (meridiem === 'p' && hours < 12) hours += 12;
  if (meridiem === 'a' && hours === 12) hours = 0;

  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  return isNaN(date.getTime()) ? null : date;
}

function isAttachment(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return ATTACHMENT_MARKERS.some((marker) => lower.includes(marker));
}

/**
 * Detecta el idioma del contenido de forma ligera a partir de stopwords muy
 * frecuentes. Suficiente para elegir léxicos de análisis; no es un detector serio.
 */
function detectLanguage(messages: ChatMessage[]): SupportedLanguage {
  const sample = messages
    .filter((m) => !m.isSystem && !m.isAttachment)
    .slice(0, 500)
    .map((m) => m.text.toLowerCase())
    .join(' ');

  const esHits = countWordHits(sample, [
    'que', 'de', 'la', 'el', 'y', 'no', 'es', 'por', 'para', 'con', 'pero', 'está', 'más',
  ]);
  const enHits = countWordHits(sample, [
    'the', 'and', 'you', 'that', 'for', 'with', 'but', 'this', 'what', 'are', 'not', 'have',
  ]);

  return esHits >= enHits ? 'es' : 'en';
}

function countWordHits(text: string, words: string[]): number {
  let hits = 0;
  for (const w of words) {
    const re = new RegExp(`\\b${w}\\b`, 'g');
    hits += (text.match(re) ?? []).length;
  }
  return hits;
}

/**
 * Parsea el texto completo de un export de WhatsApp.
 * @param raw contenido del archivo .txt
 */
export function parseWhatsAppChat(raw: string): ParsedChat {
  const warnings: string[] = [];
  const normalized = raw.replace(INVISIBLE_CHARS, '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  const messages: ChatMessage[] = [];
  const formatVotes: Record<string, number> = {};
  let current: ChatMessage | null = null;
  let skipped = 0;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line === '') {
      // Línea en blanco: pertenece al mensaje actual si lo hay.
      if (current) current.text += '\n';
      continue;
    }

    const msgMatch = matchMessageLine(line);
    if (msgMatch) {
      const date = parseDateTime(msgMatch.date, msgMatch.time);
      if (!date) {
        skipped++;
        if (current) current.text += '\n' + line;
        continue;
      }
      formatVotes[msgMatch.format] = (formatVotes[msgMatch.format] ?? 0) + 1;
      const attachment = isAttachment(msgMatch.text);
      current = {
        timestamp: date,
        author: msgMatch.author,
        text: attachment ? '' : msgMatch.text,
        isSystem: false,
        isAttachment: attachment,
      };
      messages.push(current);
      continue;
    }

    const sysMatch = matchSystemLine(line);
    if (sysMatch) {
      const date = parseDateTime(sysMatch.date, sysMatch.time);
      if (date) {
        current = {
          timestamp: date,
          author: '',
          text: sysMatch.text,
          isSystem: true,
          isAttachment: false,
        };
        messages.push(current);
        continue;
      }
    }

    // Continuación de un mensaje multilínea.
    if (current) {
      current.text += '\n' + line;
    } else {
      skipped++;
    }
  }

  if (skipped > 0) {
    warnings.push(`${skipped} líneas no se pudieron interpretar y se omitieron o anexaron.`);
  }

  const detectedFormat =
    (Object.entries(formatVotes).sort((a, b) => b[1] - a[1])[0]?.[0] as ChatFormat) ??
    'unknown';

  if (messages.length === 0) {
    warnings.push(
      'No se detectó ningún mensaje. ¿Seguro que es un export .txt de WhatsApp sin modificar?',
    );
  }

  const authors = Array.from(
    new Set(messages.filter((m) => !m.isSystem).map((m) => m.author)),
  );

  const detectedLanguage = detectLanguage(messages);

  return { messages, authors, detectedFormat, detectedLanguage, warnings };
}

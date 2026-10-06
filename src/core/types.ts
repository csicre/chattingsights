/**
 * Tipos de dominio compartidos por el parser, el motor de análisis y la UI.
 * Todo el procesamiento ocurre en el cliente: estos objetos nunca salen del navegador.
 */

/** Idiomas soportados por la app y el análisis. Preparado para ampliarse. */
export type SupportedLanguage = 'es' | 'en';

/** Un único mensaje ya parseado de un export de WhatsApp. */
export interface ChatMessage {
  /** Marca temporal del mensaje. */
  timestamp: Date;
  /** Autor del mensaje tal cual aparece en el export. */
  author: string;
  /** Texto del mensaje (vacío si es un adjunto o mensaje de sistema). */
  text: string;
  /** true si es un mensaje de sistema (cambios de grupo, cifrado, etc.). */
  isSystem: boolean;
  /** true si el cuerpo era un adjunto omitido (imagen, audio, etc.). */
  isAttachment: boolean;
}

/** Resultado del parseo de un export completo. */
export interface ParsedChat {
  messages: ChatMessage[];
  /** Autores detectados (sin contar mensajes de sistema). */
  authors: string[];
  /** Formato detectado del export. */
  detectedFormat: ChatFormat;
  /** Idioma detectado del contenido para el análisis. */
  detectedLanguage: SupportedLanguage;
  /** Avisos no fatales surgidos durante el parseo. */
  warnings: string[];
}

export type ChatFormat =
  | 'android-12h'
  | 'android-24h'
  | 'ios-12h'
  | 'ios-24h'
  | 'unknown';

/** Conteo genérico etiqueta -> valor, usado por varias visualizaciones. */
export interface CountDatum {
  label: string;
  value: number;
}

/** Métricas por autor. */
export interface AuthorStats {
  author: string;
  messageCount: number;
  wordCount: number;
  charCount: number;
  emojiCount: number;
  /** Media de palabras por mensaje. */
  avgWordsPerMessage: number;
  /** Tiempo medio de respuesta en segundos (cuando responde a otro autor). */
  avgResponseTimeSec: number | null;
  /** Medianas de tiempo de respuesta en segundos. */
  medianResponseTimeSec: number | null;
  /** Quién inicia conversaciones: nº de veces que rompe un silencio largo. */
  conversationsStarted: number;
}

export interface EmojiDatum {
  emoji: string;
  count: number;
}

export interface WordDatum {
  word: string;
  count: number;
}

/** Serie temporal: nº de mensajes por periodo. */
export interface TimeBucket {
  /** Clave del periodo (ISO date, hora 0-23, día de semana 0-6, etc.). */
  key: string;
  count: number;
}

/** Puntuación de sentimiento agregada (-1 muy negativo .. +1 muy positivo). */
export interface SentimentDatum {
  author: string;
  score: number;
  positive: number;
  negative: number;
  neutral: number;
}

/** Rasgos de "personalidad" derivados heurísticamente (no es psicometría real). */
export interface PersonalityProfile {
  author: string;
  traits: PersonalityTrait[];
}

export interface PersonalityTrait {
  /** Clave i18n del rasgo, p.ej. "trait.initiator". */
  key: string;
  /** Valor 0..1 normalizado. */
  score: number;
}

/** Informe completo de análisis que consume la UI. */
export interface AnalysisReport {
  language: SupportedLanguage;
  dateRange: { start: Date; end: Date };
  totalMessages: number;
  totalWords: number;
  authors: string[];
  authorStats: AuthorStats[];
  messagesByHour: TimeBucket[];
  messagesByWeekday: TimeBucket[];
  messagesByMonth: TimeBucket[];
  messagesByDay: TimeBucket[];
  topEmojis: EmojiDatum[];
  topWords: WordDatum[];
  sentiment: SentimentDatum[];
  personality: PersonalityProfile[];
  /** Métricas globales de un vistazo. */
  highlights: {
    busiestDay: string;
    busiestHour: number;
    mostActiveAuthor: string;
    totalEmojis: number;
    avgMessagesPerDay: number;
  };
}

/* ============================================================================
   Tipos del dashboard interactivo (scatter, filtros, series temporales).
   ========================================================================== */

/**
 * Mensaje individual enriquecido para las visualizaciones interactivas.
 * Se deriva de ChatMessage pero añade campos ya calculados (hora decimal,
 * longitud, festivo) y un `id` estable para navegar al detalle.
 */
export interface MessagePoint {
  /** Índice estable del mensaje dentro del chat parseado (clave del detalle). */
  id: number;
  timestamp: Date;
  author: string;
  text: string;
  /** Hora del día en decimal (p. ej. 14.5 = 14:30). Eje X del scatter. */
  hourOfDay: number;
  /** Longitud del mensaje en caracteres (sin espacios). Eje Y del scatter. */
  length: number;
  /** Nº de palabras del mensaje. */
  words: number;
  /** Nº de emojis del mensaje. */
  emojiCount: number;
  /** Emojis presentes en el mensaje (uno por aparición). */
  emojis: string[];
  /** true si cae en fin de semana (sábado o domingo). */
  isWeekend: boolean;
}

/**
 * Nivel de agrupación temporal de las series.
 * 'points' no agrupa: cada mensaje es un punto independiente (solo aplica al
 * scatter temporal, donde permite clicar un punto e ir al mensaje concreto).
 */
export type TimeGroup = 'points' | 'day' | 'week' | 'month';

/**
 * Criterio para dividir las series en varias (una por categoría), controlado
 * desde el bloque "Leyenda".
 *  - 'none': una única serie 'all'.
 *  - 'author': una serie por persona.
 *  - 'weekday': una serie por día de la semana (clave i18n mon..sun).
 */
export type SeriesSplit = 'none' | 'author' | 'weekday';

/** Valor del filtro de festivo. */
export type HolidayFilter = 'all' | 'weekend' | 'weekday';

/** Estado de los filtros del dashboard. */
export interface ChatFilters {
  /** Fecha desde (ISO yyyy-mm-dd) o '' si sin límite. */
  from: string;
  /** Fecha hasta (ISO yyyy-mm-dd) o '' si sin límite. */
  to: string;
  /** Autores seleccionados (vacío = todos). */
  authors: string[];
  /** Filtro de festivo/fin de semana. */
  holiday: HolidayFilter;
}

/** Opciones disponibles para poblar los filtros. */
export interface FilterOptions {
  authors: string[];
  /** Rango de fechas del chat completo (para los min/max de los inputs). */
  minDate: string;
  maxDate: string;
}

/** Un punto de una serie temporal (para TrendPanel). */
export interface TrendPoint {
  /** Instante del cubo temporal. */
  t: Date;
  /** Valor agregado del periodo (nº de mensajes o longitud media). */
  value: number;
}

/** Una serie temporal nombrada (una por categoría/autor). */
export interface TrendSeries {
  /** Clave de la serie (autor, o 'all' si no se divide por autor). */
  key: string;
  points: TrendPoint[];
}

/* ============================================================================
   Tipos de las visualizaciones de las solapas General/Horario.
   ========================================================================== */

/** Punto agregado por periodo para el scatter temporal (X=tiempo, Y=palabras). */
export interface TemporalPoint {
  /** Serie a la que pertenece (autor, o 'all'). */
  key: string;
  /** Instante del cubo temporal (eje X). */
  t: Date;
  /** Longitud media en palabras de los mensajes del periodo (eje Y). */
  avgWords: number;
  /** Nº de mensajes agregados en el periodo (para el tooltip y el tamaño). */
  count: number;
  /**
   * Id del mensaje concreto, solo presente en la agrupación 'points' (sin
   * agrupar). Permite clicar el punto y navegar al detalle del mensaje.
   */
  messageId?: number;
}

/** Una barra del histograma horario. */
export interface HourBin {
  /** Índice del bin. */
  index: number;
  /** Minuto de inicio del bin dentro del día (0..1440). */
  startMinute: number;
  /** Minuto de fin del bin. */
  endMinute: number;
  /** Nº de mensajes en el bin. */
  count: number;
}

/** Una columna del gráfico por día de la semana. */
export interface WeekdayBar {
  /** Clave i18n del día (mon..sun). */
  key: string;
  /** Índice 0=lunes .. 6=domingo (para ordenar). */
  index: number;
  count: number;
}

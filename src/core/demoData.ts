/**
 * Generador de un chat de ejemplo (datos SINTÉTICOS) para la página de muestra.
 *
 * No contiene datos reales de nadie: construye un export de WhatsApp verosímil
 * (formato Android 24h) con dos participantes ficticios a lo largo de varios
 * meses, y lo pasa por el MISMO parser y analizador que un chat real. Así el
 * informe de ejemplo es internamente consistente y type-safe sin construir a
 * mano el objeto AnalysisReport.
 *
 * El resultado es determinista (sin aleatoriedad real) para que el ejemplo se
 * vea siempre igual.
 */

import { parseWhatsAppChat } from './parser';
import { analyzeChat } from './analyzer';
import type { AnalysisReport, ParsedChat, SupportedLanguage } from './types';

/** Participantes ficticios del chat de ejemplo. */
const PERSON_A = 'Alex';
const PERSON_B = 'Sam';

/**
 * Banco de frases por idioma, separadas por tono para que el análisis de
 * sentimiento y los emojis tengan variedad. Son frases genéricas inventadas.
 */
const LINES: Record<SupportedLanguage, { a: string[]; b: string[] }> = {
  es: {
    a: [
      'Buenos días! 😀 qué ganas tenía de hablar contigo',
      'jajaja me encanta cuando dices esas cosas ❤️',
      'oye tengo una idea genial para el finde',
      'me ha hecho mucha ilusión verte ayer',
      'qué bonito día hace hoy, estoy feliz 😄',
      'gracias por lo de ayer, de verdad 🙏',
      'estoy un poco cansada pero contenta',
      'nos vemos luego entonces? 😊',
      'me encanta este plan, cuenta conmigo',
      'jajajaja no puedo parar de reír 😂',
    ],
    b: [
      'yo también tenía ganas la verdad',
      'uf hoy ha sido un día horrible, estoy agotado 😞',
      'me parece perfecto, me apunto',
      'perdona por no contestar antes, estaba liado',
      'qué mala suerte he tenido hoy, menudo desastre',
      'claro que sí, ahí estaré sin falta',
      'estoy triste por lo que pasó ayer 😢',
      'genial! me alegro un montón por ti 🎉',
      'vale, hablamos esta noche mejor',
      'gracias de verdad, eres el mejor',
    ],
  },
  en: {
    a: [
      'Good morning! 😀 I really wanted to talk to you',
      'haha I love it when you say those things ❤️',
      'hey I have a great idea for the weekend',
      'it made me so happy to see you yesterday',
      'what a beautiful day today, I feel great 😄',
      'thanks for yesterday, really 🙏',
      "I'm a little tired but happy",
      'see you later then? 😊',
      'I love this plan, count me in',
      'hahaha I cannot stop laughing 😂',
    ],
    b: [
      'I was looking forward to it too honestly',
      'ugh today was awful, I am exhausted 😞',
      'sounds perfect, I am in',
      'sorry for not replying earlier, I was busy',
      'such bad luck today, what a disaster',
      'of course, I will be there for sure',
      'I feel sad about what happened yesterday 😢',
      'great! I am so happy for you 🎉',
      "okay, let's talk tonight instead",
      'thank you so much, you are the best',
    ],
  },
};

/** dd/mm/yyyy con ceros a la izquierda, formato que entiende el parser. */
function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmtTime(h: number, min: number): string {
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * Construye el texto crudo de un export de WhatsApp (Android 24h) de ejemplo.
 *
 * Genera ~6 meses de conversación con una cadencia variable: más mensajes por
 * las tardes/noches y los fines de semana, para que las gráficas de hora y día
 * de la semana tengan forma. Determinista: usa índices, no Math.random.
 */
function buildRawChat(lang: SupportedLanguage): string {
  const bank = LINES[lang];
  const lines: string[] = [];

  // Punto de partida: ~6 meses atrás desde una fecha fija (determinista).
  const start = new Date(2024, 0, 8, 9, 0, 0); // 8 ene 2024, lunes
  const DAYS = 180;

  let li = 0; // índice rotatorio del banco de frases A
  let lj = 0; // índice rotatorio del banco de frases B

  for (let day = 0; day < DAYS; day++) {
    const date = new Date(start.getTime() + day * 86_400_000);
    const dow = date.getDay(); // 0 dom .. 6 sáb
    const isWeekend = dow === 0 || dow === 6;

    // Nº de "ráfagas" de conversación ese día: más el finde.
    const bursts = isWeekend ? 3 : 2;
    // Saltamos algún día entre semana para que no sea monótono.
    if (!isWeekend && day % 5 === 0) continue;

    for (let b = 0; b < bursts; b++) {
      // Horas sesgadas a tarde/noche: 10, 14, 18, 21, 23.
      const hourPool = isWeekend ? [11, 13, 17, 20, 23] : [8, 14, 19, 22];
      const hour = hourPool[(b + day) % hourPool.length];
      let minute = (day * 7 + b * 13) % 60;

      // Una ráfaga = varios mensajes alternando A/B.
      const burstLen = 3 + ((day + b) % 4); // 3..6 mensajes
      for (let k = 0; k < burstLen; k++) {
        const fromA = k % 2 === 0;
        const author = fromA ? PERSON_A : PERSON_B;
        const text = fromA
          ? bank.a[li++ % bank.a.length]
          : bank.b[lj++ % bank.b.length];

        lines.push(
          `${fmtDate(date)}, ${fmtTime(hour, minute)} - ${author}: ${text}`,
        );

        // Avanzamos el reloj unos minutos dentro de la ráfaga.
        minute = (minute + 2 + (k % 3)) % 60;
      }
    }
  }

  return lines.join('\n');
}

/**
 * Devuelve el chat de ejemplo listo para alimentar la app: el ParsedChat y su
 * AnalysisReport, generados con el pipeline real. El idioma del contenido
 * condiciona el banco de frases y el idioma detectado del informe.
 */
export function buildDemoAnalysis(lang: SupportedLanguage): {
  parsed: ParsedChat;
  report: AnalysisReport;
} {
  const raw = buildRawChat(lang);
  const parsed = parseWhatsAppChat(raw);
  const report = analyzeChat(parsed);
  return { parsed, report };
}

/**
 * Léxicos lingüísticos por idioma: stopwords y palabras con carga de sentimiento.
 *
 * Diseño pensado para escalar: añadir un idioma nuevo es registrar una entrada
 * más en LEXICONS. El motor de análisis siempre pide el léxico por su clave de
 * idioma y cae a 'en' si no existe.
 *
 * Los léxicos de sentimiento son deliberadamente pequeños y transparentes
 * (enfoque algorítmico sin IA): puntúan palabras +1 / -1 y agregan por mensaje.
 */

import type { SupportedLanguage } from './types';

export interface Lexicon {
  /** Palabras vacías que se excluyen del wordmap. */
  stopwords: Set<string>;
  /** Palabras con sentimiento positivo. */
  positive: Set<string>;
  /** Palabras con sentimiento negativo. */
  negative: Set<string>;
}

const ES_STOPWORDS = `a al algo algunas algunos ante antes como con contra cual cuando de del desde donde dos el ella ellas ellos en entre era erais eran eras eres es esa esas ese eso esos esta estaba estas este esto estos estoy fin fue fueron ha hace hacia han hasta hay la las le les lo los mas más me mi mis mucho muy nada ni no nos nosotros o os otra otras otro otros para pero poco por porque que quien se sea si sin so sobre su sus te tiene tienen todo todos tu tus un una uno unos vosotros y ya yo soy eres somos sois son estoy estás está estamos estáis están tengo tienes tenemos tenéis tienen me te nos os les lo la le`
  .split(/\s+/)
  .filter(Boolean);

const EN_STOPWORDS = `a an and are as at be been but by can cannot could did do does doing done for from had has have having he her here hers him his how i if in into is it its just me my no nor not of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under up very was we were what when where which while who whom why will with would you your yours`
  .split(/\s+/)
  .filter(Boolean);

const ES_POSITIVE = `genial gracias feliz feliz amor amo quiero bien bueno buenisimo buenísimo perfecto encanta encantó increíble maravilloso guay fenomenal contento alegre jaja jajaja jeje disfruto éxito ánimo abrazo besos cariño ilusión agradecido estupendo fantástico`.split(/\s+/);

const ES_NEGATIVE = `triste mal malo horrible odio enfadado enojado cansado agotado problema pena llorar nunca jamás peor fatal preocupado estrés estresado miedo culpa discutir pelea aburrido solo decepción decepcionado difícil duele dolor`.split(/\s+/);

const EN_POSITIVE = `great thanks happy love like good awesome perfect amazing wonderful nice cool fantastic glad excited haha lol enjoy success cheers hug kiss grateful fun beautiful best`.split(/\s+/);

const EN_NEGATIVE = `sad bad awful hate angry mad tired exhausted problem sorry cry never worse terrible worried stress stressed afraid fear guilt argue fight bored lonely disappointment hard hurt pain`.split(/\s+/);

function buildLexicon(
  stopwords: string[],
  positive: string[],
  negative: string[],
): Lexicon {
  return {
    stopwords: new Set(stopwords),
    positive: new Set(positive),
    negative: new Set(negative),
  };
}

export const LEXICONS: Record<SupportedLanguage, Lexicon> = {
  es: buildLexicon(ES_STOPWORDS, ES_POSITIVE, ES_NEGATIVE),
  en: buildLexicon(EN_STOPWORDS, EN_POSITIVE, EN_NEGATIVE),
};

export function getLexicon(lang: SupportedLanguage): Lexicon {
  return LEXICONS[lang] ?? LEXICONS.en;
}

/**
 * Utilidades de texto: tokenización de palabras y extracción de emojis.
 * Unicode-aware para funcionar con español (acentos, ñ) y futuros idiomas.
 */

/** Regex de emojis basada en propiedades Unicode (incluye secuencias ZWJ y modificadores). */
const EMOJI_REGEX =
  /(\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic})*[\u{1F3FB}-\u{1F3FF}]?)/gu;

/** Divide un texto en palabras en minúsculas, conservando letras Unicode y números. */
export function tokenize(text: string): string[] {
  const matches = text
    .toLowerCase()
    .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return matches ?? [];
}

/** Extrae todos los emojis de un texto (uno por aparición). */
export function extractEmojis(text: string): string[] {
  const matches = text.match(EMOJI_REGEX);
  if (!matches) return [];
  // Filtra dígitos y símbolos que no son realmente emojis visibles.
  return matches.filter((m) => !/^[0-9#*]$/.test(m));
}

/** Cuenta caracteres excluyendo espacios. */
export function charCount(text: string): number {
  return text.replace(/\s/g, '').length;
}

/**
 * Normaliza un texto para búsqueda PRESERVANDO LA LONGITUD (una posición de
 * entrada = una de salida). Pasa a minúsculas y elimina los diacríticos de cada
 * carácter de forma individual, de modo que los índices de las coincidencias
 * siguen siendo válidos sobre el texto original (para poder resaltar).
 *
 * Ej.: "Días" -> "dias", "Qué" -> "que". Así "dias" encuentra "días" y
 * viceversa, y las tildes no impiden la búsqueda.
 */
export function normalizeForSearch(text: string): string {
  let out = '';
  for (const ch of text.toLowerCase()) {
    // Descompone el carácter y quita las marcas combinantes. Si el resultado
    // tiene más de un code point (p. ej. ligaduras raras), nos quedamos con el
    // original para no desalinear longitudes.
    const decomposed = ch.normalize('NFD').replace(/\p{Mn}+/gu, '');
    out += decomposed.length === 1 ? decomposed : ch;
  }
  return out;
}

/** Un rango de coincidencia [start, end) en índices del texto ORIGINAL. */
export interface MatchRange {
  start: number;
  end: number;
}

/**
 * Encuentra todas las apariciones (no solapadas) de `term` dentro de `text`,
 * insensible a mayúsculas y a tildes. Soporta cualquier expresión escrita por
 * el usuario, incluidas varias palabras con espacios (p. ej. "buenos días").
 *
 * Devuelve rangos sobre el texto ORIGINAL, listos para resaltar. Un término
 * vacío (o que al normalizar queda vacío) devuelve [].
 */
export function findMatches(text: string, term: string): MatchRange[] {
  // Recortamos espacios de los extremos pero conservamos los internos, de modo
  // que "buenos días" se busca tal cual.
  const search = normalizeForSearch(term).trim();
  if (!search) return [];
  const haystack = normalizeForSearch(text); // misma longitud que `text`
  const ranges: MatchRange[] = [];
  let from = 0;
  while (from <= haystack.length - search.length) {
    const idx = haystack.indexOf(search, from);
    if (idx === -1) break;
    ranges.push({ start: idx, end: idx + search.length });
    from = idx + search.length; // sin solapamiento
  }
  return ranges;
}

/** Nº de apariciones (no solapadas) de `term` en `text`, con la misma
 *  semántica que `findMatches`. */
export function countMatches(text: string, term: string): number {
  return findMatches(text, term).length;
}

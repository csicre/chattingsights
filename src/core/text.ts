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

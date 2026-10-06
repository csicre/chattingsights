/**
 * Helpers de formato dependientes del idioma de la UI.
 */

import type { SupportedLanguage } from './types';

/** Formatea una duración en segundos a un string legible (s / min / h). */
export function formatDuration(
  seconds: number | null,
  labels: { seconds: string; minutes: string; hours: string },
): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${Math.round(seconds)} ${labels.seconds}`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} ${labels.minutes}`;
  return `${(seconds / 3600).toFixed(1)} ${labels.hours}`;
}

/** Formatea una fecha según el idioma. */
export function formatDate(date: Date, lang: SupportedLanguage): string {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** Formatea un número grande con separadores de miles del locale. */
export function formatNumber(n: number, lang: SupportedLanguage): string {
  return new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-US').format(Math.round(n));
}

/** Formatea un precio en céntimos a moneda. */
export function formatPrice(cents: number, currency: string, lang: SupportedLanguage): string {
  return new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

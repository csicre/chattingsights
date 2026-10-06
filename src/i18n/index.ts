/**
 * Configuración de i18n.
 *
 * Preparado para escalar: añadir un idioma es (1) crear el archivo de recursos
 * en ./locales, (2) importarlo aquí y (3) registrarlo en `resources` y en
 * SUPPORTED_UI_LANGUAGES. El detector de idioma del navegador elige el inicial.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { es } from './locales/es';
import { en } from './locales/en';

export const SUPPORTED_UI_LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
] as const;

export const resources = {
  es: { translation: es },
  en: { translation: en },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_UI_LANGUAGES.map((l) => l.code),
    interpolation: {
      escapeValue: false, // React ya escapa
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;

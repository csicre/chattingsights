/**
 * Integración ligera con Google Analytics 4 (gtag.js).
 *
 * El ID de medición se lee de `VITE_GA_ID` (formato G-XXXXXXXXXX). Si no está
 * definido —p. ej. en desarrollo o en forks sin analítica— el módulo no hace
 * absolutamente nada: no se carga ningún script ni se envían eventos.
 *
 * ChattingSights procesa datos personales en el navegador y presume de
 * privacidad, así que configuramos GA con `anonymize_ip` y desactivamos el
 * envío automático de la primera página: en una SPA preferimos controlar
 * nosotros cuándo se registra cada vista (ver `trackPageView`).
 */

const GA_ID = import.meta.env.VITE_GA_ID as string | undefined;

type GtagArgs =
  | [command: 'js', date: Date]
  | [command: 'config', targetId: string, config?: Record<string, unknown>]
  | [command: 'event', eventName: string, params?: Record<string, unknown>];

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: GtagArgs) => void;
  }
}

let initialized = false;

/** ¿Está la analítica activa (hay ID configurado)? */
export function analyticsEnabled(): boolean {
  return typeof GA_ID === 'string' && GA_ID.length > 0;
}

/**
 * Carga el script de gtag.js e inicializa GA4. Idempotente: llamarlo más de
 * una vez no tiene efecto. No hace nada si no hay `VITE_GA_ID`.
 */
export function initAnalytics(): void {
  if (initialized || !analyticsEnabled() || typeof document === 'undefined') {
    return;
  }
  initialized = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: GtagArgs) {
    window.dataLayer.push(args);
  };

  window.gtag('js', new Date());
  window.gtag('config', GA_ID as string, {
    anonymize_ip: true,
    // Controlamos las vistas manualmente porque la app es una SPA.
    send_page_view: false,
  });
}

/**
 * Registra una vista de página virtual. Pensado para una SPA donde la URL no
 * cambia pero sí la pantalla que ve el usuario.
 */
export function trackPageView(path: string, title?: string): void {
  if (!initialized || !analyticsEnabled()) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title,
    page_location: window.location.origin + path,
  });
}

/** Registra un evento personalizado (clics, conversiones, etc.). */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!initialized || !analyticsEnabled()) return;
  window.gtag('event', name, params);
}

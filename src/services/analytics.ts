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

/** Clave de localStorage donde se guarda la decisión de consentimiento. */
const CONSENT_KEY = 'chattingsights:analytics-consent';

type ConsentValue = 'granted' | 'denied';

type ConsentState = Record<string, 'granted' | 'denied'>;

type GtagArgs =
  | [command: 'js', date: Date]
  | [command: 'config', targetId: string, config?: Record<string, unknown>]
  | [command: 'event', eventName: string, params?: Record<string, unknown>]
  | [command: 'consent', subcommand: 'default' | 'update', state: ConsentState];

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

  // Consent Mode v2: declaramos el estado por defecto (denegado) ANTES de
  // configurar GA. Como solo llamamos a initAnalytics() tras el consentimiento,
  // acto seguido lo actualizamos a 'granted'. Esto deja el modelo de consent
  // explícito y preparado para los requisitos de la UE/EEE.
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  });

  window.gtag('js', new Date());
  window.gtag('config', GA_ID as string, {
    anonymize_ip: true,
    // Controlamos las vistas manualmente porque la app es una SPA.
    send_page_view: false,
  });

  // El usuario ya aceptó (initAnalytics solo se llama tras el consentimiento),
  // así que concedemos el almacenamiento de analítica.
  window.gtag('consent', 'update', {
    analytics_storage: 'granted',
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

// ---- Eventos del funnel de pago (nombres estándar de GA4) --------------
//
// Usamos los nombres de evento recomendados por GA4 para e-commerce, así GA
// los reconoce automáticamente como pasos del embudo de compra.

/** Precio del informe en unidades monetarias (p. ej. 4.99), leído de env. */
function reportValue(): number {
  const cents = Number(import.meta.env.VITE_REPORT_PRICE_CENTS ?? '499');
  return Number.isFinite(cents) ? cents / 100 : 0;
}

/** El usuario inicia el checkout de Stripe (pulsa desbloquear). */
export function trackBeginCheckout(): void {
  trackEvent('begin_checkout', {
    currency: (import.meta.env.VITE_REPORT_CURRENCY ?? 'eur').toUpperCase(),
    value: reportValue(),
  });
}

/** Conversión: el informe se desbloquea tras un pago correcto. */
export function trackPurchase(): void {
  trackEvent('purchase', {
    currency: (import.meta.env.VITE_REPORT_CURRENCY ?? 'eur').toUpperCase(),
    value: reportValue(),
  });
}

/** El usuario cancela el checkout y vuelve sin pagar. */
export function trackCheckoutCancelled(): void {
  trackEvent('checkout_cancelled');
}

// ---- Consentimiento ----------------------------------------------------
//
// GA no se carga hasta que el usuario acepta explícitamente. La decisión se
// guarda en localStorage para no volver a preguntar en cada visita.

/** Lee la decisión guardada, o `null` si el usuario aún no ha decidido. */
export function getConsent(): ConsentValue | null {
  if (typeof localStorage === 'undefined') return null;
  const value = localStorage.getItem(CONSENT_KEY);
  return value === 'granted' || value === 'denied' ? value : null;
}

/**
 * ¿Debemos mostrar el banner de consentimiento? Solo si la analítica está
 * configurada (hay ID) y el usuario todavía no ha tomado una decisión.
 */
export function shouldAskForConsent(): boolean {
  return analyticsEnabled() && getConsent() === null;
}

/** El usuario acepta: guarda la decisión e inicializa GA inmediatamente. */
export function grantConsent(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CONSENT_KEY, 'granted');
  }
  initAnalytics();
}

/** El usuario rechaza: guarda la decisión. GA no se carga. */
export function denyConsent(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CONSENT_KEY, 'denied');
  }
}

/**
 * Inicializa la analítica solo si el usuario ya había dado su consentimiento
 * en una visita anterior. Pensado para llamarse al arrancar la app. Si no hay
 * consentimiento previo, no hace nada (el banner pedirá la decisión).
 */
export function initAnalyticsIfConsented(): void {
  if (getConsent() === 'granted') {
    initAnalytics();
  }
}

/**
 * Analítica para las guías estáticas (SEO).
 *
 * Estas páginas se sirven directamente, sin pasar por el bundle de React, así
 * que no comparten el módulo `src/services/analytics.ts`. Replicamos aquí lo
 * esencial para que el tráfico orgánico de las guías también se mida:
 *
 *   - Mismo ID de medición: el placeholder de abajo se sustituye en el build
 *     por el valor de VITE_GA_ID (ver scripts/inject-ga.mjs). Si no se
 *     sustituye, el script detecta el placeholder y no carga nada.
 *   - Mismo consentimiento: reutilizamos la clave de localStorage de la app
 *     ('chattingsights:analytics-consent'), de modo que la decisión tomada en
 *     la web principal se respeta también en las guías y viceversa.
 *   - Consent Mode v2 con analytics_storage denegado por defecto.
 *
 * Si el usuario no ha decidido aún, mostramos un banner mínimo acorde al de la
 * app. Si ya aceptó, cargamos GA; si rechazó, no cargamos nada.
 */
(function () {
  var GA_ID = '__GA_ID__';
  // Si el placeholder no se sustituyó en el build, desactivamos la analítica.
  if (!GA_ID || GA_ID.charAt(0) !== 'G') return;

  var CONSENT_KEY = 'chattingsights:analytics-consent';

  function getConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY);
    } catch (e) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch (e) {
      /* almacenamiento no disponible: seguimos sin recordar la decisión */
    }
  }

  function loadGA() {
    if (window.__gaLoaded) return;
    window.__gaLoaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };

    window.gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    });

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);

    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
  }

  function showBanner() {
    var lang = (document.documentElement.lang || 'es').slice(0, 2);
    var es = lang !== 'en';
    var texts = es
      ? {
          msg: 'Usamos Google Analytics para entender el uso de la web mediante cookies. El análisis de tus chats sigue ocurriendo solo en tu navegador.',
          accept: 'Aceptar',
          reject: 'Rechazar',
        }
      : {
          msg: 'We use Google Analytics to understand site usage via cookies. Your chat analysis still happens only in your browser.',
          accept: 'Accept',
          reject: 'Reject',
        };

    var bar = document.createElement('div');
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-live', 'polite');
    bar.style.cssText =
      'position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;' +
      'background:#182031;border:1px solid #2a3651;border-radius:14px;' +
      'padding:16px 18px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;' +
      'justify-content:space-between;max-width:760px;margin:0 auto;' +
      'box-shadow:0 10px 30px rgba(0,0,0,.4);font:14px/1.5 system-ui,sans-serif;color:#d4dbea';

    var p = document.createElement('p');
    p.textContent = texts.msg;
    p.style.cssText = 'margin:0;flex:1 1 280px';

    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px';

    var reject = document.createElement('button');
    reject.type = 'button';
    reject.textContent = texts.reject;
    reject.style.cssText =
      'cursor:pointer;border:1px solid #2a3651;background:transparent;color:#d4dbea;' +
      'padding:8px 16px;border-radius:999px;font-weight:600';

    var accept = document.createElement('button');
    accept.type = 'button';
    accept.textContent = texts.accept;
    accept.style.cssText =
      'cursor:pointer;border:none;background:#25d366;color:#04210f;' +
      'padding:8px 18px;border-radius:999px;font-weight:700';

    function close() {
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    }
    accept.addEventListener('click', function () {
      setConsent('granted');
      loadGA();
      close();
    });
    reject.addEventListener('click', function () {
      setConsent('denied');
      close();
    });

    actions.appendChild(reject);
    actions.appendChild(accept);
    bar.appendChild(p);
    bar.appendChild(actions);
    document.body.appendChild(bar);
  }

  var consent = getConsent();
  if (consent === 'granted') {
    loadGA();
  } else if (consent === null) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showBanner);
    } else {
      showBanner();
    }
  }
})();

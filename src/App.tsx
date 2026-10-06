import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Landing } from './components/Landing';
import { Uploader } from './components/Uploader';
import { Dashboard } from './components/dash/Dashboard';
import { MessageDetail } from './components/dash/MessageDetail';
import { SUPPORTED_UI_LANGUAGES } from './i18n';
import { useApp } from './state/AppContext';
import { clearCheckoutParams, readCheckoutReturn } from './services/checkout';
import { trackPageView, trackEvent } from './services/analytics';
import { ConsentBanner } from './components/ConsentBanner';
import { ExampleBanner } from './components/ExampleBanner';
import { buildDemoAnalysis } from './core/demoData';
import type { SupportedLanguage } from './core/types';

type View = 'landing' | 'upload';

export function App() {
  const { t, i18n } = useTranslation();
  const { report, setAnalysis, reset, unlock, selectedMessageId } = useApp();
  const [view, setView] = useState<View>('landing');
  // Cuando es true, el `report` cargado es el chat de EJEMPLO (datos
  // sintéticos), no un chat real del usuario: se muestra el Report con banner.
  const [exampleMode, setExampleMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Se incrementa cuando el usuario acepta la analítica, para re-registrar la
  // vista actual una vez GA ya está cargado.
  const [consentTick, setConsentTick] = useState(0);

  // Al volver de Stripe Checkout, confirma el desbloqueo.
  useEffect(() => {
    const result = readCheckoutReturn();
    if (result === 'paid') {
      unlock();
      setToast(t('paywall.unlocked'));
    }
    if (result) clearCheckoutParams();
  }, [unlock, t]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // Vista de página virtual para GA4. La app es una SPA sin router: la URL no
  // cambia, así que mapeamos cada estado a una ruta/título lógicos.
  useEffect(() => {
    let path = '/';
    let title = 'Landing';
    if (report && exampleMode) {
      path = '/ejemplo';
      title = 'Informe de ejemplo';
    } else if (report) {
      if (selectedMessageId != null) {
        path = '/mensaje';
        title = 'Detalle de mensaje';
      } else {
        path = '/dashboard';
        title = 'Dashboard';
      }
    } else if (view === 'upload') {
      path = '/subir';
      title = 'Subir chat';
    }
    trackPageView(path, title);
  }, [report, exampleMode, selectedMessageId, view, consentTick]);

  // Carga el chat de EJEMPLO (datos sintéticos) y muestra el Report con banner.
  const showExample = () => {
    const lang = (i18n.language.split('-')[0] as SupportedLanguage) === 'en' ? 'en' : 'es';
    const { parsed, report: demoReport } = buildDemoAnalysis(lang);
    setAnalysis(parsed, demoReport);
    setExampleMode(true);
    trackEvent('view_example');
  };

  // Entra al flujo de subir un chat desde la landing (CTA principal).
  const startUpload = () => {
    trackEvent('start_upload', { from: 'landing' });
    setView('upload');
  };

  // Sale del ejemplo y lleva al flujo real de subir un chat.
  const startFromExample = () => {
    reset();
    setExampleMode(false);
    setView('upload');
    trackEvent('start_upload', { from: 'example' });
  };

  // Sale del ejemplo y vuelve a la landing.
  const exitExample = () => {
    reset();
    setExampleMode(false);
    setView('landing');
  };

  // Decide qué vista principal mostrar.
  let content;
  if (report && exampleMode) {
    // En modo ejemplo el usuario navega EXACTAMENTE las mismas vistas que con un
    // chat real (dashboard interactivo + detalle de mensaje), solo que con datos
    // sintéticos. Un banner recuerda que es un ejemplo y ofrece empezar/salir.
    content = (
      <>
        <ExampleBanner onStart={startFromExample} onExit={exitExample} />
        {selectedMessageId != null ? <MessageDetail /> : <Dashboard />}
      </>
    );
  } else if (report) {
    content = selectedMessageId != null ? <MessageDetail /> : <Dashboard />;
  } else if (view === 'landing') {
    content = <Landing onStart={startUpload} onSeeExample={showExample} />;
  } else {
    content = <Uploader />;
  }

  // En la landing mantenemos el header libre de distracciones para que el
  // único CTA domine. El selector de idioma aparece a partir del uploader.
  const isLanding = !report && view === 'landing';

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <img src="/favicon.svg" width={36} height={36} alt="" />
          <span>
            {t('app.name')}
            <small>{t('app.tagline')}</small>
          </span>
        </div>
        {!isLanding && (
          <div className="header-actions">
            <select
              className="lang-select"
              value={i18n.language.split('-')[0]}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              aria-label={t('nav.language')}
            >
              {SUPPORTED_UI_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      <main>{content}</main>

      <footer className="footer" style={{ marginTop: 24 }}>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
          🔒 {t('footer.privacy')}
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 13 }}>
          <a href="/guia/analizar-chat-pareja.html" style={{ color: 'var(--muted)' }}>
            {t('footer.guideCouple')}
          </a>
        </p>
      </footer>

      {toast && <div className="toast">{toast}</div>}

      <ConsentBanner onAccept={() => setConsentTick((n) => n + 1)} />
    </div>
  );
}

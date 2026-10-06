import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Landing } from './components/Landing';
import { Uploader } from './components/Uploader';
import { Dashboard } from './components/dash/Dashboard';
import { MessageDetail } from './components/dash/MessageDetail';
import { SUPPORTED_UI_LANGUAGES } from './i18n';
import { useApp } from './state/AppContext';
import { clearCheckoutParams, readCheckoutReturn } from './services/checkout';

type View = 'landing' | 'upload';

export function App() {
  const { t, i18n } = useTranslation();
  const { report, unlock, selectedMessageId } = useApp();
  const [view, setView] = useState<View>('landing');
  const [toast, setToast] = useState<string | null>(null);

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

  // Decide qué vista principal mostrar.
  let content;
  if (report) {
    content = selectedMessageId != null ? <MessageDetail /> : <Dashboard />;
  } else if (view === 'landing') {
    content = <Landing onStart={() => setView('upload')} />;
  } else {
    content = <Uploader />;
  }

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
      </header>

      <main>{content}</main>

      <footer className="footer" style={{ marginTop: 24 }}>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
          🔒 {t('footer.privacy')}
        </p>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

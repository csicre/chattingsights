import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './styles/global.css';
import './styles/theme.css';
import { App } from './App';
import { AppProvider } from './state/AppContext';
import { initAnalyticsIfConsented } from './services/analytics';

// Solo carga GA si el usuario ya dio su consentimiento en una visita previa.
// Si no, el banner de consentimiento (ConsentBanner) pedirá la decisión.
initAnalyticsIfConsented();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('No se encontró el elemento #root');

createRoot(rootEl).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);

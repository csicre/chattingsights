/**
 * Banner de consentimiento de cookies / analítica.
 *
 * Solo se muestra si la analítica está configurada (hay VITE_GA_ID) y el
 * usuario todavía no ha decidido. Al aceptar se carga Google Analytics; al
 * rechazar no se carga nada. La decisión se recuerda en localStorage, así que
 * el banner no vuelve a aparecer una vez tomada.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  denyConsent,
  grantConsent,
  shouldAskForConsent,
} from '../services/analytics';

interface ConsentBannerProps {
  /** Se llama tras aceptar, cuando GA ya está inicializado, para que el
   *  contenedor pueda registrar la vista de página actual. */
  onAccept?: () => void;
}

export function ConsentBanner({ onAccept }: ConsentBannerProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(() => shouldAskForConsent());

  if (!visible) return null;

  const accept = () => {
    grantConsent();
    setVisible(false);
    onAccept?.();
  };

  const reject = () => {
    denyConsent();
    setVisible(false);
  };

  return (
    <div className="consent-banner" role="dialog" aria-live="polite" aria-label={t('consent.message')}>
      <p className="consent-text">{t('consent.message')}</p>
      <div className="consent-actions">
        <button type="button" className="btn btn-ghost consent-btn" onClick={reject}>
          {t('consent.reject')}
        </button>
        <button type="button" className="btn btn-primary consent-btn" onClick={accept}>
          {t('consent.accept')}
        </button>
      </div>
    </div>
  );
}

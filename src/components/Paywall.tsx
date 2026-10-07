import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/state/AppContext';
import { startCheckout } from '@/services/checkout';
import { trackBeginCheckout } from '@/services/analytics';
import { formatPrice } from '@/core/format';
import type { SupportedLanguage } from '@/core/types';

/**
 * Overlay de paywall que se superpone a una sección bloqueada.
 * Lanza el checkout de Stripe. El desbloqueo real se confirma al volver del pago.
 */
export function Paywall({ lang }: { lang: SupportedLanguage }) {
  const { t } = useTranslation();
  const { unlock } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const priceCents = Number(import.meta.env.VITE_REPORT_PRICE_CENTS ?? '499');
  const currency = import.meta.env.VITE_REPORT_CURRENCY ?? 'eur';
  const priceLabel = formatPrice(priceCents, currency, lang);

  const handleUnlock = async () => {
    setError(false);
    setBusy(true);
    trackBeginCheckout();
    try {
      await startCheckout(lang);
      // startCheckout redirige fuera; si no hay backend (dev), caemos al catch.
    } catch {
      // Fallback de desarrollo: si no hay función de pago configurada,
      // permitimos desbloquear localmente para poder probar la UI.
      if (import.meta.env.DEV) {
        unlock();
      } else {
        setError(true);
      }
      setBusy(false);
    }
  };

  return (
    <div className="paywall">
      <span className="badge">{t('paywall.previewNote')}</span>
      <h3 style={{ margin: 0 }}>{t('paywall.locked')}</h3>
      <p className="muted" style={{ maxWidth: 420, margin: 0 }}>
        {t('paywall.description')}
      </p>
      <button className="btn btn-primary" onClick={handleUnlock} disabled={busy}>
        {busy ? (
          <>
            <span className="spinner" /> {t('paywall.processing')}
          </>
        ) : (
          t('paywall.unlockCta', { price: priceLabel })
        )}
      </button>
      <span className="muted" style={{ fontSize: 13 }}>
        {t('paywall.oneTime')}
      </span>
      {error && (
        <p style={{ color: '#c0392b', margin: 0 }} role="alert">
          {t('paywall.error')}
        </p>
      )}
    </div>
  );
}

import { useTranslation } from 'react-i18next';

/**
 * Aviso que acompaña al modo EJEMPLO: recuerda que los datos son sintéticos y
 * ofrece dos acciones: analizar el chat propio o salir del ejemplo. Se muestra
 * sobre el dashboard de ejemplo para que el usuario pueda navegar las mismas
 * vistas que tendrá con su chat real.
 */
interface ExampleBannerProps {
  /** Ir al flujo real de subir un chat. */
  onStart: () => void;
  /** Salir del ejemplo y volver a la landing. */
  onExit: () => void;
}

export function ExampleBanner({ onStart, onExit }: ExampleBannerProps) {
  const { t } = useTranslation();
  return (
    <div className="example-banner" role="note">
      <div>
        <strong>{t('example.bannerTitle')}</strong>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          {t('example.bannerBody')}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button className="btn btn-ghost" onClick={onExit}>
          ← {t('common.back')}
        </button>
        <button className="btn btn-primary" onClick={onStart}>
          {t('example.startCta')} →
        </button>
      </div>
    </div>
  );
}

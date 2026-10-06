import { useTranslation } from 'react-i18next';

interface LandingProps {
  onStart: () => void;
}

const ICON_COLOR = '#25d366';
// Hueco = color de la tarjeta (--surface), para que el detalle lea como
// espacio negativo recortado en el verde, igual que las barras del favicon.
const ICON_CUTOUT = '#182031';

/** Icono simplificado de candado, en el mismo verde que el favicon. */
function LockIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M16 22v-5a8 8 0 0 1 16 0v5"
        stroke={ICON_COLOR}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <rect x="12" y="22" width="24" height="18" rx="4" fill={ICON_COLOR} />
      <circle cx="24" cy="30" r="2.5" fill={ICON_CUTOUT} />
      <rect x="22.5" y="31" width="3" height="5" rx="1.5" fill={ICON_CUTOUT} />
    </svg>
  );
}

/** Mini gráfico de barras, en el mismo verde que el favicon. */
function ChartIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="9" y="26" width="7" height="14" rx="2.5" fill={ICON_COLOR} />
      <rect x="20.5" y="18" width="7" height="22" rx="2.5" fill={ICON_COLOR} />
      <rect x="32" y="10" width="7" height="30" rx="2.5" fill={ICON_COLOR} />
    </svg>
  );
}

/** Documento/fichero, en el mismo verde que el favicon. */
function FileIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M13 8h15l8 8v24a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3z"
        fill={ICON_COLOR}
      />
      <path d="M28 8v8h8" fill={ICON_CUTOUT} fillOpacity="0.35" />
      <rect x="16" y="24" width="16" height="3" rx="1.5" fill={ICON_CUTOUT} />
      <rect x="16" y="30" width="16" height="3" rx="1.5" fill={ICON_CUTOUT} />
      <rect x="16" y="36" width="10" height="3" rx="1.5" fill={ICON_CUTOUT} />
    </svg>
  );
}

const FEATURE_ICON = {
  privacy: LockIcon,
  insights: ChartIcon,
  export: FileIcon,
} as const;

export function Landing({ onStart }: LandingProps) {
  const { t } = useTranslation();

  const features = ['privacy', 'insights', 'export'] as const;

  return (
    <section className="container">
      <div className="hero">
        <div className="hero-privacy">
          <span className="badge">{t('landing.privacyBadge')}</span>
          <span className="badge">{t('footer.privacy')}</span>
        </div>
        <h1 style={{ marginTop: 16 }}>{t('landing.title')}</h1>
        <p>{t('landing.subtitle')}</p>
        <button className="btn btn-primary" onClick={onStart}>
          {t('landing.cta')} →
        </button>
      </div>

      <div className="features">
        {features.map((key) => {
          const Icon = FEATURE_ICON[key];
          return (
            <div key={key} className="card">
              <div style={{ marginBottom: 8 }}>
                <Icon />
              </div>
              <h3>{t(`landing.features.${key}.title`)}</h3>
              <p className="muted" style={{ margin: 0 }}>
                {t(`landing.features.${key}.body`)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

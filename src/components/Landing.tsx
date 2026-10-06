import { useTranslation } from 'react-i18next';

interface LandingProps {
  onStart: () => void;
}

export function Landing({ onStart }: LandingProps) {
  const { t } = useTranslation();

  const features = [
    { key: 'privacy', icon: '🔒' },
    { key: 'insights', icon: '📊' },
    { key: 'export', icon: '📄' },
  ] as const;

  return (
    <section className="container">
      <div className="hero">
        <span className="badge">{t('landing.privacyBadge')}</span>
        <h1 style={{ marginTop: 16 }}>{t('landing.title')}</h1>
        <p>{t('landing.subtitle')}</p>
        <button className="btn btn-primary" onClick={onStart}>
          {t('landing.cta')} →
        </button>
      </div>

      <div className="features">
        {features.map((f) => (
          <div key={f.key} className="card">
            <div style={{ fontSize: 32, marginBottom: 8 }}>{f.icon}</div>
            <h3>{t(`landing.features.${f.key}.title`)}</h3>
            <p className="muted" style={{ margin: 0 }}>
              {t(`landing.features.${f.key}.body`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

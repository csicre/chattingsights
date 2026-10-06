import { useTranslation } from 'react-i18next';
import { SUPPORTED_UI_LANGUAGES } from '@/i18n';

export function TopBar() {
  const { t, i18n } = useTranslation();

  return (
    <header className="topbar container">
      <div className="brand">
        <img src="/favicon.svg" width={28} height={28} alt="" />
        {t('app.name')}
      </div>
      <label>
        <span className="muted" style={{ marginRight: 8, fontSize: 13 }}>
          {t('nav.language')}
        </span>
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
      </label>
    </header>
  );
}

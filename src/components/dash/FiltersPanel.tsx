import { useTranslation } from 'react-i18next';
import { MultiSelect } from './MultiSelect';
import type {
  ChatFilters,
  FilterOptions,
  HolidayFilter,
  TimeGroup,
} from '@/core/types';

/**
 * Panel de controles de la columna izquierda:
 *  - Bloque "Filtros": fecha (desde/hasta), persona, festivo.
 *  - Bloque "Agrupación temporal" + "Leyenda" (dividir series por persona).
 *
 * Sigue el patrón del proyecto de referencia: filtro simple con etiqueta a la
 * izquierda y control a la derecha; filtro de fecha con etiqueta arriba.
 */
interface FiltersPanelProps {
  options: FilterOptions;
  filters: ChatFilters;
  setFilters: (updater: (prev: ChatFilters) => ChatFilters) => void;
  resetFilters: () => void;
  timeGroup: TimeGroup;
  setTimeGroup: (g: TimeGroup) => void;
  splitByAuthor: boolean;
  setSplitByAuthor: (v: boolean) => void;
}

export function FiltersPanel({
  options,
  filters,
  setFilters,
  resetFilters,
  timeGroup,
  setTimeGroup,
  splitByAuthor,
  setSplitByAuthor,
}: FiltersPanelProps) {
  const { t } = useTranslation();

  const filtersActive =
    Boolean(filters.from) ||
    Boolean(filters.to) ||
    filters.authors.length > 0 ||
    filters.holiday !== 'all';
  const dateActive = Boolean(filters.from || filters.to);

  const holidayOptions: { id: HolidayFilter; label: string }[] = [
    { id: 'all', label: t('filters.holiday.all') },
    { id: 'weekday', label: t('filters.holiday.weekday') },
    { id: 'weekend', label: t('filters.holiday.weekend') },
  ];

  const timeOptions: { id: TimeGroup; label: string }[] = [
    { id: 'day', label: t('time.day') },
    { id: 'week', label: t('time.week') },
    { id: 'month', label: t('time.month') },
  ];

  return (
    <div className="sidebar">
      <section className="controls">
        <div className="group">
          <div className="group-head">
            <h3>{t('filters.title')}</h3>
            {filtersActive && (
              <button className="link-btn" onClick={resetFilters}>
                {t('filters.clearAll')}
              </button>
            )}
          </div>

          {/* Fecha */}
          <div className="field-block">
            <div className="field-head">
              <span className="field-label">{t('filters.date')}</span>
              {dateActive && (
                <button
                  className="clear-x"
                  onClick={() => setFilters((f) => ({ ...f, from: '', to: '' }))}
                  aria-label={t('filters.clearDate')}
                  title={t('filters.clearDate')}
                >
                  ×
                </button>
              )}
            </div>
            <label className="field">
              <span>{t('filters.from')}</span>
              <input
                type="date"
                value={filters.from}
                min={options.minDate || undefined}
                max={filters.to || options.maxDate || undefined}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>{t('filters.to')}</span>
              <input
                type="date"
                value={filters.to}
                min={filters.from || options.minDate || undefined}
                max={options.maxDate || undefined}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              />
            </label>
          </div>

          {/* Persona */}
          <div className="field-block field-inline">
            <span className="field-label">{t('filters.person')}</span>
            <div className="field-control">
              <MultiSelect
                label={t('filters.person')}
                options={options.authors}
                selected={filters.authors}
                onChange={(vals) => setFilters((f) => ({ ...f, authors: vals }))}
                placeholder={t('filters.allPeople')}
              />
              {filters.authors.length > 0 && (
                <button
                  className="clear-x"
                  onClick={() => setFilters((f) => ({ ...f, authors: [] }))}
                  aria-label={t('filters.clearPerson')}
                  title={t('filters.clearPerson')}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Festivo / fin de semana */}
          <div className="field-block">
            <span className="field-label">{t('filters.holiday')}</span>
            <div className="segmented">
              {holidayOptions.map((opt) => (
                <button
                  key={opt.id}
                  className={filters.holiday === opt.id ? 'active' : ''}
                  onClick={() => setFilters((f) => ({ ...f, holiday: opt.id }))}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="controls">
        <div className="group">
          <h3>{t('time.title')}</h3>
          <div className="segmented">
            {timeOptions.map((opt) => (
              <button
                key={opt.id}
                className={timeGroup === opt.id ? 'active' : ''}
                onClick={() => setTimeGroup(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="hint">{t('time.hint')}</p>
        </div>

        <div className="group">
          <h3>{t('legend.title')}</h3>
          <div className="pills">
            <button
              className={`pill ${splitByAuthor ? 'active' : ''}`}
              onClick={() => setSplitByAuthor(!splitByAuthor)}
            >
              {t('legend.byPerson')}
            </button>
          </div>
          <p className="hint">{t('legend.hint')}</p>
        </div>
      </section>
    </div>
  );
}

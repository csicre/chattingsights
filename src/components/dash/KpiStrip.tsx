/**
 * Tira de KPIs genérica. Recibe la lista de KPIs ya calculados por cada solapa.
 * Cada KPI muestra un globo de ayuda (.ui-tip con data-tip) al pasar el ratón.
 */
export interface KpiItem {
  value: string;
  label: string;
  info: string;
}

interface KpiStripProps {
  items: KpiItem[];
}

export function KpiStrip({ items }: KpiStripProps) {
  return (
    <div className="kpi-strip">
      {items.map((it) => (
        <div className="kpi ui-tip tip-left" data-tip={it.info} key={it.label}>
          <span className="kpi-value">{it.value}</span>
          <span className="kpi-label">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

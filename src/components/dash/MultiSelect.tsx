import { useEffect, useRef, useState } from 'react';

/**
 * Combo multi-selección: botón con resumen + panel de opciones con checkboxes.
 * Se cierra al hacer clic fuera. Controlado por props (selected/onChange).
 */
interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  /** Texto cuando no hay nada seleccionado. */
  placeholder?: string;
}

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Todos',
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0]
        : `${selected.length} seleccionados`;

  return (
    <div className="multiselect" ref={rootRef}>
      <button
        type="button"
        className="ms-button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <span className={`ms-summary${selected.length === 0 ? ' muted' : ''}`}>{summary}</span>
        <span className="ms-caret">▼</span>
      </button>
      {open && (
        <div className="ms-panel" role="listbox">
          {options.length === 0 && <div className="ms-option muted">Sin opciones</div>}
          {options.map((opt) => (
            <label key={opt} className="ms-option">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

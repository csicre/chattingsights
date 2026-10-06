import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Icono de información (ⓘ) con globo de ayuda al pasar el ratón o enfocar con
 * teclado. Pensado para ir junto al título de una gráfica y explicar cómo leerla.
 *
 * El globo se renderiza en un PORTAL al <body> con position: fixed, para que
 * nunca lo recorte un contenedor con overflow: hidden. La posición se calcula
 * desde el rectángulo del icono y se ajusta para no salirse de la ventana.
 */
const BUBBLE_W = 260;
const GAP = 8;
const MARGIN = 8;

interface InfoTipProps {
  text: string;
  align?: 'left' | 'right';
  label?: string;
}

export function InfoTip({ text, align = 'left', label = 'Más información' }: InfoTipProps) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  const place = useCallback(() => {
    const icon = iconRef.current;
    const bubble = bubbleRef.current;
    if (!icon) return;
    const r = icon.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const h = bubble ? bubble.getBoundingClientRect().height : 80;

    let left = align === 'right' ? r.right - BUBBLE_W : r.left;
    left = Math.max(MARGIN, Math.min(left, vw - BUBBLE_W - MARGIN));

    let top = r.bottom + GAP;
    if (top + h + MARGIN > vh) top = r.top - GAP - h;
    top = Math.max(MARGIN, Math.min(top, vh - h - MARGIN));

    setPos({ left, top });
  }, [align]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  if (!text) return null;

  return (
    <>
      <span
        ref={iconRef}
        className="info-tip"
        tabIndex={0}
        role="button"
        aria-label={label}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="4.6" r="0.95" fill="currentColor" />
          <rect x="7.2" y="6.6" width="1.6" height="5" rx="0.8" fill="currentColor" />
        </svg>
      </span>
      {open &&
        createPortal(
          <span
            ref={bubbleRef}
            className="info-bubble"
            role="tooltip"
            style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
          >
            {text}
          </span>,
          document.body,
        )}
    </>
  );
}

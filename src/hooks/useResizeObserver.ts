import { useEffect, useState, type RefObject } from 'react';

/** Observa el tamaño de un elemento y devuelve su ancho/alto en px. */
export function useResizeObserver(ref: RefObject<HTMLElement>): {
  width: number;
  height: number;
} {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

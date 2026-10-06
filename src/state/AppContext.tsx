/**
 * Estado global de la app mediante React Context.
 *
 * Guarda el chat parseado + el informe analizado (solo en memoria) y el estado
 * de desbloqueo del pago. El desbloqueo se persiste en localStorage porque
 * Stripe Checkout redirige fuera de la app y vuelve: necesitamos recordar que ya
 * se pagó.
 *
 * Ni el chat ni el informe se persisten: contienen datos personales y deben
 * desaparecer al recargar, coherente con la promesa de privacidad.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AnalysisReport, ParsedChat } from '@/core/types';

const UNLOCK_KEY = 'chattingsights:unlocked';

function initialUnlocked(): boolean {
  const forcePaywall = import.meta.env.VITE_FORCE_PAYWALL === 'true';
  if (import.meta.env.DEV && !forcePaywall) return true;
  return localStorage.getItem(UNLOCK_KEY) === 'true';
}

interface AppState {
  parsed: ParsedChat | null;
  report: AnalysisReport | null;
  /** Carga un chat parseado + su informe (ambos a la vez). */
  setAnalysis: (parsed: ParsedChat, report: AnalysisReport) => void;
  isUnlocked: boolean;
  unlock: () => void;
  /** Vuelve a la pantalla inicial (descarta el análisis actual). */
  reset: () => void;
  /** Mensaje seleccionado para la vista de detalle (id = índice en parsed.messages). */
  selectedMessageId: number | null;
  setSelectedMessageId: (id: number | null) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [parsed, setParsed] = useState<ParsedChat | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [isUnlocked, setUnlocked] = useState<boolean>(initialUnlocked);

  const setAnalysis = useCallback((p: ParsedChat, r: AnalysisReport) => {
    setParsed(p);
    setReport(r);
    setSelectedMessageId(null);
  }, []);

  const unlock = useCallback(() => {
    localStorage.setItem(UNLOCK_KEY, 'true');
    setUnlocked(true);
  }, []);

  const reset = useCallback(() => {
    setParsed(null);
    setReport(null);
    setSelectedMessageId(null);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      parsed,
      report,
      setAnalysis,
      isUnlocked,
      unlock,
      reset,
      selectedMessageId,
      setSelectedMessageId,
    }),
    [parsed, report, setAnalysis, isUnlocked, unlock, reset, selectedMessageId],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>');
  return ctx;
}

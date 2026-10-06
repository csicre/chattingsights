/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REPORT_PRICE_CENTS: string;
  readonly VITE_REPORT_CURRENCY: string;
  /** Si es 'true', fuerza el paywall también en desarrollo. */
  readonly VITE_FORCE_PAYWALL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

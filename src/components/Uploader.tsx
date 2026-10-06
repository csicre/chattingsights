import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseWhatsAppChat } from '@/core/parser';
import { analyzeChat } from '@/core/analyzer';
import { useApp } from '@/state/AppContext';

export function Uploader() {
  const { t } = useTranslation();
  const { setAnalysis } = useApp();
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setBusy(true);
      try {
        const text = await file.text();
        const parsed = parseWhatsAppChat(text);
        if (parsed.messages.length === 0) {
          setError(t('upload.errorEmpty'));
          setBusy(false);
          return;
        }
        const report = analyzeChat(parsed);
        setAnalysis(parsed, report);
      } catch {
        setError(t('upload.errorFormat'));
      } finally {
        setBusy(false);
      }
    },
    [setAnalysis, t],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  return (
    <section className="container" style={{ maxWidth: 720 }}>
      <h2>{t('upload.title')}</h2>

      <div
        className={`dropzone${dragActive ? ' active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        aria-label={t('upload.instructions')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,text/plain"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
        {busy ? (
          <p>{t('upload.parsing')}</p>
        ) : (
          <p>{dragActive ? t('upload.dropActive') : t('upload.instructions')}</p>
        )}
      </div>

      {error && (
        <p style={{ color: '#c0392b', marginTop: 12 }} role="alert">
          {error}
        </p>
      )}

      <details className="card" style={{ marginTop: 20 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          {t('upload.howTo')}
        </summary>
        <ol style={{ marginTop: 12 }}>
          {(t('upload.howToSteps', { returnObjects: true }) as string[]).map(
            (step, i) => (
              <li key={i}>{step}</li>
            ),
          )}
        </ol>
      </details>
    </section>
  );
}

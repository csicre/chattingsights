import { useTranslation } from 'react-i18next';
import { useApp } from '@/state/AppContext';
import { tokenize, charCount } from '@/core/text';

/**
 * Página de detalle de un mensaje concreto, a la que se llega al hacer clic en
 * un punto del scatter. Muestra el mensaje, sus metadatos y el contexto de la
 * conversación (mensajes anterior y siguiente).
 */
export function MessageDetail() {
  const { t } = useTranslation();
  const { parsed, selectedMessageId, setSelectedMessageId } = useApp();

  const back = () => setSelectedMessageId(null);

  const msg =
    parsed && selectedMessageId != null ? parsed.messages[selectedMessageId] : null;

  if (!parsed || !msg) {
    return (
      <section className="detail">
        <div className="detail-controls">
          <button className="btn btn-ghost" onClick={back}>
            ← {t('detail.back')}
          </button>
        </div>
        <p className="status">{t('detail.notFound')}</p>
      </section>
    );
  }

  const dateStr = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(msg.timestamp);
  const day = msg.timestamp.getDay();
  const isWeekend = day === 0 || day === 6;

  // Contexto: hasta 2 mensajes antes y 2 después (sin contar los de sistema).
  const context: { id: number; author: string; text: string; current: boolean }[] = [];
  for (
    let i = Math.max(0, selectedMessageId! - 2);
    i <= Math.min(parsed.messages.length - 1, selectedMessageId! + 2);
    i++
  ) {
    const m = parsed.messages[i];
    if (m.isSystem) continue;
    context.push({
      id: i,
      author: m.author,
      text: m.isAttachment ? '📎' : m.text,
      current: i === selectedMessageId,
    });
  }

  return (
    <section className="detail">
      <div className="detail-controls">
        <button className="btn btn-ghost" onClick={back}>
          ← {t('detail.back')}
        </button>
        <h2 style={{ margin: 0, fontSize: 20 }}>{t('detail.title')}</h2>
      </div>

      <div className="message-card">
        <strong style={{ color: 'var(--accent)' }}>{msg.author}</strong>
        <div className="message-bubble">{msg.text}</div>

        <div className="message-meta">
          <div className="m-item">
            <div className="m-label">{t('detail.date')}</div>
            <div className="m-value">{dateStr}</div>
          </div>
          <div className="m-item">
            <div className="m-label">{t('detail.length')}</div>
            <div className="m-value">
              {charCount(msg.text)} {t('detail.chars')}
            </div>
          </div>
          <div className="m-item">
            <div className="m-label">{t('detail.words')}</div>
            <div className="m-value">{tokenize(msg.text).length}</div>
          </div>
          <div className="m-item">
            <div className="m-label">{t('detail.dayType')}</div>
            <div className="m-value">
              {isWeekend ? t('detail.weekend') : t('detail.weekday')}
            </div>
          </div>
        </div>

        {context.length > 1 && (
          <div className="message-context">
            <div className="m-label" style={{ marginBottom: 8 }}>
              {t('detail.context')}
            </div>
            {context.map((c) => (
              <div
                key={c.id}
                className={`context-line${c.current ? ' current' : ''}`}
                onClick={() => !c.current && setSelectedMessageId(c.id)}
                style={{ cursor: c.current ? 'default' : 'pointer' }}
              >
                <span className="c-author">{c.author}</span>
                <span>{c.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

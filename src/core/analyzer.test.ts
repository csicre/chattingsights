import { describe, it, expect } from 'vitest';
import { analyzeChat } from './analyzer';
import { parseWhatsAppChat } from './parser';

const SAMPLE = [
  '01/03/2023, 09:00 - Ana: Buenos días! 😀 Qué ganas de verte',
  '01/03/2023, 09:02 - Luis: Yo también, me encanta quedar contigo ❤️',
  '01/03/2023, 09:05 - Ana: jajaja genial, nos vemos luego',
  '02/03/2023, 20:00 - Luis: Oye estoy triste, día horrible',
  '02/03/2023, 20:01 - Ana: Vaya, lo siento mucho 😢',
].join('\n');

describe('analyzeChat', () => {
  const report = analyzeChat(parseWhatsAppChat(SAMPLE));

  it('cuenta el total de mensajes', () => {
    expect(report.totalMessages).toBe(5);
  });

  it('identifica a ambos autores', () => {
    expect(report.authors.sort()).toEqual(['Ana', 'Luis']);
  });

  it('calcula stats por autor', () => {
    const ana = report.authorStats.find((s) => s.author === 'Ana')!;
    expect(ana.messageCount).toBe(3);
    expect(ana.emojiCount).toBeGreaterThan(0);
  });

  it('calcula sentimiento (Ana más positiva que Luis)', () => {
    const ana = report.sentiment.find((s) => s.author === 'Ana')!;
    const luis = report.sentiment.find((s) => s.author === 'Luis')!;
    expect(ana.score).toBeGreaterThan(luis.score);
  });

  it('extrae emojis top', () => {
    expect(report.topEmojis.length).toBeGreaterThan(0);
  });

  it('construye wordmap sin stopwords', () => {
    const words = report.topWords.map((w) => w.word);
    expect(words).not.toContain('que');
    expect(words).not.toContain('de');
  });

  it('rellena las 24 horas', () => {
    expect(report.messagesByHour).toHaveLength(24);
  });

  it('rellena los 7 días de la semana', () => {
    expect(report.messagesByWeekday).toHaveLength(7);
  });

  it('genera perfiles de personalidad con 5 rasgos', () => {
    expect(report.personality).toHaveLength(2);
    expect(report.personality[0].traits).toHaveLength(5);
    for (const t of report.personality[0].traits) {
      expect(t.score).toBeGreaterThanOrEqual(0);
      expect(t.score).toBeLessThanOrEqual(1);
    }
  });

  it('calcula highlights', () => {
    expect(report.highlights.mostActiveAuthor).toBe('Ana');
    expect(report.highlights.totalEmojis).toBeGreaterThan(0);
  });
});

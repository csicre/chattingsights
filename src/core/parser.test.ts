import { describe, it, expect } from 'vitest';
import { parseWhatsAppChat } from './parser';

describe('parseWhatsAppChat', () => {
  it('parsea el formato Android 24h en español', () => {
    const raw = [
      '12/03/2023, 20:15 - Ana: Hola! ¿Qué tal?',
      '12/03/2023, 20:16 - Luis: Muy bien, ¿y tú?',
    ].join('\n');

    const result = parseWhatsAppChat(raw);

    expect(result.messages).toHaveLength(2);
    expect(result.authors.sort()).toEqual(['Ana', 'Luis']);
    expect(result.messages[0].author).toBe('Ana');
    expect(result.messages[0].text).toBe('Hola! ¿Qué tal?');
    expect(result.detectedLanguage).toBe('es');
  });

  it('parsea el formato iOS con corchetes', () => {
    const raw = '[12/03/2023, 20:15:30] John: Hello there, how are you?';
    const result = parseWhatsAppChat(raw);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].author).toBe('John');
    expect(result.messages[0].text).toBe('Hello there, how are you?');
  });

  it('reconstruye mensajes multilínea', () => {
    const raw = [
      '12/03/2023, 20:15 - Ana: Primera línea',
      'Segunda línea',
      'Tercera línea',
      '12/03/2023, 20:16 - Luis: Otro mensaje',
    ].join('\n');

    const result = parseWhatsAppChat(raw);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].text).toBe('Primera línea\nSegunda línea\nTercera línea');
  });

  it('marca adjuntos omitidos', () => {
    const raw = '12/03/2023, 20:15 - Ana: <Multimedia omitido>';
    const result = parseWhatsAppChat(raw);
    expect(result.messages[0].isAttachment).toBe(true);
    expect(result.messages[0].text).toBe('');
  });

  it('detecta mensajes de sistema sin autor', () => {
    const raw =
      '12/03/2023, 20:15 - Los mensajes y las llamadas están cifrados de extremo a extremo.';
    const result = parseWhatsAppChat(raw);
    expect(result.messages[0].isSystem).toBe(true);
    expect(result.authors).toHaveLength(0);
  });

  it('detecta inglés', () => {
    const raw = [
      '12/03/2023, 20:15 - John: What are you doing with that and the thing?',
      '12/03/2023, 20:16 - Jane: I have not seen you for a while now',
    ].join('\n');
    const result = parseWhatsAppChat(raw);
    expect(result.detectedLanguage).toBe('en');
  });

  it('avisa cuando no hay mensajes', () => {
    const result = parseWhatsAppChat('esto no es un export válido\notra línea');
    expect(result.messages).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('interpreta correctamente día > 12 como formato europeo', () => {
    const raw = '25/12/2023, 10:30 - Ana: Feliz Navidad';
    const result = parseWhatsAppChat(raw);
    const d = result.messages[0].timestamp;
    expect(d.getDate()).toBe(25);
    expect(d.getMonth()).toBe(11); // diciembre
  });
});

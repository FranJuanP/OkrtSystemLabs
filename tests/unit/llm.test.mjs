/**
 * IA con clave propia: la clave va en una cabecera, nunca en la URL, y se
 * borra de los errores. AETHER es público: esto es lo que protege la clave
 * del visitante.
 */
import { describe, it, expect } from 'vitest';
import { construirPeticion, leerRespuesta, sinClave, PROVEEDORES } from '../../src/core/llm.js';

const CLAVE = 'sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const msgs = [{ role: 'user', content: 'hola' }];

describe('construirPeticion', () => {
  for (const p of ['anthropic', 'openai', 'gemini', 'openrouter']) {
    it(`${p}: la clave va en una cabecera y no aparece en la URL ni en el cuerpo`, () => {
      const { url, init } = construirPeticion(p, { modelo: PROVEEDORES[p].modelos[0], clave: CLAVE, system: 'sis', messages: msgs });
      expect(url).not.toContain(CLAVE);
      expect(init.body).not.toContain(CLAVE);
      expect(Object.values(init.headers).join(' ')).toContain(CLAVE);
      expect(url.startsWith('https://')).toBe(true);
    });
  }
  it('anthropic lleva la cabecera de acceso directo desde el navegador y el system aparte', () => {
    const { init } = construirPeticion('anthropic', { modelo: 'm', clave: CLAVE, system: 'sis', messages: msgs });
    expect(init.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(JSON.parse(init.body).system).toBe('sis');
  });
  it('ollama no lleva clave y va a la URL local', () => {
    const { url, init } = construirPeticion('ollama', { modelo: 'mistral', messages: msgs, ollamaURL: 'http://localhost:11434' });
    expect(url).toBe('http://localhost:11434/api/chat');
    expect(JSON.stringify(init.headers)).not.toMatch(/key|authorization/i);
  });
});

describe('leerRespuesta', () => {
  it('lee el texto de cada proveedor', () => {
    expect(leerRespuesta('anthropic', { content: [{ type: 'text', text: 'a' }] })).toBe('a');
    expect(leerRespuesta('openai', { choices: [{ message: { content: 'b' } }] })).toBe('b');
    expect(leerRespuesta('gemini', { candidates: [{ content: { parts: [{ text: 'c' }] } }] })).toBe('c');
    expect(leerRespuesta('ollama', { message: { content: 'd' } })).toBe('d');
    expect(() => leerRespuesta('openai', { error: { message: 'mal' } })).toThrow('mal');
  });
});

describe('sinClave', () => {
  it('borra la clave entera y los patrones de clave de un mensaje', () => {
    expect(sinClave('Incorrect API key provided: ' + CLAVE, CLAVE)).not.toContain(CLAVE);
    expect(sinClave('key sk-proj-abcdef123456789xyz is invalid')).not.toContain('123456789xyz');
    expect(sinClave('AIzaSyD-1234567890abcdefghij bad')).not.toContain('1234567890abcdefghij');
  });
});

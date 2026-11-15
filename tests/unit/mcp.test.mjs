/**
 * Servidor MCP: responde al protocolo y sus herramientas devuelven datos
 * coherentes con el cálculo de la web.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

function conversar(mensajes) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(process.cwd(), 'mcp/aether-mcp.mjs'), '--local', path.join(process.cwd(), 'data')]);
    let out = '';
    const esperadas = mensajes.filter((m) => m.id != null).length;
    p.stdout.on('data', (d) => {
      out += d;
      const lineas = out.trim().split('\n').filter(Boolean);
      if (lineas.length >= esperadas) { p.kill(); resolve(lineas.map((l) => JSON.parse(l))); }
    });
    p.on('error', reject);
    setTimeout(() => { p.kill(); reject(new Error('sin respuesta: ' + out)); }, 15000);
    for (const m of mensajes) p.stdin.write(JSON.stringify(m) + '\n');
  });
}

describe('servidor MCP', () => {
  it('inicializa, lista herramientas y responde a riesgo_pais y ranking', async () => {
    const r = await conversar([
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'riesgo_pais', arguments: { pais: 'Spain' } } },
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'ranking', arguments: { n: 3 } } },
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'no_existe' } },
    ]);
    const por = Object.fromEntries(r.map((m) => [m.id, m]));
    expect(por[1].result.serverInfo.name).toBe('aether');
    expect(por[2].result.tools.map((t) => t.name)).toEqual(expect.arrayContaining(['riesgo_pais', 'ranking', 'tendencias', 'eventos_recientes', 'conflicto']));
    const esp = JSON.parse(por[3].result.content[0].text);
    expect(esp.iso).toBe('ESP');
    expect(esp.indice).toBeGreaterThan(0);
    expect(JSON.parse(por[4].result.content[0].text).lista).toHaveLength(3);
    expect(por[5].error.code).toBe(-32602);
  }, 20000);
});

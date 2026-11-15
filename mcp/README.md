# AETHER · servidor MCP

Permite que un agente (Claude Desktop, Claude Code, Cursor o cualquier
cliente MCP) consulte AETHER con sus propios datos: riesgo de un país,
ranking, tendencias, eventos recientes, conflicto según GDELT y mercados de
predicción.

- **Sin dependencias**: solo Node 18 o superior.
- **Sin claves ni servidor**: lee los mismos ficheros públicos que la web
  (`data/latest.json` y `data/events.json`) y calcula con el mismo
  `src/core/scoring.js`. Corre en tu equipo.

## Herramientas

| Herramienta | Qué devuelve |
|---|---|
| `riesgo_pais` | Índice, nivel, puesto, categorías peores con su tendencia, conflicto GDELT, eventos de 72 h y mercados |
| `ranking` | Países por índice o por una categoría |
| `tendencias` | Países que más empeoran o mejoran (puntos de riesgo por año) |
| `eventos_recientes` | Eventos de las últimas horas, de un país o de todos |
| `conflicto` | Países con más conflicto material en 24 h según GDELT |

## Uso

Desde la raíz del repositorio:

```bash
node mcp/aether-mcp.mjs                 # datos publicados en GitHub Pages
node mcp/aether-mcp.mjs --local ./data  # datos de una carpeta
```

### Claude Desktop

En `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aether": {
      "command": "node",
      "args": ["C:/ruta/a/OkrtSystemLabs/mcp/aether-mcp.mjs"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add aether -- node /ruta/a/OkrtSystemLabs/mcp/aether-mcp.mjs
```

Para usar otra copia publicada: variable `AETHER_DATOS_URL` con la URL de su
carpeta `data/`.

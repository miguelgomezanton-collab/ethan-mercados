# ETHAN Mercados

Trading platform personal — Sistema de inversión "Lo más fuerte de lo fuerte"

## Módulos

| Módulo | Descripción |
|--------|-------------|
| **Screener** | Watchlist + Análisis técnico + Backtesting |
| **Macro** | Dashboard macroeconómico (17 indicadores) |
| **Cartera** | Rentabilidades, métricas, proyecciones |
| **Risk Mgmt** | 7 estrategias de gestión monetaria |
| **Fundamental** | Rankings: Fundamental + Greenblatt + Lynch |

## Acceso

La web está protegida por contraseña.  
Contraseña por defecto: `ethan2026`

Para cambiarla, edita `index.html` y sustituye el hash SHA-256.  
Genera el nuevo hash ejecutando en la consola del navegador (F12):

```js
crypto.subtle.digest('SHA-256', new TextEncoder().encode('TU_NUEVA_CONTRASEÑA'))
  .then(h => console.log(Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('')))
```

## Atajos de teclado

- `Alt+1` → Screener
- `Alt+2` → Macro
- `Alt+3` → Cartera
- `Alt+4` → Risk Management
- `Alt+5` → Fundamental

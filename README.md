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

Contraseña por defecto: `ethan2026`

Para cambiarla, edita `index.html` y sustituye el hash SHA-256.  
Genera el nuevo hash en la consola del navegador (F12):

```js
crypto.subtle.digest('SHA-256', new TextEncoder().encode('TU_NUEVA_CONTRASEÑA'))
  .then(h => console.log(Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('')))
```

## Añadir operaciones a la cartera

Edita el archivo `operaciones.json` directamente en GitHub:

1. Ve al archivo → click en el **lápiz** para editar
2. Añade la nueva operación al final del array `alcista.operaciones`
3. Formato de cada operación:
```json
{
  "valor": "NOMBRE EMPRESA",
  "ticker": "TICK",
  "fechaEntrada": "2025-07-01",
  "fechaSalida": "2025-07-15",
  "precioEntrada": 100.00,
  "precioSalida": 110.00,
  "capital": 3000,
  "peso": 0.30,
  "plusvalia": 300.00,
  "rentabilidad": 0.10,
  "dias": 14,
  "motivo": "Voluntaria"
}
```
4. Click en **Commit changes**
5. La web se actualiza automáticamente en 1-2 minutos

## Atajos de teclado

- `Alt+1` → Screener
- `Alt+2` → Macro
- `Alt+3` → Cartera
- `Alt+4` → Risk Management
- `Alt+5` → Fundamental

## Archivos

| Archivo | Función |
|---------|---------|
| `index.html` | Shell principal + login + navegación |
| `ethan-app.html` | Screener / Watchlist / Backtesting |
| `macro.html` | Dashboard macroeconómico |
| `portfolio.html` | Cartera y rentabilidades |
| `risk.html` | Gestión monetaria |
| `fundamental.html` | Análisis fundamental |
| `operaciones.json` | **Datos editables** de operaciones |

# ETHAN Mercados · Plataforma de Trading

Sistema completo de análisis técnico y gestión de carteras con backtesting del sistema ETHAN.

## 📦 Estructura de Archivos

```
ETHAN_FINAL/
├── index.html              # Plataforma principal (multi-módulo)
├── ethan-app.html         # Watchlist independiente
├── alertas.html           # Sistema de alertas
├── ethan_mercados.html    # Versión alternativa
├── fundamental.html       # Análisis fundamental
├── macro.html            # Indicadores macro
├── portfolio.html        # Gestión de cartera
├── risk.html             # Risk Management
├── sectors.html          # Análisis sectorial
└── operaciones.json      # Datos de operaciones
```

## 🚀 Despliegue en GitHub Pages

### 1. Subir a GitHub

```bash
git add .
git commit -m "Deploy ETHAN platform"
git push origin main
```

### 2. Activar GitHub Pages

1. Ve a **Settings** → **Pages**
2. Source: **Deploy from branch**
3. Branch: **main** / **root**
4. Click **Save**

### 3. Acceder

Tu plataforma estará en:
```
https://tu-usuario.github.io/tu-repo/
```

## 📋 Módulos Incluidos

### **index.html** (Principal)
- **Macro**: Indicadores macroeconómicos
- **Asset Allocation**: Análisis de activos (VTI, VEU, IEF, BNDX, SPY, GLD, USO, HYG, EUR/USD)
- **Sectores**: Análisis de ETFs sectoriales
- **S&P 500**: Screener completo del S&P 500
- **Screener**: Filtrado de valores
- **Cartera**: Gestión de portfolio
- **Fundamental**: Análisis fundamental

### **ethan-app.html** (Watchlist Independiente)
- Watchlist multi-ticker
- Análisis técnico completo
- Dashboard con backtesting

### **Otros Módulos**
- **alertas.html**: Notificaciones y alertas
- **portfolio.html**: Gestión avanzada de cartera
- **risk.html**: Gestión de riesgo
- **sectors.html**: Análisis sectorial standalone

## ⚙️ Sistema ETHAN

### Filtros Mensuales
- MACD > 0 y MACD > Signal
- Stoch(89) > 80 y K > D, o K > 92
- RSI(14) > 65
- Stoch(8) > 78
- Precio > SMA(10)

### Filtros Semanales
- MACD > 0 y MACD > Signal
- Stoch(89) > 85 y K > D, o K > 92
- RSI(14) > 67
- Precio > SMA(20)

### Señales de Entrada
- **MACD**: Cruce alcista + RSI(14) > 57 + MACD > 0
- **SMA5 Semanal**: Precio cruza SMA(5) al alza
- **SMA5 Diario**: Precio cruza SMA(5) al alza
- **RSI5 Diario**: RSI(5) cruza 60 al alza

### Salida
- Precio < SMA(10) semanal
- Filtros mensuales/semanales rotos (viernes)

## 🔧 Correcciones Aplicadas

✅ **index.html**: 63 entidades `&amp;&amp;` corregidas
✅ **ethan-app.html**: 116 entidades `&amp;&amp;` corregidas
✅ **operaciones.json**: Validado y formateado
✅ Todos los proxies actualizados para Yahoo Finance

## 📊 Operaciones Registradas

El archivo `operaciones.json` contiene:
- **Alcista**: 17 operaciones, +29.58% rentabilidad
- **Bajista**: 20 posiciones registradas

## 🌐 APIs Utilizadas

- **Yahoo Finance**: Datos históricos de precios
- **Proxies CORS**: 
  - corsproxy.io
  - api.codetabs.com
  - thingproxy.freeboard.io

## 📱 Compatibilidad

- ✅ Chrome/Edge
- ✅ Firefox
- ✅ Safari
- ✅ Mobile responsive

## 🔒 Sin Backend

Todo funciona 100% en el navegador:
- No requiere servidor
- No requiere base de datos
- localStorage para persistencia local

## 📝 Notas

- Los datos se actualizan en tiempo real desde Yahoo Finance
- El backtesting se ejecuta localmente
- La persistencia usa localStorage del navegador
- Compatible con GitHub Pages (hosting estático gratuito)

---

**Versión**: 2.0  
**Última actualización**: Marzo 2026  
**Autor**: ethan mercados

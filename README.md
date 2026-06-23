# ETHAN Mercados · Plataforma v3.0

Plataforma de análisis e inversión en bolsa. Arquitectura: Vite (vanilla JS,
sin framework) + Firebase (Auth + Firestore) + Vercel.

## Estructura

```
ethan-mercados/
├── index.html              # Shell único: login + sidebar + main
├── src/
│   ├── main.js              # Punto de entrada: conecta auth, sidebar, router
│   ├── firebase.js          # Inicialización Firebase (Auth + Firestore)
│   ├── auth.js               # login / logout / sesión
│   ├── state.js              # Estado global compartido + sync con Firestore
│   ├── router.js             # Navegación entre módulos (sin iframes)
│   ├── styles/main.css       # Paleta teal-on-black, tipografías
│   └── modules/
│       ├── macro/            # 1.1 Coyuntura · 1.2 Indicadores · 1.3 Liquidez
│       ├── alcista/           # 2.1 RV · 2.2 RF · 2.3 Commodities
│       ├── bajista/           # 3.1-3.3 Screener Sectores/SP500/Watchlist
│       ├── cartera/           # 4.1-4.6 Allocation/Cartera/Money/Risk/Backtest/Vitácora
│       └── fundamentales/     # 5. Análisis Fundamental
├── firestore.rules           # Reglas de seguridad (cada usuario solo ve sus datos)
├── vercel.json
└── package.json
```

## Setup local

```bash
npm install
```

### 1. Configurar Firebase

Edita `src/firebase.js` y sustituye el objeto `firebaseConfig` por el que te
da la consola de Firebase (Project settings → General → Your apps).

### 2. Desplegar las reglas de Firestore

Necesitas Firebase CLI instalado (`npm install -g firebase-tools`) y haber
hecho login (`firebase login`). Después:

```bash
firebase init firestore   # selecciona tu proyecto, acepta firestore.rules existente
firebase deploy --only firestore:rules
```

Esto es importante: sin estas reglas, cualquiera con la apiKey pública
podría leer o escribir en tu base de datos. Con ellas, cada usuario solo
puede tocar los documentos bajo `/users/{su_propio_uid}/...`.

### 3. Arrancar en local

```bash
npm run dev
```

Abre `http://localhost:5173`, inicia sesión con el usuario que creaste en
Firebase Authentication.

## Deploy en Vercel

```bash
npm install -g vercel
vercel
```

Sigue las instrucciones (vincula tu cuenta, elige el proyecto). Vercel
detecta `vercel.json` y usa Vite automáticamente. Para producción:

```bash
vercel --prod
```

## Modelo de datos en Firestore

```
users/{uid}/
  operaciones_alcista/{docId}    → { valor, ticker, fechaEntrada, fechaSalida,
                                       precioEntrada, precioSalida, capital,
                                       peso, plusvalia, rentabilidad, dias, motivo }
  operaciones_bajista/{docId}    → { valor, ticker, fecha, precio, capital, peso }
  vitacora/{docId}               → { ticker, estado, msd, nota, fecha }
```

Cada módulo nuevo que añadas puede crear su propia subcolección bajo
`users/{uid}/` siguiendo el mismo patrón — mira `src/state.js` para ver
cómo se registran suscripciones en tiempo real (`onSnapshot`) y funciones
de escritura (`addDoc`, `updateDoc`, `deleteDoc`).

## Añadir un módulo nuevo

1. Crea `src/modules/<grupo>/<nombre>.js` exportando:
   ```js
   export async function render(container, { actionsSlot }) {
     container.innerHTML = `...`;
     return { destroy() { /* limpiar listeners/intervals */ } };
   }
   ```
2. Regístralo en `src/main.js` con `registerPage(...)`.
3. Añade el `<div class="mod" data-page="...">` correspondiente en el
   sidebar de `index.html`.

## Estado actual (placeholder vs conectado)

- **Conectados a Firestore en tiempo real**: Cartera (4.2), Vitácora (4.6)
- **Placeholders** (UI lista, pendiente de migrar lógica real desde los
  HTML originales): el resto de los 17 módulos

## Migración de datos antiguos

Si quieres importar tus operaciones de `operaciones.json` a Firestore,
puedes escribir un script puntual de importación con el SDK de admin de
Firebase, o pegarlas manualmente desde el módulo Cartera una vez esté
ampliado con un formulario de importación masiva.

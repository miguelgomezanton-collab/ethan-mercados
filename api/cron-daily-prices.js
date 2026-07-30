// /api/cron-daily-prices.js — Vercel Serverless
// Pipeline de precios diarios · ETHAN Mercados
// Trigger: cron 30 21 * * * (21:30 UTC, post-cierre NYSE)
// Especificación: §4 del documento de arquitectura

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ── Firebase Admin ────────────────────────────
function getDB() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

// ── Festivos NYSE 2025–2026 ───────────────────
const NYSE_HOLIDAYS = new Set([
  // 2025
  '2025-01-01', // New Year's Day
  '2025-01-20', // MLK Day
  '2025-02-17', // Presidents' Day
  '2025-04-18', // Good Friday
  '2025-05-26', // Memorial Day
  '2025-06-19', // Juneteenth
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-11-27', // Thanksgiving
  '2025-12-25', // Christmas
  // 2026
  '2026-01-01', // New Year's Day
  '2026-01-19', // MLK Day
  '2026-02-16', // Presidents' Day
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth
  '2026-07-03', // Independence Day (observed)
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving
  '2026-12-25', // Christmas
]);

// ── Fecha de trading en hora NY ───────────────
function getTradingDate() {
  const now = new Date();
  const nyStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  return nyStr; // YYYY-MM-DD
}

function isWeekend(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.getDay() === 0 || d.getDay() === 6;
}

function isNYSEHoliday(dateStr) {
  return NYSE_HOLIDAYS.has(dateStr);
}

// ── Twelve Data batch fetch ───────────────────
async function fetchPrices(tickers) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  const symbols = tickers.join(',');
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols)}&apikey=${apiKey}&dp=4`;

  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);
  return await res.json();
}

// ── Parsear respuesta de Twelve Data ─────────
// Si es 1 ticker devuelve objeto, si son varios devuelve {TICKER: obj, ...}
function parseResponse(data, tickers) {
  const results = {};
  if (tickers.length === 1) {
    const t = tickers[0];
    results[t] = data;
  } else {
    for (const t of tickers) {
      results[t] = data[t] || null;
    }
  }
  return results;
}

function isValidQuote(q) {
  if (!q || q.status === 'error') return false;
  const price = parseFloat(q.close);
  return !isNaN(price) && price > 0;
}

// ── Retry individual ticker ───────────────────
async function retryTicker(ticker, attempts = 2, delayMs = 2000) {
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, delayMs));
    try {
      const data = await fetchPrices([ticker]);
      const parsed = parseResponse(data, [ticker]);
      if (isValidQuote(parsed[ticker])) return parsed[ticker];
    } catch {}
  }
  return null;
}

// ── Calcular métricas de cartera ─────────────
async function calcPortfolioMetrics(db, portfolioId, todayDate) {
  try {
    // Leer posiciones activas del portfolio
    const posSnap = await db.collection('ethan_positions_' + portfolioId).get()
      .catch(() => null);

    // Fallback: usar colección flat ethan_positions
    const positions = [];
    const posDoc = await db.collection('ethan_metadata').doc('positions_' + portfolioId).get()
      .catch(() => null);

    // Leer capital inicial
    const capitalDoc = await db.collection('ethan_metadata').doc('capital_' + portfolioId).get()
      .catch(() => null);
    const capitalInicial = capitalDoc?.data()?.alcista || 0;

    if (!capitalInicial) return null;

    // Leer últimos precios de posiciones abiertas
    // (simplificado: lee de prices/{ticker}/latest/current)
    let totalValue = capitalInicial;
    // En producción aquí se calcularía el valor real de cada posición
    // usando prices/{ticker}/latest/current y shares almacenados

    const metrics = {
      portfolioId,
      date: todayDate,
      capitalInicial,
      totalValue,
      totalReturn: totalValue > 0 ? (totalValue - capitalInicial) / capitalInicial : 0,
      calculatedAt: new Date().toISOString(),
    };

    await db.collection('portfolio_metrics')
      .doc(portfolioId)
      .collection('daily')
      .doc(todayDate)
      .set(metrics);

    return metrics;
  } catch (e) {
    console.error('calcPortfolioMetrics error:', e.message);
    return null;
  }
}

// ── Handler principal ─────────────────────────
export default async function handler(req, res) {
  const startMs = Date.now();

  // 1. Autenticación
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'];
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getDB();
  const todayDate = getTradingDate();

  // 2. Comprobar si es día de mercado
  if (isWeekend(todayDate)) {
    return res.status(200).json({ status: 'skipped_weekend', date: todayDate });
  }
  if (isNYSEHoliday(todayDate)) {
    return res.status(200).json({ status: 'skipped_holiday', date: todayDate });
  }

  // 3. Idempotencia
  const cronRef = db.collection('cron_runs').doc(todayDate);
  const cronDoc = await cronRef.get();
  if (cronDoc.exists && cronDoc.data()?.status === 'success') {
    return res.status(200).json({ status: 'already_done', date: todayDate });
  }

  // 4. Leer tickers activos
  const assetsSnap = await db.collection('tracked_assets')
    .where('status', '==', 'active')
    .get();

  const tickers = assetsSnap.docs.map(d => d.data().ticker).filter(Boolean);

  if (!tickers.length) {
    await cronRef.set({ status: 'skipped_no_tickers', date: todayDate, runAt: new Date().toISOString() });
    return res.status(200).json({ status: 'skipped_no_tickers' });
  }

  // 5. Fetch batch en una sola llamada
  let rawData;
  try {
    rawData = await fetchPrices(tickers);
  } catch (e) {
    await cronRef.set({ status: 'failed', error: e.message, date: todayDate, runAt: new Date().toISOString() });
    return res.status(500).json({ status: 'failed', error: e.message });
  }

  const parsed = parseResponse(rawData, tickers);

  // 6. Separar OK y fallidos — reintentar fallidos
  const okTickers = [], failedTickers = [];
  const quotes = {};

  for (const t of tickers) {
    if (isValidQuote(parsed[t])) {
      quotes[t] = parsed[t];
      okTickers.push(t);
    } else {
      failedTickers.push(t);
    }
  }

  // Reintentar fallidos individualmente
  for (const t of failedTickers) {
    const q = await retryTicker(t);
    if (q) {
      quotes[t] = q;
      okTickers.push(t);
      failedTickers.splice(failedTickers.indexOf(t), 1);
    }
  }

  // 7. Escribir en Firestore con batch write
  const batch = db.batch();

  for (const t of okTickers) {
    const q = quotes[t];
    const adjClose = parseFloat(q.close); // Twelve Data /quote usa close como adjusted
    const prevClose = parseFloat(q.previous_close) || adjClose;
    const dayChangePct = prevClose > 0 ? (adjClose - prevClose) / prevClose * 100 : 0;
    const priceData = {
      close: adjClose,
      adjustedClose: adjClose,
      volume: parseInt(q.volume) || 0,
      source: 'twelvedata',
      fetchedAt: new Date().toISOString(),
    };

    // prices/{ticker}/daily/{YYYY-MM-DD}
    batch.set(
      db.collection('prices').doc(t).collection('daily').doc(todayDate),
      priceData
    );

    // prices/{ticker}/latest/current
    batch.set(
      db.collection('prices').doc(t).collection('latest').doc('current'),
      { adjustedClose: adjClose, asOf: todayDate, dayChangePct, ...priceData },
      { merge: true }
    );

    // Actualizar tracked_assets
    batch.update(
      db.collection('tracked_assets').doc(t),
      { lastSuccessfulFetch: new Date().toISOString(), consecutiveFailures: 0 }
    );
  }

  // Marcar tickers fallidos
  for (const t of failedTickers) {
    const assetDoc = assetsSnap.docs.find(d => d.data().ticker === t);
    if (assetDoc) {
      const failures = (assetDoc.data().consecutiveFailures || 0) + 1;
      batch.update(
        db.collection('tracked_assets').doc(t),
        {
          consecutiveFailures: failures,
          ...(failures >= 3 ? { status: 'stale' } : {}),
        }
      );
    }
  }

  await batch.commit();

  // 8. Recalcular métricas de cartera
  // En producción aquí se iterarían los portfolios activos
  await calcPortfolioMetrics(db, 'default', todayDate);

  // 9. Registrar resultado del cron
  const durationMs = Date.now() - startMs;
  const cronStatus = failedTickers.length === 0 ? 'success' : 'partial';
  await cronRef.set({
    status: cronStatus,
    date: todayDate,
    tickersRequested: tickers.length,
    tickersOk: okTickers.length,
    tickersFailed: failedTickers,
    durationMs,
    runAt: new Date().toISOString(),
  });

  return res.status(200).json({
    status: cronStatus,
    date: todayDate,
    tickersOk: okTickers.length,
    tickersFailed: failedTickers,
    durationMs,
  });
}

// /api/backfill-ticker.js — Vercel Serverless
// Descarga histórico de precios para un ticker entre dateFrom y dateTo.
// Si no se especifica rango, descarga 1 año.
// POST { ticker, dateFrom?, dateTo?, status? }
// status: 'active' (sigue abierta) | 'inactive' (posición cerrada)

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getDB() {
  if (!getApps().length) {
    initializeApp({ credential: cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })});
  }
  return getFirestore();
}

// Twelve Data acepta outputsize (número de días) o start_date/end_date
async function fetchHistory(ticker, { dateFrom, dateTo, outputSize = 252 } = {}) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  let url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(ticker)}&interval=1day&apikey=${apiKey}&dp=4&order=DESC`;
  if (dateFrom && dateTo) {
    url += `&start_date=${dateFrom}&end_date=${dateTo}&outputsize=5000`;
  } else {
    url += `&outputsize=${outputSize}`;
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);
  const data = await res.json();
  if (data.status === 'error') throw new Error(data.message || 'Twelve Data error');
  return data.values || [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cronSecret = process.env.CRON_SECRET;
  const isClient   = req.headers['x-ethan-client'] === 'true';
  if (cronSecret && !isClient && req.headers['authorization'] !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { ticker, dateFrom, dateTo, status = 'active', forceRefresh = false } = req.body || {};
  if (!ticker) return res.status(400).json({ error: 'ticker requerido' });

  const db = getDB();
  const startMs = Date.now();

  try {
    // Comprobar si ya tiene histórico en ese rango (skip si es posición cerrada ya procesada)
    if (!forceRefresh && status === 'inactive') {
      const snap = await db.collection('prices').doc(ticker).collection('daily')
        .orderBy('__name__', 'desc').limit(1).get();
      if (!snap.empty) {
        return res.status(200).json({
          status: 'already_exists',
          ticker,
          lastDate: snap.docs[0].id,
        });
      }
    }

    // Descargar histórico
    const history = await fetchHistory(ticker, { dateFrom, dateTo });
    if (!history.length) throw new Error('Sin datos históricos de Twelve Data');

    // Guardar en Firestore en batches
    const BATCH_SIZE = 400;
    let saved = 0;
    for (let i = 0; i < history.length; i += BATCH_SIZE) {
      const chunk = history.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      chunk.forEach(day => {
        const date = day.datetime?.slice(0, 10);
        if (!date) return;
        const close = parseFloat(day.close);
        if (isNaN(close) || close <= 0) return;
        batch.set(
          db.collection('prices').doc(ticker).collection('daily').doc(date),
          {
            close,
            adjustedClose: close,
            open:   parseFloat(day.open)   || null,
            high:   parseFloat(day.high)   || null,
            low:    parseFloat(day.low)    || null,
            volume: parseInt(day.volume)   || 0,
            source: 'twelvedata_backfill',
            fetchedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        saved++;
      });
      await batch.commit();
    }

    // Actualizar latest/current solo si la posición está activa
    if (status === 'active') {
      const latest = history[0]; // Twelve Data devuelve DESC
      const close = parseFloat(latest.close);
      const prevClose = parseFloat(history[1]?.close) || close;
      await db.collection('prices').doc(ticker).collection('latest').doc('current').set({
        adjustedClose: close,
        asOf: latest.datetime?.slice(0, 10),
        dayChangePct: prevClose > 0 ? (close - prevClose) / prevClose * 100 : 0,
        source: 'twelvedata_backfill',
        fetchedAt: new Date().toISOString(),
      });
    }

    // Registrar en tracked_assets
    await db.collection('tracked_assets').doc(ticker).set({
      ticker,
      status,
      addedAt: new Date().toISOString(),
      lastSuccessfulFetch: new Date().toISOString(),
      consecutiveFailures: 0,
      dateFrom: dateFrom || null,
      dateTo:   dateTo   || null,
    }, { merge: true });

    return res.status(200).json({
      status: 'ok', ticker, saved,
      dateFrom: history[history.length-1]?.datetime?.slice(0,10),
      dateTo:   history[0]?.datetime?.slice(0,10),
      durationMs: Date.now() - startMs,
    });

  } catch (e) {
    return res.status(500).json({ status: 'error', ticker, error: e.message });
  }
}

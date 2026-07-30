// ═══════════════════════════════════════════════
// MÓDULO: 4.1 Fondo ETHAN
// Cotización · Movimientos · Distribución
// Contabilidad por participaciones (VL base 100)
// ═══════════════════════════════════════════════

import { UserData } from '../../userdata.js';
import { saveModuleState } from '../../router.js';

const FONDO_KEY  = 'ethan_fondo_v1';
const VL_INICIAL = 100;

// ── Fetch Yahoo histórico (igual que el resto de la plataforma) ──
const PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://soft-field-156f.miguel-gomez-anton.workers.dev/?url=${encodeURIComponent(u)}`,
];

async function fetchYahooHistory(ticker, dateFrom, dateTo) {
  // Convertir fechas a timestamps Unix para Yahoo
  const from = dateFrom ? Math.floor(new Date(dateFrom).getTime() / 1000) : Math.floor(Date.now() / 1000) - 2 * 365 * 86400;
  const to   = dateTo   ? Math.floor(new Date(dateTo + 'T23:59:59').getTime() / 1000) : Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${from}&period2=${to}`;

  for (const fn of PROXIES) {
    try {
      const r = await fetch(fn(url), { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 12000); return c.signal; })() });
      if (!r.ok) continue;
      const j = JSON.parse(await r.text());
      const res = j?.chart?.result?.[0]; if (!res) continue;
      const ts = res.timestamp || [];
      const closes = res.indicators?.quote?.[0]?.close || [];
      const days = [];
      ts.forEach((t, i) => {
        if (closes[i] == null) return;
        days.push({
          date:  new Date(t * 1000).toISOString().slice(0, 10),
          close: closes[i],
        });
      });
      return days;
    } catch {}
  }
  throw new Error(`No se pudo obtener histórico de ${ticker}`);
}

async function saveHistoryToFirestore(ticker, days, status = 'active') {
  // Guardar en ethan_prices_{ticker} como objeto { date: close }
  // Usamos UserData para no necesitar Firebase Admin
  const key = `ethan_px_hist_${ticker}`;
  const existing = await UserData.get(key) || {};
  days.forEach(d => { existing[d.date] = d.close; });
  await UserData.set(key, existing);

  // Guardar también el último precio en ethan_px_latest_{ticker}
  if (status === 'active' && days.length > 0) {
    const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date));
    await UserData.set(`ethan_px_latest_${ticker}`, {
      close: sorted[0].close,
      asOf:  sorted[0].date,
      prev:  sorted[1]?.close || sorted[0].close,
    });
  }
  return Object.keys(existing).length;
}
const fmtE   = n => n != null && isFinite(n) ? (n < 0 ? '-' : '') + '€' + Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
const fmtPct = (n, d=2) => n != null && isFinite(n) ? (n >= 0 ? '+' : '') + n.toFixed(d) + '%' : '—';
const fmtVL  = n => n != null ? n.toFixed(2) : '—';
const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ── Fondo core ────────────────────────────────
async function getFondo() { return await UserData.get(FONDO_KEY); }

async function saveFondo(fondo) { await UserData.set(FONDO_KEY, fondo); }

function calcVLActual(fondo, valorCartera) {
  if (!fondo?.participaciones) return VL_INICIAL;
  return valorCartera / fondo.participaciones;
}

async function inicializar(importe, fecha, nota = 'Capital inicial') {
  const participaciones = importe / VL_INICIAL;
  const fondo = {
    vlInicial: VL_INICIAL,
    participaciones,
    creadoEn: fecha,
    movimientos: [{
      date: fecha, tipo: 'inicio', importe,
      vl: VL_INICIAL,
      participacionesMov: participaciones,
      participacionesTotal: participaciones,
      nota,
    }],
  };
  await saveFondo(fondo);
  return fondo;
}

async function registrarMovimiento(tipo, importe, fecha, nota, valorCarteraActual) {
  let fondo = await getFondo();
  const vl = calcVLActual(fondo, valorCarteraActual);
  const participacionesMov = Math.abs(importe) / vl;
  const nuevasTotal = tipo === 'aportacion'
    ? fondo.participaciones + participacionesMov
    : fondo.participaciones - participacionesMov;

  if (nuevasTotal < 0) throw new Error('Retirada superior al valor del fondo');

  fondo.participaciones = nuevasTotal;
  fondo.movimientos = [...(fondo.movimientos || []), {
    date: fecha, tipo, importe: tipo === 'aportacion' ? importe : -importe,
    vl, participacionesMov, participacionesTotal: nuevasTotal, nota,
  }];
  await saveFondo(fondo);
  return fondo;
}

// ── Ratios trading ────────────────────────────
function calcTrading(ops) {
  if (!ops?.length) return null;
  const wins = ops.filter(h => h.pnlPct > 0);
  const losses = ops.filter(h => h.pnlPct <= 0);
  const winRate = wins.length / ops.length;
  const avgWin = wins.length ? wins.reduce((a, h) => a + h.pnlPct, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((a, h) => a + h.pnlPct, 0) / losses.length) : 0;
  const totalPL = ops.reduce((a, h) => a + (h.pnlAbs || 0), 0);
  const profitFactor = avgLoss > 0 ? (winRate * avgWin) / ((1 - winRate) * avgLoss) : null;
  const esperanza = (winRate * avgWin / 100) - ((1 - winRate) * avgLoss / 100);
  const payoff = avgLoss > 0 ? avgWin / avgLoss : null;
  const avgReturn = ops.reduce((a, h) => a + (h.pnlPct || 0), 0) / ops.length;
  const opsWithDays = ops.filter(h => h.entryDateISO && h.exitDateISO);
  const avgDays = opsWithDays.length
    ? Math.round(opsWithDays.reduce((a, h) =>
        a + Math.round((new Date(h.exitDateISO) - new Date(h.entryDateISO)) / 86400000), 0
      ) / opsWithDays.length)
    : null;
  return { winRate, avgWin, avgLoss, profitFactor, esperanza, payoff, totalPL, avgReturn, avgDays, n: ops.length, hasAbs: ops.some(h => h.pnlAbs) };
}

// ── Métricas desde VL (con histórico diario) ──
// Construye la serie VL día a día usando los precios guardados en Firestore
async function calcMetricas(fondo, vlActual, history = [], positions = [], capitalInicial = 0) {
  const movs = fondo?.movimientos || [];
  const startDate = movs[0]?.date;
  const today = new Date().toISOString().slice(0, 10);
  const nDays = startDate ? Math.round((new Date(today) - new Date(startDate)) / 86400000) : 0;
  const tradingDays = Math.round(nDays * 252 / 365);
  const participaciones = fondo?.participaciones || (capitalInicial / VL_INICIAL);

  const totalReturn = (vlActual - VL_INICIAL) / VL_INICIAL;
  const annReturn = tradingDays > 10
    ? Math.pow(Math.max(1 + totalReturn, 0.001), 252 / tradingDays) - 1
    : totalReturn;

  // ── Leer histórico diario de Firestore ────────────────────────────
  // Para cada ticker: { date: close }
  const allTickers = [
    ...(history || []).map(h => h.ticker),
    ...(positions || []).map(p => p.ticker),
  ].filter((t, i, a) => t && a.indexOf(t) === i);

  const priceHistMap = {};
  await Promise.all(allTickers.map(async ticker => {
    const data = await UserData.get(`ethan_px_hist_${ticker}`);
    if (data) priceHistMap[ticker] = data; // { 'YYYY-MM-DD': close }
  }));

  const hasHistory = Object.keys(priceHistMap).length > 0;

  // ── Construir serie VL día a día ──────────────────────────────────
  let serieFinal = [];

  if (hasHistory && startDate) {
    // Generar todos los días desde startDate hasta hoy
    const days = [];
    let d = new Date(startDate);
    const todayD = new Date(today);
    while (d <= todayD) {
      const dateStr = d.toISOString().slice(0, 10);
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) days.push(dateStr); // solo días laborables
      d.setDate(d.getDate() + 1);
    }

    // Para cada día calcular el valor de cartera y el VL
    days.forEach(date => {
      // Valor cartera = cash disponible ese día + valor de mercado de posiciones abiertas
      // cash = capitalInicial - coste de las posiciones abiertas ese día + P&L realizado acumulado hasta ese día
      let costeInvertido = 0;
      let valorMercado = 0;
      let pnlRealizadoAcum = 0;
      let hayDatos = false;

      // Operaciones ya cerradas antes de esta fecha → P&L realizado
      ;(history || []).forEach(h => {
        if (!h.exitDateISO || !h.pnlAbs) return;
        if (h.exitDateISO < date) pnlRealizadoAcum += h.pnlAbs;
      });

      // Posiciones cerradas activas ese día
      ;(history || []).forEach(h => {
        if (!h.ticker || !h.entryDateISO || !h.exitDateISO) return;
        if (date < h.entryDateISO || date > h.exitDateISO) return;
        const hist = priceHistMap[h.ticker] || {};
        const precio = hist[date];
        if (!precio) return;
        const shares = h.shares || (h.cost && h.entry ? h.cost / h.entry : 0);
        if (!shares) return;
        const coste = h.cost || shares * h.entry;
        const dir = h.direction || 'alcista';
        const vm = dir === 'bajista'
          ? shares * h.entry * 2 - shares * precio  // corto: ganancia si baja
          : shares * precio;
        costeInvertido += coste;
        valorMercado += vm;
        hayDatos = true;
      });

      // Posiciones abiertas activas ese día
      ;(positions || []).forEach(p => {
        if (!p.ticker || !p.entryDate || date < p.entryDate) return;
        const hist = priceHistMap[p.ticker] || {};
        const precio = date === today
          ? (p.currentPrice || p.entry)
          : (hist[date] || null);
        if (!precio) return;
        const shares = p.shares || (p.cost && p.entry ? p.cost / p.entry : 0);
        if (!shares) return;
        const coste = p.cost || shares * p.entry;
        const dir = p.direction || 'alcista';
        const vm = dir === 'bajista'
          ? shares * p.entry * 2 - shares * precio
          : shares * precio;
        costeInvertido += coste;
        valorMercado += vm;
        hayDatos = true;
      });

      if (!hayDatos) return; // saltar días sin posiciones activas con datos

      const cash = capitalInicial + pnlRealizadoAcum - costeInvertido;
      const valorDia = Math.max(0, cash + valorMercado);
      const vlDia = valorDia / participaciones;
      if (vlDia > 0) serieFinal.push([date, vlDia]);
    });
  }

  // Fallback: si no hay histórico, usar puntos de operaciones
  if (serieFinal.length < 3) {
    const puntos = [];
    if (startDate) puntos.push([startDate, VL_INICIAL]);
    let pnlAcum = 0;
    ;(history || [])
      .filter(h => h.exitDateISO && h.pnlAbs != null)
      .sort((a, b) => a.exitDateISO.localeCompare(b.exitDateISO))
      .forEach(h => {
        pnlAcum += h.pnlAbs || 0;
        puntos.push([h.exitDateISO, (capitalInicial + pnlAcum) / participaciones]);
      });
    puntos.push([today, vlActual]);
    movs.forEach(m => { if (m.tipo !== 'inicio') puntos.push([m.date, m.vl]); });
    const serieMap = {};
    puntos.sort((a, b) => a[0].localeCompare(b[0])).forEach(([d, v]) => { if (v > 0) serieMap[d] = v; });
    serieFinal = Object.entries(serieMap).sort((a, b) => a[0].localeCompare(b[0]));
  }

  // Asegurar que el último punto es el VL actual de hoy
  if (serieFinal.length > 0) serieFinal[serieFinal.length - 1] = [today, vlActual];

  // ── Estadísticas sobre la serie diaria ───────────────────────────
  let peak = VL_INICIAL, maxDD = 0, ddDate = startDate;
  serieFinal.forEach(([date, vl]) => {
    if (vl > peak) peak = vl;
    const dd = (peak - vl) / peak;
    if (dd > maxDD) { maxDD = dd; ddDate = date; }
  });

  const drawdownActual = peak > 0 ? (vlActual - peak) / peak : 0;
  const calmar = maxDD > 0 ? annReturn / maxDD : null;

  // Retornos diarios para Sharpe, Sortino, Volatilidad, Beta
  const dailyReturns = [];
  const dailyDates = [];
  for (let i = 1; i < serieFinal.length; i++) {
    const prev = serieFinal[i-1][1], cur = serieFinal[i][1];
    if (prev > 0 && cur > 0) {
      dailyReturns.push((cur - prev) / prev);
      dailyDates.push(serieFinal[i][0]);
    }
  }

  let sharpe = null, sortino = null, annVol = null, beta = null, alpha = null, correlation = null, spyStats = null;
  if (dailyReturns.length >= 10) {
    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((a, r) => a + (r - mean) ** 2, 0) / dailyReturns.length;
    annVol = Math.sqrt(variance * 252);
    sharpe = annVol > 0 ? annReturn / annVol : null;
    const downR = dailyReturns.filter(r => r < 0);
    if (downR.length > 0) {
      const downVol = Math.sqrt(downR.reduce((a, r) => a + r * r, 0) / downR.length * 252);
      sortino = downVol > 0 ? annReturn / downVol : null;
    }

    // Beta vs SPY — leer histórico de SPY de Firestore
    const spyHist = await UserData.get('ethan_px_hist_SPY') || {};
    const spyReturns = [];
    const fondoReturnsSPY = [];
    // dailyDates[i] = fecha del día i, serieFinal[i+1][0] = fecha actual, serieFinal[i][0] = día anterior
    for (let i = 0; i < dailyDates.length; i++) {
      const date     = dailyDates[i];            // fecha del retorno diario
      const prevDate = serieFinal[i]?.[0];       // día anterior en la serie VL
      if (!date || !prevDate || date === prevDate) continue;
      const spyCur  = spyHist[date];
      const spyPrev = spyHist[prevDate];
      if (spyCur && spyPrev && spyPrev > 0 && dailyReturns[i] != null) {
        spyReturns.push((spyCur - spyPrev) / spyPrev);
        fondoReturnsSPY.push(dailyReturns[i]);
      }
    }

    if (spyReturns.length >= 10) {
      const meanF = fondoReturnsSPY.reduce((a,b)=>a+b,0)/fondoReturnsSPY.length;
      const meanS = spyReturns.reduce((a,b)=>a+b,0)/spyReturns.length;
      const cov = fondoReturnsSPY.reduce((a,r,i)=>a+(r-meanF)*(spyReturns[i]-meanS),0)/fondoReturnsSPY.length;
      const varSPY = spyReturns.reduce((a,r)=>a+(r-meanS)**2,0)/spyReturns.length;
      beta = varSPY > 0 ? cov / varSPY : null;
      const spyAnnReturn = Math.pow(1 + meanS, 252) - 1;
      const rf = 0.05;
      // Alpha sobre retorno del período real (no anualizado) — evita distorsión en fondos jóvenes
      const spyTotalReturn = spyReturns.reduce((acc, r) => acc * (1 + r), 1) - 1;
      const rfPeriod = Math.pow(1 + rf, spyReturns.length / 252) - 1;
      alpha = beta != null ? totalReturn - (rfPeriod + beta * (spyTotalReturn - rfPeriod)) : null;
      const stdF = Math.sqrt(fondoReturnsSPY.reduce((a,r)=>a+(r-meanF)**2,0)/fondoReturnsSPY.length);
      const stdS = Math.sqrt(varSPY);
      correlation = stdF > 0 && stdS > 0 ? cov / (stdF * stdS) : null;
      // Métricas SPY para comparativa en cotización
      spyStats = {
        volAnual: Math.sqrt(varSPY * 252),
        twrTotal: spyReturns.reduce((acc, r) => acc * (1 + r), 1) - 1,
        twrAnual: spyAnnReturn,
      };
      // YTD SPY
      const spyDatesYear = Object.keys(spyHist).filter(d => d.startsWith(today.slice(0,4))).sort();
      if (spyDatesYear.length >= 2) {
        spyStats.ytd = (spyHist[spyDatesYear[spyDatesYear.length-1]] - spyHist[spyDatesYear[0]]) / spyHist[spyDatesYear[0]];
      }
    }
  }

  // Serie base 100 para el gráfico
  const serieBase100 = serieFinal.map(([date, vl]) => ({
    date,
    val: +(vl / VL_INICIAL * 100).toFixed(4),
  }));

  // YTD y MTD desde la serie
  const thisYear = today.slice(0, 4);
  const thisMonth = today.slice(0, 7);
  const serieThisYear = serieFinal.filter(([d]) => d.slice(0,4) === thisYear);
  const serieThisMonth = serieFinal.filter(([d]) => d.slice(0,7) === thisMonth);
  // Si el fondo empezó este año, YTD = TWR total (mismo período)
  const fondoStartYear = startDate?.slice(0,4);
  const ytd = fondoStartYear === thisYear
    ? totalReturn
    : serieThisYear.length >= 2
      ? (serieThisYear[serieThisYear.length-1][1] - serieThisYear[0][1]) / serieThisYear[0][1]
      : totalReturn;
  const mtd = serieThisMonth.length >= 2
    ? (serieThisMonth[serieThisMonth.length-1][1] - serieThisMonth[0][1]) / serieThisMonth[0][1]
    : null;

  return {
    vlActual, vlInicial: VL_INICIAL, totalReturn, annReturn,
    nDays, tradingDays, startDate,
    participaciones,
    maxHistoricoVL: peak,
    drawdownActual, ddDate, maxDD, calmar,
    sharpe, sortino, annVol, beta, alpha, correlation,
    spyStats,
    ytd, mtd,
    hasHistory,
    serieBase100,
    nPuntos: serieFinal.length,
    dailyReturns,
  };
}

// ── SVG gráfico VL ────────────────────────────
function vlChart(serieBase100, colorPositivo = true) {
  if (!serieBase100 || serieBase100.length < 2) return '<div style="height:200px;display:flex;align-items:center;justify-content:center;color:var(--text3);font-family:var(--mono);font-size:11px;">Sin datos suficientes — registra el capital inicial</div>';
  const vals = serieBase100.map(p => p.val);
  const W = 820, H = 200;
  const min = Math.min(...vals) * 0.998, max = Math.max(...vals) * 1.002;
  const range = (max - min) || 1;
  const toX = i => (i / (vals.length - 1)) * W;
  const toY = v => H - ((v - min) / range) * (H - 20) - 10;
  const pts = vals.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const last = vals[vals.length - 1];
  const col = last >= 100 ? '#40d9c0' : '#f47174';
  const base100Y = toY(100).toFixed(1);
  const area = `0,${H} ${pts} ${W},${H}`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block;">
    <defs><linearGradient id="vlg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${col}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
    </linearGradient></defs>
    <line x1="0" y1="${base100Y}" x2="${W}" y2="${base100Y}" stroke="var(--border2)" stroke-width="1" stroke-dasharray="4,4"/>
    <text x="8" y="${parseFloat(base100Y)-4}" font-family="IBM Plex Mono" font-size="9" fill="var(--text3)">100</text>
    <polygon points="${area}" fill="url(#vlg)"/>
    <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${toX(vals.length-1).toFixed(1)}" cy="${toY(last).toFixed(1)}" r="5" fill="${col}"/>
    <circle cx="${toX(vals.length-1).toFixed(1)}" cy="${toY(last).toFixed(1)}" r="9" fill="none" stroke="${col}" stroke-width="1" opacity="0.4"/>
  </svg>`;
}

// ── Metric card ───────────────────────────────
function mc(label, value, badge, badgeClass, note) {
  const valCol = badgeClass==='good'?'var(--green)':badgeClass==='bad'?'var(--red)':badgeClass==='warn'?'var(--amber)':'var(--text1)';
  return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px 20px;transition:background 0.15s;">
    <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-bottom:10px;">${label}</div>
    <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px;">
      <span style="font-family:var(--mono);font-size:22px;font-weight:500;color:${valCol};">${value}</span>
      ${badge ? `<span style="font-family:var(--mono);font-size:9px;padding:2px 7px;border-radius:3px;background:${valCol}22;color:${valCol};">${badge}</span>` : ''}
    </div>
    <div style="font-size:10.5px;color:var(--text3);line-height:1.55;">${note}</div>
  </div>`;
}

// ── CSS ───────────────────────────────────────
const CSS = `
.fondo-tabs{display:flex;gap:2px;border-bottom:1px solid var(--border);margin-bottom:20px;}
.fondo-tab{padding:9px 18px;background:transparent;border:none;color:var(--text3);cursor:pointer;font-size:11px;font-weight:600;letter-spacing:0.03em;border-bottom:2px solid transparent;font-family:var(--sans);}
.fondo-tab.active{color:var(--teal);border-bottom-color:var(--teal);}
.fondo-panel{display:none;}.fondo-panel.active{display:block;}
.fondo-hero{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px 28px;margin-bottom:16px;}
.fondo-vl-big{font-family:'Cormorant Garamond',serif;font-size:64px;font-weight:600;font-style:italic;line-height:1;}
.fondo-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:16px;}
.fondo-strip-cell{background:var(--surface);padding:14px 18px;}
.fondo-strip-lbl{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:6px;}
.fondo-strip-val{font-family:var(--mono);font-size:20px;font-weight:700;}
.fondo-strip-sub{font-size:10px;color:var(--text3);margin-top:3px;}
.fondo-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1px;background:var(--border);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:20px;}
.fondo-section{font-family:var(--mono);font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3);display:flex;align-items:center;gap:10px;margin:16px 0 12px;}
.fondo-section::after{content:"";flex:1;height:1px;background:var(--border);}
.fondo-mov-table{width:100%;border-collapse:collapse;font-size:12px;}
.fondo-mov-table th{padding:9px 14px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text3);border-bottom:1px solid var(--border);font-weight:600;background:var(--surface2);}
.fondo-mov-table th.r{text-align:right;}
.fondo-mov-table td{padding:11px 14px;border-bottom:1px solid var(--border);font-family:var(--mono);font-size:11px;color:var(--text2);}
.fondo-mov-table td.r{text-align:right;}
.fondo-mov-table tr:last-child td{border-bottom:none;}
.fondo-form{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px 22px;margin-bottom:16px;}
.fondo-form-title{font-size:13px;font-weight:600;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;}
.fondo-form-grid{display:grid;grid-template-columns:160px 160px 1fr auto;gap:10px;align-items:end;}
.fondo-field label{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);display:block;margin-bottom:5px;}
`;

// ── RENDER ────────────────────────────────────
export async function render(container, { actionsSlot, savedState }) {
  if (!document.getElementById('fondo-css')) {
    const s = document.createElement('style'); s.id = 'fondo-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  actionsSlot.innerHTML = `
    <button class="btn" id="fondo-backfill-btn" title="Descarga el histórico de precios de todas las posiciones">📥 Importar histórico</button>
    <button class="btn btn-primary" id="fondo-report-btn">📄 Informe mensual</button>
    <button class="btn btn-primary" id="fondo-refresh">↻ Actualizar</button>
  `;
  container.innerHTML = `<div id="fondo-wrap"><div class="empty"><div class="loader-ring"></div><div class="empty-title">Cargando fondo...</div></div></div>`;

  let activeTab = savedState?.activeTab || 'cotizacion';

  async function load() {
    const el = document.getElementById('fondo-wrap');

    // Leer datos
    const [fondo, positions, history, capA, capB] = await Promise.all([
      getFondo(),
      UserData.get('ethan_positions').then(v => v || []),
      UserData.get('ethan_positions_history').then(v => v || []),
      UserData.get('ethan_capital_alcista').then(v => v || 0),
      UserData.get('ethan_capital_bajista').then(v => v || 0),
    ]);

    // Actualizar precios automáticamente en segundo plano
    // Solo si hay posiciones abiertas y no se ha actualizado hoy
    const today = new Date().toISOString().slice(0, 10);
    const lastUpdate = sessionStorage.getItem('ethan_fondo_last_update');
    if (lastUpdate !== today && positions.length > 0) {
      const tickersToUpdate = [
        ...positions.filter(p => !p.exitDateISO).map(p => ({ ticker: p.ticker, from: p.entryDateISO || today })),
        { ticker: 'SPY', from: fondo?.movimientos?.[0]?.date || '2026-01-01' },
      ];
      Promise.all(tickersToUpdate.map(async ({ ticker, from }) => {
        try {
          const TICKER_MAP = { '3GOL': '3GOL.MI' };
          const yahooTicker = TICKER_MAP[ticker] || ticker;
          const days = await fetchYahooHistory(yahooTicker, from, today);
          if (days?.length) await saveHistoryToFirestore(ticker, days, 'active');
        } catch {}
      })).then(() => {
        sessionStorage.setItem('ethan_fondo_last_update', today);
      });
    }

    const capitalTotal = capA + capB;

    // Calcular valor actual de la cartera
    const pnlRealizado = history.reduce((s, h) => s + (h.pnlAbs || 0), 0);
    const pnlNoRealizado = positions.reduce((s, p) => {
      const current = p.currentPrice || p.entry;
      if (!current || !p.entry || !p.shares) return s;
      return s + ((p.direction||'alcista') === 'bajista'
        ? (p.entry - current) * p.shares
        : (current - p.entry) * p.shares);
    }, 0);
    const valorCartera = capitalTotal + pnlRealizado + pnlNoRealizado;

    // VL actual
    const vlActual = fondo ? calcVLActual(fondo, valorCartera) : VL_INICIAL;
    const m = fondo ? await calcMetricas(fondo, vlActual, history, positions, capitalTotal) : null;
    const twr = m?.totalReturn || 0;
    const twrCol = twr >= 0 ? 'var(--green)' : 'var(--red)';

    // Guardar datos para el informe mensual
    window._ethanReportData = { m, positions, history, fondo, vlActual, valorCartera, pnlRealizado, pnlNoRealizado };

    el.innerHTML = `
      <div class="fondo-tabs">
        <button class="fondo-tab ${activeTab==='cotizacion'?'active':''}" data-tab="cotizacion">📈 Cotización</button>
        <button class="fondo-tab ${activeTab==='riesgo'?'active':''}" data-tab="riesgo">⚡ Riesgo</button>
        <button class="fondo-tab ${activeTab==='trading'?'active':''}" data-tab="trading">🎯 Trading</button>
        <button class="fondo-tab ${activeTab==='movimientos'?'active':''}" data-tab="movimientos">💶 Movimientos</button>
        <button class="fondo-tab ${activeTab==='distribucion'?'active':''}" data-tab="distribucion">🗂 Distribución</button>
      </div>

      <!-- ══ TAB COTIZACIÓN ══ -->
      <div class="fondo-panel ${activeTab==='cotizacion'?'active':''}" id="fondo-panel-cotizacion">

        ${!fondo ? `
        <div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.3);border-radius:10px;padding:20px 22px;margin-bottom:16px;">
          <div style="font-size:13px;font-weight:600;color:var(--amber);margin-bottom:8px;">⚠ Fondo no inicializado</div>
          <div style="font-size:11px;color:var(--text2);margin-bottom:14px;">Para activar la contabilidad por participaciones, introduce el capital inicial del fondo.</div>
          <div style="display:flex;gap:10px;align-items:center;">
            <div>
              <label style="font-family:var(--mono);font-size:9px;text-transform:uppercase;color:var(--text3);display:block;margin-bottom:5px;">Capital inicial (€)</label>
              <input type="number" id="fondo-init-importe" class="wl-input" style="width:160px;" placeholder="ej. 8000" value="${capitalTotal||''}">
            </div>
            <div>
              <label style="font-family:var(--mono);font-size:9px;text-transform:uppercase;color:var(--text3);display:block;margin-bottom:5px;">Fecha de inicio</label>
              <input type="date" id="fondo-init-fecha" class="wl-input" style="width:160px;" value="${history[0]?.entryDateISO || new Date().toISOString().slice(0,10)}">
            </div>
            <div style="padding-top:18px;">
              <button class="btn btn-primary" id="fondo-init-btn">Inicializar fondo</button>
            </div>
          </div>
          <div style="font-size:10px;color:var(--text3);margin-top:10px;">VL inicial = 100,0000 · Participaciones = capital / 100</div>
        </div>` : ''}

        <!-- Hero VL -->
        <div class="fondo-hero">
          <div style="display:grid;grid-template-columns:auto 1fr;gap:32px;align-items:center;">
            <div>
              <div style="font-family:var(--mono);font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text3);margin-bottom:8px;">Valor Liquidativo</div>
              <div class="fondo-vl-big" style="color:var(--teal);">${fmtVL(vlActual)}</div>
              <div style="font-family:var(--mono);font-size:12px;color:${twrCol};margin-top:6px;">${fmtPct(twr*100)} desde el ${fmtDate(m?.startDate)}</div>
              <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:4px;">
                ${m?.participaciones?.toFixed(4)||'—'} participaciones · VL inicial: ${VL_INICIAL.toFixed(4)}
              </div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:10px;color:var(--text3);font-family:var(--mono);">Base 100 · ${m?.tradingDays||0} sesiones · ${m?.nPuntos||0} puntos</div>
                <div style="font-size:10px;color:var(--text3);">Valor cartera: <strong style="color:var(--teal);">${fmtE(valorCartera)}</strong></div>
              </div>
              ${vlChart(m?.serieBase100)}
            </div>
          </div>
        </div>

        <!-- Strip métricas rápidas -->
        <div class="fondo-strip">
          <div class="fondo-strip-cell">
            <div class="fondo-strip-lbl">TWR Total</div>
            <div class="fondo-strip-val" style="color:${twrCol};">${fmtPct(twr*100)}</div>
            <div class="fondo-strip-sub">(VL ${fmtVL(vlActual)} / ${VL_INICIAL})</div>
          </div>
          <div class="fondo-strip-cell">
            <div class="fondo-strip-lbl">CAGR Anualizado</div>
            <div class="fondo-strip-val" style="color:${(m?.annReturn||0)>=0?'var(--green)':'var(--red)'};">${fmtPct((m?.annReturn||0)*100)}</div>
            <div class="fondo-strip-sub">252 sesiones/año</div>
          </div>
          <div class="fondo-strip-cell">
            <div class="fondo-strip-lbl">Máx. Histórico VL</div>
            <div class="fondo-strip-val" style="color:var(--text1);">${fmtVL(m?.maxHistoricoVL)}</div>
            <div class="fondo-strip-sub">Pico del fondo</div>
          </div>
          <div class="fondo-strip-cell">
            <div class="fondo-strip-lbl">Drawdown Actual</div>
            <div class="fondo-strip-val" style="color:${(m?.drawdownActual||0)<0?'var(--red)':'var(--green)'};">${fmtPct((m?.drawdownActual||0)*100)}</div>
            <div class="fondo-strip-sub">Desde el máximo</div>
          </div>
        </div>

        <!-- Métricas detalladas -->
        <div class="fondo-section">Rentabilidad</div>

        ${m?.spyStats ? `
        <!-- Comparativa Fondo vs SPY -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:16px;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="background:var(--surface2);">
              <th style="padding:10px 16px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);border-bottom:1px solid var(--border);">Métrica</th>
              <th style="padding:10px 16px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:var(--teal);border-bottom:1px solid var(--border);">Fondo ETHAN</th>
              <th style="padding:10px 16px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:var(--blue);border-bottom:1px solid var(--border);">SPY</th>
              <th style="padding:10px 16px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);border-bottom:1px solid var(--border);">Diferencia</th>
            </tr></thead>
            <tbody>
              ${[
                ['TWR (período)', m.totalReturn*100, m.spyStats.twrTotal*100, '%'],
                ['YTD', m.ytd!=null?m.ytd*100:null, m.spyStats.ytd!=null?m.spyStats.ytd*100:null, '%'],
                ['Volatilidad anual', m.annVol!=null?m.annVol*100:null, m.spyStats.volAnual*100, '%'],
              ].map(([label, fondo, spy, unit]) => {
                if (fondo == null || spy == null) return '';
                const diff = fondo - spy;
                const diffCol = diff >= 0 ? 'var(--green)' : 'var(--red)';
                const fmt = v => v != null ? (v >= 0 ? '+' : '') + v.toFixed(2) + unit : '—';
                const fondoCol = label === 'Volatilidad anual'
                  ? (fondo < spy ? 'var(--green)' : 'var(--red)')
                  : (fondo >= spy ? 'var(--green)' : 'var(--red)');
                return `<tr>
                  <td style="padding:10px 16px;border-bottom:1px solid var(--border);color:var(--text2);">${label}</td>
                  <td style="padding:10px 16px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--mono);font-weight:700;color:${fondoCol};">${fmt(fondo)}</td>
                  <td style="padding:10px 16px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--mono);color:var(--text2);">${fmt(spy)}</td>
                  <td style="padding:10px 16px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--mono);font-weight:700;color:${diffCol};">${fmt(diff)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : m?.beta == null ? `
        <div style="font-size:10px;color:var(--text3);background:var(--surface2);border-radius:6px;padding:10px 14px;margin-bottom:16px;font-family:var(--mono);">
          Importa el histórico de SPY en la pestaña Riesgo para ver la comparativa con el benchmark
        </div>` : ''}

        <div class="fondo-metrics">
          ${mc('YTD', fmtPct(((m?.ytd)||0)*100), null, (m?.ytd||0)>=0?'good':'bad', 'Rentabilidad acumulada desde el 1 de enero del año en curso.')}
          ${mc('MTD', m?.mtd!=null?fmtPct(m.mtd*100):'—', null, m?.mtd!=null?(m.mtd>=0?'good':'bad'):'neu', 'Rentabilidad del mes en curso.')}
          ${mc('P&L Realizado', fmtE(pnlRealizado), pnlRealizado>=0?'Ganancia':'Pérdida', pnlRealizado>=0?'good':'bad', 'Suma de beneficios y pérdidas de todas las operaciones cerradas.')}
          ${mc('P&L No Realizado', fmtE(pnlNoRealizado), pnlNoRealizado>=0?'Latente+':'Latente−', pnlNoRealizado>=0?'good':'bad', 'P&L de las posiciones abiertas a precio actual. Se actualiza al abrir Posiciones.')}
          ${mc('Valor Liquidativo', fmtVL(vlActual), null, 'neu', `Precio por participación hoy. Inicio: ${VL_INICIAL.toFixed(4)}. Sube/baja con el P&L de la cartera.`)}
          ${mc('Valor Cartera', fmtE(valorCartera), null, 'neu', `VL (${fmtVL(vlActual)}) × ${m?.participaciones?.toFixed(2)||'—'} participaciones.`)}
        </div>

      </div>

      <!-- ══ TAB RIESGO ══ -->
      <div class="fondo-panel ${activeTab==='riesgo'?'active':''}" id="fondo-panel-riesgo">
        <div class="fondo-section">Drawdown</div>
        <div class="fondo-strip" style="margin-bottom:16px;">
          <div class="fondo-strip-cell">
            <div class="fondo-strip-lbl">Máx. Histórico VL</div>
            <div class="fondo-strip-val" style="color:var(--text1);">${fmtVL(m?.maxHistoricoVL)}</div>
            <div class="fondo-strip-sub">Pico del fondo</div>
          </div>
          <div class="fondo-strip-cell">
            <div class="fondo-strip-lbl">Drawdown Actual</div>
            <div class="fondo-strip-val" style="color:${(m?.drawdownActual||0)<0?'var(--red)':'var(--green)'};">${fmtPct((m?.drawdownActual||0)*100)}</div>
            <div class="fondo-strip-sub">Desde el máximo</div>
          </div>
          <div class="fondo-strip-cell">
            <div class="fondo-strip-lbl">Desde máximo (€)</div>
            <div class="fondo-strip-val" style="color:${(m?.drawdownActual||0)<0?'var(--red)':'var(--green)'};">${fmtE((m?.drawdownActual||0) * valorCartera)}</div>
            <div class="fondo-strip-sub">${(m?.drawdownActual||0)>=0?'En máximos':'Recuperar'}</div>
          </div>
          <div class="fondo-strip-cell">
            <div class="fondo-strip-lbl">Máx. Drawdown</div>
            <div class="fondo-strip-val" style="color:${(m?.maxDD||0)>0.1?'var(--red)':'var(--amber)'};">${m?.maxDD!=null?'-'+(m.maxDD*100).toFixed(1)+'%':'N/A'}</div>
            <div class="fondo-strip-sub">Histórico</div>
          </div>
        </div>

        <div class="fondo-section">Ratios ajustados por riesgo</div>
        <div class="fondo-metrics">
          ${m?.sharpe!=null ? mc('Sharpe Ratio', m.sharpe.toFixed(2), m.sharpe>=1.5?'Excelente':m.sharpe>=1?'Sólido':m.sharpe>=0.5?'Aceptable':'Débil', m.sharpe>=1?'good':m.sharpe>=0.5?'warn':'bad', 'Retorno anualizado / volatilidad diaria × √252. Calculado sobre retornos diarios reales del VL.') : mc('Sharpe Ratio', 'N/A', null, 'neu', 'Importa el histórico de precios para calcular.')}
          ${m?.sortino!=null ? mc('Sortino Ratio', m.sortino.toFixed(2), m.sortino>=2?'Excelente':m.sortino>=1.5?'Bueno':'Aceptable', m.sortino>=1.5?'good':'warn', 'Como Sharpe pero penaliza solo la volatilidad bajista. >2 = gestión de riesgo sobresaliente.') : mc('Sortino Ratio', 'N/A', null, 'neu', 'Sin días negativos en el VL o histórico insuficiente.')}
          ${mc('Calmar Ratio', m?.calmar!=null?m.calmar.toFixed(2):'N/A', m?.calmar!=null?(m.calmar>=1?'Bueno':'Vigilar'):null, m?.calmar!=null?(m.calmar>=1?'good':'warn'):'neu', 'CAGR / Máx. Drawdown histórico. >1 = el retorno compensa el peor dolor sufrido.')}
          ${m?.annVol!=null ? mc('Volatilidad Anual.', (m.annVol*100).toFixed(1)+'%', m.annVol<0.15?'Contenida':m.annVol<0.25?'Moderada':'Alta', m.annVol<0.15?'good':m.annVol<0.25?'warn':'bad', 'Desviación estándar retornos diarios del VL × √252. Referencia: SP500 ~15-20%/año.') : mc('Volatilidad Anual.', 'N/A', null, 'neu', 'Importa el histórico de precios para calcular.')}
          ${mc('Días activo', m?.nDays!=null?m.nDays+'d':'—', null, 'neu', `Desde el ${fmtDate(m?.startDate)} · ${m?.tradingDays||0} sesiones · ${m?.nPuntos||0} puntos en la serie VL.`)}
        </div>

        <div class="fondo-section">Beta vs SPY</div>
        <div class="fondo-metrics">
          ${m?.beta!=null ? mc('Beta', m.beta.toFixed(2), m.beta<0.8?'Defensivo':m.beta<1.2?'Mercado':'Agresivo', m.beta<0.8?'good':m.beta<1.2?'neu':'warn', `Sensibilidad del fondo vs SP500. Beta=1 = se mueve igual que el mercado. Calculada con ${m?.nPuntos||0} sesiones.`) : `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px 20px;"><div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-bottom:10px;">BETA VS SPY</div><div style="font-family:var(--mono);font-size:22px;font-weight:500;margin-bottom:6px;">N/A</div><div style="font-size:10.5px;color:var(--text3);line-height:1.55;">Importa el histórico de SPY para calcular. <button class="btn btn-primary" id="fondo-import-spy" style="font-size:9px;padding:4px 10px;margin-left:8px;">📥 Importar SPY</button></div></div>`}
          ${m?.alpha!=null ? mc('Alpha (Jensen)', (m.alpha*100).toFixed(2)+'%', m.alpha>0?'Positivo':'Negativo', m.alpha>0?'good':'bad', 'Retorno del fondo no explicado por el mercado. Alpha>0 = generas valor sobre el benchmark.') : mc('Alpha', 'N/A', null, 'neu', 'Requiere Beta calculada.')}
          ${m?.correlation!=null ? mc('Correlación', m.correlation.toFixed(2), m.correlation>0.8?'Alta':m.correlation>0.5?'Media':'Baja', m.correlation>0.8?'warn':m.correlation>0.5?'neu':'good', 'Correlación entre retornos diarios del fondo y el SP500. <1 = diversificación real.') : mc('Correlación', 'N/A', null, 'neu', 'Requiere Beta calculada.')}
        </div>

        ${(() => {
          // ── VaR y Monte Carlo ────────────────────
          if (!m?.dailyReturns || m.dailyReturns.length < 20) return `
            <div class="fondo-section">VaR & Monte Carlo</div>
            <div style="background:var(--surface2);border-radius:8px;padding:14px 16px;font-size:11px;color:var(--text3);font-family:var(--mono);">
              Se necesitan al menos 20 días de retornos para calcular VaR y Monte Carlo. Importa el histórico de precios.
            </div>`;

          const rets = m.dailyReturns;
          const sorted = [...rets].sort((a,b)=>a-b);
          const n = sorted.length;
          // VaR histórico 95% y 99%
          const var95 = sorted[Math.floor(n*0.05)];
          const var99 = sorted[Math.floor(n*0.01)];
          const var95Eur = var95 * valorCartera;
          const var99Eur = var99 * valorCartera;
          // CVaR (Expected Shortfall) 95%
          const tail95 = sorted.slice(0, Math.floor(n*0.05));
          const cvar95 = tail95.length ? tail95.reduce((a,b)=>a+b,0)/tail95.length : var95;
          const cvar95Eur = cvar95 * valorCartera;

          // Monte Carlo — 500 simulaciones, 252 días
          const mean = rets.reduce((a,b)=>a+b,0)/n;
          const std = Math.sqrt(rets.reduce((a,r)=>a+(r-mean)**2,0)/n);
          const SIMS = 500, DAYS = 252;
          const finals = [];
          for (let s=0; s<SIMS; s++) {
            let v = 1;
            for (let d=0; d<DAYS; d++) {
              // Box-Muller para normal
              const u1 = Math.random(), u2 = Math.random();
              const z = Math.sqrt(-2*Math.log(u1)) * Math.cos(2*Math.PI*u2);
              v *= (1 + mean + std*z);
            }
            finals.push(v);
          }
          finals.sort((a,b)=>a-b);
          const p10 = finals[Math.floor(SIMS*0.10)];
          const p50 = finals[Math.floor(SIMS*0.50)];
          const p90 = finals[Math.floor(SIMS*0.90)];
          const pWorst = finals[Math.floor(SIMS*0.05)];

          // SVG Monte Carlo — histograma simple
          const bins = 30;
          const minF = finals[0], maxF = finals[finals.length-1];
          const binSize = (maxF-minF)/bins;
          const hist = new Array(bins).fill(0);
          finals.forEach(v => {
            const b = Math.min(bins-1, Math.floor((v-minF)/binSize));
            hist[b]++;
          });
          const maxH = Math.max(...hist);
          const W=820, H=120;
          const bw = W/bins;
          const bars = hist.map((h,i) => {
            const x = i*bw;
            const bh = (h/maxH)*H;
            const val = minF + i*binSize;
            const col = val < 1 ? '#f47174' : val > 1 ? '#40d9c0' : '#fbbf24';
            return `<rect x="${x.toFixed(1)}" y="${(H-bh).toFixed(1)}" width="${(bw-1).toFixed(1)}" height="${bh.toFixed(1)}" fill="${col}" opacity="0.7"/>`;
          }).join('');
          const base1X = ((1-minF)/(maxF-minF)*W).toFixed(1);
          const p10X  = ((p10-minF)/(maxF-minF)*W).toFixed(1);
          const p90X  = ((p90-minF)/(maxF-minF)*W).toFixed(1);

          return `
          <div class="fondo-section">Value at Risk (VaR histórico)</div>
          <div class="fondo-metrics" style="margin-bottom:8px;">
            ${mc('VaR 95% (1 día)', fmtPct(var95*100), 'Hist. 95%', 'bad', `Con 95% de confianza, no perderás más de ${fmtE(Math.abs(var95Eur))} en un día.`)}
            ${mc('VaR 99% (1 día)', fmtPct(var99*100), 'Hist. 99%', 'bad', `Con 99% de confianza, no perderás más de ${fmtE(Math.abs(var99Eur))} en un día.`)}
            ${mc('CVaR 95%', fmtPct(cvar95*100), 'Expected Shortfall', 'bad', `Pérdida media esperada en el peor 5% de los días. También llamado Expected Shortfall.`)}
            ${mc('VaR 95% mensual', fmtPct(var95*Math.sqrt(21)*100), 'Escalado √21', 'warn', `VaR diario escalado a 21 días hábiles por la raíz del tiempo.`)}
          </div>
          <div style="background:var(--surface2);border-radius:6px;padding:10px 14px;font-size:10px;color:var(--text3);margin-bottom:16px;font-family:var(--mono);">
            Basado en ${n} retornos diarios históricos reales del VL · Método histórico (no asume distribución normal)
          </div>

          <div class="fondo-section">Monte Carlo — Proyección 12 meses</div>
          <div class="fondo-metrics" style="margin-bottom:12px;">
            ${mc('Escenario Optimista (P90)', fmtPct((p90-1)*100), '+'+fmtE((p90-1)*valorCartera), 'good', `El 10% de las simulaciones superan este resultado. Valor cartera: ${fmtE(p90*valorCartera)}`)}
            ${mc('Escenario Base (P50)', fmtPct((p50-1)*100), fmtE((p50-1)*valorCartera), (p50-1)>=0?'good':'bad', `Mediana de 500 simulaciones. Valor cartera esperado: ${fmtE(p50*valorCartera)}`)}
            ${mc('Escenario Pesimista (P10)', fmtPct((p10-1)*100), fmtE((p10-1)*valorCartera), 'bad', `El 90% de las simulaciones superan este resultado. Valor cartera: ${fmtE(p10*valorCartera)}`)}
            ${mc('Tail Risk (P5)', fmtPct((pWorst-1)*100), fmtE((pWorst-1)*valorCartera), 'bad', `El peor 5% de escenarios. Pérdida máxima esperada en escenario de estrés a 12 meses.`)}
          </div>

          <!-- Histograma Monte Carlo -->
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <div style="font-size:12px;font-weight:600;">Distribución de resultados — ${SIMS} simulaciones · ${DAYS} días</div>
              <div style="font-size:10px;color:var(--text3);font-family:var(--mono);">μ=${fmtPct(mean*252*100)} · σ=${fmtPct(std*Math.sqrt(252)*100)} anualizado</div>
            </div>
            <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block;">
              ${bars}
              <line x1="${base1X}" y1="0" x2="${base1X}" y2="${H}" stroke="var(--text3)" stroke-width="1.5" stroke-dasharray="4,4"/>
              <text x="${parseFloat(base1X)+4}" y="14" font-family="IBM Plex Mono" font-size="9" fill="var(--text3)">Base 100</text>
              <line x1="${p10X}" y1="0" x2="${p10X}" y2="${H}" stroke="#f47174" stroke-width="1.5" stroke-dasharray="3,3"/>
              <text x="${parseFloat(p10X)+4}" y="28" font-family="IBM Plex Mono" font-size="9" fill="#f47174">P10</text>
              <line x1="${p90X}" y1="0" x2="${p90X}" y2="${H}" stroke="#40d9c0" stroke-width="1.5" stroke-dasharray="3,3"/>
              <text x="${parseFloat(p90X)+4}" y="28" font-family="IBM Plex Mono" font-size="9" fill="#40d9c0">P90</text>
            </svg>
            <div style="display:flex;gap:20px;margin-top:10px;font-size:10px;font-family:var(--mono);color:var(--text3);">
              <span style="color:#f47174;">■ Pérdida</span>
              <span style="color:#fbbf24;">■ Neutral</span>
              <span style="color:#40d9c0;">■ Ganancia</span>
              <span style="margin-left:auto;">Retorno anual esperado: <strong style="color:${(p50-1)>=0?'var(--green)':'var(--red)'};">${fmtPct((p50-1)*100)}</strong></span>
            </div>
          </div>
          <div style="background:var(--surface2);border-radius:6px;padding:10px 14px;font-size:10px;color:var(--text3);font-family:var(--mono);">
            ⚠ Monte Carlo asume distribución normal de retornos con media y desviación histórica. Los resultados son ilustrativos — los mercados tienen colas más gruesas de lo que el modelo predice.
          </div>`;
        })()}
      </div>

      <!-- ══ TAB TRADING ══ -->
      <div class="fondo-panel ${activeTab==='trading'?'active':''}" id="fondo-panel-trading">
        ${(() => {
          const rg = calcTrading(history);
          const ra = calcTrading(history.filter(h => (h.direction||'alcista')==='alcista'));
          const rb = calcTrading(history.filter(h => h.direction==='bajista'));
          const fmtPct2 = (n,d=2) => n!=null&&isFinite(n)?(n>=0?'+':'')+n.toFixed(d)+'%':'—';
          const fmtE2 = n => n!=null&&isFinite(n)?(n<0?'-':'')+'€'+Math.abs(n).toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:0}):'—';
          if (!rg) return '<div class="empty"><div class="empty-icon">📊</div><div class="empty-title">Sin operaciones cerradas</div></div>';
          return `
          <div class="fondo-metrics" style="margin-bottom:16px;">
            ${mc('Win Rate', rg?Math.round(rg.winRate*100)+'%':'—', rg&&rg.winRate>=0.5?'Bueno':'Vigilar', rg&&rg.winRate>=0.5?'good':'warn', rg.n+' operaciones cerradas')}
            ${mc('Profit Factor', rg&&rg.profitFactor!=null?rg.profitFactor.toFixed(2):'—', rg&&rg.profitFactor>=1.5?'Sólido':rg&&rg.profitFactor>=1?'Aceptable':'Débil', rg&&rg.profitFactor>=1.5?'good':rg&&rg.profitFactor>=1?'neu':'bad', 'Ganancias brutas / pérdidas brutas. >1.5 = sistema robusto.')}
            ${mc('Esperanza Mat.', rg?fmtPct2(rg.esperanza*100):'—', rg&&rg.esperanza>=0?'Positiva':'Negativa', rg&&rg.esperanza>=0?'good':'bad', 'Retorno esperado por operación normalizada.')}
            ${mc('Avg Win', rg?'+'+rg.avgWin.toFixed(1)+'%':'—', null, 'good', 'Ganancia media de las operaciones ganadoras.')}
            ${mc('Avg Loss', rg?'-'+rg.avgLoss.toFixed(1)+'%':'—', null, 'warn', 'Pérdida media de las operaciones perdedoras.')}
            ${mc('Payoff', rg&&rg.payoff!=null?rg.payoff.toFixed(2):'—', rg&&rg.payoff>=1.5?'Bueno':'Neutral', rg&&rg.payoff>=1.5?'good':'neu', 'Avg Win / Avg Loss.')}
            ${mc('Holding medio', rg?.avgDays!=null?rg.avgDays+'d':'—', null, 'neu', 'Días medios por operación cerrada.')}
            ${mc('P&L Realizado', rg?.hasAbs?fmtE2(rg.totalPL):'—', rg&&rg.totalPL>=0?'Ganancia':'Pérdida', rg&&rg.totalPL>=0?'good':'bad', 'Suma de todos los P&L realizados.')}
            ${mc('Rent. media/op.', rg?fmtPct2(rg.avgReturn):'—', rg&&rg.avgReturn>=0?'Positiva':'Negativa', rg&&rg.avgReturn>=0?'good':'bad', 'Rentabilidad media por operación cerrada.')}
          </div>

          <div class="fondo-section">Por estrategia</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
            ${['Alcista','Bajista'].map((name,idx) => {
              const r = idx===0?ra:rb;
              const col = idx===0?'var(--green)':'var(--red)';
              return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px 18px;">
                <div style="font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:${col};margin-bottom:12px;">${name} · ${r?r.n+' ops':'sin ops'}</div>
                ${r ? [
                  ['Win Rate', Math.round(r.winRate*100)+'%'],
                  ['Avg Win', '+'+r.avgWin.toFixed(1)+'%'],
                  ['Avg Loss', '-'+r.avgLoss.toFixed(1)+'%'],
                  ['Profit Factor', r.profitFactor!=null?r.profitFactor.toFixed(2):'—'],
                  ['Esperanza', fmtPct2(r.esperanza*100)],
                  ['Holding medio', r.avgDays!=null?r.avgDays+'d':'—'],
                  ['Rent. media/op', fmtPct2(r.avgReturn)],
                ].map(([l,v]) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:11px;"><span style="color:var(--text2);">${l}</span><span style="font-family:var(--mono);font-weight:700;">${v}</span></div>`).join('') : '<div style="color:var(--text3);font-size:11px;padding:10px 0;">Sin operaciones</div>'}
              </div>`;
            }).join('')}
          </div>

          <div class="fondo-section">Historial de operaciones</div>
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;">
            <table style="width:100%;border-collapse:collapse;font-size:11px;">
              <thead><tr style="background:var(--surface2);">
                <th style="padding:8px 14px;text-align:left;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">Ticker</th>
                <th style="padding:8px 14px;text-align:left;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">Estrategia</th>
                <th style="padding:8px 14px;text-align:right;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">Entrada</th>
                <th style="padding:8px 14px;text-align:right;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">Salida</th>
                <th style="padding:8px 14px;text-align:right;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">Días</th>
                <th style="padding:8px 14px;text-align:right;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">P&L %</th>
                <th style="padding:8px 14px;text-align:right;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">P&L €</th>
              </tr></thead>
              <tbody>
                ${history.map(h => {
                  const days = h.entryDateISO&&h.exitDateISO ? Math.round((new Date(h.exitDateISO)-new Date(h.entryDateISO))/86400000) : null;
                  const col = (h.pnlPct||0)>=0?'var(--green)':'var(--red)';
                  return `<tr>
                    <td style="padding:9px 14px;border-bottom:1px solid var(--border);font-weight:700;">${h.ticker}</td>
                    <td style="padding:9px 14px;border-bottom:1px solid var(--border);"><span style="font-size:9px;padding:2px 7px;border-radius:10px;background:${(h.direction||'alcista')==='alcista'?'rgba(74,222,128,0.1)':'rgba(244,113,116,0.1)'};color:${(h.direction||'alcista')==='alcista'?'var(--green)':'var(--red)'};">${h.direction||'alcista'}</span></td>
                    <td style="padding:9px 14px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--mono);color:var(--text3);">${h.entryDateISO||'—'}</td>
                    <td style="padding:9px 14px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--mono);color:var(--text3);">${h.exitDateISO||'—'}</td>
                    <td style="padding:9px 14px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--mono);">${days!=null?days+'d':'—'}</td>
                    <td style="padding:9px 14px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--mono);font-weight:700;color:${col};">${fmtPct2(h.pnlPct)}</td>
                    <td style="padding:9px 14px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--mono);font-weight:700;color:${col};">${h.pnlAbs!=null?fmtE2(h.pnlAbs):'—'}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`;
        })()}
      </div>

      <!-- ══ TAB MOVIMIENTOS ══ -->
      <div class="fondo-panel ${activeTab==='movimientos'?'active':''}" id="fondo-panel-movimientos">

        <!-- Formulario nueva aportación/retirada -->
        <div class="fondo-form">
          <div class="fondo-form-title">
            Registrar movimiento
            <span style="font-family:var(--mono);font-size:10px;color:var(--text3);">VL actual: ${fmtVL(vlActual)}</span>
          </div>
          <div class="fondo-form-grid">
            <div class="fondo-field">
              <label>Tipo</label>
              <select id="mov-tipo" class="wl-input">
                <option value="aportacion">Aportación</option>
                <option value="retirada">Retirada</option>
              </select>
            </div>
            <div class="fondo-field">
              <label>Importe (€)</label>
              <input type="number" id="mov-importe" class="wl-input" placeholder="ej. 2000" min="0">
            </div>
            <div class="fondo-field">
              <label>Fecha</label>
              <input type="date" id="mov-fecha" class="wl-input" value="${new Date().toISOString().slice(0,10)}">
            </div>
            <div class="fondo-field">
              <label>Nota</label>
              <input type="text" id="mov-nota" class="wl-input" placeholder="Opcional">
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;">
            <div id="mov-preview" style="font-size:11px;color:var(--text3);font-family:var(--mono);"></div>
            <button class="btn btn-primary" id="mov-guardar" ${!fondo?'disabled':''}>Registrar</button>
          </div>
          ${!fondo ? '<div style="font-size:10px;color:var(--amber);margin-top:8px;">⚠ Inicializa el fondo primero en la pestaña Cotización</div>' : ''}
        </div>

        <!-- Tabla movimientos -->
        ${fondo?.movimientos?.length ? `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;">
          <table class="fondo-mov-table">
            <thead><tr>
              <th>Fecha</th><th>Tipo</th><th class="r">Importe</th>
              <th class="r">VL</th><th class="r">Participaciones</th>
              <th class="r">Total Part.</th><th>Nota</th><th></th>
            </tr></thead>
            <tbody>
              ${[...fondo.movimientos].reverse().map((m, idxRev) => {
                const idxReal = fondo.movimientos.length - 1 - idxRev;
                const col = m.tipo === 'aportacion' || m.tipo === 'inicio' ? 'var(--green)' : 'var(--red)';
                const badge = m.tipo === 'inicio' ? '🏁 Inicio' : m.tipo === 'aportacion' ? '▲ Aportación' : '▼ Retirada';
                return `<tr>
                  <td>${fmtDate(m.date)}</td>
                  <td><span style="font-family:var(--mono);font-size:9px;padding:2px 8px;border-radius:10px;background:${col}22;color:${col};">${badge}</span></td>
                  <td class="r" style="color:${col};">${fmtE(Math.abs(m.importe))}</td>
                  <td class="r">${m.vl?.toFixed(4)||'—'}</td>
                  <td class="r">${m.participacionesMov?.toFixed(4)||'—'}</td>
                  <td class="r" style="color:var(--teal);">${m.participacionesTotal?.toFixed(4)||'—'}</td>
                  <td style="color:var(--text3);font-size:10px;">${m.nota||'—'}</td>
                  <td class="r">
                    <button class="btn fondo-del-mov" data-idx="${idxReal}" style="font-size:9px;padding:2px 8px;color:var(--red);border-color:rgba(244,113,116,0.3);">✕</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : `
        <div class="empty">
          <div class="empty-icon">💶</div>
          <div class="empty-title">Sin movimientos</div>
          <div class="empty-desc">Inicializa el fondo y registra aportaciones y retiradas aquí.</div>
        </div>`}
      </div>

      <!-- ══ TAB DISTRIBUCIÓN ══ -->
      <div class="fondo-panel ${activeTab==='distribucion'?'active':''}" id="fondo-panel-distribucion">
        ${(() => {
          const capitalInvertido = positions.reduce((s, p) => {
            const current = p.currentPrice || p.entry;
            return s + (current && p.shares ? current * p.shares : p.cost || 0);
          }, 0);
          const cash = Math.max(0, valorCartera - capitalInvertido);
          const items = [
            { label: 'Capital invertido', val: capitalInvertido, col: 'var(--teal)' },
            { label: 'Cash disponible', val: cash, col: 'var(--blue)' },
          ];
          const total = valorCartera || 1;
          return `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px 22px;margin-bottom:14px;">
            <div style="font-size:13px;font-weight:600;margin-bottom:16px;">Asignación del capital</div>
            <div style="display:flex;height:8px;border-radius:4px;overflow:hidden;margin-bottom:16px;">
              ${items.map(i => `<div style="width:${(i.val/total*100).toFixed(1)}%;background:${i.col};"></div>`).join('')}
            </div>
            ${items.map(i => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
              <div style="display:flex;align-items:center;gap:8px;">
                <div style="width:8px;height:8px;border-radius:2px;background:${i.col};"></div>
                <span style="font-size:12px;">${i.label}</span>
              </div>
              <div style="display:flex;gap:20px;">
                <span style="font-family:var(--mono);font-size:12px;color:var(--text3);">${(i.val/total*100).toFixed(1)}%</span>
                <span style="font-family:var(--mono);font-size:12px;color:var(--text1);font-weight:600;">${fmtE(i.val)}</span>
              </div>
            </div>`).join('')}
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0 0;">
              <span style="font-weight:700;">Valor total fondo</span>
              <span style="font-family:var(--mono);font-size:14px;font-weight:700;color:var(--teal);">${fmtE(valorCartera)}</span>
            </div>
          </div>

          <!-- Posiciones abiertas -->
          ${positions.length ? `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;">
            <div style="padding:16px 20px;border-bottom:1px solid var(--border);font-size:13px;font-weight:600;">${positions.length} posiciones abiertas</div>
            <table style="width:100%;border-collapse:collapse;font-size:11px;">
              <thead><tr style="background:var(--surface2);">
                <th style="padding:8px 16px;text-align:left;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">Ticker</th>
                <th style="padding:8px 16px;text-align:right;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">Valor</th>
                <th style="padding:8px 16px;text-align:right;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">Peso</th>
                <th style="padding:8px 16px;text-align:right;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">P&L</th>
              </tr></thead>
              <tbody>
                ${positions.map(p => {
                  const current = p.currentPrice || p.entry;
                  const valor = current && p.shares ? current * p.shares : p.cost || 0;
                  const pnl = p.shares && p.entry ? ((p.direction||'alcista')==='bajista' ? (p.entry-current)*p.shares : (current-p.entry)*p.shares) : null;
                  const peso = (valor/total*100).toFixed(1);
                  return `<tr>
                    <td style="padding:10px 16px;border-bottom:1px solid var(--border);font-weight:700;">${p.ticker}</td>
                    <td style="padding:10px 16px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--mono);">${fmtE(valor)}</td>
                    <td style="padding:10px 16px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--mono);">${peso}%</td>
                    <td style="padding:10px 16px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--mono);color:${pnl>=0?'var(--green)':'var(--red)'};">${pnl!=null?fmtE(pnl):'—'}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>` : '<div class="empty"><div class="empty-icon">📂</div><div class="empty-title">Sin posiciones abiertas</div></div>'}`;
        })()}
      </div>
    `;

    // ── Listeners ─────────────────────────────
    // Tabs
    el.querySelectorAll('.fondo-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        saveModuleState('car-fondo', { activeTab });
        el.querySelectorAll('.fondo-tab').forEach(t => t.classList.remove('active'));
        el.querySelectorAll('.fondo-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        el.querySelector(`#fondo-panel-${activeTab}`)?.classList.add('active');
      });
    });

    // Inicializar fondo
    document.getElementById('fondo-init-btn')?.addEventListener('click', async () => {
      const importe = parseFloat(document.getElementById('fondo-init-importe')?.value);
      const fecha   = document.getElementById('fondo-init-fecha')?.value;
      if (!importe || importe <= 0) return alert('Introduce un importe válido');
      if (!fecha) return alert('Introduce una fecha de inicio');
      await inicializar(importe, fecha, 'Capital inicial');
      load();
    });

    // Preview participaciones en formulario
    const previewMov = () => {
      const importe = parseFloat(document.getElementById('mov-importe')?.value);
      const tipo    = document.getElementById('mov-tipo')?.value;
      const preEl   = document.getElementById('mov-preview');
      if (!preEl) return;
      if (!fondo || !importe || importe <= 0) { preEl.textContent = ''; return; }
      const partic = (importe / vlActual).toFixed(4);
      preEl.textContent = tipo === 'aportacion'
        ? `→ Se emitirán ${partic} participaciones al VL ${fmtVL(vlActual)}`
        : `→ Se cancelarán ${partic} participaciones al VL ${fmtVL(vlActual)}`;
    };
    document.getElementById('mov-importe')?.addEventListener('input', previewMov);
    document.getElementById('mov-tipo')?.addEventListener('change', previewMov);

    // Importar SPY para Beta
    document.getElementById('fondo-import-spy')?.addEventListener('click', async () => {
      const btn = document.getElementById('fondo-import-spy');
      btn.disabled = true; btn.textContent = '⏳ Importando SPY...';
      try {
        const days = await fetchYahooHistory('SPY', fondo?.movimientos?.[0]?.date || '2024-01-01', new Date().toISOString().slice(0,10));
        await saveHistoryToFirestore('SPY', days, 'active');
        btn.textContent = `✓ ${days.length} días importados`;
        setTimeout(() => load(), 2000);
      } catch(e) {
        btn.textContent = '⚠ Error: ' + e.message.slice(0,30);
        btn.disabled = false;
      }
    });
    el.querySelectorAll('.fondo-del-mov').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.idx);
        const mov = fondo.movimientos[idx];
        if (!confirm(`¿Eliminar ${mov.tipo} de ${fmtE(Math.abs(mov.importe))} del ${fmtDate(mov.date)}?`)) return;
        fondo.movimientos.splice(idx, 1);
        let total = 0;
        fondo.movimientos = fondo.movimientos.map(m => {
          if (m.tipo === 'inicio' || m.tipo === 'aportacion') total += m.participacionesMov || 0;
          else if (m.tipo === 'retirada') total -= m.participacionesMov || 0;
          return { ...m, participacionesTotal: total };
        });
        fondo.participaciones = total;
        await saveFondo(fondo);
        load();
      });
    });

    // Guardar movimiento
    document.getElementById('mov-guardar')?.addEventListener('click', async () => {
      if (!fondo) return;
      const tipo    = document.getElementById('mov-tipo')?.value;
      const importe = parseFloat(document.getElementById('mov-importe')?.value);
      const fecha   = document.getElementById('mov-fecha')?.value;
      const nota    = document.getElementById('mov-nota')?.value.trim();
      if (!importe || importe <= 0) return alert('Introduce un importe válido');
      if (!fecha) return alert('Selecciona una fecha');
      try {
        await registrarMovimiento(tipo, importe, fecha, nota, valorCartera);
        document.getElementById('mov-importe').value = '';
        document.getElementById('mov-nota').value = '';
        load();
      } catch(e) { alert('Error: ' + e.message); }
    });
  }

  document.getElementById('fondo-refresh')?.addEventListener('click', load);
  document.getElementById('fondo-report-btn')?.addEventListener('click', () => {
    // Las variables se leen del estado guardado
    generateReport(window._ethanReportData || {});
  });

  document.getElementById('fondo-backfill-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('fondo-backfill-btn');
    btn.disabled = true;
    try {
      const [positionsRaw, historyRaw] = await Promise.all([
        UserData.get('ethan_positions').then(v => v || []),
        UserData.get('ethan_positions_history').then(v => v || []),
      ]);
      const today = new Date().toISOString().slice(0, 10);
      let ok = 0, totalDays = 0, errors = 0;

      // Mapa de tickers alternativos (productos europeos con ticker diferente en Yahoo)
      const TICKER_MAP = { '3GOL': '3GOL.MI' };

      // Posiciones cerradas — rango exacto de la operación
      for (const pos of historyRaw) {
        if (!pos.ticker || !pos.entryDateISO || !pos.exitDateISO) continue;
        const yahooTicker = TICKER_MAP[pos.ticker] || pos.ticker;
        btn.textContent = `⏳ ${yahooTicker}...`;
        try {
          const days = await fetchYahooHistory(yahooTicker, pos.entryDateISO, pos.exitDateISO);
          // Sobrescribir el precio del último día con el precio real de salida registrado en Cartera
          if (pos.exit && days.length > 0) {
            const lastDay = days.reduce((a, b) => a.date > b.date ? a : b);
            lastDay.close = pos.exit;
          }
          await saveHistoryToFirestore(pos.ticker, days, 'inactive'); // guardar con ticker original
          totalDays += days.length; ok++;
        } catch(e) { errors++; console.warn('Backfill ' + yahooTicker + ':', e.message); }
      }

      // Posiciones abiertas — desde entrada hasta hoy
      for (const pos of positionsRaw) {
        if (!pos.ticker || !pos.entryDate) continue;
        btn.textContent = `⏳ ${pos.ticker}...`;
        try {
          const days = await fetchYahooHistory(pos.ticker, pos.entryDate, today);
          await saveHistoryToFirestore(pos.ticker, days, 'active');
          totalDays += days.length; ok++;
        } catch(e) { errors++; console.warn('Backfill ' + pos.ticker + ':', e.message); }
      }

      btn.textContent = `✓ ${ok} tickers · ${totalDays} días${errors ? ' · ' + errors + ' errores' : ''}`;
      setTimeout(() => { btn.disabled = false; btn.textContent = '📥 Importar histórico'; load(); }, 4000);
    } catch(e) {
      btn.textContent = '⚠ ' + e.message.slice(0, 40);
      setTimeout(() => { btn.disabled = false; btn.textContent = '📥 Importar histórico'; }, 3000);
    }
  });
  load();
  return { destroy() { document.getElementById('fondo-css')?.remove(); } };
}

// ── Generador de informe mensual ──────────────────────────────────────────
function generateReport({ m, positions, history, fondo, vlActual, valorCartera, pnlRealizado, pnlNoRealizado }) {
  const now   = new Date();
  const mes   = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const mesNum = now.toLocaleDateString('es-ES', { month: 'long' });
  const anyo  = now.getFullYear();
  const fmtP  = (n, d=1) => n != null && isFinite(n) ? (n >= 0 ? '+' : '') + n.toFixed(d) + '%' : '—';
  const fmtE2 = n => n != null ? (n >= 0 ? '+€' : '−€') + Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—';
  const fmtV  = n => n != null ? n.toFixed(2) : '—';

  // Operaciones del mes actual
  const thisMonth = `${anyo}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const opsMonth  = (history || []).filter(h => (h.exitDateISO || '').startsWith(thisMonth));
  const wins      = opsMonth.filter(h => (h.pnlPct || 0) > 0);
  const losses    = opsMonth.filter(h => (h.pnlPct || 0) <= 0);
  const pnlMes    = opsMonth.reduce((s, h) => s + (h.pnlAbs || 0), 0);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>ETHAN · Informe ${mes}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Montserrat:wght@300;400;500;600&family=IBM+Plex+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#040e0e;--surface:#0b1f1f;--surface2:#0f2828;--border:#1a3c3c;--teal:#40d9c0;--teal-dim:rgba(64,217,192,0.08);--green:#4ade80;--red:#f47174;--amber:#fbbf24;--blue:#5fa8e0;--text1:#eaf6f4;--text2:#7aada6;--text3:#3d6460;--serif:'Cormorant Garamond',serif;--sans:'Montserrat',sans-serif;--mono:'IBM Plex Mono',monospace;}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:var(--bg);color:var(--text1);font-family:var(--sans);font-size:13px;}
.page{max-width:860px;margin:0 auto;}
.cover{min-height:100vh;display:flex;flex-direction:column;justify-content:space-between;padding:60px;border-bottom:1px solid var(--border);position:relative;overflow:hidden;}
.cover::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 70% 50% at 100% 0%,rgba(64,217,192,0.08),transparent 60%),radial-gradient(ellipse 50% 70% at 0% 100%,rgba(64,217,192,0.05),transparent 50%);pointer-events:none;}
.cover-top{position:relative;z-index:1;}
.cover-eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:var(--text3);margin-bottom:16px;margin-top:60px;}
.cover-title{font-family:var(--serif);font-size:72px;font-weight:300;font-style:italic;line-height:0.95;color:var(--text1);}
.cover-title em{color:var(--teal);}
.cover-subtitle{font-family:var(--serif);font-size:24px;font-weight:300;color:var(--text2);margin-top:16px;}
.cover-bottom{position:relative;z-index:1;display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border);border:1px solid var(--border);}
.cover-stat{background:var(--surface);padding:20px 22px;}
.cover-stat-lbl{font-family:var(--mono);font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text3);margin-bottom:8px;}
.cover-stat-val{font-family:var(--serif);font-size:32px;font-weight:600;font-style:italic;line-height:1;}
.cover-stat-sub{font-family:var(--mono);font-size:9px;color:var(--text2);margin-top:5px;}
.section{padding:48px 60px;border-bottom:1px solid var(--border);}
.section-header{display:flex;align-items:baseline;gap:16px;margin-bottom:28px;padding-bottom:14px;border-bottom:1px solid var(--border);}
.section-num{font-family:var(--mono);font-size:10px;color:var(--teal);letter-spacing:0.15em;}
.section-title{font-family:var(--serif);font-size:28px;font-weight:400;font-style:italic;}
.section-rule{flex:1;height:1px;background:var(--border);}
.metrics-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:4px;overflow:hidden;margin-bottom:20px;}
.metric-cell{background:var(--surface);padding:18px 20px;}
.metric-lbl{font-family:var(--mono);font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text2);margin-bottom:8px;}
.metric-val{font-family:var(--serif);font-size:34px;font-weight:600;font-style:italic;line-height:1;}
.metric-sub{font-family:var(--mono);font-size:9px;color:var(--text2);margin-top:5px;}
.compare-table{width:100%;border-collapse:collapse;margin-bottom:20px;}
.compare-table th{padding:10px 16px;text-align:left;font-family:var(--mono);font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text2);border-bottom:1px solid var(--border);background:var(--surface2);}
.compare-table th.r{text-align:right;}
.compare-table td{padding:12px 16px;border-bottom:1px solid var(--border);font-family:var(--mono);font-size:12px;}
.compare-table td.r{text-align:right;}
.compare-table td.label{font-family:var(--sans);font-size:12px;color:var(--text1);}
.compare-table tbody tr:last-child td{border-bottom:none;}
.ops-table{width:100%;border-collapse:collapse;}
.ops-table th{padding:9px 12px;text-align:left;font-family:var(--mono);font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text2);border-bottom:1px solid var(--border);background:var(--surface2);}
.ops-table th.r{text-align:right;}
.ops-table td{padding:11px 12px;border-bottom:1px solid var(--border);font-size:11px;}
.ops-table td.r{text-align:right;font-family:var(--mono);}
.ops-table tbody tr:last-child td{border-bottom:none;}
.pos-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:4px;overflow:hidden;margin-bottom:20px;}
.pos-cell{background:var(--surface);padding:14px 16px;display:flex;justify-content:space-between;align-items:center;}
.pos-ticker{font-weight:700;font-size:14px;}
.pos-name{font-size:10px;color:var(--text2);margin-top:3px;}
.pos-pnl{font-family:var(--serif);font-size:22px;font-style:italic;font-weight:600;}
.pos-weight{font-family:var(--mono);font-size:9px;color:var(--text2);margin-top:3px;}
.insight{border-left:3px solid var(--teal);background:var(--teal-dim);padding:14px 18px;border-radius:0 4px 4px 0;margin-top:18px;}
.insight-title{font-family:var(--mono);font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--teal);margin-bottom:7px;}
.insight-text{font-size:12px;color:var(--text1);line-height:1.7;}
.tag{display:inline-block;padding:2px 8px;border-radius:3px;font-family:var(--mono);font-size:9px;font-weight:700;}
.tag-green{background:rgba(74,222,128,0.12);color:var(--green);}
.tag-red{background:rgba(244,113,116,0.12);color:var(--red);}
.tag-blue{background:rgba(95,168,224,0.12);color:var(--blue);}
.risk-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:20px;}
.risk-card{background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:16px 18px;}
.risk-card-lbl{font-family:var(--mono);font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text2);margin-bottom:7px;}
.risk-card-val{font-family:var(--serif);font-size:26px;font-style:italic;font-weight:600;line-height:1;margin-bottom:4px;}
.risk-card-desc{font-size:10px;color:var(--text2);line-height:1.5;margin-top:5px;}
.macro-row{display:flex;align-items:center;gap:24px;padding:16px 20px;background:var(--surface);border:1px solid var(--border);border-radius:4px;margin-bottom:16px;}
.macro-score{font-family:var(--serif);font-size:56px;font-weight:600;font-style:italic;line-height:1;flex-shrink:0;}
.macro-label{font-family:var(--serif);font-size:20px;font-style:italic;margin-bottom:4px;}
.macro-desc{font-size:11px;color:var(--text2);line-height:1.6;}
.macro-inds{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:4px;overflow:hidden;}
.macro-ind{background:var(--surface2);padding:12px 14px;}
.macro-ind-lbl{font-family:var(--mono);font-size:9px;color:var(--text3);margin-bottom:5px;}
.macro-ind-val{font-family:var(--mono);font-size:13px;font-weight:500;}
.exec-summary{font-family:var(--serif);font-size:17px;font-weight:300;line-height:1.8;border-left:3px solid var(--teal);padding-left:22px;margin-bottom:22px;}
.exec-summary em{color:var(--teal);font-style:italic;}
.footer{padding:28px 60px;display:flex;justify-content:space-between;align-items:center;}
.footer-left{font-family:var(--serif);font-size:13px;font-style:italic;color:var(--text3);}
.footer-right{font-family:var(--mono);font-size:9px;color:var(--text3);text-align:right;line-height:1.6;}
@media print{body{background:#040e0e!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}.cover{min-height:100vh;page-break-after:always;}.section{page-break-inside:avoid;}}
</style>
</head>
<body>
<div class="page">

  <!-- PORTADA -->
  <div class="cover">
    <div class="cover-top">
      <img src="/LOGO ETHAN MERCADOS.png" alt="ETHAN Mercados" style="height:34px;width:auto;margin-bottom:0;">
      <div class="cover-eyebrow">Informe mensual de gestión · Período</div>
      <div class="cover-title">${mesNum}<br><em>${anyo}</em></div>
      <div class="cover-subtitle">Fondo ETHAN · Resumen ejecutivo y métricas de rendimiento</div>
    </div>
    <div class="cover-bottom">
      <div class="cover-stat">
        <div class="cover-stat-lbl">VL cierre</div>
        <div class="cover-stat-val" style="color:var(--teal);">${fmtV(vlActual)}</div>
        <div class="cover-stat-sub">Base 100 · inicio fondo</div>
      </div>
      <div class="cover-stat">
        <div class="cover-stat-lbl">Rentabilidad mes</div>
        <div class="cover-stat-val" style="color:${(m?.mtd||0)>=0?'var(--green)':'var(--red)'};">${fmtP((m?.mtd||0)*100)}</div>
        <div class="cover-stat-sub">vs benchmark</div>
      </div>
      <div class="cover-stat">
        <div class="cover-stat-lbl">Rentabilidad YTD</div>
        <div class="cover-stat-val" style="color:${(m?.ytd||0)>=0?'var(--green)':'var(--red)'};">${fmtP((m?.ytd||0)*100)}</div>
        <div class="cover-stat-sub">acumulado año</div>
      </div>
      <div class="cover-stat">
        <div class="cover-stat-lbl">Valor cartera</div>
        <div class="cover-stat-val" style="color:var(--teal);">€${Math.round(valorCartera||0).toLocaleString('es-ES')}</div>
        <div class="cover-stat-sub">${positions.length} posiciones abiertas</div>
      </div>
    </div>
  </div>

  <!-- 01. RESUMEN EJECUTIVO -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">01</span>
      <span class="section-title">Resumen Ejecutivo</span>
      <div class="section-rule"></div>
    </div>
    <p class="exec-summary">
      ${mesNum} ${anyo} cerró con un VL de <em>${fmtV(vlActual)}</em> y una rentabilidad acumulada desde inicio del 
      <em>${fmtP((m?.totalReturn||0)*100)}</em>. 
      ${opsMonth.length ? `Durante el mes se ejecutaron <em>${opsMonth.length} operaciones</em> — ${wins.length} ganadoras y ${losses.length} perdedoras — con un P&L realizado de <em>${fmtE2(pnlMes)}</em>.` : 'No se ejecutaron operaciones durante el mes.'}
      El P&L no realizado en posiciones abiertas es de <em>${fmtE2(pnlNoRealizado)}</em>.
    </p>
    <div class="insight">
      <div class="insight-title">Métricas clave del período</div>
      <div class="insight-text">
        Sharpe: <strong>${m?.sharpe?.toFixed(2)||'—'}</strong> · 
        Sortino: <strong>${m?.sortino?.toFixed(2)||'—'}</strong> · 
        Volatilidad anual: <strong>${m?.annVol?((m.annVol*100).toFixed(1)+'%'):'—'}</strong> · 
        Max Drawdown: <strong style="color:var(--red);">${m?.maxDD?('-'+(m.maxDD*100).toFixed(1)+'%'):'—'}</strong> · 
        Beta vs SPY: <strong>${m?.beta?.toFixed(2)||'—'}</strong>
      </div>
    </div>
  </div>

  <!-- 02. RENTABILIDAD -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">02</span>
      <span class="section-title">Rentabilidad</span>
      <div class="section-rule"></div>
    </div>
    <div class="metrics-grid">
      <div class="metric-cell">
        <div class="metric-lbl">TWR Total</div>
        <div class="metric-val" style="color:${(m?.totalReturn||0)>=0?'var(--green)':'var(--red)'};">${fmtP((m?.totalReturn||0)*100)}</div>
        <div class="metric-sub">desde inicio del fondo</div>
      </div>
      <div class="metric-cell">
        <div class="metric-lbl">YTD ${anyo}</div>
        <div class="metric-val" style="color:${(m?.ytd||0)>=0?'var(--green)':'var(--red)'};">${fmtP((m?.ytd||0)*100)}</div>
        <div class="metric-sub">acumulado año en curso</div>
      </div>
      <div class="metric-cell">
        <div class="metric-lbl">MTD ${mesNum}</div>
        <div class="metric-val" style="color:${(m?.mtd||0)>=0?'var(--green)':'var(--red)'};">${fmtP((m?.mtd||0)*100)}</div>
        <div class="metric-sub">rentabilidad del mes</div>
      </div>
      <div class="metric-cell">
        <div class="metric-lbl">P&L Realizado</div>
        <div class="metric-val" style="color:${(pnlRealizado||0)>=0?'var(--green)':'var(--red)'};">${fmtE2(pnlRealizado)}</div>
        <div class="metric-sub">operaciones cerradas</div>
      </div>
      <div class="metric-cell">
        <div class="metric-lbl">P&L No Realizado</div>
        <div class="metric-val" style="color:${(pnlNoRealizado||0)>=0?'var(--green)':'var(--red)'};">${fmtE2(pnlNoRealizado)}</div>
        <div class="metric-sub">posiciones abiertas</div>
      </div>
      <div class="metric-cell">
        <div class="metric-lbl">Valor Liquidativo</div>
        <div class="metric-val" style="color:var(--teal);">${fmtV(vlActual)}</div>
        <div class="metric-sub">${m?.participaciones?.toFixed(2)||'—'} participaciones</div>
      </div>
    </div>
    ${m?.spyStats ? `
    <table class="compare-table">
      <thead><tr><th>Métrica</th><th class="r">Fondo ETHAN</th><th class="r">SPY</th><th class="r">Diferencia</th></tr></thead>
      <tbody>
        <tr>
          <td class="label">TWR período</td>
          <td class="r" style="color:${(m.totalReturn||0)>=(m.spyStats.twrTotal||0)?'var(--green)':'var(--red)'};">${fmtP((m.totalReturn||0)*100)}</td>
          <td class="r" style="color:var(--text2);">${fmtP((m.spyStats.twrTotal||0)*100)}</td>
          <td class="r" style="color:${(m.totalReturn||0)>=(m.spyStats.twrTotal||0)?'var(--green)':'var(--red)'};">${fmtP(((m.totalReturn||0)-(m.spyStats.twrTotal||0))*100)}</td>
        </tr>
        <tr>
          <td class="label">Volatilidad anual</td>
          <td class="r" style="color:${(m.annVol||0)<=(m.spyStats.volAnual||1)?'var(--green)':'var(--red)'};">${m.annVol?((m.annVol*100).toFixed(1)+'%'):'—'}</td>
          <td class="r" style="color:var(--text2);">${m.spyStats.volAnual?((m.spyStats.volAnual*100).toFixed(1)+'%'):'—'}</td>
          <td class="r" style="color:${(m.annVol||0)<=(m.spyStats.volAnual||1)?'var(--green)':'var(--red)'};">${m.annVol&&m.spyStats.volAnual?(fmtP(((m.annVol-m.spyStats.volAnual)*100))):'—'}</td>
        </tr>
      </tbody>
    </table>` : ''}
  </div>

  <!-- 03. RIESGO -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">03</span>
      <span class="section-title">Métricas de Riesgo</span>
      <div class="section-rule"></div>
    </div>
    <div class="risk-grid">
      <div class="risk-card">
        <div class="risk-card-lbl">Sharpe Ratio</div>
        <div class="risk-card-val" style="color:${(m?.sharpe||0)>=1?'var(--green)':(m?.sharpe||0)>=0?'var(--amber)':'var(--red)'};">${m?.sharpe?.toFixed(2)||'—'}</div>
        <div class="risk-card-desc">Retorno ajustado por riesgo total. >1 = nivel profesional.</div>
      </div>
      <div class="risk-card">
        <div class="risk-card-lbl">Sortino Ratio</div>
        <div class="risk-card-val" style="color:${(m?.sortino||0)>=1?'var(--green)':(m?.sortino||0)>=0?'var(--amber)':'var(--red)'};">${m?.sortino?.toFixed(2)||'—'}</div>
        <div class="risk-card-desc">Penaliza solo la volatilidad negativa. >2 = excelente.</div>
      </div>
      <div class="risk-card">
        <div class="risk-card-lbl">Max Drawdown</div>
        <div class="risk-card-val" style="color:var(--red);">${m?.maxDD?('-'+(m.maxDD*100).toFixed(1)+'%'):'—'}</div>
        <div class="risk-card-desc">Caída máxima desde máximos históricos del VL.</div>
      </div>
      <div class="risk-card">
        <div class="risk-card-lbl">Beta vs SPY</div>
        <div class="risk-card-val" style="color:var(--teal);">${m?.beta?.toFixed(2)||'—'}</div>
        <div class="risk-card-desc">Sensibilidad vs mercado. <1 = más defensivo que el SP500.</div>
      </div>
      <div class="risk-card">
        <div class="risk-card-lbl">Alpha Jensen</div>
        <div class="risk-card-val" style="color:${(m?.alpha||0)>=0?'var(--green)':'var(--red)'};">${m?.alpha?fmtP((m.alpha*100),2):'—'}</div>
        <div class="risk-card-desc">Retorno no explicado por el mercado. Positivo = valor añadido real.</div>
      </div>
      <div class="risk-card">
        <div class="risk-card-lbl">Calmar Ratio</div>
        <div class="risk-card-val" style="color:${(m?.calmar||0)>=0.5?'var(--green)':'var(--amber)'};">${m?.calmar?.toFixed(2)||'—'}</div>
        <div class="risk-card-desc">TWR / Max Drawdown. Retorno por unidad de drawdown sufrido.</div>
      </div>
    </div>
  </div>

  <!-- 04. OPERACIONES -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">04</span>
      <span class="section-title">Operaciones del Mes</span>
      <div class="section-rule"></div>
    </div>
    ${opsMonth.length ? `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:4px;overflow:hidden;margin-bottom:20px;">
      <div style="background:var(--surface);padding:14px 16px;">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text2);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.1em;">Operaciones</div>
        <div style="font-family:var(--serif);font-size:28px;font-style:italic;font-weight:600;">${opsMonth.length}</div>
        <div style="font-family:var(--mono);font-size:9px;color:var(--text2);margin-top:4px;">${wins.length}G · ${losses.length}P</div>
      </div>
      <div style="background:var(--surface);padding:14px 16px;">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text2);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.1em;">Win Rate mes</div>
        <div style="font-family:var(--serif);font-size:28px;font-style:italic;font-weight:600;color:${wins.length/opsMonth.length>=0.5?'var(--green)':'var(--red)'};">${opsMonth.length>0?((wins.length/opsMonth.length*100).toFixed(0)+'%'):'—'}</div>
        <div style="font-family:var(--mono);font-size:9px;color:var(--text2);margin-top:4px;">del mes</div>
      </div>
      <div style="background:var(--surface);padding:14px 16px;">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text2);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.1em;">P&L realizado</div>
        <div style="font-family:var(--serif);font-size:28px;font-style:italic;font-weight:600;color:${pnlMes>=0?'var(--green)':'var(--red)'};">${fmtE2(pnlMes)}</div>
        <div style="font-family:var(--mono);font-size:9px;color:var(--text2);margin-top:4px;">neto del mes</div>
      </div>
      <div style="background:var(--surface);padding:14px 16px;">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text2);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.1em;">Días medio</div>
        <div style="font-family:var(--serif);font-size:28px;font-style:italic;font-weight:600;">${opsMonth.length>0?Math.round(opsMonth.reduce((s,h)=>{const d=h.exitDateISO&&h.entryDateISO?Math.round((new Date(h.exitDateISO)-new Date(h.entryDateISO))/86400000):0;return s+d;},0)/opsMonth.length)+'d':'—'}</div>
        <div style="font-family:var(--mono);font-size:9px;color:var(--text2);margin-top:4px;">duración media</div>
      </div>
    </div>
    <table class="ops-table">
      <thead><tr><th>Ticker</th><th>Entrada</th><th>Salida</th><th class="r">P.Entrada</th><th class="r">P.Salida</th><th class="r">P&L %</th><th class="r">P&L €</th></tr></thead>
      <tbody>
        ${opsMonth.map(op => `<tr>
          <td><div style="font-weight:700;font-size:13px;">${op.ticker||'—'}</div></td>
          <td style="font-family:var(--mono);font-size:10px;color:var(--text2);">${op.entryDateISO?.slice(0,10)||'—'}</td>
          <td style="font-family:var(--mono);font-size:10px;color:var(--text2);">${op.exitDateISO?.slice(0,10)||'—'}</td>
          <td class="r">$${op.entry?.toFixed(2)||'—'}</td>
          <td class="r">$${op.exit?.toFixed(2)||'—'}</td>
          <td class="r" style="color:${(op.pnlPct||0)>=0?'var(--green)':'var(--red)'};font-weight:700;">${fmtP(op.pnlPct||0)}</td>
          <td class="r" style="color:${(op.pnlAbs||0)>=0?'var(--green)':'var(--red)'};font-weight:700;">${fmtE2(op.pnlAbs)}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : `<div style="text-align:center;padding:32px;color:var(--text2);font-family:var(--mono);">Sin operaciones cerradas en ${mesNum} ${anyo}</div>`}
  </div>

  <!-- 05. POSICIONES ABIERTAS -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">05</span>
      <span class="section-title">Posiciones Abiertas al Cierre</span>
      <div class="section-rule"></div>
    </div>
    ${positions.length ? `
    <div class="pos-grid">
      ${positions.map(p => {
        const cur = p.currentPrice || p.entry;
        const dir = p.direction || 'alcista';
        const pnlPct = cur && p.entry ? (dir==='bajista'?(p.entry-cur)/p.entry:(cur-p.entry)/p.entry)*100 : 0;
        const col = pnlPct >= 0 ? 'var(--green)' : 'var(--red)';
        const weight = valorCartera > 0 ? ((p.shares||1)*(cur||p.entry||0)/valorCartera*100).toFixed(1) : '—';
        return `<div class="pos-cell">
          <div>
            <div class="pos-ticker" style="color:var(--text1);">${p.ticker}</div>
            <div class="pos-name">${p.name||''}</div>
          </div>
          <div style="text-align:right;">
            <div class="pos-pnl" style="color:${col};">${fmtP(pnlPct)}</div>
            <div class="pos-weight">Peso: ${weight}% · Stop: ${p.entryStop||p.stopManual||'—'}</div>
          </div>
        </div>`;
      }).join('')}
    </div>` : `<div style="text-align:center;padding:32px;color:var(--text2);font-family:var(--mono);">Sin posiciones abiertas</div>`}
  </div>

  <!-- PIE -->
  <div class="footer">
    <div class="footer-left">ETHAN Mercados · Informe ${mes}</div>
    <div class="footer-right">
      Documento de uso privado · No constituye asesoramiento financiero<br>
      Generado el ${now.toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})} · Plataforma ETHAN v3.0
    </div>
  </div>
</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.document.title = `ETHAN · Informe ${mes}`;
}

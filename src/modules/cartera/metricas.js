// ═══════════════════════════════════════════════
// MÓDULO: Cartera · Métricas v4
// 2 tabs: Cartera | Trading
// Precios de posiciones abiertas desde Firestore
// (currentPrice guardado por cartera.js)
// ═══════════════════════════════════════════════

import { UserData } from '../../userdata.js';

// ── Formatters ────────────────────────────────
const fmtPct  = (n, d=2) => n != null && isFinite(n) ? (n>=0?'+':'')+n.toFixed(d)+'%' : '—';
const fmtE    = n => n != null && isFinite(n) ? (n<0?'-':'')+'€'+Math.abs(n).toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:0}) : '—';
const fmtR    = (n, d=2) => n != null && isFinite(n) ? n.toFixed(d) : '—';
const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'}) : '—';

// ── Calcular métricas de cartera ──────────────
function calcMetrics(history, openPos, capitalInicial) {
  if (!capitalInicial || capitalInicial <= 0) return null;

  const today = new Date().toISOString().slice(0, 10);

  // P&L realizado
  const pnlRealizado = (history || []).reduce((s, h) => s + (h.pnlAbs || 0), 0);

  // P&L no realizado (usa currentPrice guardado por cartera.js)
  const pnlNoRealizado = (openPos || []).reduce((s, p) => {
    const current = p.currentPrice || p.entry;
    if (!current || !p.entry || !p.shares) return s;
    const pnl = (p.direction || 'alcista') === 'bajista'
      ? (p.entry - current) * p.shares
      : (current - p.entry) * p.shares;
    return s + pnl;
  }, 0);

  // Capital invertido (valor de mercado de posiciones abiertas)
  const capitalInvertido = (openPos || []).reduce((s, p) => {
    const current = p.currentPrice || p.entry;
    return s + (current && p.shares ? current * p.shares : p.cost || 0);
  }, 0);

  const capitalActual = capitalInicial + pnlRealizado + pnlNoRealizado;
  const cash = Math.max(0, capitalInicial - capitalInvertido + pnlRealizado);
  const totalReturn = (capitalActual - capitalInicial) / capitalInicial;

  // Fecha de inicio
  const allDates = [
    ...(history  || []).map(h => h.entryDateISO).filter(Boolean),
    ...(openPos  || []).map(p => p.entryDate).filter(Boolean),
  ].sort();
  const startDate = allDates[0] || today;
  const nDays = Math.round((new Date(today) - new Date(startDate)) / 86400000);

  // CAGR: (1 + TWR)^(252/días_cotizados) − 1
  // días_cotizados ≈ nDays × 252/365
  const tradingDays = Math.round(nDays * 252 / 365);
  const annReturn = tradingDays > 0
    ? Math.pow(Math.max(1 + totalReturn, 0.001), 252 / tradingDays) - 1
    : totalReturn;

  // Retornos por operación para volatilidad
  const opReturns = [
    ...(history || []).map(h => (h.pnlPct || 0) / 100),
    ...(openPos || []).map(p => {
      const current = p.currentPrice || p.entry;
      if (!current || !p.entry) return 0;
      return (p.direction || 'alcista') === 'bajista'
        ? (p.entry - current) / p.entry
        : (current - p.entry) / p.entry;
    }),
  ];
  const n = opReturns.length;
  const mean = n ? opReturns.reduce((a, b) => a + b, 0) / n : 0;
  const variance = n ? opReturns.reduce((a, r) => a + (r - mean) ** 2, 0) / n : 0;
  const opsPerYear = nDays > 0 ? n / (nDays / 365) : n;
  const annVol = Math.sqrt(variance * opsPerYear);
  const sharpe = annVol > 0 ? annReturn / annVol : 0;
  const downR = opReturns.filter(r => r < 0);
  const hasNegOps = downR.length > 0;
  const downVol = hasNegOps
    ? Math.sqrt(downR.reduce((a, r) => a + r ** 2, 0) / downR.length * opsPerYear)
    : 0;
  const sortino = downVol > 0 ? annReturn / downVol : null;

  // TWR series (base 100) por operación cronológica
  const opsChron = [
    ...(history || []).map(h => ({
      r: 1 + (h.pnlPct || 0) / 100,
      date: h.entryDateISO || '',
    })),
    ...(openPos || []).map(p => {
      const current = p.currentPrice || p.entry;
      const r = current && p.entry
        ? ((p.direction || 'alcista') === 'bajista'
            ? 1 + (p.entry - current) / p.entry
            : current / p.entry)
        : 1;
      return { r, date: p.entryDate || '' };
    }),
  ].filter(o => o.date).sort((a, b) => a.date.localeCompare(b.date));

  const twrSeries = [100];
  let acc = 1;
  opsChron.forEach(o => { acc *= o.r; twrSeries.push(+(acc * 100).toFixed(3)); });

  // Máximo histórico y drawdown actual
  const maxHistorico = capitalInicial * Math.max(...twrSeries) / 100;
  const drawdownActual = maxHistorico > 0 ? (capitalActual - maxHistorico) / maxHistorico : 0;
  const desdeMaximo = capitalActual - maxHistorico;

  // Max Drawdown histórico
  let peak = 100, maxDD = 0, ddStart = startDate, ddTrough = startDate;
  twrSeries.forEach((v, i) => {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDD) { maxDD = dd; ddTrough = opsChron[i-1]?.date || startDate; }
  });
  const calmar = maxDD > 0 ? annReturn / maxDD : null;

  // Períodos
  const thisYear = today.slice(0, 4);
  const thisMonth = today.slice(0, 7);
  const ytd = totalReturn; // toda la cartera es de 2026
  const mtd = null; // requiere snapshot fin de mes anterior

  return {
    totalReturn, annReturn, nDays, tradingDays,
    ytd, mtd,
    annVol, sharpe, sortino, calmar, hasNegOps,
    maxDD, ddStart, ddTrough,
    maxHistorico, drawdownActual, desdeMaximo,
    twrSeries, startDate,
    pnlRealizado, pnlNoRealizado, capitalActual,
    capitalInvertido, cash,
  };
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

// ── SVG Gráfico TWR base 100 ──────────────────
function twrChart(twrSeries) {
  if (!twrSeries || twrSeries.length < 2) return '<div style="height:140px;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:11px;font-family:var(--mono);">Sin datos suficientes</div>';
  const W = 800, H = 140;
  const min = Math.min(...twrSeries), max = Math.max(...twrSeries);
  const range = (max - min) || 1;
  const toX = i => (i / (twrSeries.length - 1)) * W;
  const toY = v => H - ((v - min) / range) * H;
  const pts = twrSeries.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const last = twrSeries[twrSeries.length - 1];
  const col = last >= 100 ? '#40d9c0' : '#f47174';
  const base100Y = toY(100).toFixed(1);
  const area = `${toX(0).toFixed(1)},${H} ${pts} ${W},${H}`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block;">
    <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${col}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
    </linearGradient></defs>
    <line x1="0" y1="${base100Y}" x2="${W}" y2="${base100Y}" stroke="var(--border2)" stroke-width="1" stroke-dasharray="4,4"/>
    <polygon points="${area}" fill="url(#tg)"/>
    <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${W}" cy="${toY(last).toFixed(1)}" r="4" fill="${col}"/>
  </svg>`;
}

// ── Metric row ────────────────────────────────
function mRow(label, value, col) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);">
    <span style="font-size:11px;color:var(--text2);">${label}</span>
    <span style="font-family:var(--mono);font-size:12px;font-weight:700;color:${col||'var(--text1)'};">${value}</span>
  </div>`;
}

function badge(label, col) {
  return `<span style="font-family:var(--mono);font-size:9px;padding:2px 7px;border-radius:3px;background:${col}22;color:${col};">${label}</span>`;
}

// ── Fetch SPY para benchmark ──────────────────
// Solo necesitamos el precio en la fecha de inicio y el precio actual.
// Usamos el endpoint de quote + history mínimo para no bloquear la carga.
const PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
];

async function fetchSPYReturn(startDate) {
  // Calculamos el rango necesario desde startDate hasta hoy
  const nDays = Math.round((Date.now() - new Date(startDate)) / 86400000);
  const range = nDays > 365 ? '2y' : nDays > 180 ? '1y' : '6mo';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=${range}`;
  for (const fn of PROXIES) {
    try {
      const r = await fetch(fn(url), { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 6000); return c.signal; })() });
      if (!r.ok) continue;
      const j = JSON.parse(await r.text());
      const res = j?.chart?.result?.[0];
      if (!res) continue;
      const ts = res.timestamp || res.timestamps;
      const closes = res.indicators?.quote?.[0]?.close;
      if (!ts || !closes || closes.length < 2) continue;
      // Encontrar el precio más cercano a startDate
      const startMs = new Date(startDate).getTime();
      let startIdx = 0;
      for (let i = 0; i < ts.length; i++) {
        if (ts[i] * 1000 >= startMs) { startIdx = i; break; }
      }
      const priceStart = closes[startIdx];
      const priceEnd   = closes[closes.length - 1];
      if (!priceStart || !priceEnd) continue;
      return { return: (priceEnd - priceStart) / priceStart, priceStart, priceEnd };
    } catch {}
  }
  return null;
}


function mc(name, value, badge, badgeClass, note) {
  return `<div class="pm-mc">
    <div class="pm-mc-name">${name}</div>
    <div class="pm-mc-row">
      <span class="pm-mc-val">${value}</span>
      ${badge ? `<span class="pm-mc-badge ${badgeClass}">${badge}</span>` : ''}
    </div>
    <div class="pm-mc-note">${note}</div>
  </div>`;
}

// ── CSS ───────────────────────────────────────
const CSS = `
.pm-wrap{font-family:var(--sans);}
.pm-tabs2{display:flex;gap:2px;border-bottom:1px solid var(--border);margin-bottom:18px;}
.pm-tab2{padding:9px 18px;background:transparent;border:none;color:var(--text3);cursor:pointer;font-size:11px;font-weight:600;letter-spacing:0.03em;border-bottom:2px solid transparent;font-family:var(--sans);}
.pm-tab2.active{color:var(--teal);border-bottom-color:var(--teal);}
.pm-panel2{display:none;}.pm-panel2.active{display:block;}

.pm-hero2{display:grid;grid-template-columns:260px 1fr;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface);margin-bottom:16px;}
.pm-hero-left{padding:22px 24px;border-right:1px solid var(--border);display:flex;flex-direction:column;gap:14px;}
.pm-hero-main{display:flex;flex-direction:column;gap:3px;}
.pm-hero-lbl{font-family:var(--mono);font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3);}
.pm-hero-val{font-family:var(--serif);font-size:36px;font-weight:600;font-style:italic;line-height:1;}
.pm-hero-sub{font-family:var(--mono);font-size:11px;}
.pm-hero-stack{display:flex;flex-direction:column;gap:0;}
.pm-hero-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:11px;}
.pm-hero-row:last-child{border-bottom:none;}
.pm-hero-row-lbl{color:var(--text3);}
.pm-hero-row-val{font-family:var(--mono);font-weight:600;}
.pm-chart-right{padding:18px 20px 12px;display:flex;flex-direction:column;gap:10px;}
.pm-chart-top{display:flex;justify-content:space-between;align-items:center;}
.pm-chart-lbl{font-size:9px;font-family:var(--mono);color:var(--text3);}

.pm-dd-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:16px;}
.pm-dd-cell{background:var(--surface);padding:12px 16px;}
.pm-dd-lbl{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:6px;}
.pm-dd-val{font-family:var(--mono);font-size:18px;font-weight:700;}
.pm-dd-sub{font-size:10px;color:var(--text3);margin-top:3px;}

/* ── Cards con descripción (estilo anterior) ── */
.pm-eyebrow{font-family:var(--mono);font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3);display:flex;align-items:center;gap:10px;margin-bottom:12px;}
.pm-eyebrow::after{content:"";flex:1;height:1px;background:var(--border);}
.pm-section-lbl{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
.pm-section-lbl .pm-dash{width:10px;height:1.5px;background:var(--teal);}
.pm-section-lbl span{font-family:var(--mono);font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--teal);}
.pm-section-lbl small{font-size:11px;color:var(--text3);text-transform:none;letter-spacing:0;}
.pm-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1px;background:var(--border);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:20px;}
.pm-mc{background:var(--surface);padding:18px 20px;transition:background 0.15s;}
.pm-mc:hover{background:var(--surface2);}
.pm-mc-name{font-family:var(--mono);font-size:10px;color:var(--text3);margin-bottom:10px;}
.pm-mc-row{display:flex;align-items:baseline;gap:8px;margin-bottom:6px;}
.pm-mc-val{font-family:var(--mono);font-size:22px;font-weight:500;}
.pm-mc-badge{font-family:var(--mono);font-size:9px;padding:2px 7px;border-radius:3px;}
.pm-mc-badge.good{color:var(--green);background:rgba(74,222,128,0.1);}
.pm-mc-badge.warn{color:var(--amber);background:rgba(251,191,36,0.1);}
.pm-mc-badge.bad{color:var(--red);background:rgba(244,113,116,0.1);}
.pm-mc-badge.neu{color:var(--text3);background:var(--surface2);}
.pm-mc-note{font-size:10.5px;color:var(--text3);line-height:1.55;}

.pm-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;}
.pm-card2{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px 18px;}
.pm-card2-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--text3);margin-bottom:10px;}

.pm-debug{background:#0d1500;border:1px solid rgba(251,191,36,0.3);border-radius:8px;padding:14px 16px;margin-bottom:16px;font-family:var(--mono);font-size:10px;line-height:1.9;color:var(--text3);}
.pm-debug-title{color:var(--amber);font-weight:700;font-size:11px;margin-bottom:8px;}
.pm-debug-row{display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.04);padding:3px 0;}
.pm-debug-lbl{color:var(--text3);}
.pm-debug-val{color:var(--text2);font-weight:600;}

.pm-stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:16px;}
.pm-stat{background:var(--surface);padding:14px 16px;}
.pm-stat-lbl{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:6px;}
.pm-stat-val{font-family:var(--mono);font-size:20px;font-weight:700;margin-bottom:3px;}
.pm-stat-sub{font-size:10px;color:var(--text3);}
`;

// ── RENDER ────────────────────────────────────
export async function render(container, { actionsSlot }) {
  if (!document.getElementById('pm-css2')) {
    const s = document.createElement('style');
    s.id = 'pm-css2'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  actionsSlot.innerHTML = `<button class="btn btn-primary" id="pm-refresh">↻ Actualizar</button>`;
  container.innerHTML = `<div class="pm-wrap" id="pm-wrap"><div class="empty"><div class="loader-ring"></div><div class="empty-title">Cargando métricas...</div></div></div>`;

  async function load() {
    const el = document.getElementById('pm-wrap');
    el.innerHTML = `<div class="empty"><div class="loader-ring"></div><div class="empty-title">Leyendo Firestore...</div></div>`;

    try {
      const positions = await UserData.get('ethan_positions').then(v => v || []);
      const history   = await UserData.get('ethan_positions_history').then(v => v || []);
      const capA      = await UserData.get('ethan_capital_alcista') || 0;
      const capB      = await UserData.get('ethan_capital_bajista') || 0;
      const satelite  = await UserData.get('ethan_satelite_assets').then(v => v || []);
      const corePct   = await UserData.get('ethan_core_pct') || 70;

      if (!positions.length && !history.length) {
        el.innerHTML = `<div class="empty"><div class="empty-icon">📊</div><div class="empty-title">Sin operaciones</div><div class="empty-desc">Registra operaciones en Cartera para ver las métricas.</div></div>`;
        return;
      }

      const capitalInicial = capA + capB;
      const m = calcMetrics(history, positions, capitalInicial);
      const rg = calcTrading(history);
      const ra = calcTrading(history.filter(h => (h.direction||'alcista')==='alcista'));
      const rb = calcTrading(history.filter(h => h.direction==='bajista'));

      // Intentar usar el fondo de participaciones si existe
      let mFondo = null;
      try {
        const { getFondo, calcMetricasFondo } = await import('../../fondo.js');
        const fondo = await getFondo();
        if (fondo && m?.capitalActual) {
          mFondo = calcMetricasFondo(fondo, m.capitalActual);
        }
      } catch(e) { console.warn('Fondo no disponible:', e.message); }

      // Si hay fondo, sus métricas de VL tienen prioridad solo para las métricas
      // que realmente mejoran (VL, participaciones, serie). El CAGR y nDays
      // los calculamos siempre desde calcMetrics que usa las fechas reales.
      const mFinal = mFondo ? {
        ...m,
        // Del fondo: VL, participaciones, serie base100, maxHistorico
        vlActual: mFondo.vlActual,
        vlInicial: mFondo.vlInicial,
        participaciones: mFondo.participaciones,
        serieBase100: mFondo.serieBase100,
        maxHistoricoVL: mFondo.maxHistoricoVL,
        maxHistoricoEur: mFondo.maxHistoricoEur,
        // Solo override totalReturn si el fondo tiene más de un punto (más preciso)
        ...(mFondo.nDays > 10 ? {
          totalReturn: mFondo.totalReturn,
          annReturn: mFondo.annReturn,
          maxDD: mFondo.maxDD,
          drawdownActual: mFondo.drawdownActual,
          desdeMaximoEur: mFondo.desdeMaximoEur,
          calmar: mFondo.calmar,
        } : {}),
      } : m;

      // SPY benchmark — en paralelo, con timeout, opcional
      let spyData = null;
      if (mFinal?.startDate) {
        spyData = await Promise.race([
          fetchSPYReturn(mFinal.startDate),
          new Promise(r => setTimeout(() => r(null), 6000)),
        ]).catch(() => null);
      }

      paint(el, positions, history, mFinal, rg, ra, rb, capitalInicial, satelite, corePct, capA, capB, spyData);
    } catch(e) {
      console.error('Métricas:', e);
      document.getElementById('pm-wrap').innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Error</div><div class="empty-desc">${e.message}</div></div>`;
    }
  }

  function paint(el, positions, history, m, rg, ra, rb, capitalInicial, satelite, corePct, capA, capB, spyData) {
    const twr = m?.totalReturn ?? 0;
    const twrCol = twr >= 0 ? 'var(--green)' : 'var(--red)';
    const hasPrice = positions.some(p => p.currentPrice);

    // Aviso si no hay precio actual
    const priceWarning = !hasPrice && positions.length
      ? `<div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:11px;color:var(--amber);">
          ⚠ Abre <strong>Cartera</strong> para actualizar los precios de las posiciones abiertas. Métricas usa el precio guardado allí.
        </div>` : '';

    // Debug panel
    const debug = `<div class="pm-debug">
      <div class="pm-debug-title">🔍 Reconciliación de capital</div>
      <div class="pm-debug-row"><span class="pm-debug-lbl">Capital inicial (Alcista)</span><span class="pm-debug-val">${fmtE(capA)}</span></div>
      <div class="pm-debug-row"><span class="pm-debug-lbl">Capital inicial (Bajista)</span><span class="pm-debug-val">${fmtE(capB)}</span></div>
      <div class="pm-debug-row"><span class="pm-debug-lbl">Capital invertido (posiciones abiertas)</span><span class="pm-debug-val">${fmtE(m?.capitalInvertido)}</span></div>
      <div class="pm-debug-row"><span class="pm-debug-lbl">Cash disponible (estimado)</span><span class="pm-debug-val">${fmtE(m?.cash)}</span></div>
      <div class="pm-debug-row"><span class="pm-debug-lbl">P&L realizado (operaciones cerradas)</span><span class="pm-debug-val" style="color:var(--green)">${fmtE(m?.pnlRealizado)}</span></div>
      <div class="pm-debug-row"><span class="pm-debug-lbl">P&L no realizado (posiciones abiertas)</span><span class="pm-debug-val" style="color:${(m?.pnlNoRealizado||0)>=0?'var(--green)':'var(--red)'}">${fmtE(m?.pnlNoRealizado)}</span></div>
      <div class="pm-debug-row" style="border-top:1px solid rgba(255,255,255,0.1);margin-top:4px;padding-top:6px;"><span class="pm-debug-lbl" style="color:var(--text2);font-weight:700;">Valor cartera = inicial + realizado + no realizado</span><span class="pm-debug-val" style="color:var(--teal);font-size:13px;">${fmtE(m?.capitalActual)}</span></div>
      ${m?.vlActual != null ? `<div class="pm-debug-row"><span class="pm-debug-lbl" style="color:var(--teal);">VL por participación</span><span class="pm-debug-val" style="color:var(--teal);">${m.vlActual.toFixed(4)} (inicio: ${m.vlInicial?.toFixed(2)||'100'})</span></div>
      <div class="pm-debug-row"><span class="pm-debug-lbl" style="color:var(--teal);">Participaciones totales</span><span class="pm-debug-val" style="color:var(--teal);">${m.participaciones?.toFixed(4)||'—'}</span></div>` : '<div class="pm-debug-row"><span class="pm-debug-lbl">Fondo por participaciones</span><span class="pm-debug-val" style="color:var(--amber);">No inicializado — guarda el capital en Cartera para activar</span></div>'}
      ${positions.map(p => `<div class="pm-debug-row"><span class="pm-debug-lbl">${p.ticker} · precio ${p.currentPrice?'actual':'entrada'}</span><span class="pm-debug-val">${p.currentPrice||p.entry} × ${p.shares} = ${fmtE((p.currentPrice||p.entry)*p.shares)}</span></div>`).join('')}
    </div>`;

    el.innerHTML = `
      ${priceWarning}
      ${debug}

      <!-- Tabs -->
      <div class="pm-tabs2">
        <button class="pm-tab2 active" data-tab2="cartera">📊 Cartera</button>
        <button class="pm-tab2" data-tab2="trading">📈 Trading</button>
      </div>

      <!-- ══ TAB CARTERA ══ -->
      <div class="pm-panel2 active" id="pm-panel-cartera">

        <!-- Hero -->
        <div class="pm-hero2">
          <div class="pm-hero-left">
            <div class="pm-hero-main">
              <div class="pm-hero-lbl">Valor total de la cartera</div>
              <div class="pm-hero-val" style="color:var(--teal);">${fmtE(m?.capitalActual || capitalInicial)}</div>
              <div class="pm-hero-sub" style="color:${twrCol};">${fmtPct(twr * 100)} desde el ${fmtDate(m?.startDate)}</div>
            </div>
            <div class="pm-hero-stack">
              ${mRow('Cash disponible', fmtE(m?.cash), 'var(--text2)')}
              ${mRow('Invertido', fmtE(m?.capitalInvertido), 'var(--text2)')}
              ${mRow('P&L Realizado', fmtE(m?.pnlRealizado), 'var(--green)')}
              ${mRow('P&L No Realizado', fmtE(m?.pnlNoRealizado), (m?.pnlNoRealizado||0)>=0?'var(--green)':'var(--red)')}
            </div>
          </div>
          <div class="pm-chart-right">
            <div class="pm-chart-top">
              <div style="font-size:11px;font-weight:600;">TWR · base 100</div>
              <div class="pm-chart-lbl">${m?.tradingDays||0} sesiones · desde ${fmtDate(m?.startDate)}</div>
            </div>
            ${twrChart(m?.twrSeries)}
            <div style="display:flex;gap:16px;font-size:9px;font-family:var(--mono);color:var(--text3);">
              <span>100 = capital inicial</span>
              <span>Actual: ${m?.twrSeries?.[m.twrSeries.length-1]?.toFixed(1)||'—'}</span>
            </div>
          </div>
        </div>

        <!-- Drawdown strip -->
        <div class="pm-dd-strip">
          <div class="pm-dd-cell">
            <div class="pm-dd-lbl">Máximo histórico</div>
            <div class="pm-dd-val" style="color:var(--green);">${fmtE(m?.maxHistorico)}</div>
            <div class="pm-dd-sub">Pico del NAV</div>
          </div>
          <div class="pm-dd-cell">
            <div class="pm-dd-lbl">Drawdown actual</div>
            <div class="pm-dd-val" style="color:${(m?.drawdownActual||0)<0?'var(--red)':'var(--green)'};">${fmtPct((m?.drawdownActual||0)*100)}</div>
            <div class="pm-dd-sub">Desde el máximo</div>
          </div>
          <div class="pm-dd-cell">
            <div class="pm-dd-lbl">Desde máximo (€)</div>
            <div class="pm-dd-val" style="color:${(m?.desdeMaximo||0)<0?'var(--red)':'var(--green)'};">${fmtE(m?.desdeMaximo)}</div>
            <div class="pm-dd-sub">${(m?.desdeMaximo||0)>=0?'En máximos':'Recuperar'}</div>
          </div>
        </div>

        <!-- Métricas cartera — Rentabilidad -->
        <div class="pm-section-lbl"><span class="pm-dash"></span><span>Rentabilidad</span><small>— qué generó la cartera</small></div>
        <div class="pm-cards">
          ${mc('TWR Total', fmtPct(twr*100), twr>=0?'Positivo':'Negativo', twr>=0?'good':'bad', `Time-Weighted Return desde el ${fmtDate(m?.startDate)}. Neutraliza el efecto de aportaciones y retiradas.`)}
          ${mc('CAGR Anualizado', fmtPct((m?.annReturn||0)*100), (m?.annReturn||0)>=0.1?'Bueno':(m?.annReturn||0)>=0?'Positivo':'Negativo', (m?.annReturn||0)>=0.1?'good':(m?.annReturn||0)>=0?'neu':'bad', `Tasa de crecimiento anual compuesta. Fórmula: (1+TWR)^(252/${m?.tradingDays||0}) − 1. Base: 252 sesiones/año.`)}
          ${mc('YTD', fmtPct((m?.ytd||0)*100), null, 'neu', 'Rentabilidad acumulada desde el 1 de enero del año en curso.')}
          ${mc('MTD', m?.mtd!=null?fmtPct(m.mtd*100):'—', null, 'neu', 'Rentabilidad del mes en curso. Requiere snapshot del valor al cierre del mes anterior.')}
          ${mc('P&L Realizado', fmtE(m?.pnlRealizado), (m?.pnlRealizado||0)>=0?'Ganancia':'Pérdida', (m?.pnlRealizado||0)>=0?'good':'bad', 'Suma de beneficios y pérdidas de todas las operaciones cerradas.')}
          ${mc('P&L No Realizado', fmtE(m?.pnlNoRealizado), (m?.pnlNoRealizado||0)>=0?'Latente+':'Latente−', (m?.pnlNoRealizado||0)>=0?'good':'warn', 'P&L de las posiciones aún abiertas a precio actual. Se actualiza cuando abres el módulo Cartera.')}
          ${spyData ? mc('Benchmark SPY', fmtPct(spyData.return*100), null, 'neu', `Rentabilidad del SP500 (SPY) en el mismo período (desde ${fmtDate(m?.startDate)}). Referencia de mercado.`) : ''}
          ${spyData && m ? mc('Alpha', fmtPct((m.totalReturn - spyData.return)*100), (m.totalReturn - spyData.return)>=0?'Superando mercado':'Por debajo', (m.totalReturn - spyData.return)>=0?'good':'bad', `TWR cartera (${fmtPct(m.totalReturn*100)}) − Benchmark SPY (${fmtPct(spyData.return*100)}). Alpha positivo = bates al mercado.`) : ''}
        </div>

        <!-- Métricas cartera — Riesgo -->
        <div class="pm-section-lbl"><span class="pm-dash"></span><span>Riesgo ajustado</span><small>— si el retorno compensa la volatilidad</small></div>
        <div class="pm-cards">
          ${mc('Sharpe Ratio', fmtR(m?.sharpe), (m?.sharpe||0)>=1.5?'Excelente':(m?.sharpe||0)>=1?'Sólido':(m?.sharpe||0)>=0.5?'Aceptable':'Débil', (m?.sharpe||0)>=1?'good':(m?.sharpe||0)>=0.5?'neu':'warn', 'Retorno anualizado / volatilidad total. >1 = sólido, >1.5 = excelente. Referencia: fondos top ~1.0.')}
          ${mc('Sortino Ratio', m?.sortino!=null?fmtR(m.sortino):m?.hasNegOps===false?'N/A':'—', m?.sortino!=null?(m.sortino>=2?'Excelente':m.sortino>=1.5?'Bueno':'Aceptable'):null, m?.sortino!=null?(m.sortino>=1.5?'good':'neu'):'neu', m?.hasNegOps===false?'Sin operaciones negativas todavía — se calculará en cuanto haya pérdidas.':'Como Sharpe pero penaliza solo la volatilidad bajista. >2 = gestión de riesgo sobresaliente.')}
          ${mc('Calmar Ratio', m?.calmar!=null?fmtR(m.calmar):m?.maxDD===0?'N/A':'—', m?.calmar!=null?(m.calmar>=1?'Bueno':'Vigilar'):null, m?.calmar!=null?(m.calmar>=1?'good':'warn'):'neu', m?.maxDD===0?'Sin drawdown todavía — se calculará en cuanto haya uno.':'CAGR / Máx. Drawdown. >1 = el retorno supera el mayor dolor sufrido.')}
          ${mc('Volatilidad Anual.', m?.annVol!=null?(m.annVol*100).toFixed(1)+'%':'—', m?.annVol!=null?(m.annVol<0.15?'Contenida':m.annVol<0.25?'Moderada':'Alta'):null, m?.annVol!=null?(m.annVol<0.15?'good':m.annVol<0.25?'neu':'warn'):'neu', 'Desviación estándar de los retornos anualizada. Referencia: SP500 ~15-20%/año.')}
          ${mc('Máx. Drawdown', m?.maxDD!=null?'-'+(m.maxDD*100).toFixed(1)+'%':'—', m?.maxDD!=null?(m.maxDD<0.1?'Controlado':m.maxDD<0.2?'Moderado':'Alto'):null, m?.maxDD!=null?(m.maxDD<0.1?'good':m.maxDD<0.2?'neu':'bad'):'neu', `Caída máxima desde un pico hasta el valle siguiente. Desde ${fmtDate(m?.ddStart)} hasta ${fmtDate(m?.ddTrough)}.`)}
        </div>

        <!-- Allocation -->
        <div class="pm-card2">
          <div class="pm-card2-title">Asset Allocation</div>
          <div style="display:flex;height:6px;border-radius:3px;overflow:hidden;margin-bottom:12px;">
            ${capitalInicial>0?`
            <div style="width:${Math.min((m?.capitalInvertido||0)/capitalInicial*100,100).toFixed(1)}%;background:var(--teal);"></div>
            <div style="flex:1;background:var(--surface2);"></div>`:
            '<div style="width:100%;background:var(--surface2);"></div>'}
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
            ${[
              ['Invertido', fmtE(m?.capitalInvertido), m?.capitalInvertido!=null&&capitalInicial>0?(m.capitalInvertido/capitalInicial*100).toFixed(1)+'%':'—', 'var(--teal)'],
              ['Cash', fmtE(m?.cash), m?.cash!=null&&capitalInicial>0?(m.cash/capitalInicial*100).toFixed(1)+'%':'—', 'var(--blue)'],
              ['Capital inicial', fmtE(capitalInicial), '100%', 'var(--text3)'],
            ].map(([l,v,p,c])=>`<div style="background:var(--surface2);border-radius:6px;padding:10px 12px;">
              <div style="font-size:9px;color:var(--text3);font-family:var(--mono);margin-bottom:4px;">${l}</div>
              <div style="font-family:var(--mono);font-size:15px;font-weight:700;color:${c};">${v}</div>
              <div style="font-size:10px;color:var(--text3);margin-top:2px;">${p}</div>
            </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- ══ TAB TRADING ══ -->
      <div class="pm-panel2" id="pm-panel-trading">

        <!-- Stats globales -->
        <div class="pm-stat-grid">
          ${[
            ['Win Rate', rg?Math.round(rg.winRate*100)+'%':'—', rg?rg.n+' operaciones':'—', rg&&rg.winRate>=0.5?'var(--green)':'var(--red)'],
            ['Profit Factor', rg&&rg.profitFactor!=null?rg.profitFactor.toFixed(2):'—', '>1.5 = sólido', rg&&rg.profitFactor>=1.5?'var(--green)':rg&&rg.profitFactor>=1?'var(--amber)':'var(--red)'],
            ['Esperanza', rg?fmtPct(rg.esperanza*100):'—', 'por operación', rg&&rg.esperanza>=0?'var(--green)':'var(--red)'],
            ['Avg Win', rg?'+'+rg.avgWin.toFixed(1)+'%':'—', 'ganancia media', 'var(--green)'],
            ['Avg Loss', rg?'-'+rg.avgLoss.toFixed(1)+'%':'—', 'pérdida media', 'var(--red)'],
            ['Payoff', rg&&rg.payoff!=null?rg.payoff.toFixed(2):'—', 'win/loss ratio', rg&&rg.payoff>=1.5?'var(--green)':'var(--amber)'],
            ['Holding medio', rg?.avgDays!=null?rg.avgDays+'d':'—', 'días por operación', 'var(--text2)'],
            ['P&L Realizado', rg?.hasAbs?fmtE(rg.totalPL):'—', 'operaciones cerradas', rg&&rg.totalPL>=0?'var(--green)':'var(--red)'],
            ['Rent. media/op.', rg?fmtPct(rg.avgReturn):'—', 'todas las ops', rg&&rg.avgReturn>=0?'var(--green)':'var(--red)'],
          ].map(([l,v,s,c])=>`<div class="pm-stat">
            <div class="pm-stat-lbl">${l}</div>
            <div class="pm-stat-val" style="color:${c};">${v}</div>
            <div class="pm-stat-sub">${s}</div>
          </div>`).join('')}
        </div>

        <!-- Alcista vs Bajista -->
        <div class="pm-grid2">
          ${['Alcista','Bajista'].map((name, idx) => {
            const r = idx===0?ra:rb;
            const col = idx===0?'var(--green)':'var(--red)';
            return `<div class="pm-card2">
              <div class="pm-card2-title" style="color:${col};">${name} · ${r?r.n+' ops':'sin ops'}</div>
              ${r ? [
                ['Win Rate', Math.round(r.winRate*100)+'%'],
                ['Avg Win', '+'+r.avgWin.toFixed(1)+'%'],
                ['Avg Loss', '-'+r.avgLoss.toFixed(1)+'%'],
                ['Profit Factor', r.profitFactor!=null?r.profitFactor.toFixed(2):'—'],
                ['Esperanza', fmtPct(r.esperanza*100)],
                ['Holding medio', r.avgDays!=null?r.avgDays+'d':'—'],
                ['Rent. media/op', fmtPct(r.avgReturn)],
              ].map(([l,v])=>mRow(l,v)).join('') : '<div style="color:var(--text3);font-size:11px;padding:10px 0;">Sin operaciones</div>'}
            </div>`;
          }).join('')}
        </div>

        <!-- Historial -->
        ${history.length ? `<div class="pm-card2">
          <div class="pm-card2-title">Operaciones cerradas (${history.length})</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px;">
            <thead><tr style="background:var(--surface2);">
              <th style="padding:7px 10px;text-align:left;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">Ticker</th>
              <th style="padding:7px 10px;text-align:right;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">Entrada</th>
              <th style="padding:7px 10px;text-align:right;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">Salida</th>
              <th style="padding:7px 10px;text-align:right;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">Días</th>
              <th style="padding:7px 10px;text-align:right;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">P&L %</th>
              <th style="padding:7px 10px;text-align:right;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">P&L €</th>
            </tr></thead>
            <tbody>
              ${history.map(h => {
                const days = h.entryDateISO&&h.exitDateISO ? Math.round((new Date(h.exitDateISO)-new Date(h.entryDateISO))/86400000) : null;
                const col = h.pnlPct>=0?'var(--green)':'var(--red)';
                return `<tr>
                  <td style="padding:8px 10px;border-bottom:1px solid var(--border);font-weight:700;">${h.ticker} <span style="font-size:9px;color:var(--text3);">${h.direction||'alcista'}</span></td>
                  <td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--mono);font-size:11px;">${fmtDate(h.entryDateISO)}</td>
                  <td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--mono);font-size:11px;">${fmtDate(h.exitDateISO)}</td>
                  <td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--mono);">${days!=null?days+'d':'—'}</td>
                  <td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--mono);font-weight:700;color:${col};">${fmtPct(h.pnlPct)}</td>
                  <td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--mono);font-weight:700;color:${col};">${h.pnlAbs!=null?fmtE(h.pnlAbs):'—'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : ''}
      </div>

      <div style="font-family:var(--mono);font-size:9px;color:var(--text3);text-align:right;margin-top:14px;padding-top:10px;border-top:1px solid var(--border);">
        Valor cartera = capitalInicial + P&L realizado + P&L no realizado · CAGR con 252 sesiones/año · ${new Date().toLocaleString('es-ES')}
      </div>
    `;

    // Tabs
    el.querySelectorAll('.pm-tab2').forEach(tab => {
      tab.addEventListener('click', () => {
        el.querySelectorAll('.pm-tab2').forEach(t => t.classList.remove('active'));
        el.querySelectorAll('.pm-panel2').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        el.querySelector('#pm-panel-' + tab.dataset.tab2)?.classList.add('active');
      });
    });
  }

  document.getElementById('pm-refresh')?.addEventListener('click', load);
  load();
  return { destroy() { document.getElementById('pm-css2')?.remove(); } };
}

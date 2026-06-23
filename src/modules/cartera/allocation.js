// ═══════════════════════════════════════════════
// MÓDULO: Asset Allocation (4.1)
// Universo ampliado: RV, RF, REIT y Commodities (oro, plata,
// petróleo). Motor técnico idéntico al histórico de ETHAN —
// MACD(12,26,9) + Stochastic(89,3,3) + RSI(14) + Precio vs EMA,
// calculado en mensual y semanal, 8 condiciones por activo.
//
// 3 pestañas:
//   1. Dashboard   — decisión RV vs RF (top 2) + position sizing
//                    por inversa de volatilidad sobre todo el
//                    universo con score≥6, más REIT/Commodities
//                    como categorías satélite informativas.
//   2. Parámetros  — gráficos de evolución, momentum, percentiles
//                    52 semanas y matriz de correlaciones.
//   3. Cesta Libre — el usuario añade cualquier ticker + categoría
//                    manual; se reparte el 100% entre ellos por
//                    inversa de volatilidad (sin score, sin cash).
//
// Datos en vivo desde Yahoo Finance vía proxies CORS públicos
// (mismo patrón que el resto de ETHAN: inestables por naturaleza,
// con fallback en cascada y manejo de error visible si todos fallan).
// ═══════════════════════════════════════════════

import Chart from 'chart.js/auto';

// ───────────────────────────────────────────────
// MOTOR TÉCNICO — funciones puras, sin estado
// ───────────────────────────────────────────────
function ema(arr, p) {
  const k = 2/(p+1), out = new Array(arr.length).fill(null);
  let s = arr.findIndex(v => v != null && !isNaN(v));
  if (s < 0) return out;
  out[s] = arr[s];
  for (let i = s+1; i < arr.length; i++) {
    const v = (arr[i] != null && !isNaN(arr[i])) ? arr[i] : out[i-1];
    out[i] = v*k + out[i-1]*(1-k);
  }
  return out;
}
function macd(closes) {
  const ef = ema(closes,12), es = ema(closes,26);
  const m = ef.map((v,i) => (v!=null && es[i]!=null) ? v-es[i] : null);
  const sl = ema(m.map(v => v??0), 9);
  return { m, sl };
}
function rsi(closes, p=14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length < p+1) return out;
  let g=0, l=0;
  for (let i=1; i<=p; i++) { const d=closes[i]-closes[i-1]; d>0?g+=d:l-=d; }
  let ag=g/p, al=l/p;
  out[p] = al===0 ? 100 : 100-(100/(1+ag/al));
  for (let i=p+1; i<closes.length; i++) {
    const d = closes[i]-closes[i-1];
    ag = (ag*(p-1)+(d>0?d:0))/p;
    al = (al*(p-1)+(d<0?-d:0))/p;
    out[i] = al===0 ? 100 : 100-(100/(1+ag/al));
  }
  return out;
}
function stoch(highs, lows, closes, p) {
  const rawK = closes.map((c,i) => {
    if (i<p-1) return null;
    const hh = Math.max(...highs.slice(i-p+1,i+1));
    const ll = Math.min(...lows.slice(i-p+1,i+1));
    return hh===ll ? 50 : (c-ll)/(hh-ll)*100;
  });
  const k = ema(rawK,3);
  const d = ema(k.map(v=>v??0),3);
  return { k, d };
}
function resample(ts, opens, highs, lows, closes, vols, freq) {
  const groups = {};
  ts.forEach((t,i) => {
    const dd = new Date(t*1000);
    let key;
    if (freq==='W') {
      const day = dd.getDay();
      const diff = dd.getDate() - day + (day===0?-6:1);
      const mo = new Date(+dd); mo.setDate(diff);
      key = mo.toISOString().slice(0,10);
    } else {
      key = `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}`;
    }
    if (!groups[key]) {
      groups[key] = { o: opens[i], h: highs[i], l: lows[i], c: closes[i], v: vols[i] };
    } else {
      groups[key].h = Math.max(groups[key].h, highs[i]);
      groups[key].l = Math.min(groups[key].l, lows[i]);
      groups[key].c = closes[i];
      groups[key].v += vols[i];
    }
  });
  const keys = Object.keys(groups).sort();
  return {
    dates: keys,
    opens: keys.map(k=>groups[k].o), highs: keys.map(k=>groups[k].h),
    lows: keys.map(k=>groups[k].l), closes: keys.map(k=>groups[k].c), vols: keys.map(k=>groups[k].v)
  };
}

// ───────────────────────────────────────────────
// UNIVERSO DE ACTIVOS
// ───────────────────────────────────────────────
const ASSETS = [
  { ticker: 'VTI',  name: 'Vanguard Total Stock Market',     type: 'RV', region: '🇺🇸 USA',   category: 'allocation' },
  { ticker: 'VEU',  name: 'Vanguard FTSE All-World ex-US',   type: 'RV', region: '🌍 Mundo',  category: 'allocation' },
  { ticker: 'IEF',  name: 'iShares 7-10Y Treasury Bond',     type: 'RF', region: '🇺🇸 USA',   category: 'allocation' },
  { ticker: 'BNDX', name: 'Vanguard Total Intl Bond',        type: 'RF', region: '🌍 Mundo',  category: 'allocation' },
  { ticker: 'VNQ',  name: 'Vanguard Real Estate ETF',        type: 'REIT', region: '🇺🇸 USA',  category: 'reit' },
  { ticker: 'VNQI', name: 'Vanguard Global ex-US Real Estate', type: 'REIT', region: '🌍 Mundo', category: 'reit' },
  { ticker: 'GLD',  name: 'SPDR Gold Trust',                 type: 'GOLD',   region: '🥇 Oro',      category: 'commodity' },
  { ticker: 'SLV',  name: 'iShares Silver Trust',             type: 'SILVER', region: '🥈 Plata',    category: 'commodity' },
  { ticker: 'USO',  name: 'United States Oil Fund',           type: 'OIL',    region: '🛢️ Petróleo', category: 'commodity' },
  { ticker: 'SPY',       name: 'S&P 500 ETF',                type: 'INDEX', region: '📊 S&P 500', category: 'indicator' },
  { ticker: 'HYG',       name: 'iShares High Yield Corp Bond', type: 'HY',   region: '💳 Corp',    category: 'indicator' },
  { ticker: 'EURUSD=X',  name: 'Euro/Dólar',                 type: 'FX',    region: '💱 FX',       category: 'indicator' }
];

async function fetchData(ticker) {
  const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y&events=history`;
  const proxies = [
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    u => `https://soft-field-156f.miguel-gomez-anton.workers.dev/?url=${encodeURIComponent(u)}`
  ];
  for (const fn of proxies) {
    try {
      const r = await fetch(fn(yUrl), { signal: AbortSignal.timeout(7000) });
      if (!r.ok) continue;
      const text = await r.text();
      let j;
      try { j = JSON.parse(text); } catch (parseErr) { continue; }
      const res = j?.chart?.result?.[0];
      if (!res) continue;
      const q = res.indicators?.quote?.[0];
      if (!q) continue;
      const adj = res.indicators.adjclose?.[0]?.adjclose || q.close;
      const ratio = adj.map((a,i) => (q.close[i] && a) ? a/q.close[i] : 1);
      return {
        timestamps: res.timestamp,
        opens: q.open.map((v,i) => v*ratio[i]),
        highs: q.high.map((v,i) => v*ratio[i]),
        lows: q.low.map((v,i) => v*ratio[i]),
        closes: adj,
        vols: q.volume
      };
    } catch (e) {}
  }
  throw new Error('Error fetching');
}

function analyzeAsset(raw) {
  const { timestamps, opens, highs, lows, closes, vols } = raw;
  const W = resample(timestamps, opens, highs, lows, closes, vols, 'W');
  const M = resample(timestamps, opens, highs, lows, closes, vols, 'M');

  const m_macd = macd(M.closes);
  const m_s89 = stoch(M.highs, M.lows, M.closes, 89);
  const m_rsi = rsi(M.closes, 14);
  const m_ema10 = ema(M.closes, 10);
  const mi = M.closes.length - 1;

  const w_macd = macd(W.closes);
  const w_s89 = stoch(W.highs, W.lows, W.closes, 89);
  const w_rsi = rsi(W.closes, 14);
  const w_ema20 = ema(W.closes, 20);
  const wi = W.closes.length - 1;

  const mc = {
    macd: m_macd.m[mi] > 0 && m_macd.m[mi] > m_macd.sl[mi],
    s89: (m_s89.k[mi] > 80 && m_s89.k[mi] > m_s89.d[mi]) || m_s89.k[mi] > 92,
    rsi: m_rsi[mi] > 65,
    precio: m_ema10[mi] && M.closes[mi] > m_ema10[mi]
  };
  const sc = {
    macd: w_macd.m[wi] > 0 && w_macd.m[wi] > w_macd.sl[wi],
    s89: (w_s89.k[wi] > 85 && w_s89.k[wi] > w_s89.d[wi]) || w_s89.k[wi] > 92,
    rsi: w_rsi[wi] > 67,
    precio: w_ema20[wi] && W.closes[wi] > w_ema20[wi]
  };

  const score = Object.values(mc).filter(x=>x).length + Object.values(sc).filter(x=>x).length;

  const last52w = closes.slice(-252);
  const current = closes[closes.length-1];
  const min52 = Math.min(...last52w);
  const max52 = Math.max(...last52w);
  const percentile = ((current - min52) / (max52 - min52)) * 100;

  return { score, mensual: mc, semanal: sc, price: current, closes: closes.slice(-60), percentile, min52, max52, raw };
}

// ───────────────────────────────────────────────
// POSITION SIZING — inversa de volatilidad
// ───────────────────────────────────────────────
const SIZING_CANDIDATE_TICKERS = ['VTI','VEU','IEF','BNDX','VNQ','VNQI','GLD','SLV','USO'];
const SIZING_SCORE_THRESHOLD = 6;
const SIZING_MAX_WEIGHT = 0.40;

function dailyVolatility(closes) {
  if (!closes || closes.length < 2) return null;
  const returns = [];
  for (let i = 1; i < closes.length; i++) returns.push((closes[i] / closes[i-1]) - 1);
  const mean = returns.reduce((a,b) => a+b, 0) / returns.length;
  const variance = returns.reduce((a,b) => a + Math.pow(b-mean, 2), 0) / returns.length;
  return Math.sqrt(variance);
}

function calculatePositionSizing(allData) {
  const candidates = allData.filter(a =>
    SIZING_CANDIDATE_TICKERS.includes(a.ticker) &&
    a.score >= SIZING_SCORE_THRESHOLD &&
    a.closes && a.closes.length >= 30
  );

  if (candidates.length === 0) return { cashPct: 100, positions: [], scoreMedio: 0 };

  const scoreMedio = candidates.reduce((s,a) => s + a.score, 0) / candidates.length;
  let cashPct = ((8 - scoreMedio) / 8) * 100;
  cashPct = Math.max(0, Math.min(100, cashPct));
  const investedPct = 100 - cashPct;

  const withVol = candidates.map(a => ({ ...a, vol: dailyVolatility(a.closes) })).filter(a => a.vol && a.vol > 0);
  if (withVol.length === 0) return { cashPct: 100, positions: [], scoreMedio };

  const invVols = withVol.map(a => 1 / a.vol);
  const sumInvVol = invVols.reduce((a,b) => a+b, 0);

  let positions = withVol.map((a, i) => ({
    ticker: a.ticker, name: a.name, type: a.type, region: a.region,
    score: a.score, vol: a.vol, weightPct: (invVols[i] / sumInvVol) * investedPct
  }));

  const effectiveMaxWeight = Math.max(SIZING_MAX_WEIGHT, 1 / positions.length);
  for (let iter = 0; iter < 10; iter++) {
    const capWeight = effectiveMaxWeight * investedPct;
    const over = positions.filter(p => p.weightPct > capWeight);
    if (over.length === 0) break;
    let excess = 0;
    positions.forEach(p => { if (p.weightPct > capWeight) { excess += p.weightPct - capWeight; p.weightPct = capWeight; } });
    const under = positions.filter(p => p.weightPct < capWeight);
    const underSum = under.reduce((s,p) => s + p.weightPct, 0);
    if (underSum === 0 || under.length === 0) break;
    under.forEach(p => { p.weightPct += (p.weightPct / underSum) * excess; });
  }

  positions.sort((a,b) => b.weightPct - a.weightPct);
  return { cashPct, positions, scoreMedio };
}

function calculateBasketSizing(results) {
  const withVol = results
    .filter(a => !a.error && a.closes && a.closes.length >= 30)
    .map(a => ({ ...a, vol: dailyVolatility(a.closes) }))
    .filter(a => a.vol && a.vol > 0);

  if (withVol.length === 0) return { positions: [], failed: results.filter(a => a.error) };

  const invVols = withVol.map(a => 1 / a.vol);
  const sumInvVol = invVols.reduce((a,b) => a+b, 0);

  let positions = withVol.map((a, i) => ({
    ticker: a.ticker, category: a.category, vol: a.vol, weightPct: (invVols[i] / sumInvVol) * 100
  }));

  const effectiveMaxWeight = Math.max(SIZING_MAX_WEIGHT, 1 / positions.length);
  const capWeight = effectiveMaxWeight * 100;
  for (let iter = 0; iter < 10; iter++) {
    const over = positions.filter(p => p.weightPct > capWeight);
    if (over.length === 0) break;
    let excess = 0;
    positions.forEach(p => { if (p.weightPct > capWeight) { excess += p.weightPct - capWeight; p.weightPct = capWeight; } });
    const under = positions.filter(p => p.weightPct < capWeight);
    const underSum = under.reduce((s,p) => s + p.weightPct, 0);
    if (underSum === 0 || under.length === 0) break;
    under.forEach(p => { p.weightPct += (p.weightPct / underSum) * excess; });
  }

  positions.sort((a,b) => b.weightPct - a.weightPct);
  return { positions, failed: results.filter(a => a.error) };
}

// ───────────────────────────────────────────────
// DONUT CHART — agrupado por categoría macro
// ───────────────────────────────────────────────
const CATEGORY_COLORS = { RV: '#40d9c0', RF: '#5fa8e0', REIT: '#a78bfa', Commodity: '#fbbf24', Otro: '#9ca3af', Cash: '#3d6460' };
const CATEGORY_LABELS = { RV: 'RV', RF: 'RF', REIT: 'REIT', Commodity: 'Commodities', Otro: 'Otro', Cash: 'Cash' };
const BASKET_CATEGORY_COLORS = { RV: '#40d9c0', RF: '#5fa8e0', REIT: '#a78bfa', Commodity: '#fbbf24', Otro: '#9ca3af' };

function dashboardTypeToCategory(type) {
  if (type === 'GOLD' || type === 'SILVER' || type === 'OIL') return 'Commodity';
  return type;
}

function groupByCategory(items, cashPct) {
  const totals = {};
  items.forEach(it => { totals[it.category] = (totals[it.category] || 0) + it.pct; });
  const segments = Object.entries(totals).map(([cat, pct]) => ({
    label: CATEGORY_LABELS[cat] || cat, pct, color: CATEGORY_COLORS[cat] || '#9ca3af'
  }));
  if (cashPct && cashPct > 0.5) segments.push({ label: CATEGORY_LABELS.Cash, pct: cashPct, color: CATEGORY_COLORS.Cash });
  return segments.sort((a,b) => b.pct - a.pct);
}

function drawDonutChart(canvas, segments) {
  if (!canvas) return null;
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: segments.map(s => s.label),
      datasets: [{ data: segments.map(s => s.pct), backgroundColor: segments.map(s => s.color), borderColor: '#0b1f1f', borderWidth: 2 }]
    },
    options: {
      responsive: true,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#ffffff',
            font: { size: 11, family: "'IBM Plex Mono', monospace" },
            boxWidth: 11,
            padding: 12,
            generateLabels: (chart) => {
              const data = chart.data;
              return data.labels.map((label, i) => ({
                text: `${label}  ${data.datasets[0].data[i].toFixed(1)}%`,
                fillStyle: data.datasets[0].backgroundColor[i],
                strokeStyle: data.datasets[0].backgroundColor[i],
                fontColor: '#ffffff',
                color: '#ffffff',
                index: i
              }));
            }
          }
        },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed.toFixed(1)}%` } }
      }
    }
  });
}

function correlationCoef(x, y) {
  const n = Math.min(x.length, y.length);
  const meanX = x.reduce((a,b)=>a+b,0)/n;
  const meanY = y.reduce((a,b)=>a+b,0)/n;
  let num=0, denX=0, denY=0;
  for (let i=0; i<n; i++) {
    const dx = x[i]-meanX, dy = y[i]-meanY;
    num += dx*dy; denX += dx*dx; denY += dy*dy;
  }
  return denX===0 || denY===0 ? 0 : num/Math.sqrt(denX*denY);
}

function calculateCorrelationMatrix(assets) {
  const n = assets.length;
  const matrix = Array(n).fill(0).map(() => Array(n).fill(NaN));
  const minLen = Math.min(...assets.map(a => a.closes ? a.closes.length : 0));
  if (minLen < 2) return matrix;
  const allReturns = assets.map(a => {
    const cl = a.closes.slice(-minLen);
    return cl.map((c,k) => k > 0 ? (c / cl[k-1]) - 1 : null).slice(1);
  });
  for (let i=0; i<n; i++) {
    for (let j=0; j<n; j++) {
      if (i===j) matrix[i][j] = 1;
      else if (allReturns[i] && allReturns[j]) matrix[i][j] = correlationCoef(allReturns[i], allReturns[j]);
    }
  }
  return matrix;
}

function scoreClass(score) {
  return score >= 6 ? 's-high' : score >= 4 ? 's-mid' : 's-low';
}

function condRow(a) {
  if (!a.mensual) return '';
  return `
    <div class="aa-cond-row">
      <span class="aa-cond-mini ${a.mensual.macd?'ok':''}">M·MACD</span>
      <span class="aa-cond-mini ${a.mensual.s89?'ok':''}">M·S89</span>
      <span class="aa-cond-mini ${a.mensual.rsi?'ok':''}">M·RSI</span>
      <span class="aa-cond-mini ${a.mensual.precio?'ok':''}">M·P&gt;EMA</span>
      <span class="aa-cond-mini ${a.semanal.macd?'ok':''}">W·MACD</span>
      <span class="aa-cond-mini ${a.semanal.s89?'ok':''}">W·S89</span>
      <span class="aa-cond-mini ${a.semanal.rsi?'ok':''}">W·RSI</span>
      <span class="aa-cond-mini ${a.semanal.precio?'ok':''}">W·P&gt;EMA</span>
    </div>
  `;
}

function assetCard(a, selected) {
  return `
    <div class="aa-asset-card ${selected ? 'selected' : ''}">
      <div class="aa-asset-top">
        <div>
          <div class="aa-asset-ticker">${a.ticker.replace('=X','')}</div>
          <div class="aa-asset-region">${a.region}</div>
        </div>
        <div class="aa-asset-score ${scoreClass(a.score)}">${a.score}<span class="aa-asset-score-max">/8</span></div>
      </div>
      ${condRow(a)}
    </div>
  `;
}

// ═══════════════════════════════════════════════
// RENDER — punto de entrada del módulo
// ═══════════════════════════════════════════════
export async function render(container, { actionsSlot }) {
  let allData = null;
  let currentTab = 'core';
  let coreSizing = null;
  let corePct = parseInt(localStorage.getItem('ethan_core_pct') ?? '70', 10);
  let basketAssets = [];
  try {
    basketAssets = JSON.parse(localStorage.getItem('ethan_satelite_assets') || '[]');
  } catch (e) { basketAssets = []; }
  let basketResults = null;
  let basketRawResults = null; // datos completos de Yahoo para métricas
  let chartInstances = {};

  actionsSlot.innerHTML = `
    <span class="last-update" id="aa-last-update"></span>
    <button class="btn btn-primary" id="aa-btn-refresh">↻ Actualizar</button>
  `;

  container.innerHTML = `
    <div class="aa-tabs">
      <button class="aa-tab active" data-tab="core">Cartera CORE</button>
      <button class="aa-tab" data-tab="params">Parámetros</button>
      <button class="aa-tab" data-tab="satelite">Cartera Satélite</button>
    </div>
    <div id="aa-content">
      <div class="empty">
        <div class="loader-ring"></div>
        <div class="empty-title">Analizando mercados</div>
        <div class="empty-desc">Trayendo precios y calculando señales técnicas...</div>
      </div>
    </div>
  `;

  const contentEl = document.getElementById('aa-content');

  function destroyChart(id) {
    if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
  }

  async function runAnalysis() {
    contentEl.innerHTML = `
      <div class="empty">
        <div class="loader-ring"></div>
        <div class="empty-title">Analizando mercados</div>
        <div class="empty-desc">Trayendo precios y calculando señales técnicas...</div>
      </div>
    `;

    const results = await Promise.all(ASSETS.map(async (asset, i) => {
      await new Promise(r => setTimeout(r, i * 150));
      try {
        const raw = await fetchData(asset.ticker);
        const analysis = analyzeAsset(raw);
        return { ...asset, ...analysis };
      } catch (err) {
        return { ...asset, score: 0, error: err.message };
      }
    }));

    allData = results;

    const failedCount = results.filter(a => a.error).length;
    if (failedCount === results.length) {
      contentEl.innerHTML = `
        <div class="empty">
          <div class="empty-title">No se pudieron cargar los datos</div>
          <div class="empty-desc">
            Los proxies CORS públicos que traen los precios de Yahoo Finance no han respondido.
            Esto pasa de vez en cuando porque son servicios gratuitos de terceros, no algo roto en el código.
            Prueba a pulsar "Actualizar" de nuevo en unos segundos.
          </div>
        </div>
      `;
      return;
    }

    const allocationAssets = results.filter(a => a.category === 'allocation');
    const reitAssets = results.filter(a => a.category === 'reit');
    const commodityAssets = results.filter(a => a.category === 'commodity');
    const indicators = results.filter(a => a.category === 'indicator');

    allocationAssets.sort((a,b) => b.score - a.score);
    const top2 = allocationAssets.slice(0, 2);
    const rfCount = top2.filter(a => a.type === 'RF').length;
    const rvCount = top2.filter(a => a.type === 'RV').length;

    let recommendation;
    if (rvCount === 2) recommendation = { type: 'RV', label: 'Renta Variable', class: 'green', desc: 'Los 2 más fuertes son RV' };
    else if (rfCount === 2) recommendation = { type: 'RF', label: 'Renta Fija', class: 'blue', desc: 'Los 2 más fuertes son RF' };
    else recommendation = { type: 'NEUTRO', label: 'Mixto', class: 'amber', desc: '1 RF + 1 RV' };

    const gold = commodityAssets.find(i => i.ticker === 'GLD');
    const silver = commodityAssets.find(i => i.ticker === 'SLV');
    const oil = commodityAssets.find(i => i.ticker === 'USO');
    const hy = indicators.find(i => i.ticker === 'HYG');
    const fx = indicators.find(i => i.ticker === 'EURUSD=X');
    const sizing = calculatePositionSizing(allData);
    coreSizing = sizing;

    renderDashboard({ allocationAssets, top2, recommendation, reitAssets, gold, silver, oil, hy, fx, sizing });

    const lastUpdateEl = document.getElementById('aa-last-update');
    if (lastUpdateEl) lastUpdateEl.textContent = 'Última actualización: ' + new Date().toLocaleString('es-ES');
  }

  // ───────────────────────────────────────────────
  // MÉTRICAS DE RIESGO DE CARTERA
  // Todas calculadas sobre datos diarios del último año (≈252 días).
  // Se calculan sobre la serie de retornos diarios de la cartera
  // ponderada, no sobre activos individuales.
  // ───────────────────────────────────────────────

  /**
   * Construye la serie de retornos diarios de la cartera ponderada.
   * Usa los datos brutos (raw.closes completo, no solo los últimos 60)
   * para tener máximo histórico disponible (~252 días).
   */
  function portfolioReturns(positions, dataSource) {
    const posData = positions.map(p => {
      const asset = (dataSource || allData).find(a => a.ticker === p.ticker);
      // Preferir raw.closes (datos completos) sobre closes (recortado a 60 días)
      const closes = asset?.raw?.closes || asset?.closes || [];
      return { weight: p.weightPct / 100, closes };
    }).filter(p => p.closes.length > 20);

    if (posData.length === 0) return [];

    const minLen = Math.min(...posData.map(p => p.closes.length));
    const n = Math.min(minLen, 252);

    const returns = [];
    for (let i = 1; i < n; i++) {
      let dayReturn = 0;
      posData.forEach(p => {
        const idx = p.closes.length - n + i;
        if (idx > 0 && p.closes[idx] && p.closes[idx-1]) {
          dayReturn += p.weight * ((p.closes[idx] / p.closes[idx-1]) - 1);
        }
      });
      returns.push(dayReturn);
    }
    return returns;
  }

  function calcVolAnualizada(returns) {
    if (returns.length < 5) return null;
    const mean = returns.reduce((a,b) => a+b, 0) / returns.length;
    const variance = returns.reduce((a,b) => a + Math.pow(b-mean, 2), 0) / returns.length;
    return Math.sqrt(variance * 252) * 100; // anualizada en %
  }

  function calcMaxDrawdown(returns) {
    if (returns.length < 2) return null;
    let peak = 1, value = 1, maxDD = 0;
    returns.forEach(r => {
      value *= (1 + r);
      if (value > peak) peak = value;
      const dd = (value - peak) / peak;
      if (dd < maxDD) maxDD = dd;
    });
    return maxDD * 100; // en %, negativo
  }

  function calcBestWorstMonth(returns) {
    if (returns.length < 20) return { best: null, worst: null };
    // Agrupar retornos en bloques de ~21 días (mes de trading)
    const months = [];
    for (let i = 0; i < returns.length; i += 21) {
      const slice = returns.slice(i, i + 21);
      if (slice.length < 5) continue;
      const monthReturn = slice.reduce((acc, r) => acc * (1 + r), 1) - 1;
      months.push(monthReturn * 100);
    }
    if (months.length === 0) return { best: null, worst: null };
    return { best: Math.max(...months), worst: Math.min(...months) };
  }

  function calcSharpe(returns, riskFreeAnnual = 0.045) {
    if (returns.length < 20) return null;
    const riskFreeDaily = riskFreeAnnual / 252;
    const excess = returns.map(r => r - riskFreeDaily);
    const meanExcess = excess.reduce((a,b) => a+b, 0) / excess.length;
    const std = Math.sqrt(excess.reduce((a,b) => a + Math.pow(b - meanExcess, 2), 0) / excess.length);
    if (std === 0) return null;
    return (meanExcess / std) * Math.sqrt(252);
  }

  function calcSortino(returns, riskFreeAnnual = 0.045) {
    if (returns.length < 20) return null;
    const riskFreeDaily = riskFreeAnnual / 252;
    const excess = returns.map(r => r - riskFreeDaily);
    const meanExcess = excess.reduce((a,b) => a+b, 0) / excess.length;
    const downside = excess.filter(r => r < 0);
    if (downside.length === 0) return null;
    const downsideStd = Math.sqrt(downside.reduce((a,b) => a + b*b, 0) / excess.length);
    if (downsideStd === 0) return null;
    return (meanExcess / downsideStd) * Math.sqrt(252);
  }

  function renderMetricsBlock(sizing, label, donutId, dataSource = null) {
    if (!sizing || sizing.positions.length === 0) return '';

    const returns = portfolioReturns(sizing.positions, dataSource);
    if (returns.length < 20) return '';

    const vol = calcVolAnualizada(returns);
    const mdd = calcMaxDrawdown(returns);
    const { best, worst } = calcBestWorstMonth(returns);
    const sharpe = calcSharpe(returns);
    const sortino = calcSortino(returns);

    const fmt = (v, decimals = 2, suffix = '%') =>
      v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}${suffix}`;

    const metricColor = (v, goodHigh) => {
      if (v === null) return 'var(--text3)';
      return goodHigh ? (v >= 0 ? 'var(--green)' : 'var(--red)') : (v <= -15 ? 'var(--red)' : v <= -8 ? 'var(--amber)' : 'var(--green)');
    };

    const sharpeColor = sharpe === null ? 'var(--text3)' : sharpe >= 1 ? 'var(--green)' : sharpe >= 0.5 ? 'var(--amber)' : 'var(--red)';
    const volColor = vol === null ? 'var(--text3)' : vol <= 10 ? 'var(--green)' : vol <= 18 ? 'var(--amber)' : 'var(--red)';

    return `
      <div class="section-title" style="margin-top:26px;">Métricas de Riesgo · ${label} <span class="count">últimos 12 meses · pesos actuales fijos</span></div>
      <div class="aa-metrics-grid">
        <div class="aa-metric-card">
          <div class="aa-metric-label">Volatilidad Anualizada</div>
          <div class="aa-metric-value" style="color:${volColor}">${vol !== null ? vol.toFixed(1) + '%' : '—'}</div>
          <div class="aa-metric-sub">desv. estándar × √252</div>
        </div>
        <div class="aa-metric-card">
          <div class="aa-metric-label">Maximum Drawdown</div>
          <div class="aa-metric-value" style="color:${metricColor(mdd, false)}">${mdd !== null ? mdd.toFixed(2) + '%' : '—'}</div>
          <div class="aa-metric-sub">peor caída desde pico</div>
        </div>
        <div class="aa-metric-card">
          <div class="aa-metric-label">Mejor Mes</div>
          <div class="aa-metric-value" style="color:var(--green)">${best !== null ? '+' + best.toFixed(2) + '%' : '—'}</div>
          <div class="aa-metric-sub">retorno mensual máximo</div>
        </div>
        <div class="aa-metric-card">
          <div class="aa-metric-label">Peor Mes</div>
          <div class="aa-metric-value" style="color:var(--red)">${worst !== null ? worst.toFixed(2) + '%' : '—'}</div>
          <div class="aa-metric-sub">retorno mensual mínimo</div>
        </div>
        <div class="aa-metric-card">
          <div class="aa-metric-label">Sharpe Ratio</div>
          <div class="aa-metric-value" style="color:${sharpeColor}">${sharpe !== null ? sharpe.toFixed(2) : '—'}</div>
          <div class="aa-metric-sub">rf = 4.5% · >1 = bueno</div>
        </div>
        <div class="aa-metric-card">
          <div class="aa-metric-label">Sortino Ratio</div>
          <div class="aa-metric-value" style="color:${sharpe !== null ? (sortino >= 1 ? 'var(--green)' : sortino >= 0.5 ? 'var(--amber)' : 'var(--red)') : 'var(--text3)'}">${sortino !== null ? sortino.toFixed(2) : '—'}</div>
          <div class="aa-metric-sub">solo penaliza vol bajista</div>
        </div>
      </div>
      <div style="font-size:9px;color:var(--text3);margin-top:6px;font-family:var(--mono);">
        ⚠ Métricas calculadas con pesos actuales fijos sobre datos históricos de 12 meses. No representan rentabilidad pasada real con rebalanceos.
      </div>
    `;
  }

  function renderSplitBanner() {
    const satPct = 100 - corePct;
    return `
      <div class="aa-split-banner">
        <div class="aa-split-title">Distribución Capital Total</div>
        <div class="aa-split-bar">
          <div class="aa-split-seg core" style="width:${corePct}%">
            <span class="aa-split-label">CORE ${corePct}%</span>
          </div>
          <div class="aa-split-seg satelite" style="width:${satPct}%">
            <span class="aa-split-label">Satélite ${satPct}%</span>
          </div>
        </div>
        <div class="aa-split-controls">
          <span class="aa-split-hint">Arrastra para ajustar</span>
          <input type="range" id="aa-split-slider" min="50" max="90" step="5" value="${corePct}" class="aa-split-slider">
          <span class="aa-split-value" id="aa-split-value">${corePct} / ${satPct}</span>
        </div>
      </div>
    `;
  }

  function attachSplitListener() {
    const slider = document.getElementById('aa-split-slider');
    if (!slider) return;
    slider.addEventListener('input', () => {
      corePct = parseInt(slider.value, 10);
      localStorage.setItem('ethan_core_pct', corePct);
      const satPct = 100 - corePct;
      const valueEl = document.getElementById('aa-split-value');
      if (valueEl) valueEl.textContent = `${corePct} / ${satPct}`;
      const coreSeg = document.querySelector('.aa-split-seg.core');
      const satSeg = document.querySelector('.aa-split-seg.satelite');
      if (coreSeg) { coreSeg.style.width = corePct + '%'; coreSeg.querySelector('.aa-split-label').textContent = `CORE ${corePct}%`; }
      if (satSeg) { satSeg.style.width = satPct + '%'; satSeg.querySelector('.aa-split-label').textContent = `Satélite ${satPct}%`; }
    });
  }

  function renderSizingBlock(sizing) {
    if (!sizing || sizing.positions.length === 0) {
      return `
        <div class="aa-sizing-block">
          <div class="section-title">Cartera CORE <span class="count">inversa de volatilidad</span></div>
          <div class="aa-cash-banner">
            <div class="aa-cash-icon">💵</div>
            <div>
              <div class="aa-cash-title">100% Cash · En espera de señal</div>
              <div class="aa-cash-desc">Ningún activo del universo CORE alcanza el score mínimo (≥6/8). El sistema indica mantenerse en liquidez hasta que las condiciones mejoren.</div>
            </div>
          </div>
        </div>
      `;
    }

    const palette = { RV: '#40d9c0', RF: '#5fa8e0', REIT: '#a78bfa', GOLD: '#fbbf24', SILVER: '#9ca3af', OIL: '#f47174' };
    const segments = [...sizing.positions.map(p => ({ label: p.ticker, pct: p.weightPct, color: palette[p.type] || 'var(--text2)' }))];
    if (sizing.cashPct > 0.5) segments.push({ label: 'CASH', pct: sizing.cashPct, color: 'var(--text3)' });

    const barHTML = segments.map(s => `<div class="aa-sizing-seg" style="width:${s.pct}%;background:${s.color};" title="${s.label}: ${s.pct.toFixed(1)}%"></div>`).join('');

    const cardsHTML = sizing.positions.map(p => `
      <div class="aa-sizing-card">
        <div class="aa-sizing-card-top">
          <span class="aa-sizing-dot" style="background:${palette[p.type] || 'var(--text2)'}"></span>
          <span class="aa-sizing-ticker">${p.ticker}</span>
        </div>
        <div class="aa-sizing-pct">${p.weightPct.toFixed(1)}<span class="aa-sizing-pct-sym">%</span></div>
        <div class="aa-sizing-meta">${p.region} · score ${p.score}/8</div>
        <div class="aa-sizing-meta-vol">vol 60d: ${(p.vol * 100).toFixed(2)}%/día</div>
      </div>
    `).join('') + (sizing.cashPct > 0.5 ? `
      <div class="aa-sizing-card cash">
        <div class="aa-sizing-card-top">
          <span class="aa-sizing-dot" style="background:var(--text3)"></span>
          <span class="aa-sizing-ticker">CASH</span>
        </div>
        <div class="aa-sizing-pct" style="color:var(--text3)">${sizing.cashPct.toFixed(1)}<span class="aa-sizing-pct-sym">%</span></div>
        <div class="aa-sizing-meta">liquidez · convicción media ${sizing.scoreMedio.toFixed(1)}/8</div>
      </div>
    ` : '');

    return `
      <div class="aa-sizing-block">
        <div class="section-title">Cartera CORE <span class="count">inversa de volatilidad · score≥6</span></div>
        <div class="aa-sizing-layout">
          <div class="aa-sizing-main">
            <div class="aa-sizing-bar">${barHTML}</div>
            <div class="aa-sizing-grid">${cardsHTML}</div>
            <div class="aa-sizing-note">Menos volátil → más peso (desviación estándar de retornos diarios, 60 sesiones). Cash% = (8 − score medio) / 8. Tope de concentración: 40% por activo.</div>
          </div>
          <div class="aa-sizing-donut-wrap"><canvas id="aa-donut-dashboard"></canvas></div>
        </div>
      </div>
    `;
  }

  function renderDashboard({ allocationAssets, top2, recommendation, reitAssets, gold, silver, oil, hy, fx, sizing }) {
    const recessionClass = hy && hy.score <= 3 ? 'red' : hy && hy.score <= 5 ? 'amber' : 'green';
    const recessionLabel = hy && hy.score <= 3 ? 'Alto' : hy && hy.score <= 5 ? 'Moderado' : 'Bajo';
    const hedgeClass = fx && fx.score >= 6 ? 'red' : fx && fx.score >= 4 ? 'amber' : 'green';
    const hedgeLabel = fx && fx.score >= 6 ? 'Sí cubrir' : fx && fx.score >= 4 ? 'Vigilar' : 'No cubrir';

    const warnings = [];
    if (gold && gold.score >= 7) warnings.push({ type:'caution', icon:'🥇', text:'<strong>Oro en máximos:</strong> mercado buscando refugio, incertidumbre elevada. Validar posiciones de riesgo.' });
    if (silver && gold && silver.score >= 7 && gold.score >= 7) warnings.push({ type:'caution', icon:'🥈', text:'<strong>Oro y plata fuertes a la vez:</strong> señal de refugio amplificada, no solo institucional (oro) sino también especulativa (plata).' });
    if (recommendation.type === 'RV' && hy && hy.score <= 4) warnings.push({ type:'alert', icon:'⚠️', text:'<strong>Divergencia detectada:</strong> Renta Variable fuerte pero High Yield débil. Señal contradictoria — extrema precaución.' });
    if (oil && oil.score >= 7) warnings.push({ type:'caution', icon:'🛢️', text:'<strong>Commodities en fuerza:</strong> petróleo muy fuerte, posible presión inflacionaria. Vigilar política monetaria.' });
    if (recommendation.type === 'RV' && hy && hy.score >= 6 && gold && gold.score <= 4) warnings.push({ type:'ok', icon:'✓', text:'<strong>Entorno favorable:</strong> RV fuerte, crédito sano, sin búsqueda de refugio. Condiciones óptimas para posiciones alcistas.' });
    if (recommendation.type === 'RF' && gold && gold.score >= 6) warnings.push({ type:'alert', icon:'🛡️', text:'<strong>Modo defensivo total:</strong> RF + Oro fuertes. Mercado en máxima aversión al riesgo.' });
    if (fx && fx.score >= 7) warnings.push({ type:'alert', icon:'💱', text:'<strong>Euro muy fuerte vs Dólar:</strong> impacto negativo en inversiones USD sin cobertura. Implementar hedge.' });
    if (oil && oil.score <= 3) warnings.push({ type:'caution', icon:'📉', text:'<strong>Petróleo débil:</strong> posible desaceleración económica o exceso de oferta.' });
    if (hy && hy.score <= 2) warnings.push({ type:'alert', icon:'🚨', text:'<strong>Alerta crítica:</strong> High Yield colapsando, estrés severo en crédito. Reducir exposición a riesgo inmediatamente.' });
    const reitTop = reitAssets.slice().sort((a,b)=>b.score-a.score)[0];
    if (reitTop && reitTop.score >= 7 && recommendation.type !== 'RV') warnings.push({ type:'caution', icon:'🏢', text:`<strong>REITs fuertes (${reitTop.ticker}) pese a allocation no-RV:</strong> posible rotación sectorial temprana hacia inmobiliario. Vigilar si se confirma en próximas semanas.` });

    const sizingHTML = renderSizingBlock(sizing);
    const splitHTML = renderSplitBanner();
    const metricsHTML = renderMetricsBlock(sizing, 'Cartera CORE', 'aa-donut-dashboard');

    contentEl.innerHTML = `
      <div class="aa-tab-panel">
        ${splitHTML}
        ${sizingHTML}
        ${metricsHTML}

        ${warnings.length > 0 ? `
          <div class="aa-warnings">
            ${warnings.map(w => `
              <div class="aa-warning-item ${w.type}">
                <div class="aa-warning-icon">${w.icon}</div>
                <div class="aa-warning-text">${w.text}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="aa-decision-row">
          <div class="aa-decision-card ${recommendation.class}">
            <div class="aa-decision-label">Decisión de Inversión</div>
            <div class="aa-decision-value ${recommendation.class}">${recommendation.label}</div>
            <div class="aa-decision-desc">${recommendation.desc}</div>
          </div>
          <div class="aa-decision-card ${recessionClass}">
            <div class="aa-decision-label">Riesgo de Recesión</div>
            <div class="aa-decision-value ${recessionClass}">${recessionLabel}</div>
            <div class="aa-decision-desc">${hy ? 'HYG Score: ' + hy.score + '/8' : 'Analizando...'}</div>
          </div>
          <div class="aa-decision-card ${hedgeClass}">
            <div class="aa-decision-label">Cobertura Cambiaria</div>
            <div class="aa-decision-value ${hedgeClass}">${hedgeLabel}</div>
            <div class="aa-decision-desc">${fx ? 'EUR/USD Score: ' + fx.score + '/8' : 'Analizando...'}</div>
          </div>
        </div>

        <div class="section-title">Renta Variable vs Renta Fija <span class="count">decisión principal</span></div>
        <div class="aa-asset-grid">${allocationAssets.map(a => assetCard(a, top2.includes(a))).join('')}</div>

        <div class="section-title" style="margin-top:24px;">Inmobiliario (REIT) <span class="count">satélite — informativo</span></div>
        <div class="aa-asset-grid">${reitAssets.map(a => assetCard(a, false)).join('')}</div>

        <div class="section-title" style="margin-top:24px;">Commodities &amp; Contexto <span class="count">satélite — informativo</span></div>
        <div class="aa-asset-grid satellite">${[gold, silver, oil].filter(Boolean).map(a => assetCard(a, false)).join('')}</div>
        <div class="aa-asset-grid satellite" style="margin-top:12px;">${[allData.find(a => a.ticker === 'SPY'), hy, fx].filter(Boolean).map(a => assetCard(a, false)).join('')}</div>
      </div>
    `;

    if (sizing && sizing.positions.length > 0) {
      const donutSegments = groupByCategory(
        sizing.positions.map(p => ({ category: dashboardTypeToCategory(p.type), pct: p.weightPct })),
        sizing.cashPct
      );
      destroyChart('aa-donut-dashboard');
      const canvas = document.getElementById('aa-donut-dashboard');
      if (canvas) chartInstances['aa-donut-dashboard'] = drawDonutChart(canvas, donutSegments);
    }
    attachSplitListener();
  }

  function renderParameters() {
    if (!allData) {
      contentEl.innerHTML = `<div class="aa-tab-panel"><div class="empty"><div class="empty-title">Sin datos todavía</div></div></div>`;
      return;
    }

    contentEl.innerHTML = `
      <div class="aa-tab-panel">
        <div class="aa-charts-grid">
          <div class="aa-chart-card">
            <div class="aa-chart-title">Evolución Normalizada (60d)</div>
            <canvas id="aa-evolution-chart"></canvas>
          </div>
          <div class="aa-chart-card">
            <div class="aa-chart-title">Momentum (% cambio 20d)</div>
            <canvas id="aa-momentum-chart"></canvas>
          </div>
        </div>

        <div class="aa-data-table-wrap">
          <div class="aa-chart-title">Análisis 52 Semanas</div>
          <table class="data-table">
            <thead><tr><th>Ticker</th><th>Precio</th><th>Min 52w</th><th>Max 52w</th><th>Percentil</th><th>Posición</th></tr></thead>
            <tbody>
              ${allData.map(a => `
                <tr>
                  <td style="font-family:var(--mono);font-weight:500;">${a.ticker.replace('=X','')}</td>
                  <td>$${a.price?.toFixed(2) || 'N/A'}</td>
                  <td>$${a.min52?.toFixed(2) || 'N/A'}</td>
                  <td>$${a.max52?.toFixed(2) || 'N/A'}</td>
                  <td>${a.percentile?.toFixed(0) || 'N/A'}%</td>
                  <td><div class="aa-pctl-bar"><div class="aa-pctl-fill" style="width:${a.percentile || 0}%"></div></div></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="aa-chart-card">
          <div class="aa-chart-title">Matriz de Correlaciones (60 días)</div>
          <div id="aa-correlation-matrix"></div>
        </div>
      </div>
    `;

    drawParameterCharts();
  }

  function drawParameterCharts() {
    destroyChart('aa-evolution-chart');
    destroyChart('aa-momentum-chart');
    if (!allData) return;

    const validAssets = allData.filter(a => a.closes && a.closes.length > 0);
    const labels = Array.from({length:60}, (_,i) => `-${60-i}d`);
    const palette = ['#40d9c0','#5fa8e0','#fbbf24','#f47174','#4ade80','#a78bfa','#f0a8d0','#ffffff','#9ca3af'];

    const evCanvas = document.getElementById('aa-evolution-chart');
    if (evCanvas) {
      chartInstances['aa-evolution-chart'] = new Chart(evCanvas, {
        type: 'line',
        data: {
          labels,
          datasets: validAssets.slice(0,9).map((a,i) => ({
            label: a.ticker.replace('=X',''),
            data: a.closes.map(c => ((c / a.closes[0]) - 1) * 100),
            borderColor: palette[i % palette.length],
            tension: 0.4, borderWidth: 1.8, pointRadius: 0
          }))
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: '#d0e8e4', font: { size: 9 }, boxWidth: 10 } } },
          scales: {
            y: { ticks: { color: '#7aada6', callback: v => v + '%' }, grid: { color: '#1a3c3c' } },
            x: { ticks: { color: '#7aada6', maxTicksLimit: 10 }, grid: { color: '#1a3c3c' } }
          }
        }
      });
    }

    const momentum = validAssets.map(a => {
      const recent = a.closes.slice(-20);
      return recent.length > 0 ? ((recent[recent.length-1] / recent[0]) - 1) * 100 : 0;
    });

    const moCanvas = document.getElementById('aa-momentum-chart');
    if (moCanvas) {
      chartInstances['aa-momentum-chart'] = new Chart(moCanvas, {
        type: 'bar',
        data: {
          labels: validAssets.map(a => a.ticker.replace('=X','')),
          datasets: [{ label: '% Cambio 20d', data: momentum, backgroundColor: momentum.map(m => m > 0 ? '#4ade80' : '#f47174') }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { ticks: { color: '#7aada6', callback: v => v + '%' }, grid: { color: '#1a3c3c' } },
            x: { ticks: { color: '#7aada6', font: { size: 9 } }, grid: { color: '#1a3c3c' } }
          }
        }
      });
    }

    const tickers = validAssets.map(a => a.ticker.replace('=X',''));
    const corr = calculateCorrelationMatrix(validAssets);
    let corrHTML = `<div style="display:grid;grid-template-columns:50px repeat(${tickers.length},1fr);gap:2px;font-family:var(--mono);font-size:9px;">`;
    corrHTML += '<div></div>' + tickers.map(t => `<div style="text-align:center;font-weight:600;color:var(--text2);padding:4px 0;">${t}</div>`).join('');
    tickers.forEach((t1,i) => {
      corrHTML += `<div style="font-weight:600;padding:4px;color:var(--text2);">${t1}</div>`;
      tickers.forEach((t2,j) => {
        const val = corr[i][j];
        const color = val > 0.7 ? 'var(--green)' : val > 0.3 ? 'var(--blue)' : val < -0.3 ? 'var(--red)' : 'var(--text3)';
        corrHTML += `<div style="background:${color}1a;color:${color};text-align:center;padding:5px 2px;border-radius:3px;">${val.toFixed(2)}</div>`;
      });
    });
    corrHTML += '</div>';
    const matrixEl = document.getElementById('aa-correlation-matrix');
    if (matrixEl) matrixEl.innerHTML = corrHTML;
  }

  function saveBasketToStorage() {
    localStorage.setItem('ethan_satelite_assets', JSON.stringify(basketAssets));
  }

  function renderBasketTab() {
    const chipsHTML = basketAssets.map((a, i) => `
      <div class="aa-basket-chip">
        <span class="aa-basket-chip-dot" style="background:${BASKET_CATEGORY_COLORS[a.category]}"></span>
        <span class="aa-basket-chip-ticker">${a.ticker}</span>
        <span class="aa-basket-chip-cat">${a.category}</span>
        <button class="aa-basket-chip-remove" data-remove-index="${i}">✕</button>
      </div>
    `).join('');

    contentEl.innerHTML = `
      <div class="aa-tab-panel">
        <div class="section-title">Cartera Satélite <span class="count">libre elección · 100% invertido, sin cash</span></div>

        <div class="aa-basket-form">
          <div class="aa-basket-field">
            <label>Ticker</label>
            <input type="text" id="aa-basket-ticker-input" placeholder="ej. AAPL" autocomplete="off">
          </div>
          <div class="aa-basket-field">
            <label>Categoría</label>
            <select id="aa-basket-category-input">
              <option value="RV">RV — Renta Variable</option>
              <option value="RF">RF — Renta Fija</option>
              <option value="REIT">REIT — Inmobiliario</option>
              <option value="Commodity">Commodity</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          <button class="btn btn-primary" id="aa-basket-add-btn">+ Añadir</button>
          <button class="btn" id="aa-basket-calc-btn" ${basketAssets.length < 2 ? 'disabled' : ''}>↻ Calcular Pesos</button>
          ${basketAssets.length > 0 ? `<button class="btn" id="aa-basket-clear-btn">Vaciar</button>` : ''}
        </div>

        ${basketAssets.length > 0 ? `<div class="aa-basket-list">${chipsHTML}</div>` : `
          <div class="empty" style="padding:30px 20px;">
            <div class="empty-title">Cartera Satélite vacía</div>
            <div class="empty-desc">Añade al menos 2 tickers. Los pesos se calculan por inversa de volatilidad sobre el capital Satélite.</div>
          </div>
        `}

        <div id="aa-basket-results"></div>
      </div>
    `;

    attachBasketListeners();
    renderBasketResults();
  }

  function renderBasketResults() {
    const el = document.getElementById('aa-basket-results');
    if (!el) return;
    if (!basketResults) { el.innerHTML = ''; return; }

    const { positions, failed } = basketResults;

    if (positions.length === 0) {
      el.innerHTML = `
        <div class="empty" style="padding:30px 20px;">
          <div class="empty-title">No se pudo calcular</div>
          <div class="empty-desc">${failed.length > 0 ? 'No se pudieron traer datos de: ' + failed.map(f=>f.ticker).join(', ') : 'Revisa los tickers introducidos.'}</div>
        </div>
      `;
      return;
    }

    const barHTML = positions.map(p => `<div class="aa-sizing-seg" style="width:${p.weightPct}%;background:${BASKET_CATEGORY_COLORS[p.category]};" title="${p.ticker}: ${p.weightPct.toFixed(1)}%"></div>`).join('');

    const cardsHTML = positions.map(p => `
      <div class="aa-sizing-card">
        <div class="aa-sizing-card-top">
          <span class="aa-sizing-dot" style="background:${BASKET_CATEGORY_COLORS[p.category]}"></span>
          <span class="aa-sizing-ticker">${p.ticker}</span>
        </div>
        <div class="aa-sizing-pct">${p.weightPct.toFixed(1)}<span class="aa-sizing-pct-sym">%</span></div>
        <div class="aa-sizing-meta">${p.category}</div>
        <div class="aa-sizing-meta-vol">vol 60d: ${(p.vol * 100).toFixed(2)}%/día</div>
      </div>
    `).join('');

    el.innerHTML = `
      <div class="aa-sizing-block" style="margin-top:20px;">
        <div class="section-title">Reparto Sugerido <span class="count">inversa de volatilidad · 100% invertido, sin cash</span></div>
        <div class="aa-sizing-layout">
          <div class="aa-sizing-main">
            <div class="aa-sizing-bar">${barHTML}</div>
            <div class="aa-sizing-grid">${cardsHTML}</div>
            <div class="aa-sizing-note">Menos volátil → más peso (desviación estándar de retornos diarios, 60 sesiones). Tope de concentración: 40% por activo. Sin filtro de score: aquí entra cualquier ticker que añadas.</div>
            ${failed.length > 0 ? `<div class="aa-sizing-note" style="color:var(--amber);margin-top:6px;">⚠ No se pudieron traer datos de: ${failed.map(f=>f.ticker).join(', ')}</div>` : ''}
          </div>
          <div class="aa-sizing-donut-wrap"><canvas id="aa-donut-basket"></canvas></div>
        </div>
      </div>
    `;

    const donutSegments = groupByCategory(positions.map(p => ({ category: p.category, pct: p.weightPct })), 0);
    destroyChart('aa-donut-basket');
    const canvas = document.getElementById('aa-donut-basket');
    if (canvas) chartInstances['aa-donut-basket'] = drawDonutChart(canvas, donutSegments);

    // Métricas: usar basketRawResults como fuente de datos completos
    if (basketRawResults) {
      const satMetrics = renderMetricsBlock(
        { positions: positions.map(p => ({ ...p, ticker: p.ticker })) },
        'Cartera Satélite',
        null,
        basketRawResults
      );
      if (satMetrics) el.insertAdjacentHTML('beforeend', satMetrics);
    }
  }

  async function calculateBasket() {
    if (basketAssets.length < 2) return;

    const resultsEl = document.getElementById('aa-basket-results');
    if (resultsEl) {
      resultsEl.innerHTML = `
        <div class="empty" style="padding:40px 20px;">
          <div class="loader-ring"></div>
          <div class="empty-title">Calculando</div>
          <div class="empty-desc">Trayendo precios de ${basketAssets.length} activos...</div>
        </div>
      `;
    }

    const results = await Promise.all(basketAssets.map(async (a, i) => {
      await new Promise(r => setTimeout(r, i * 150));
      try {
        const raw = await fetchData(a.ticker);
        const analysis = analyzeAsset(raw);
        return { ...a, ...analysis };
      } catch (err) {
        return { ...a, error: err.message };
      }
    }));

    basketResults = calculateBasketSizing(results);
    basketRawResults = results; // guardamos para métricas de riesgo
    renderBasketResults();
  }

  function attachBasketListeners() {
    const tickerInput = document.getElementById('aa-basket-ticker-input');
    const categoryInput = document.getElementById('aa-basket-category-input');
    const addBtn = document.getElementById('aa-basket-add-btn');
    const calcBtn = document.getElementById('aa-basket-calc-btn');
    const clearBtn = document.getElementById('aa-basket-clear-btn');

    function addTicker() {
      const raw = tickerInput.value.trim().toUpperCase();
      if (!raw) return;
      if (basketAssets.some(a => a.ticker === raw)) { tickerInput.value = ''; return; }
      basketAssets.push({ ticker: raw, category: categoryInput.value });
      basketResults = null;
      saveBasketToStorage();
      renderBasketTab();
    }

    if (addBtn) addBtn.addEventListener('click', addTicker);
    if (tickerInput) tickerInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTicker(); } });

    document.querySelectorAll('[data-remove-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.removeIndex, 10);
        basketAssets.splice(idx, 1);
        basketResults = null;
        saveBasketToStorage();
        renderBasketTab();
      });
    });

    if (calcBtn) calcBtn.addEventListener('click', calculateBasket);
    if (clearBtn) clearBtn.addEventListener('click', () => {
      basketAssets = [];
      basketResults = null;
      basketRawResults = null;
      saveBasketToStorage();
      renderBasketTab();
    });
  }

  function switchTab(tab) {
    currentTab = tab;
    container.querySelectorAll('.aa-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

    if (tab === 'params') {
      renderParameters();
    } else if (tab === 'satelite') {
      renderBasketTab();
    } else {
      // tab === 'core'
      if (allData) {
        const allocationAssets = allData.filter(a => a.category === 'allocation').slice().sort((a,b)=>b.score-a.score);
        const top2 = allocationAssets.slice(0,2);
        const reitAssets = allData.filter(a => a.category === 'reit');
        const commodityAssets = allData.filter(a => a.category === 'commodity');
        const indicators = allData.filter(a => a.category === 'indicator');
        const rfCount = top2.filter(a=>a.type==='RF').length;
        const rvCount = top2.filter(a=>a.type==='RV').length;
        let recommendation;
        if (rvCount===2) recommendation = { type:'RV', label:'Renta Variable', class:'green', desc:'Los 2 más fuertes son RV' };
        else if (rfCount===2) recommendation = { type:'RF', label:'Renta Fija', class:'blue', desc:'Los 2 más fuertes son RF' };
        else recommendation = { type:'NEUTRO', label:'Mixto', class:'amber', desc:'1 RF + 1 RV' };
        renderDashboard({
          allocationAssets, top2, recommendation, reitAssets,
          gold: commodityAssets.find(i=>i.ticker==='GLD'),
          silver: commodityAssets.find(i=>i.ticker==='SLV'),
          oil: commodityAssets.find(i=>i.ticker==='USO'),
          hy: indicators.find(i=>i.ticker==='HYG'),
          fx: indicators.find(i=>i.ticker==='EURUSD=X'),
          sizing: coreSizing || calculatePositionSizing(allData)
        });
      } else {
        contentEl.innerHTML = `
          <div class="empty">
            <div class="loader-ring"></div>
            <div class="empty-title">Analizando mercados</div>
          </div>
        `;
      }
    }
  }

  container.querySelectorAll('.aa-tab').forEach(tabEl => {
    tabEl.addEventListener('click', () => switchTab(tabEl.dataset.tab));
  });

  document.getElementById('aa-btn-refresh').addEventListener('click', runAnalysis);

  await runAnalysis();

  return {
    destroy() {
      Object.keys(chartInstances).forEach(destroyChart);
    }
  };
}

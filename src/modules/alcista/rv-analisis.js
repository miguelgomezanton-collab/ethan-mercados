// ═══════════════════════════════════════════════
// MÓDULO: Análisis Técnico · Renta Variable
import { saveModuleState } from '../../router.js';
// Replicación del módulo de Análisis original:
// - Precio hero + variación + stop semanal
// - Score ETHAN /10 con barra
// - Desglose Mensual / Semanal / Diario
// - Señales de entrada (4 tipos)
// - Sección de Opciones: OI por strike + Max Pain
// ═══════════════════════════════════════════════

const PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://soft-field-156f.miguel-gomez-anton.workers.dev/?url=${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
];

async function fetchWithProxy(url) {
  for (const fn of PROXIES) {
    try {
      const r = await fetch(fn(url), { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 8000); return c.signal; })() });
      if (!r.ok) continue;
      const text = await r.text();
      try { return JSON.parse(text); } catch { continue; }
    } catch {}
  }
  throw new Error('Sin proxy disponible');
}

// ── Motor técnico ──────────────────────────────
function calcEMA(arr, p) {
  const k = 2/(p+1), out = new Array(arr.length).fill(null);
  let s = arr.findIndex(v => v != null && !isNaN(v));
  if (s < 0) return out; out[s] = arr[s];
  for (let i = s+1; i < arr.length; i++) {
    const v = (arr[i] != null && !isNaN(arr[i])) ? arr[i] : out[i-1];
    out[i] = v*k + out[i-1]*(1-k);
  }
  return out;
}
function calcSMASimple(arr, p) {
  return arr.map((_, i) => {
    if (i < p-1) return null;
    const sl = arr.slice(i-p+1, i+1).filter(v => v != null && !isNaN(v));
    return sl.length === p ? sl.reduce((a,b) => a+b, 0)/p : null;
  });
}
function calcMACD(c, f=12, s=26, sig=9) {
  const ef = calcEMA(c,f), es = calcEMA(c,s);
  const m = ef.map((v,i) => (v!=null&&es[i]!=null) ? v-es[i] : null);
  const sl = calcEMA(m.map(v=>v??0), sig);
  return { m, sl, hist: m.map((v,i) => (v!=null&&sl[i]!=null) ? v-sl[i] : null) };
}
function calcRSI(c, p=14) {
  const out = new Array(c.length).fill(null);
  if (c.length < p+1) return out;
  let g=0, l=0;
  for (let i=1; i<=p; i++) { const d=c[i]-c[i-1]; d>0?g+=d:l-=d; }
  let ag=g/p, al=l/p;
  out[p] = al===0?100:100-(100/(1+ag/al));
  for (let i=p+1; i<c.length; i++) {
    const d=c[i]-c[i-1];
    ag=(ag*(p-1)+(d>0?d:0))/p; al=(al*(p-1)+(d<0?-d:0))/p;
    out[i]=al===0?100:100-(100/(1+ag/al));
  }
  return out;
}
function calcStoch(H, L, C, p=14, sk=3) {
  const rk = C.map((c,i) => {
    if (i<p-1) return null;
    const hh=Math.max(...H.slice(i-p+1,i+1)), ll=Math.min(...L.slice(i-p+1,i+1));
    return hh===ll?50:(c-ll)/(hh-ll)*100;
  });
  const k = calcSMASimple(rk, sk);
  return { k, d: calcSMASimple(k.map(v=>v??0), 3) };
}
function resample(ts, O, H, L, C, V, freq) {
  const g = {};
  ts.forEach((t,i) => {
    const dd = new Date(t*1000); let key;
    if (freq==='W') {
      const dy=dd.getDay(), df=dd.getDate()-dy+(dy===0?-6:1);
      const mo=new Date(+dd); mo.setDate(df); key=mo.toISOString().slice(0,10);
    } else key=`${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}`;
    if (!g[key]) g[key]={o:O[i],h:H[i],l:L[i],c:C[i],v:V[i]};
    else { g[key].h=Math.max(g[key].h,H[i]); g[key].l=Math.min(g[key].l,L[i]); g[key].c=C[i]; g[key].v+=V[i]; }
  });
  const keys = Object.keys(g).sort();
  return { O:keys.map(k=>g[k].o), H:keys.map(k=>g[k].h), L:keys.map(k=>g[k].l), C:keys.map(k=>g[k].c), V:keys.map(k=>g[k].v) };
}

async function fetchOHLC(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=10y&events=history`;
  const j = await fetchWithProxy(url);
  const res = j?.chart?.result?.[0]; if (!res) throw new Error('Sin datos');
  const q = res.indicators?.quote?.[0]; if (!q) throw new Error('Sin quotes');
  const adj = res.indicators?.adjclose?.[0]?.adjclose || q.close;
  const ratio = adj.map((a,i) => (q.close[i]&&a) ? a/q.close[i] : 1);
  const meta = res.meta || {};
  return {
    timestamps: res.timestamp,
    O: q.open.map((v,i)=>v*ratio[i]),
    H: q.high.map((v,i)=>v*ratio[i]),
    L: q.low.map((v,i)=>v*ratio[i]),
    C: adj, V: q.volume,
    name: meta.shortName||meta.longName||ticker,
    currency: meta.currency||'USD'
  };
}

function evaluate(raw) {
  const { timestamps, O, H, L, C, V, name, currency } = raw;
  const n = C.length;
  const di = n-1;

  // Diario
  const d_macd   = calcMACD(C);
  const d_s89    = calcStoch(H, L, C, 89);
  const d_s8     = calcStoch(H, L, C, 8);
  const d_rsi14  = calcRSI(C, 14);
  const d_rsi5   = calcRSI(C, 5);
  const d_ema5   = calcEMA(C, 5);
  const d_ema10  = calcEMA(C, 10);
  const d_ema20  = calcEMA(C, 20);

  // Semanal
  const W = resample(timestamps, O, H, L, C, V, 'W');
  const wi = W.C.length-1;
  const w_macd  = calcMACD(W.C);
  const w_s89   = calcStoch(W.H, W.L, W.C, 89);
  const w_rsi14 = calcRSI(W.C, 14);
  const w_rsi5  = calcRSI(W.C, 5);
  const w_ema5  = calcEMA(W.C, 5);
  const w_ema10 = calcEMA(W.C, 10);
  const w_ema20 = calcEMA(W.C, 20);

  // Mensual
  const M = resample(timestamps, O, H, L, C, V, 'M');
  const mi = M.C.length-1;
  const m_macd  = calcMACD(M.C);
  const m_s89   = calcStoch(M.H, M.L, M.C, 89);
  const m_s8    = calcStoch(M.H, M.L, M.C, 8);
  const m_rsi14 = calcRSI(M.C, 14);
  const m_ema10 = calcEMA(M.C, 10);

  const price   = C[di];
  const prevClose = C[di-1];
  const change  = price - prevClose;
  const changePct = (change / prevClose) * 100;
  const stopSemanal = w_ema10[wi];

  // Condiciones Mensual
  const mc = {
    macd:    m_macd.m[mi]>0 && m_macd.m[mi]>m_macd.sl[mi],
    s89:     (m_s89.k[mi]>80 && m_s89.k[mi]>m_s89.d[mi]) || m_s89.k[mi]>92,
    s89_opt: m_s89.k[mi]>92,
    rsi14:   m_rsi14[mi]>65,
    s8:      m_s8.k[mi]>78,
    precio:  m_ema10[mi]!=null && M.C[mi]>m_ema10[mi],
    vals: {
      macd: m_macd.m[mi], macd_sl: m_macd.sl[mi],
      s89: m_s89.k[mi], rsi14: m_rsi14[mi],
      s8: m_s8.k[mi], close: M.C[mi], ema10: m_ema10[mi]
    }
  };
  mc.cumple = mc.macd && mc.s89 && mc.rsi14 && mc.s8 && mc.precio;

  // Condiciones Semanal
  const sc = {
    macd:    w_macd.m[wi]>0 && w_macd.m[wi]>w_macd.sl[wi],
    s89:     (w_s89.k[wi]>85 && w_s89.k[wi]>w_s89.d[wi]) || w_s89.k[wi]>92,
    s89_opt: w_s89.k[wi]>92,
    rsi14:   w_rsi14[wi]>67,
    precio:  w_ema20[wi]!=null && W.C[wi]>w_ema20[wi],
    vals: {
      macd: w_macd.m[wi], macd_sl: w_macd.sl[wi],
      s89: w_s89.k[wi], rsi14: w_rsi14[wi], rsi5: w_rsi5[wi],
      close: W.C[wi], ema5: w_ema5[wi], ema10: w_ema10[wi], ema20: w_ema20[wi]
    }
  };
  sc.cumple = sc.macd && sc.s89 && sc.rsi14 && sc.precio;

  // Condiciones Diario
  const dc = {
    macd_pos:    d_macd.m[di]>0,
    s89:         d_s89.k[di]>85,
    rsi14:       d_rsi14[di]>59,
    macd_cross:  di>0 && d_macd.m[di]>d_macd.sl[di] && d_macd.m[di-1]<=d_macd.sl[di-1],
    vals: {
      macd: d_macd.m[di], s89: d_s89.k[di], rsi14: d_rsi14[di],
      ema5: d_ema5[di], ema10: d_ema10[di], ema20: d_ema20[di]
    }
  };
  dc.cumple = dc.macd_pos && dc.s89 && dc.rsi14 && dc.macd_cross;

  // Señales
  const señal_ema5_w  = w_rsi14[wi]>50 && W.C[wi]>w_ema5[wi]-0.005*w_ema5[wi] && W.C[wi]<w_ema5[wi]*1.02;
  const señal_rsi5_w  = w_rsi5[wi]!=null && w_rsi5[wi]<40;
  const señal_s89_w   = w_s89.k[wi]>85;
  const señal_diaria  = dc.macd_pos && dc.macd_cross && dc.rsi14 && d_macd.m[di]>0;

  // Score /10
  let score = 0;
  if(mc.macd)score++;if(mc.s89)score++;if(mc.rsi14)score++;if(mc.s8)score++;if(mc.precio)score++;
  if(sc.macd)score++;if(sc.s89)score++;if(sc.rsi14)score++;if(sc.precio)score++;
  if(mc.cumple&&sc.cumple)score++;

  return { price, prevClose, change, changePct, stopSemanal, score,
    mc, sc, dc, señal_ema5_w, señal_rsi5_w, señal_s89_w, señal_diaria,
    name, currency };
}

// ── Opciones: Max Pain ─────────────────────────
async function fetchOptions(ticker) {
  const r = await fetch(`/api/options?ticker=${encodeURIComponent(ticker)}`);
  if (!r.ok) throw new Error(`API options HTTP ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j; // { expirationDates, calls, puts, price, symbol }
}

async function fetchOptionsExpiry(ticker, expiry) {
  const r = await fetch(`/api/options?ticker=${encodeURIComponent(ticker)}&date=${expiry}`);
  if (!r.ok) throw new Error(`API options HTTP ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j; // { calls, puts }
}

function calcMaxPain(calls, puts) {
  // Recopilar todos los strikes únicos
  const strikes = [...new Set([...calls, ...puts].map(o => o.strike))].sort((a,b)=>a-b);
  let minPain = Infinity, maxPainStrike = null;

  strikes.forEach(s => {
    // Pérdida total para vendedores de calls en este strike
    const callPain = calls.reduce((sum, c) => {
      if (c.strike < s) return sum + (s - c.strike) * (c.openInterest || 0) * 100;
      return sum;
    }, 0);
    // Pérdida total para vendedores de puts en este strike
    const putPain = puts.reduce((sum, p) => {
      if (p.strike > s) return sum + (p.strike - s) * (p.openInterest || 0) * 100;
      return sum;
    }, 0);
    const total = callPain + putPain;
    if (total < minPain) { minPain = total; maxPainStrike = s; }
  });
  return maxPainStrike;
}

// ── Helpers UI ─────────────────────────────────
const fmt  = v => v!=null&&!isNaN(v) ? v.toFixed(2) : '—';
const fmtP = v => v!=null&&!isNaN(v) ? '$'+v.toFixed(2) : '—';
const fmtK = v => v>=1e6 ? (v/1e6).toFixed(1)+'M' : v>=1e3 ? (v/1e3).toFixed(0)+'k' : v?.toString() || '—';

function condRow(ok, label, value, threshold, opt=false) {
  const cls = ok ? (opt?'an-cond-opt':'an-cond-ok') : 'an-cond-fail';
  const icon = ok ? (opt?'⭐':'✓') : '✗';
  return `
    <div class="an-cond-row ${cls}">
      <span class="an-cond-icon">${icon}</span>
      <span class="an-cond-label">${label}</span>
      <span class="an-cond-val">${value}</span>
      ${threshold?`<span class="an-cond-thr">${threshold}</span>`:''}
    </div>`;
}

// ═══════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════
export async function render(container, { actionsSlot, savedState }) {
  let currentTicker = '';
  let currentExpiry = null;
  let expirations   = [];

  actionsSlot.innerHTML = `
    <div class="an-search-bar">
      <input type="text" id="an-input" placeholder="Ticker: AAPL, MSFT, SAN.MC..." class="wl-input" autocomplete="off">
      <button class="btn btn-primary" id="an-analyze-btn">Analizar</button>
    </div>
  `;

  container.innerHTML = `
    <div id="an-content">
      <div class="empty">
        <div class="empty-icon">📊</div>
        <div class="empty-title">Análisis Técnico</div>
        <div class="empty-desc">Introduce un ticker para ver el análisis completo: score ETHAN, condiciones por timeframe, señales de entrada y cadena de opciones.</div>
      </div>
    </div>
  `;

  const contentEl = () => document.getElementById('an-content');

  async function runAnalysis(ticker) {
    saveModuleState('alc-rv-analisis', { ticker });
    const el = contentEl(); if (!el) return;
    el.innerHTML = `<div class="empty"><div class="loader-ring"></div><div class="empty-title">Analizando ${ticker}...</div></div>`;

    try {
      const raw = await fetchOHLC(ticker);
      const r   = evaluate(raw);
      currentTicker = ticker;
      paintAnalysis(r, ticker);
      // Cargar opciones en paralelo (no bloquea el análisis)
      loadOptions(ticker);
    } catch(err) {
      const el = contentEl(); if (!el) return;
      el.innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Error</div><div class="empty-desc">${err.message}</div></div>`;
    }
  }

  function paintAnalysis(r, ticker) {
    const el = contentEl(); if (!el) return;
    const scoreColor = r.score>=9?'var(--green)':r.score>=7?'var(--amber)':'var(--red)';
    const scoreVerdict = r.score===10?'CANDIDATO ÓPTIMO':r.score>=8?'MONITOREAR':'NO CUMPLE';
    const scoreVClass  = r.score>=8?'good':'bad';
    const changeDir    = r.change>=0?'up':'down';
    const changeSign   = r.change>=0?'+':'';
    const stopDist     = r.stopSemanal ? ((r.price-r.stopSemanal)/r.price*100).toFixed(2) : null;

    el.innerHTML = `
      <!-- PRECIO HERO -->
      <div class="an-hero">
        <div class="an-hero-card">
          <div class="an-hero-label">PRECIO ACTUAL</div>
          <div class="an-hero-value">${fmtP(r.price)}</div>
          <div class="an-hero-sub">${r.name} · ${r.currency}</div>
        </div>
        <div class="an-hero-card">
          <div class="an-hero-label">VARIACIÓN</div>
          <div class="an-hero-value ${changeDir}">${changeSign}${fmtP(r.change)} (${changeSign}${fmt(r.changePct)}%)</div>
          <div class="an-hero-sub">vs cierre anterior</div>
        </div>
        <div class="an-hero-card">
          <div class="an-hero-label">STOP SEMANAL</div>
          <div class="an-hero-value" style="color:var(--red)">${fmtP(r.stopSemanal)}</div>
          <div class="an-hero-sub">EMA 10 semanal · dist. ${stopDist!=null?stopDist+'%':'—'}</div>
        </div>
      </div>

      <!-- SCORE BAR -->
      <div class="an-score-section">
        <div class="an-score-label">SCORE ETHAN</div>
        <div class="an-score-track">
          <div class="an-score-fill" style="width:${r.score*10}%;background:linear-gradient(90deg,${scoreColor}88,${scoreColor})"></div>
          <div class="an-score-dot" style="left:${r.score*10}%;background:${scoreColor}"></div>
        </div>
        <div class="an-score-num" style="color:${scoreColor}">${r.score}/10</div>
        <div class="an-score-verdict ${scoreVClass}">${scoreVerdict}</div>
      </div>

      <!-- TIMEFRAME GRID -->
      <div class="an-tf-grid">

        <!-- MENSUAL -->
        <div class="an-tf-block">
          <div class="an-tf-header">
            <div class="an-tf-title mensual">◆ MENSUAL</div>
            <div class="an-tf-badge ${r.mc.cumple?'ok':'fail'}">${r.mc.cumple?'✓ CUMPLE':'✗ FALLO'}</div>
          </div>
          ${condRow(r.mc.macd,  'MACD > 0 y alcista',   `${fmt(r.mc.vals.macd)} / sig ${fmt(r.mc.vals.macd_sl)}`, '> 0')}
          ${condRow(r.mc.s89,   'Estocástico 89 > 80',  `${fmt(r.mc.vals.s89)}`, '> 80', r.mc.s89_opt)}
          ${condRow(r.mc.rsi14, 'RSI 14 > 65',          `${fmt(r.mc.vals.rsi14)}`, '> 65')}
          ${condRow(r.mc.s8,    'Estocástico 8 > 78',   `${fmt(r.mc.vals.s8)}`, '> 78')}
          ${condRow(r.mc.precio,'Precio > EMA 10',      `${fmtP(r.mc.vals.close)} / EMA ${fmtP(r.mc.vals.ema10)}`, '')}
        </div>

        <!-- SEMANAL -->
        <div class="an-tf-block">
          <div class="an-tf-header">
            <div class="an-tf-title semanal">◆ SEMANAL</div>
            <div class="an-tf-badge ${r.sc.cumple?'ok':'fail'}">${r.sc.cumple?'✓ CUMPLE':'✗ FALLO'}</div>
          </div>
          ${condRow(r.sc.macd,  'MACD > 0 y alcista',   `${fmt(r.sc.vals.macd)} / sig ${fmt(r.sc.vals.macd_sl)}`, '> 0')}
          ${condRow(r.sc.s89,   'Estocástico 89 > 85',  `${fmt(r.sc.vals.s89)}`, '> 85', r.sc.s89_opt)}
          ${condRow(r.sc.rsi14, 'RSI 14 > 67',          `${fmt(r.sc.vals.rsi14)}`, '> 67')}
          ${condRow(r.sc.precio,'Precio > EMA 20',      `${fmtP(r.sc.vals.close)} / EMA ${fmtP(r.sc.vals.ema20)}`, '')}
          <div class="an-ema-row">EMA5 ${fmtP(r.sc.vals.ema5)} · EMA10 ${fmtP(r.sc.vals.ema10)} · EMA20 ${fmtP(r.sc.vals.ema20)}</div>
        </div>

        <!-- DIARIO -->
        <div class="an-tf-block">
          <div class="an-tf-header">
            <div class="an-tf-title diario">◆ DIARIO (timing)</div>
            <div class="an-tf-badge ${r.dc.cumple?'ok':'fail'}">${r.dc.cumple?'✓ LISTO':'✗ ESPERAR'}</div>
          </div>
          ${condRow(r.dc.macd_pos,  'MACD > 0',             `${fmt(r.dc.vals.macd)}`, '> 0')}
          ${condRow(r.dc.s89,       'Estocástico 89 > 85',  `${fmt(r.dc.vals.s89)}`, '> 85')}
          ${condRow(r.dc.rsi14,     'RSI 14 > 59',          `${fmt(r.dc.vals.rsi14)}`, '> 59')}
          ${condRow(r.dc.macd_cross,'MACD cruza al alza',   r.dc.macd_cross?'SÍ':'NO', '')}
          <div class="an-ema-row">EMA5 ${fmtP(r.dc.vals.ema5)} · EMA10 ${fmtP(r.dc.vals.ema10)} · EMA20 ${fmtP(r.dc.vals.ema20)}</div>
        </div>

        <!-- SEÑALES DE ENTRADA -->
        <div class="an-tf-block">
          <div class="an-tf-header">
            <div class="an-tf-title señales">◆ SEÑALES DE ENTRADA</div>
            <div class="an-tf-badge ${r.señal_diaria||r.señal_rsi5_w||r.señal_ema5_w?'ok':r.mc.cumple&&r.sc.cumple?'wait':'fail'}">
              ${r.señal_diaria?'✓ ENTRADA ACTIVA':r.señal_rsi5_w||r.señal_ema5_w?'✓ SEÑAL SEMANAL':r.mc.cumple&&r.sc.cumple?'⏳ ESPERA':'✗ INACTIVO'}
            </div>
          </div>
          <div class="an-signals-grid">
            ${signal('📉','Rebote EMA5 Semanal',   r.señal_ema5_w,  `EMA5W: ${fmtP(r.sc.vals.ema5)}`)}
            ${signal('🔥','MACD+RSI Diario',        r.señal_diaria,  `MACD: ${fmt(r.dc.vals.macd)}`)}
            ${signal('📈','Estoch89 Semanal',        r.señal_s89_w,   `Stoch89W: ${fmt(r.sc.vals.s89)}`)}
            ${signal('📊','RSI5 Pullback Semanal',   r.señal_rsi5_w,  `RSI5W: ${fmt(r.sc.vals.rsi5)}`)}
            ${signal('🌊','Canal Bajista',           false,           'Ruptura + volumen')}
          </div>
        </div>

      </div><!-- /tf-grid -->

      <!-- OPCIONES / MAX PAIN -->
      <div id="an-options-section">
        <div class="section-title" style="margin-top:28px;">Cadena de Opciones · Max Pain <span class="count">cargando...</span></div>
        <div class="empty" style="padding:30px;"><div class="loader-ring"></div></div>
      </div>
    `;
  }

  function signal(icon, name, active, desc) {
    return `
      <div class="an-signal-card ${active?'active':''}">
        <div class="an-signal-icon">${icon}</div>
        <div class="an-signal-name">${name}</div>
        <div class="an-signal-status">${active?'ACTIVA':'NO'}</div>
        <div class="an-signal-desc">${desc}</div>
      </div>`;
  }

  // ── Detectar OPEX (tercer viernes del mes) ────
  function isMonthlyOpex(ts) {
    const d = new Date(ts * 1000);
    if (d.getDay() !== 5) return false;
    return d.getDate() >= 15 && d.getDate() <= 21;
  }
  function isQuarterlyOpex(ts) {
    if (!isMonthlyOpex(ts)) return false;
    return [2,5,8,11].includes(new Date(ts*1000).getMonth());
  }
  function getExpiryLabel(ts) {
    const d = new Date(ts*1000);
    const label = d.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
    const today = new Date(); today.setHours(0,0,0,0);
    const exp = new Date(ts*1000); exp.setHours(0,0,0,0);
    const days = Math.round((exp-today)/86400000);
    const dStr = days===0?'HOY':days===1?'mañana':days+"d";
    if (isQuarterlyOpex(ts)) return label+" ("+dStr+") ⭐ OPEX TRIM.";
    if (isMonthlyOpex(ts))   return label+" ("+dStr+") 📅 OPEX MENS.";
    return label+" ("+dStr+")";
  }
  function getBestExpiry(exps) {
    const now = Date.now()/1000;
    const future = exps.filter(e=>e>now);
    if (!future.length) return exps[0];
    return future.find(e=>isMonthlyOpex(e)) || future[0];
  }

  async function loadOptions(ticker) {
    const secEl = document.getElementById('an-options-section');
    if (!secEl) return;
    try {
      const opt = await fetchOptions(ticker);
      expirations = opt.expirationDates || [];
      currentExpiry = getBestExpiry(expirations);
      if (currentExpiry !== expirations[0]) {
        const data = await fetchOptionsExpiry(ticker, currentExpiry);
        paintOptions(ticker, data.calls, data.puts, opt.price);
      } else {
        paintOptions(ticker, opt.calls, opt.puts, opt.price);
      }
    } catch(err) {
      if (secEl) secEl.innerHTML = `
        <div class="section-title" style="margin-top:28px;">Cadena de Opciones · Max Pain</div>
        <div class="sc2-empty" style="color:var(--text3);font-size:11px;">Opciones no disponibles para ${ticker} · ${err.message}</div>
      `;
    }
  }

  function paintOptions(ticker, calls, puts, price) {
    const secEl = document.getElementById('an-options-section');
    if (!secEl) return;

    const maxPain = calcMaxPain(calls, puts);

    // Combinar por strike
    const strikeMap = {};
    calls.forEach(c => {
      if (!strikeMap[c.strike]) strikeMap[c.strike] = { strike:c.strike, callOI:0, putOI:0, callVol:0, putVol:0, callIV:null, putIV:null };
      strikeMap[c.strike].callOI  += c.openInterest||0;
      strikeMap[c.strike].callVol += c.volume||0;
      strikeMap[c.strike].callIV   = c.impliedVolatility;
    });
    puts.forEach(p => {
      if (!strikeMap[p.strike]) strikeMap[p.strike] = { strike:p.strike, callOI:0, putOI:0, callVol:0, putVol:0, callIV:null, putIV:null };
      strikeMap[p.strike].putOI  += p.openInterest||0;
      strikeMap[p.strike].putVol += p.volume||0;
      strikeMap[p.strike].putIV   = p.impliedVolatility;
    });

    const rows = Object.values(strikeMap).sort((a,b) => a.strike-b.strike);
    const maxOI = Math.max(...rows.map(r => Math.max(r.callOI, r.putOI)));

    // Solo mostrar strikes cercanos al precio (±20%)
    const near = price ? rows.filter(r => r.strike>=price*0.80 && r.strike<=price*1.20) : rows;
    const display = near.length > 0 ? near : rows.slice(0, 40);

    // Expiry selector con etiquetas OPEX
    const expiryOpts = expirations.map(e => {
      return `<option value="${e}" ${e===currentExpiry?'selected':''}>${getExpiryLabel(e)}</option>`;
    }).join('');

    // Info del vencimiento seleccionado
    const isOpexM = isMonthlyOpex(currentExpiry);
    const isOpexQ = isQuarterlyOpex(currentExpiry);
    const today = new Date(); today.setHours(0,0,0,0);
    const expDate = new Date(currentExpiry*1000); expDate.setHours(0,0,0,0);
    const daysLeft = Math.round((expDate - today) / 86400000);

    secEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:28px;margin-bottom:10px;flex-wrap:wrap;gap:12px;">
        <div class="section-title" style="margin:0;">Cadena de Opciones · Max Pain</div>
        <div style="display:flex;align-items:center;gap:10px;">
          ${expirations.length>1?`<select id="an-expiry-select" class="sc2-sel">${expiryOpts}</select>`:''}
          <div class="an-maxpain-badge">🎯 Max Pain: <strong>${fmtP(maxPain)}</strong></div>
        </div>
      </div>

      <!-- Panel explicativo OPEX -->
      <div class="an-opex-info">
        <div class="an-opex-left">
          <span class="an-opex-badge ${isOpexQ?'quarterly':isOpexM?'monthly':'weekly'}">
            ${isOpexQ?'⭐ OPEX TRIMESTRAL':isOpexM?'📅 OPEX MENSUAL':'📆 VENCIMIENTO SEMANAL'}
          </span>
          <span class="an-opex-days">${daysLeft===0?'Vence HOY':daysLeft===1?'Vence mañana':`Vence en ${daysLeft} días`}</span>
        </div>
        <div class="an-opex-explain">
          ${isOpexQ
            ? '⭐ <strong>OPEX Trimestral</strong> — el más importante del año (mar/jun/sep/dic). Concentra el mayor volumen de contratos. El Max Pain tiene aquí su máxima influencia sobre el precio.'
            : isOpexM
            ? '📅 <strong>OPEX Mensual</strong> — tercer viernes de cada mes. Vencimiento de referencia para opciones estándar. El precio suele gravitar hacia el Max Pain en los días previos.'
            : '📆 <strong>Vencimiento semanal</strong> — menor concentración de OI. El Max Pain es orientativo pero tiene menos peso que en el OPEX mensual. Se ha seleccionado el OPEX mensual más próximo automáticamente.'
          }
        </div>
      </div>

      <div class="an-options-legend">
        <span class="an-leg-call">■ Calls (OI)</span>
        <span class="an-leg-put">■ Puts (OI)</span>
        ${price?`<span style="font-size:9px;color:var(--text3);font-family:var(--mono);">Precio actual: ${fmtP(price)} · Max Pain: ${fmtP(maxPain)}</span>`:''}
      </div>

      <div id="an-options-body">
        <table class="sc2-table an-options-table">
          <thead>
            <tr>
              <th>CALL OI</th><th>CALL VOL</th><th>CALL IV</th>
              <th class="an-strike-col">STRIKE</th>
              <th>PUT IV</th><th>PUT VOL</th><th>PUT OI</th>
            </tr>
          </thead>
          <tbody>
            ${display.map(row => {
              const isMaxPain  = maxPain && Math.abs(row.strike - maxPain) < 0.5;
              const isAtMoney  = price && Math.abs(row.strike - price) < price*0.005;
              const callBarW   = maxOI>0 ? (row.callOI/maxOI*100).toFixed(1) : 0;
              const putBarW    = maxOI>0 ? (row.putOI /maxOI*100).toFixed(1) : 0;
              const rowClass   = isMaxPain?'an-row-maxpain':isAtMoney?'an-row-atm':'';
              return `
                <tr class="${rowClass}">
                  <td class="an-call-cell">
                    <div class="an-oi-wrap">
                      <div class="an-oi-bar call" style="width:${callBarW}%"></div>
                      <span class="an-oi-num">${fmtK(row.callOI)}</span>
                    </div>
                  </td>
                  <td class="an-num">${fmtK(row.callVol)}</td>
                  <td class="an-num">${row.callIV!=null?(row.callIV*100).toFixed(1)+'%':'—'}</td>
                  <td class="an-strike-col ${isMaxPain?'maxpain':''}${isAtMoney?' atm':''}">
                    ${fmtP(row.strike)}
                    ${isMaxPain?'<span class="an-mp-tag">MAX PAIN</span>':''}
                    ${isAtMoney?'<span class="an-atm-tag">ATM</span>':''}
                  </td>
                  <td class="an-num">${row.putIV!=null?(row.putIV*100).toFixed(1)+'%':'—'}</td>
                  <td class="an-num">${fmtK(row.putVol)}</td>
                  <td class="an-put-cell">
                    <div class="an-oi-wrap reverse">
                      <span class="an-oi-num">${fmtK(row.putOI)}</span>
                      <div class="an-oi-bar put" style="width:${putBarW}%"></div>
                    </div>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
        <div style="font-size:9px;color:var(--text3);font-family:var(--mono);margin-top:8px;">
          ⚠ OI = Open Interest (contratos abiertos) · Max Pain = strike donde el vendedor de opciones pierde menos. Solo vencimientos disponibles en Yahoo Finance.
        </div>
      </div>
    `;

    // Re-enganchar el selector de vencimiento tras repintar
    if (expirations.length > 1) {
      const sel = document.getElementById('an-expiry-select');
      if (sel) {
        sel.addEventListener('change', async () => {
          currentExpiry = parseInt(sel.value);
          sel.disabled = true;
          try {
            const price2 = document.querySelector('.an-hero-value')?.textContent?.replace('$','') || null;
            const { calls: nc, puts: np } = await fetchOptionsExpiry(currentTicker, currentExpiry);
            paintOptions(currentTicker, nc, np, parseFloat(price2));
          } catch(e) {
            document.getElementById('an-options-body').innerHTML = `<div class="sc2-empty">Error: ${e.message}</div>`;
          }
          sel.disabled = false;
        });
      }
    }
  }

  // Listeners
  document.getElementById('an-analyze-btn')?.addEventListener('click', () => {
    const t = document.getElementById('an-input')?.value.trim().toUpperCase();
    if (t) runAnalysis(t);
  });
  document.getElementById('an-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const t = e.target.value.trim().toUpperCase();
      if (t) runAnalysis(t);
    }
    e.target.value = e.target.value.toUpperCase();
  });

  // Restaurar último análisis al volver
  if (savedState?.ticker) {
    const input = document.getElementById('an-input');
    if (input) input.value = savedState.ticker;
    runAnalysis(savedState.ticker);
  }

  return { destroy() {} };
}

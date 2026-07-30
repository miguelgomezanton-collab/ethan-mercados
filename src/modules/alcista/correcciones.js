// ═══════════════════════════════════════════════
// MÓDULO: Watchlist de Correcciones · Alcista
// Dos tipos de corrección dentro de tendencia alcista:
// Tipo 1: Superficial (precio > MM20 semanal)
// Tipo 2: Normal (precio perfora MM10, busca MM20/MM34)
// ═══════════════════════════════════════════════

import { UserData } from '../../userdata.js';
import { saveModuleState } from '../../router.js';

const STORAGE_KEY = 'ethan_correcciones_v1';

const PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://soft-field-156f.miguel-gomez-anton.workers.dev/?url=${encodeURIComponent(u)}`,
];

// ── Fetch OHLC ────────────────────────────────
async function fetchOHLC(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=3y`;
  for (const fn of PROXIES) {
    try {
      const r = await fetch(fn(url), { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })() });
      if (!r.ok) continue;
      const j = JSON.parse(await r.text());
      const res = j?.chart?.result?.[0]; if (!res) continue;
      const meta = res.meta || {};
      const q = res.indicators?.quote?.[0] || {};
      const ts = res.timestamp || [];
      return {
        timestamps: ts,
        opens: q.open || [], highs: q.high || [],
        lows: q.low || [], closes: q.close || [],
        volumes: q.volume || [],
        name: meta.shortName || meta.longName || ticker,
        currency: meta.currency || 'USD',
      };
    } catch {}
  }
  throw new Error(`No se pudo obtener datos de ${ticker}`);
}

// ── Indicadores ───────────────────────────────
function calcEMA(data, period) {
  const k = 2 / (period + 1), ema = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i] == null) { ema.push(null); continue; }
    if (ema.length < period) { ema.push(null); continue; }
    if (ema[i - 1] == null) {
      const slice = data.slice(i - period + 1, i + 1).filter(v => v != null);
      ema.push(slice.length === period ? slice.reduce((a,b) => a+b,0)/period : null);
    } else {
      ema.push(data[i] * k + ema[i-1] * (1-k));
    }
  }
  return ema;
}

function calcSMA(data, period) {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    return slice.every(v => v != null) ? slice.reduce((a,b) => a+b, 0) / period : null;
  });
}

function calcRSI(closes, period) {
  const rsi = Array(closes.length).fill(null);
  if (closes.length < period + 1) return rsi;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i-1];
    if (d >= 0) gains += d; else losses -= d;
  }
  let avgG = gains/period, avgL = losses/period;
  rsi[period] = avgL === 0 ? 100 : 100 - 100/(1 + avgG/avgL);
  for (let i = period+1; i < closes.length; i++) {
    const d = closes[i] - closes[i-1];
    avgG = (avgG*(period-1) + Math.max(d,0)) / period;
    avgL = (avgL*(period-1) + Math.max(-d,0)) / period;
    rsi[i] = avgL === 0 ? 100 : 100 - 100/(1 + avgG/avgL);
  }
  return rsi;
}

function calcStoch(highs, lows, closes, kPeriod, dPeriod = 3) {
  const k = closes.map((c, i) => {
    if (i < kPeriod - 1) return null;
    const h = Math.max(...highs.slice(i-kPeriod+1, i+1));
    const l = Math.min(...lows.slice(i-kPeriod+1, i+1));
    return h === l ? 50 : ((c - l) / (h - l)) * 100;
  });
  const d = calcSMA(k.map(v => v ?? 0), dPeriod);
  return { k, d };
}

function calcMACD(closes, fast=12, slow=26, signal=9) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const macdLine = emaFast.map((f, i) => f != null && emaSlow[i] != null ? f - emaSlow[i] : null);
  const signalLine = calcEMA(macdLine.map(v => v ?? 0), signal);
  const hist = macdLine.map((m, i) => m != null && signalLine[i] != null ? m - signalLine[i] : null);
  return { macd: macdLine, signal: signalLine, hist };
}

// ── Resample semanal ──────────────────────────
function resampleWeekly(ts, opens, highs, lows, closes, vols) {
  const weeks = {};
  ts.forEach((t, i) => {
    if (closes[i] == null) return;
    const d = new Date(t * 1000);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const key = monday.toISOString().slice(0,10);
    if (!weeks[key]) weeks[key] = { o: opens[i], h: highs[i], l: lows[i], c: closes[i], v: vols[i] || 0 };
    else {
      weeks[key].h = Math.max(weeks[key].h, highs[i]);
      weeks[key].l = Math.min(weeks[key].l, lows[i]);
      weeks[key].c = closes[i];
      weeks[key].v += vols[i] || 0;
    }
  });
  const keys = Object.keys(weeks).sort();
  return {
    opens: keys.map(k => weeks[k].o), highs: keys.map(k => weeks[k].h),
    lows: keys.map(k => weeks[k].l), closes: keys.map(k => weeks[k].c),
  };
}

// ── Analizar corrección ───────────────────────
function analyzeCorrection(data, tipo) {
  const { timestamps, opens, highs, lows, closes, volumes } = data;
  const n = closes.length;

  // ── SEMANAL ──────────────────────────────────
  const W = resampleWeekly(timestamps, opens, highs, lows, closes, volumes);
  const wn = W.closes.length;
  const wClose = W.closes[wn-1];

  const wMM5  = calcEMA(W.closes, 5)[wn-1];
  const wMM10 = calcEMA(W.closes, 10)[wn-1];
  const wMM20 = calcEMA(W.closes, 20)[wn-1];
  const wMM34 = calcEMA(W.closes, 34)[wn-1];

  const wRSI14 = calcRSI(W.closes, 14)[wn-1];
  const wRSI2  = calcRSI(W.closes, 2)[wn-1];

  const wStoch89 = calcStoch(W.highs, W.lows, W.closes, 89);
  const wStoch14 = calcStoch(W.highs, W.lows, W.closes, 14);
  const wStoch89K = wStoch89.k[wn-1];
  const wStoch89Kprev = wStoch89.k[wn-2];
  const wStoch89D = wStoch89.d[wn-1];
  const wStoch14K = wStoch14.k[wn-1];

  const wMACD = calcMACD(W.closes);
  const wMacdVal = wMACD.macd[wn-1];
  const wMacdSig = wMACD.signal[wn-1];
  const wMacdHist = wMACD.hist[wn-1];

  // ── DIARIO ───────────────────────────────────
  const dClose = closes[n-1];
  const dMM5  = calcEMA(closes, 5)[n-1];
  const dMM10 = calcEMA(closes, 10)[n-1];
  const dMM20 = calcEMA(closes, 20)[n-1];
  const dMM34 = calcEMA(closes, 34)[n-1];
  const dRSI14 = calcRSI(closes, 14)[n-1];
  const dStoch5 = calcStoch(highs, lows, closes, 5);
  const dStoch5K = dStoch5.k[n-1];
  const dStoch5Kprev = dStoch5.k[n-2];

  const fmt = v => v != null ? v.toFixed(2) : '—';
  const fmtP = v => v != null ? '$' + v.toFixed(2) : '—';

  let condiciones = [], entrada = [], resultado = 'pendiente';

  if (tipo === 1) {
    // ── TIPO 1: Corrección superficial ───────────
    const c1 = wClose > wMM20;
    const c2 = wClose < wMM5 || wClose < wMM10;
    const c3 = wStoch89K < wStoch89Kprev && wStoch89K > 85; // corte bajista pero >85
    const c4 = wMacdHist > 0 && wMacdVal > wMacdSig;        // MACD cortado al alza
    const c5 = wRSI14 > 57;
    const c6 = wRSI2 < 40;

    condiciones = [
      { label: 'Precio > MM20 semanal', ok: c1, val: `${fmtP(wClose)} > ${fmtP(wMM20)}` },
      { label: 'Precio < MM5 o < MM10 semanal', ok: c2, val: `MM5:${fmtP(wMM5)} MM10:${fmtP(wMM10)}` },
      { label: 'Stoch(89) corta ↓ pero >85', ok: c3, val: `Stoch89: ${fmt(wStoch89K)} (prev: ${fmt(wStoch89Kprev)})` },
      { label: 'MACD cortado al alza (hist >0)', ok: c4, val: `Hist: ${fmt(wMacdHist)}` },
      { label: 'RSI(14) semanal >57', ok: c5, val: fmt(wRSI14) },
      { label: 'RSI(2) semanal <40', ok: c6, val: fmt(wRSI2) },
    ];

    // Entrada: Stoch(5) diario cruza al alza
    const entradaOk = dStoch5K > dStoch5Kprev && dStoch5Kprev < 30;
    entrada = [
      { label: 'Stoch(5) diario cruza al alza desde <30', ok: entradaOk, val: `K: ${fmt(dStoch5K)} prev: ${fmt(dStoch5Kprev)}` },
    ];

    const cumple = [c1,c2,c3,c4,c5,c6].every(Boolean);
    resultado = cumple ? (entradaOk ? 'entrada' : 'espera') : 'no-cumple';

  } else {
    // ── TIPO 2: Corrección normal ─────────────────
    const c1 = wClose < wMM10;
    const c2 = wClose > wMM34;
    const c3 = wClose != null && wMM20 != null && Math.abs(wClose - wMM20) / wMM20 < 0.05; // cerca MM20 (<5%)
    const c4 = wRSI14 < 57;
    const c5 = wMacdHist < 0 && wMacdVal > 0;  // MACD cortado ↓ pero >0
    const c6 = wStoch89K > 75;                  // Stoch(89) >75 (admite >75 si se cumplen resto)
    const c7 = wStoch14K < 60;                  // Stoch(14) ↓ <60

    condiciones = [
      { label: 'Precio < MM10 semanal', ok: c1, val: `${fmtP(wClose)} < ${fmtP(wMM10)}` },
      { label: 'Precio > MM34 semanal', ok: c2, val: `${fmtP(wClose)} > ${fmtP(wMM34)}` },
      { label: 'Precio cerca MM20 semanal (<5%)', ok: c3, val: `MM20: ${fmtP(wMM20)} · dist: ${wMM20 ? ((Math.abs(wClose-wMM20)/wMM20)*100).toFixed(1)+'%' : '—'}` },
      { label: 'RSI(14) semanal <57', ok: c4, val: fmt(wRSI14) },
      { label: 'MACD cortado ↓ pero >0', ok: c5, val: `Hist: ${fmt(wMacdHist)} · MACD: ${fmt(wMacdVal)}` },
      { label: 'Stoch(89) semanal >75', ok: c6, val: fmt(wStoch89K) },
      { label: 'Stoch(14) semanal <60', ok: c7, val: fmt(wStoch14K) },
    ];

    // Entrada diario: RSI(14) <40 + precio > MM5 > MM10 > MM20
    const eRSI  = dRSI14 < 40;
    const eMMs  = dClose > dMM5 && dMM5 > dMM10 && dMM10 > dMM20;
    const eMM20 = dMM20 > dMM34; // confirmación MM20 > MM34
    entrada = [
      { label: 'RSI(14) diario <40', ok: eRSI, val: fmt(dRSI14) },
      { label: 'Precio > MM5 > MM10 > MM20 diario', ok: eMMs, val: `P:${fmtP(dClose)} MM5:${fmtP(dMM5)} MM10:${fmtP(dMM10)} MM20:${fmtP(dMM20)}` },
      { label: 'Confirmación: MM20 > MM34 diario', ok: eMM20, val: `MM20:${fmtP(dMM20)} MM34:${fmtP(dMM34)}` },
    ];

    const cumple = [c1,c2,c4,c5,c6,c7].every(Boolean); // c3 es orientativo
    const entradaOk = eRSI && eMMs;
    resultado = cumple ? (entradaOk ? 'entrada' : 'espera') : 'no-cumple';
  }

  return {
    precio: wClose, nombre: data.name, moneda: data.currency,
    wMM5, wMM10, wMM20, wMM34,
    condiciones, entrada, resultado,
    updatedAt: new Date().toISOString(),
  };
}

// ── Badge de resultado ────────────────────────
function badgeResultado(r) {
  if (r === 'entrada')   return `<span style="background:rgba(74,222,128,0.15);color:var(--green);padding:3px 10px;border-radius:10px;font-size:9px;font-weight:700;font-family:var(--mono);">🟢 ENTRADA</span>`;
  if (r === 'espera')    return `<span style="background:rgba(251,191,36,0.12);color:var(--amber);padding:3px 10px;border-radius:10px;font-size:9px;font-weight:700;font-family:var(--mono);">⏳ ESPERA</span>`;
  if (r === 'no-cumple') return `<span style="background:rgba(244,113,116,0.12);color:var(--red);padding:3px 10px;border-radius:10px;font-size:9px;font-weight:700;font-family:var(--mono);">❌ NO CUMPLE</span>`;
  return `<span style="background:var(--surface2);color:var(--text3);padding:3px 10px;border-radius:10px;font-size:9px;font-family:var(--mono);">⏳ PENDIENTE</span>`;
}

// ── Render condición ──────────────────────────
function condRow(c) {
  return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);">
    <span style="font-size:13px;flex-shrink:0;">${c.ok ? '✅' : '❌'}</span>
    <span style="flex:1;font-size:11px;color:${c.ok?'var(--text1)':'var(--text3)'};">${c.label}</span>
    <span style="font-family:var(--mono);font-size:10px;color:${c.ok?'var(--teal)':'var(--text3)'};">${c.val}</span>
  </div>`;
}

// ── RENDER ────────────────────────────────────
export async function render(container, { actionsSlot, savedState }) {
  actionsSlot.innerHTML = '';
  container.innerHTML = `<div id="cor-wrap"><div class="empty"><div class="loader-ring"></div></div></div>`;

  let watchlist = (await UserData.get(STORAGE_KEY)) || [];

  function paint() {
    const el = document.getElementById('cor-wrap');
    el.innerHTML = `
      <!-- Añadir valor -->
      <div class="mc-card" style="margin-bottom:16px;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--text3);margin-bottom:12px;">Añadir a Watchlist de Correcciones</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <input type="text" id="cor-ticker" placeholder="Ticker (ej. AAPL)" class="wl-input" style="width:160px;text-transform:uppercase;">
          <select id="cor-tipo" class="wl-input" style="width:220px;">
            <option value="1">Tipo 1 — Corrección superficial</option>
            <option value="2">Tipo 2 — Corrección normal</option>
          </select>
          <input type="text" id="cor-nota" placeholder="Nota opcional (ej. corrige a MM20)" class="wl-input" style="flex:1;min-width:180px;">
          <button class="btn btn-primary" id="cor-add-btn">+ Añadir</button>
        </div>
        <div style="margin-top:10px;font-size:10px;color:var(--text3);line-height:1.6;">
          <strong style="color:var(--text2);">Tipo 1:</strong> Corrección superficial — precio sigue sobre MM20 semanal. Entrada: Stoch(5) cruza ↑.<br>
          <strong style="color:var(--text2);">Tipo 2:</strong> Corrección normal — precio perfora MM10, busca MM20/MM34. Entrada: RSI(14) diario &lt;40 + alineación MMs.
        </div>
      </div>

      <!-- Lista -->
      ${watchlist.length === 0 ? `
        <div class="empty">
          <div class="empty-icon">📋</div>
          <div class="empty-title">Watchlist vacía</div>
          <div class="empty-desc">Añade valores que estén en corrección para hacer seguimiento.</div>
        </div>` : watchlist.map((item, idx) => `
        <div class="mc-card" style="margin-bottom:12px;" id="cor-card-${idx}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
            <div>
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-family:var(--mono);font-size:16px;font-weight:700;color:var(--text1);">${item.ticker}</span>
                <span style="font-size:9px;padding:2px 8px;border-radius:10px;font-family:var(--mono);background:rgba(64,217,192,0.1);color:var(--teal);">TIPO ${item.tipo}</span>
                ${badgeResultado(item.resultado)}
                ${item.nota ? `<span style="font-size:10px;color:var(--text3);font-style:italic;">${item.nota}</span>` : ''}
              </div>
              ${item.nombre ? `<div style="font-size:10px;color:var(--text3);margin-top:3px;">${item.nombre} · ${item.moneda||'USD'} · Precio: $${item.precio?.toFixed(2)||'—'}</div>` : ''}
              ${item.updatedAt ? `<div style="font-size:9px;color:var(--text3);font-family:var(--mono);margin-top:2px;">Última actualización: ${new Date(item.updatedAt).toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn" data-idx="${idx}" id="cor-refresh-${idx}" style="font-size:10px;padding:4px 10px;">↻ Actualizar</button>
              <button class="btn" data-idx="${idx}" id="cor-del-${idx}" style="font-size:10px;padding:4px 10px;color:var(--red);border-color:rgba(244,113,116,0.3);">✕</button>
            </div>
          </div>

          ${item.condiciones?.length ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div>
              <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:8px;">
                Condiciones semanales · ${item.condiciones.filter(c=>c.ok).length}/${item.condiciones.length} ✓
              </div>
              ${item.condiciones.map(condRow).join('')}
            </div>
            <div>
              <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:8px;">
                Señal de entrada · diario
              </div>
              ${(item.entrada||[]).map(condRow).join('')}
              ${item.resultado === 'entrada' ? `
              <div style="margin-top:10px;background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.25);border-radius:8px;padding:10px 12px;">
                <div style="font-size:11px;color:var(--green);font-weight:700;">🟢 Condiciones de entrada activas</div>
                <div style="font-size:10px;color:var(--text2);margin-top:4px;">Revisar el gráfico y confirmar la señal antes de entrar.</div>
              </div>` : item.resultado === 'espera' ? `
              <div style="margin-top:10px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.2);border-radius:8px;padding:10px 12px;">
                <div style="font-size:11px;color:var(--amber);font-weight:700;">⏳ Condiciones de corrección activas</div>
                <div style="font-size:10px;color:var(--text2);margin-top:4px;">Esperando señal de entrada en diario.</div>
              </div>` : ''}
            </div>
          </div>` : `
          <div style="display:flex;align-items:center;gap:8px;color:var(--text3);font-size:11px;">
            <div class="loader-ring" style="width:14px;height:14px;"></div>
            Pulsa ↻ Actualizar para analizar las condiciones
          </div>`}
        </div>`).join('')}
    `;

    // Listeners
    document.getElementById('cor-add-btn')?.addEventListener('click', async () => {
      const ticker = document.getElementById('cor-ticker')?.value.trim().toUpperCase();
      const tipo   = parseInt(document.getElementById('cor-tipo')?.value || '1');
      const nota   = document.getElementById('cor-nota')?.value.trim();
      if (!ticker) return;
      if (watchlist.find(w => w.ticker === ticker && w.tipo === tipo)) {
        alert(`${ticker} ya está en la watchlist con Tipo ${tipo}`);
        return;
      }
      watchlist.push({ ticker, tipo, nota, resultado: 'pendiente', addedAt: new Date().toISOString() });
      await UserData.set(STORAGE_KEY, watchlist);
      paint();
      // Analizar inmediatamente
      analyzeItem(watchlist.length - 1);
    });

    watchlist.forEach((item, idx) => {
      document.getElementById(`cor-refresh-${idx}`)?.addEventListener('click', () => analyzeItem(idx));
      document.getElementById(`cor-del-${idx}`)?.addEventListener('click', async () => {
        watchlist.splice(idx, 1);
        await UserData.set(STORAGE_KEY, watchlist);
        paint();
      });
    });

    // Auto-analizar los que no tienen condiciones
    watchlist.forEach((item, idx) => {
      if (!item.condiciones) analyzeItem(idx);
    });
  }

  async function analyzeItem(idx) {
    const item = watchlist[idx];
    if (!item) return;
    const card = document.getElementById(`cor-card-${idx}`);
    const btn  = document.getElementById(`cor-refresh-${idx}`);
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
    try {
      const data = await fetchOHLC(item.ticker);
      const result = analyzeCorrection(data, item.tipo);
      watchlist[idx] = { ...item, ...result };
      await UserData.set(STORAGE_KEY, watchlist);
      paint();
    } catch(e) {
      if (btn) { btn.disabled = false; btn.textContent = '↻ Actualizar'; }
      const card = document.getElementById(`cor-card-${idx}`);
      if (card) {
        const info = card.querySelector('div[style*="loader-ring"]');
        if (info) info.innerHTML = `<span style="color:var(--red);">⚠ ${e.message}</span>`;
      }
    }
  }

  paint();
  return { destroy() {} };
}

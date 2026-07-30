// ═══════════════════════════════════════════════
// MÓDULO: Cartera · Gestión de Posiciones
// Replicación exacta del original:
// - Cards por posición con precio actual, P&L, stops
// - Stop activo: EMA10 Semanal o EMA10 Diario
// - Alertas: 🛑 Stop tocado · 🚨 Escape Falso
// - Persistencia en Firestore via UserData
// ═══════════════════════════════════════════════

import { UserData } from '../../userdata.js';

const STORAGE_KEY = 'ethan_positions';
const HISTORY_KEY  = 'ethan_positions_history';

const PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://soft-field-156f.miguel-gomez-anton.workers.dev/?url=${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
];

async function fetchData(ticker) {
  const TICKER = (ticker === '3GOL' ? '3GOL.MI' : ticker);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${TICKER}?interval=1d&range=6mo&events=history`;
  for (const fn of PROXIES) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(fn(url), { signal: ctrl.signal });
      clearTimeout(tid);
      if (!r.ok) continue;
      const text = await r.text();
      let j; try { j = JSON.parse(text); } catch { continue; }
      const res = j?.chart?.result?.[0]; if (!res) continue;
      const q = res.indicators?.quote?.[0]; if (!q) continue;
      const meta = res.meta || {};
      const adj = res.indicators.adjclose?.[0]?.adjclose || q.close;
      // Filtrar índices con cierre válido
      const valid = res.timestamp.map((_,i) => i).filter(i =>
        adj[i] != null && !isNaN(adj[i]) && q.high[i] != null && q.low[i] != null
      );
      if (!valid.length) continue;
      return {
        timestamps: valid.map(i => res.timestamp[i]),
        opens:   valid.map(i => q.open[i]),
        highs:   valid.map(i => q.high[i]),
        lows:    valid.map(i => q.low[i]),
        closes:  valid.map(i => adj[i]),
        volumes: valid.map(i => q.volume[i]),
        name: meta.shortName || meta.longName || ticker,
        currency: meta.currency || 'USD'
      };
    } catch {}
  }
  throw new Error('Sin datos disponibles');
}

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

function resampleWeekly(ts, O, H, L, C, V) {
  const weeks = {};
  ts.forEach((t, i) => {
    const d = new Date(t*1000);
    const dy = d.getDay(), df = d.getDate()-dy+(dy===0?-6:1);
    const mo = new Date(+d); mo.setDate(df);
    const key = mo.toISOString().slice(0,10);
    if (!weeks[key]) weeks[key] = { o:O[i], h:H[i], l:L[i], c:C[i], v:V[i] };
    else { weeks[key].h=Math.max(weeks[key].h,H[i]); weeks[key].l=Math.min(weeks[key].l,L[i]); weeks[key].c=C[i]; weeks[key].v+=V[i]; }
  });
  const keys = Object.keys(weeks).sort();
  return { opens:keys.map(k=>weeks[k].o), highs:keys.map(k=>weeks[k].h), lows:keys.map(k=>weeks[k].l), closes:keys.map(k=>weeks[k].c) };
}

function detectEscapeFalso(highs, closes) {
  const n = highs.length; if (n < 5) return false;
  const curr=n-1, prev1=n-2, prev2=n-3;
  let maxPrev = 0;
  for (let i = Math.max(0, prev2-10); i < prev2; i++) maxPrev = Math.max(maxPrev, highs[i]);
  return highs[prev2] > maxPrev
    && closes[prev1] < highs[prev2]
    && closes[curr]  < highs[prev2]
    && closes[prev1] < closes[prev2]
    && closes[curr]  < closes[prev1];
}

function analyzePosition(pos, data) {
  const { timestamps, opens, highs, lows, closes, volumes, name, currency } = data;
  const n = closes.length, di = n-1;
  const currentPrice = closes[di];

  const ema10d = calcEMA(closes, 10);
  const stopDiario = ema10d[di];

  const W = resampleWeekly(timestamps, opens, highs, lows, closes, volumes);
  const ema10w = calcEMA(W.closes, 10);
  const stopSemanal = ema10w[W.closes.length-1];

  const activeStop = pos.stopType === 'manual'
    ? pos.stopManual
    : pos.stopType === 'semanal' ? stopSemanal : stopDiario;
  const escapeFalso = detectEscapeFalso(highs, closes);
  const pnlPct = ((currentPrice - pos.entry) / pos.entry) * 100;
  const distStop = ((currentPrice - activeStop) / currentPrice) * 100;
  const tocoStop = currentPrice <= activeStop * 1.005;

  return { currentPrice, stopDiario, stopSemanal, activeStop, escapeFalso, tocoStop, pnlPct, distStop, name, currency };
}

// ── RENDER ─────────────────────────────────────
export async function render(container, { actionsSlot }) {
  let positions = (await UserData.get(STORAGE_KEY)) || [];
  let history   = (await UserData.get(HISTORY_KEY))  || [];

  actionsSlot.innerHTML = `
    <button class="btn btn-primary" id="pos-open-form-btn">+ Nueva posición</button>
  `;

  // Formulario como panel expandible en el container
  container.innerHTML = `
    <div id="pos-form-panel" style="display:none;"></div>
    <div id="pos-list"></div>
  `;

  function showForm() {
    const panel = document.getElementById('pos-form-panel');
    panel.style.display = 'block';
    panel.innerHTML = `
      <div class="pos-form-card">
        <div class="pos-form-title">Nueva posición</div>

        <!-- Fila 1: Ticker + buscar + dirección -->
        <div class="pos-form-search">
          <div class="pos-form-field">
            <label>Dirección</label>
            <select id="pf-direction" class="sc2-sel" style="width:130px;">
              <option value="alcista">📈 Alcista (Long)</option>
              <option value="bajista">📉 Bajista (Short)</option>
            </select>
          </div>
          <div class="pos-form-field">
            <label>Ticker</label>
            <input type="text" id="pf-ticker" placeholder="AAPL, 3GOL..." class="wl-input" style="width:140px;text-transform:uppercase;" autocomplete="off">
          </div>
          <button class="btn btn-primary" id="pf-search-btn" style="margin-top:18px;">🔍 Buscar</button>
          <div id="pf-search-status" style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:22px;"></div>
        </div>

        <!-- Fila 2: Datos principales -->
        <div class="pos-form-grid">
          <div class="pos-form-field">
            <label>Precio entrada</label>
            <input type="number" id="pf-entry" placeholder="150.00" step="0.01" class="wl-input">
          </div>
          <div class="pos-form-field">
            <label>Nº acciones / participaciones</label>
            <input type="number" id="pf-shares" placeholder="100" step="1" class="wl-input">
          </div>
          <div class="pos-form-field">
            <label>Coste total inversión</label>
            <input type="number" id="pf-cost" placeholder="15000.00" step="0.01" class="wl-input" readonly style="opacity:0.7;">
            <div style="font-size:9px;color:var(--text3);margin-top:3px;font-family:var(--mono);">Se calcula automáticamente</div>
          </div>
          <div class="pos-form-field">
            <label>Fecha de entrada</label>
            <input type="date" id="pf-date" value="${new Date().toISOString().slice(0,10)}" class="wl-input">
          </div>
          <div class="pos-form-field">
            <label>Stop loss</label>
            <select id="pf-stop-type" class="sc2-sel" style="width:100%;">
              <option value="semanal">EMA10 Semanal (dinámico)</option>
              <option value="diario">EMA10 Diario (dinámico)</option>
              <option value="manual">Manual (precio fijo)</option>
            </select>
          </div>
          <div class="pos-form-field">
            <label>Stop de entrada (€) <span style="color:var(--text3);text-transform:none;">— precio del stop al abrir</span></label>
            <input type="number" id="pf-entry-stop" placeholder="ej. 145.00" step="0.01" class="wl-input">
          </div>
          <div class="pos-form-field" id="pf-stop-manual-wrap" style="display:none;">
            <label>Stop loss manual (precio fijo)</label>
            <input type="number" id="pf-stop-manual" placeholder="140.00" step="0.01" class="wl-input">
          </div>
        </div>

        <!-- Fila 3: Nombre manual (si no encuentra el ticker) -->
        <div class="pos-form-grid">
          <div class="pos-form-field" style="grid-column:1/3">
            <label>Nombre del activo <span style="color:var(--text3)">(opcional — se rellena automáticamente)</span></label>
            <input type="text" id="pf-name" placeholder="ej. WisdomTree Gold 3x Daily Leveraged" class="wl-input" style="width:100%;">
          </div>
          <div class="pos-form-field" style="grid-column:3/4">
            <label>Notas</label>
            <input type="text" id="pf-notas" placeholder="Motivo de entrada, contexto..." class="wl-input" style="width:100%;">
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px;">
          <button class="btn" id="pf-cancel-btn">Cancelar</button>
          <button class="btn btn-primary" id="pf-add-btn">+ Añadir a cartera</button>
        </div>
      </div>
    `;

    // Calcular coste total automáticamente
    ['pf-entry','pf-shares'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => {
        const entry  = parseFloat(document.getElementById('pf-entry')?.value || 0);
        const shares = parseFloat(document.getElementById('pf-shares')?.value || 0);
        if (entry > 0 && shares > 0) {
          document.getElementById('pf-cost').value = (entry * shares).toFixed(2);
        }
      });
    });

    // Mostrar/ocultar stop manual
    document.getElementById('pf-stop-type')?.addEventListener('change', e => {
      document.getElementById('pf-stop-manual-wrap').style.display = e.target.value === 'manual' ? 'block' : 'none';
    });

    // Buscar ticker en Yahoo
    document.getElementById('pf-search-btn')?.addEventListener('click', async () => {
      const ticker = document.getElementById('pf-ticker')?.value.trim().toUpperCase();
      if (!ticker) return;
      const st = document.getElementById('pf-search-status');
      st.textContent = 'Buscando...'; st.style.color = 'var(--text3)';
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`;
        let found = false;
        for (const fn of PROXIES) {
          try {
            const r = await fetch(fn(url), { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 6000); return c.signal; })() });
            if (!r.ok) continue;
            const j = JSON.parse(await r.text());
            const meta = j?.chart?.result?.[0]?.meta;
            if (!meta) continue;
            const name = meta.shortName || meta.longName || ticker;
            const price = meta.regularMarketPrice;
            document.getElementById('pf-name').value = name;
            if (price && !document.getElementById('pf-entry').value) {
              document.getElementById('pf-entry').value = price.toFixed(2);
            }
            st.textContent = `✓ Encontrado: ${name}${price?' · $'+price.toFixed(2):''}`;
            st.style.color = 'var(--green)';
            found = true; break;
          } catch {}
        }
        if (!found) {
          st.textContent = '⚠ No encontrado en Yahoo · puedes añadirlo manualmente';
          st.style.color = 'var(--amber)';
        }
      } catch {
        st.textContent = '⚠ Error de conexión · puedes añadirlo manualmente';
        st.style.color = 'var(--amber)';
      }
    });

    document.getElementById('pf-ticker')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('pf-search-btn')?.click();
      e.target.value = e.target.value.toUpperCase();
    });

    document.getElementById('pf-cancel-btn')?.addEventListener('click', () => {
      panel.style.display = 'none';
    });

    document.getElementById('pf-add-btn')?.addEventListener('click', async () => {
      const direction= document.getElementById('pf-direction')?.value || 'alcista';
      const ticker   = document.getElementById('pf-ticker')?.value.trim().toUpperCase();
      const entry    = parseFloat(document.getElementById('pf-entry')?.value);
      const shares   = parseFloat(document.getElementById('pf-shares')?.value) || null;
      const cost     = parseFloat(document.getElementById('pf-cost')?.value) || (entry && shares ? entry*shares : null);
      const entryDate= document.getElementById('pf-date')?.value || new Date().toISOString().slice(0,10);
      const stopType  = document.getElementById('pf-stop-type')?.value || 'semanal';
      const stopManual= stopType==='manual'?parseFloat(document.getElementById('pf-stop-manual')?.value)||null:null;
      const entryStop = parseFloat(document.getElementById('pf-entry-stop')?.value)||stopManual||null;
      const name      = document.getElementById('pf-name')?.value.trim() || '';
      const notas     = document.getElementById('pf-notas')?.value.trim() || '';

      if (!ticker || !entry || entry <= 0) { alert('Ticker y precio de entrada son obligatorios.'); return; }
      if (positions.find(p => p.ticker === ticker)) { alert(`${ticker} ya está en cartera.`); return; }

      positions.push({ direction, ticker, name, entry, shares, cost, entryDate, stopType, stopManual, entryStop, notas, addedAt: new Date(entryDate).getTime() || Date.now() });
      await savePositions();

      // Disparar backfill de precios desde fecha de entrada hasta hoy
      fetch('/api/backfill-ticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-ETHAN-Client': 'true' },
        body: JSON.stringify({ ticker, dateFrom: entryDate, dateTo: new Date().toISOString().slice(0,10), status: 'active', forceRefresh: true }),
      }).catch(() => {}); // silencioso — no bloquea la UI

      panel.style.display = 'none';
      renderAll();
    });
  }

  document.getElementById('pos-open-form-btn')?.addEventListener('click', showForm);

  async function savePositions() {
    await UserData.set(STORAGE_KEY, positions);
  }
  async function saveHistory() {
    await UserData.set(HISTORY_KEY, history);
  }

  function renderCard(pos, analysis, loading=false) {
    const pnlColor = analysis?.pnlPct > 0 ? 'var(--green)' : analysis?.pnlPct < 0 ? 'var(--red)' : 'var(--text2)';
    const pnlSign  = analysis?.pnlPct > 0 ? '+' : '';
    const fmtP = v => v != null ? '$'+v.toFixed(2) : '—';
    const fmtPct = v => v != null ? v.toFixed(1)+'%' : '—';

    if (loading) return `
      <div class="pos-card loading" id="poscard-${pos.ticker}">
        <div class="pos-card-header">
          <div><div class="pos-ticker">${pos.ticker}</div><div class="pos-name">Cargando...</div></div>
          <span class="wl-spinner"></span>
        </div>
      </div>`;

    if (!analysis) return `
      <div class="pos-card" id="poscard-${pos.ticker}">
        <div class="pos-card-header">
          <div>
            <div class="pos-ticker">${pos.ticker} <span class="pos-dir-badge ${pos.direction==='bajista'?'short':'long'}">${pos.direction==='bajista'?'📉 SHORT':'📈 LONG'}</span></div>
            <div class="pos-name" style="color:var(--amber)">${pos.name||'Sin datos de mercado — posición manual'}</div>
            ${pos.notas?`<div class="pos-notas">${pos.notas}</div>`:''}
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <button class="pos-close-btn" data-ticker="${pos.ticker}" data-price="" title="Cerrar posición">✓ Cerrar</button>
            <button class="pos-del-btn" data-ticker="${pos.ticker}" title="Eliminar sin guardar">✕</button>
          </div>
        </div>
        <div class="pos-metrics">
          <div class="pos-metric"><div class="pos-metric-label">Precio Entrada</div><div class="pos-metric-val" style="color:var(--text2)">${fmtP(pos.entry)}</div></div>
          ${pos.shares?`<div class="pos-metric"><div class="pos-metric-label">Acciones</div><div class="pos-metric-val" style="font-size:16px;">${pos.shares}</div></div>`:''}
          ${pos.cost?`<div class="pos-metric"><div class="pos-metric-label">Inversión total</div><div class="pos-metric-val" style="font-size:16px;">$${parseFloat(pos.cost).toFixed(0)}</div></div>`:''}
          ${pos.entryDate?`<div class="pos-metric"><div class="pos-metric-label">Fecha entrada</div><div class="pos-metric-val" style="font-size:13px;font-family:var(--mono);">${new Date(pos.entryDate).toLocaleDateString('es-ES')}</div></div>`:''}
        </div>
        <div style="font-size:10px;color:var(--amber);font-family:var(--mono);padding:8px 0;">⚠ No se pudieron cargar datos de mercado para este ticker</div>
      </div>`;

    const distD = ((analysis.currentPrice - analysis.stopDiario)  / analysis.currentPrice * 100).toFixed(1);
    const distW = ((analysis.currentPrice - analysis.stopSemanal) / analysis.currentPrice * 100).toFixed(1);

    return `
      <div class="pos-card ${analysis.tocoStop?'stop-hit':''} ${analysis.escapeFalso?'escape-alert-card':''}" id="poscard-${pos.ticker}">
        <div class="pos-card-header">
          <div>
            <div class="pos-ticker">${pos.ticker} <span class="pos-dir-badge ${pos.direction==='bajista'?'short':'long'}">${pos.direction==='bajista'?'📉 SHORT':'📈 LONG'}</span></div>
            <div class="pos-name">${analysis.name||''} · ${analysis.currency||'USD'}</div>
            ${pos.notas?`<div class="pos-notas">${pos.notas}</div>`:''}
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <button class="pos-close-btn" data-ticker="${pos.ticker}" data-price="${analysis.currentPrice?.toFixed(2)||''}" title="Cerrar posición">✓ Cerrar</button>
            <button class="pos-del-btn" data-ticker="${pos.ticker}" title="Eliminar sin guardar">✕</button>
          </div>
        </div>

        <div class="pos-metrics">
          <div class="pos-metric">
            <div class="pos-metric-label">Precio Actual</div>
            <div class="pos-metric-val">${fmtP(analysis.currentPrice)}</div>
          </div>
          <div class="pos-metric">
            <div class="pos-metric-label">Precio Entrada</div>
            <div class="pos-metric-val" style="color:var(--text2)">${fmtP(pos.entry)}</div>
          </div>
          <div class="pos-metric">
            <div class="pos-metric-label">P&L</div>
            <div class="pos-metric-val" style="color:${pnlColor}">${pnlSign}${fmtPct(analysis.pnlPct)}</div>
          </div>
          <div class="pos-metric">
            <div class="pos-metric-label">Stop Activo ${pos.stopType==='manual'?'(Manual)':pos.stopType==='semanal'?'(Semanal)':'(Diario)'}</div>
            <div class="pos-metric-val" style="color:var(--red)">${fmtP(analysis.activeStop)}</div>
          </div>
          ${pos.shares ? `
          <div class="pos-metric">
            <div class="pos-metric-label">Acciones</div>
            <div class="pos-metric-val" style="font-size:16px;">${pos.shares}</div>
          </div>` : ''}
          ${pos.cost ? `
          <div class="pos-metric">
            <div class="pos-metric-label">Inversión total</div>
            <div class="pos-metric-val" style="font-size:16px;">$${parseFloat(pos.cost).toFixed(0)}</div>
          </div>` : ''}
          ${pos.shares && analysis.currentPrice ? `
          <div class="pos-metric">
            <div class="pos-metric-label">Valor actual</div>
            <div class="pos-metric-val" style="color:${pnlColor};font-size:16px;">$${(pos.shares*analysis.currentPrice).toFixed(0)}</div>
          </div>` : ''}
          ${pos.entryDate ? `
          <div class="pos-metric">
            <div class="pos-metric-label">Fecha entrada</div>
            <div class="pos-metric-val" style="font-size:13px;font-family:var(--mono);">${new Date(pos.entryDate).toLocaleDateString('es-ES')}</div>
          </div>` : ''}
        </div>

        <div class="pos-stops">
          <div class="pos-stop-row ${pos.stopType==='diario'?'active':''}">
            <span class="pos-stop-label">EMA10 Diario</span>
            <span class="pos-stop-val">${fmtP(analysis.stopDiario)}</span>
            <span class="pos-stop-dist">(${distD}%)</span>
          </div>
          <div class="pos-stop-row ${pos.stopType==='semanal'?'active':''}">
            <span class="pos-stop-label">EMA10 Semanal</span>
            <span class="pos-stop-val">${fmtP(analysis.stopSemanal)}</span>
            <span class="pos-stop-dist">(${distW}%)</span>
          </div>
        </div>

        ${analysis.tocoStop ? `
          <div class="pos-alert stop">
            <span class="pos-alert-icon">🛑</span>
            <div>
              <div class="pos-alert-title">STOP TOCADO — EMA10 ${pos.stopType==='semanal'?'SEMANAL':'DIARIO'}</div>
              <div class="pos-alert-desc">El precio ha alcanzado tu stop dinámico en ${fmtP(analysis.activeStop)}. Considera cerrar la posición.</div>
            </div>
          </div>` : ''}

        ${analysis.escapeFalso ? `
          <div class="pos-alert escape">
            <span class="pos-alert-icon">🚨</span>
            <div>
              <div class="pos-alert-title">ESCAPE FALSO DETECTADO</div>
              <div class="pos-alert-desc">El precio hizo nuevo máximo pero cerró por debajo. Señal de debilidad — considera salir antes del stop.</div>
            </div>
          </div>` : ''}
      </div>`;
  }

  function attachCardListeners() {
    document.querySelectorAll('.pos-del-btn:not([data-idx])').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`¿Eliminar ${btn.dataset.ticker} sin guardar en historial?`)) return;
        positions = positions.filter(p => p.ticker !== btn.dataset.ticker);
        await savePositions();
        renderAll();
      });
    });
    document.querySelectorAll('.pos-close-btn').forEach(btn => {
      btn.addEventListener('click', () => showCloseModal(btn.dataset.ticker, parseFloat(btn.dataset.price)));
    });
  }

  async function renderAll() {
    const el = document.getElementById('pos-list');
    if (!el) return;

    if (positions.length === 0) {
      el.innerHTML = `
        <div class="empty">
          <div class="empty-icon">📊</div>
          <div class="empty-title">Sin posiciones abiertas</div>
          <div class="empty-desc">Añade un ticker, precio de entrada y tipo de stop arriba.</div>
        </div>
        <div class="pos-hist-section">
          <div class="pos-hist-title">📋 Historial de operaciones cerradas</div>
          <div id="pos-history"></div>
        </div>`;
      renderHistory();
      return;
    }

    el.innerHTML = `
      <div class="pos-open-section">
        <div class="pos-section-title">📂 Posiciones abiertas (${positions.length})</div>
        ${positions.map(p => renderCard(p, null, true)).join('')}
      </div>
      <div class="pos-hist-section">
        <div class="pos-hist-title">📋 Historial de operaciones cerradas</div>
        <div id="pos-history"></div>
      </div>`;

    renderHistory();

    await Promise.all(positions.map(async pos => {
      try {
        const data = await fetchData(pos.ticker);
        const analysis = analyzePosition(pos, data);
        // Persistir currentPrice para que Métricas lo lea sin llamadas de red
        if (analysis.currentPrice && analysis.currentPrice !== pos.currentPrice) {
          pos.currentPrice = analysis.currentPrice;
          pos.prevPrice = data.closes?.[data.closes.length - 2] || analysis.currentPrice;
          await savePositions();
        }
        const card = document.getElementById(`poscard-${pos.ticker}`);
        if (card) card.outerHTML = renderCard(pos, analysis);
      } catch {
        const card = document.getElementById(`poscard-${pos.ticker}`);
        if (card) card.outerHTML = renderCard(pos, null);
      }
    }));

    attachCardListeners();
  }

  // ── Modal de cierre ─────────────────────────
  function showCloseModal(ticker, currentPrice) {
    const existing = document.getElementById('pos-close-modal');
    if (existing) existing.remove();

    const pos = positions.find(p => p.ticker === ticker);
    if (!pos) return;

    const modal = document.createElement('div');
    modal.id = 'pos-close-modal';
    modal.innerHTML = `
      <div class="pos-modal-overlay">
        <div class="pos-modal">
          <div class="pos-modal-title">Cerrar posición · ${ticker}</div>
          <div class="pos-modal-body">
            <div class="pos-modal-row">
              <label>Precio de cierre</label>
              <input type="number" id="close-price" value="${currentPrice||''}" step="0.01" class="wl-input" style="width:140px;">
            </div>
            <div class="pos-modal-row">
              <label>Fecha de cierre</label>
              <input type="date" id="close-date" value="${new Date().toISOString().slice(0,10)}" class="wl-input" style="width:160px;">
            </div>
            <div class="pos-modal-row">
              <label>Motivo de cierre</label>
              <select id="close-reason" class="sc2-sel" style="width:200px;">
                <option value="stop">🛑 Stop tocado (EMA10)</option>
                <option value="objetivo">🎯 Objetivo alcanzado</option>
                <option value="escape">🚨 Escape falso</option>
                <option value="condiciones">📉 Condiciones rotas</option>
                <option value="manual">✋ Cierre manual</option>
              </select>
            </div>
            <div class="pos-modal-row">
              <label>Notas de cierre</label>
              <input type="text" id="close-notas" placeholder="Opcional..." class="wl-input" style="width:280px;">
            </div>
            ${currentPrice ? `
            <div class="pos-modal-pnl">
              P&L estimado: <strong style="color:${currentPrice>=pos.entry?'var(--green)':'var(--red)'}">
                ${currentPrice>=pos.entry?'+':''}${(((currentPrice-pos.entry)/pos.entry)*100).toFixed(2)}%
              </strong>
            </div>` : ''}
          </div>
          <div class="pos-modal-footer">
            <button class="btn" id="close-cancel">Cancelar</button>
            <button class="btn btn-primary" id="close-confirm">Confirmar cierre</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    document.getElementById('close-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('.pos-modal-overlay').addEventListener('click', e => { if(e.target===e.currentTarget) modal.remove(); });

    // Actualizar P&L en tiempo real al cambiar precio
    document.getElementById('close-price').addEventListener('input', e => {
      const p = parseFloat(e.target.value);
      const pnlEl = modal.querySelector('.pos-modal-pnl');
      if (pnlEl && p > 0) {
        const pnl = ((p-pos.entry)/pos.entry*100).toFixed(2);
        pnlEl.innerHTML = `P&L: <strong style="color:${p>=pos.entry?'var(--green)':'var(--red)'}">${p>=pos.entry?'+':''}${pnl}%</strong>`;
      }
    });

    document.getElementById('close-confirm').addEventListener('click', async () => {
      const closePrice  = parseFloat(document.getElementById('close-price').value);
      const closeDate   = document.getElementById('close-date').value;
      const closeReason = document.getElementById('close-reason').value;
      const closeNotas  = document.getElementById('close-notas').value;

      if (!closePrice || closePrice <= 0) { alert('Introduce el precio de cierre'); return; }

      const direction = pos.direction || 'alcista';
      // En bajista (short) el P&L es inverso: ganas si el precio baja
      const pnlPct = direction === 'bajista'
        ? ((pos.entry - closePrice) / pos.entry) * 100
        : ((closePrice - pos.entry) / pos.entry) * 100;

      const entryDateObj = pos.entryDate ? new Date(pos.entryDate) : new Date(pos.addedAt);
      const exitDate  = new Date(closeDate);
      const duration  = Math.max(0, Math.round((exitDate - entryDateObj) / 86400000));
      const pnlAbs = pos.cost ? (pos.cost * pnlPct / 100) : null;
      const entryDateISO = entryDateObj.toISOString().slice(0,10);

      // Guardar historial de precios diarios en Firestore ANTES de guardar el cierre
      // Esto permite calcular el NAV real en Métricas sin llamar a Yahoo cada vez
      await savePriceHistory(pos.ticker, entryDateISO, closeDate, direction);

      history.unshift({
        direction:   direction,
        ticker:      pos.ticker,
        name:        pos.name || pos.ticker,
        entry:       pos.entry,
        exit:        closePrice,
        shares:      pos.shares || null,
        cost:        pos.cost || null,
        entryStop:   pos.entryStop || pos.stopManual || null,
        pnlPct:      pnlPct,
        pnlAbs:      pnlAbs,
        stopType:    pos.stopType,
        reason:      closeReason,
        notasEntrada:pos.notas || '',
        notasSalida: closeNotas,
        entryDate:   entryDateObj.toLocaleDateString('es-ES'),
        exitDate:    new Date(closeDate).toLocaleDateString('es-ES'),
        entryDateISO: entryDateISO,
        exitDateISO: closeDate,
        duration:    duration,
        closedAt:    Date.now()
      });

      positions = positions.filter(p => p.ticker !== ticker);
      await savePositions();
      await saveHistory();

      // Marcar ticker como inactive en tracked_assets (ya no necesita precio diario)
      // y guardar el histórico completo del período en Firestore
      fetch('/api/backfill-ticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-ETHAN-Client': 'true' },
        body: JSON.stringify({ ticker: pos.ticker, dateFrom: entryDateISO, dateTo: closeDate, status: 'inactive' }),
      }).catch(() => {});

      modal.remove();
      renderAll();
    });
  }

  // ── Guarda precios históricos en Firestore ──────
  // Clave: ethan_price_history_{ticker}_{entryDate}_{exitDate}
  // Valor: array de { date: 'YYYY-MM-DD', price: number }
  // Se llama UNA SOLA VEZ al cerrar la posición.
  async function savePriceHistory(ticker, entryDate, exitDate, direction) {
    const key = `ethan_ph_${ticker}_${entryDate}_${exitDate}`;

    // No volver a descargar si ya existe (por si se llama dos veces)
    const existing = await UserData.get(key);
    if (existing) return;

    // Calcular el range de Yahoo en función de los días
    const days = Math.ceil((new Date(exitDate) - new Date(entryDate)) / 86400000) + 5;
    const range = days > 365*1.5 ? '5y' : days > 200 ? '2y' : days > 60 ? '6mo' : '3mo';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=${range}`;

    for (const fn of PROXIES) {
      try {
        const r = await fetch(fn(url), { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })() });
        if (!r.ok) continue;
        const j = JSON.parse(await r.text());
        const res = j?.chart?.result?.[0]; if (!res) continue;
        const closes = res.indicators?.quote?.[0]?.close;
        const ts = res.timestamp;
        if (!closes || !ts) continue;

        // Filtrar solo el rango entryDate → exitDate
        const prices = [];
        ts.forEach((t, i) => {
          if (closes[i] == null) return;
          const d = new Date(t * 1000).toISOString().slice(0, 10);
          if (d >= entryDate && d <= exitDate) {
            prices.push({ date: d, price: closes[i] });
          }
        });

        if (prices.length > 0) {
          await UserData.set(key, { ticker, entryDate, exitDate, direction, prices });
          console.log(`[PriceHistory] Guardado ${ticker} ${entryDate}→${exitDate}: ${prices.length} días`);
        }
        return; // éxito — salir del bucle de proxies
      } catch(e) {
        console.warn(`[PriceHistory] Proxy falló para ${ticker}:`, e.message);
      }
    }
    console.warn(`[PriceHistory] No se pudo guardar historial de ${ticker} — se usará pnlPct directo`);
  }

  // ── Historial de posiciones cerradas ─────────
  // ── Cálculo de métricas avanzadas por dirección ──
  function calcMetrics(ops, capital) {
    if (ops.length === 0) return null;

    const wins   = ops.filter(o => o.pnlPct > 0);
    const losses = ops.filter(o => o.pnlPct <= 0);
    const winRate = (wins.length / ops.length) * 100;

    const avgWinPct  = wins.length   ? wins.reduce((s,o)=>s+o.pnlPct,0)/wins.length     : 0;
    const avgLossPct = losses.length ? losses.reduce((s,o)=>s+o.pnlPct,0)/losses.length : 0;
    const avgPnlPct  = ops.reduce((s,o)=>s+o.pnlPct,0) / ops.length;

    // Esperanza matemática: (%win × avgWin) + (%loss × avgLoss)
    const expectancy = (winRate/100 * avgWinPct) + ((1-winRate/100) * avgLossPct);

    // Beneficio total en € (solo si hay coste asignado a las operaciones)
    const totalPnlAbs = ops.reduce((s,o) => s + (o.pnlAbs || 0), 0);
    const hasAbsData = ops.some(o => o.pnlAbs != null);

    // Beneficio total en % sobre capital asignado (si está definido)
    const totalPnlPctOnCapital = capital > 0 ? (totalPnlAbs / capital) * 100 : null;

    // Días medios por operación
    const avgDays = ops.reduce((s,o)=>s+(o.duration||0),0) / ops.length;

    // Volatilidad (desviación estándar de los retornos %)
    const mean = avgPnlPct;
    const variance = ops.reduce((s,o) => s + Math.pow(o.pnlPct - mean, 2), 0) / ops.length;
    const stdDev = Math.sqrt(variance);

    // Sharpe simplificado (asumiendo rf=0): retorno medio / desviación estándar
    const sharpe = stdDev > 0 ? (avgPnlPct / stdDev) : 0;

    // Máxima pérdida individual
    const maxLoss = Math.min(...ops.map(o => o.pnlPct));

    // Máximo Drawdown (sobre la curva acumulada de retornos, ordenada cronológicamente)
    const sorted = [...ops].sort((a,b) => (a.closedAt||0) - (b.closedAt||0));
    let equity = 100, peak = 100, maxDD = 0;
    sorted.forEach(o => {
      equity *= (1 + o.pnlPct/100);
      if (equity > peak) peak = equity;
      const dd = ((peak - equity) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
    });

    return {
      nOps: ops.length, winRate, avgPnlPct, expectancy,
      totalPnlAbs, hasAbsData, totalPnlPctOnCapital,
      avgDays, stdDev, sharpe, maxLoss, maxDD
    };
  }

  function metricsGrid(m, capitalLabel) {
    if (!m) return `<div class="sc2-empty">Sin operaciones cerradas en esta categoría</div>`;
    const fmt = (v,d=2) => v!=null && !isNaN(v) ? v.toFixed(d) : '—';
    const sign = v => v>=0?'+':'';
    const color = v => v>=0?'var(--green)':'var(--red)';

    return `
      <div class="pos-metrics-grid">
        <div class="pos-mtile"><div class="pos-mtile-lbl">Capital Asignado</div><div class="pos-mtile-val">${capitalLabel}</div></div>
        <div class="pos-mtile"><div class="pos-mtile-lbl">Beneficio Total (€)</div><div class="pos-mtile-val" style="color:${m.hasAbsData?color(m.totalPnlAbs):'var(--text3)'}">${m.hasAbsData?(sign(m.totalPnlAbs)+'$'+fmt(m.totalPnlAbs,0)):'Sin coste asignado'}</div></div>
        <div class="pos-mtile"><div class="pos-mtile-lbl">Beneficio Total (%)</div><div class="pos-mtile-val" style="color:${m.totalPnlPctOnCapital!=null?color(m.totalPnlPctOnCapital):'var(--text3)'}">${m.totalPnlPctOnCapital!=null?(sign(m.totalPnlPctOnCapital)+fmt(m.totalPnlPctOnCapital)+'%'):'—'}</div></div>
        <div class="pos-mtile"><div class="pos-mtile-lbl">Ganancia Media</div><div class="pos-mtile-val" style="color:${color(m.avgPnlPct)}">${sign(m.avgPnlPct)}${fmt(m.avgPnlPct)}%</div></div>
        <div class="pos-mtile"><div class="pos-mtile-lbl">Ratio Win</div><div class="pos-mtile-val" style="color:${m.winRate>=50?'var(--green)':'var(--amber)'}">${fmt(m.winRate,1)}%</div></div>
        <div class="pos-mtile"><div class="pos-mtile-lbl">Esperanza Matemática</div><div class="pos-mtile-val" style="color:${color(m.expectancy)}">${sign(m.expectancy)}${fmt(m.expectancy)}%</div></div>
        <div class="pos-mtile"><div class="pos-mtile-lbl">Días Medios / Op.</div><div class="pos-mtile-val">${fmt(m.avgDays,1)}d</div></div>
        <div class="pos-mtile"><div class="pos-mtile-lbl">Ratio Sharpe</div><div class="pos-mtile-val" style="color:${m.sharpe>=1?'var(--green)':m.sharpe>=0?'var(--amber)':'var(--red)'}">${fmt(m.sharpe)}</div></div>
        <div class="pos-mtile"><div class="pos-mtile-lbl">Volatilidad Media</div><div class="pos-mtile-val">${fmt(m.stdDev)}%</div></div>
        <div class="pos-mtile"><div class="pos-mtile-lbl">Máxima Pérdida</div><div class="pos-mtile-val" style="color:var(--red)">${fmt(m.maxLoss)}%</div></div>
        <div class="pos-mtile"><div class="pos-mtile-lbl">Máximo DD</div><div class="pos-mtile-val" style="color:var(--red)">-${fmt(m.maxDD)}%</div></div>
        <div class="pos-mtile"><div class="pos-mtile-lbl">Nº Operaciones</div><div class="pos-mtile-val">${m.nOps}</div></div>
      </div>`;
  }

  function historyTable(ops, prefix) {
    if (ops.length === 0) return `<div class="sc2-empty">Sin operaciones cerradas todavía</div>`;
    const reasonLabel = { stop:'🛑 Stop', objetivo:'🎯 Objetivo', escape:'🚨 Escape falso', condiciones:'📉 Condiciones', manual:'✋ Manual' };

    return `
      <table class="sc2-table" style="margin-top:14px;">
        <thead>
          <tr>
            <th>TICKER</th><th>ENTRADA</th><th>SALIDA</th>
            <th>P&L %</th><th>P&L €</th><th>DURACIÓN</th><th>MOTIVO</th><th>NOTAS</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${ops.map((h) => {
            const globalIdx = history.indexOf(h);
            return `
            <tr>
              <td>
                <div class="sc2-ticker">${h.ticker} <span class="pos-dir-badge ${h.direction==='bajista'?'short':'long'}" style="font-size:7px;">${h.direction==='bajista'?'SHORT':'LONG'}</span></div>
                <div style="font-size:9px;color:var(--text3);font-family:var(--mono);">${h.entryDate} → ${h.exitDate}</div>
              </td>
              <td class="sc2-price">$${h.entry.toFixed(2)}</td>
              <td class="sc2-price">$${h.exit.toFixed(2)}</td>
              <td class="sc2-score" style="color:${h.pnlPct>=0?'var(--green)':'var(--red)'}">${h.pnlPct>=0?'+':''}${h.pnlPct.toFixed(2)}%</td>
              <td class="sc2-price" style="color:${h.pnlAbs!=null?(h.pnlAbs>=0?'var(--green)':'var(--red)'):'var(--text3)'}">${h.pnlAbs!=null?((h.pnlAbs>=0?'+':'')+'$'+h.pnlAbs.toFixed(0)):'—'}</td>
              <td class="sc2-vol">${h.duration}d</td>
              <td style="font-size:10px;color:var(--text2);">${reasonLabel[h.reason]||h.reason}</td>
              <td style="font-size:9px;color:var(--text3);max-width:180px;">${h.notasSalida||'—'}</td>
              <td><button class="pos-del-btn" data-idx="${globalIdx}" title="Eliminar del historial" style="font-size:10px;padding:2px 6px;">✕</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  let activeHistTab = 'alcista';
  let capitalAlcista = null;
  let capitalBajista = null;

  async function loadCapitals() {
    capitalAlcista = await UserData.get('ethan_capital_alcista');
    capitalBajista = await UserData.get('ethan_capital_bajista');
  }

  function renderHistory() {
    const el = document.getElementById('pos-history');
    if (!el) return;

    const alcistas = history.filter(h => (h.direction||'alcista') === 'alcista');
    const bajistas = history.filter(h => h.direction === 'bajista');

    const capA = capitalAlcista;
    const capB = capitalBajista;
    const mA = calcMetrics(alcistas, capA);
    const mB = calcMetrics(bajistas, capB);

    el.innerHTML = `
      <div class="pos-hist-tabs">
        <button class="pos-hist-tab ${activeHistTab==='alcista'?'active':''}" data-tab="alcista">📈 Alcista (${alcistas.length})</button>
        <button class="pos-hist-tab ${activeHistTab==='bajista'?'active':''}" data-tab="bajista">📉 Bajista (${bajistas.length})</button>
      </div>

      <div class="pos-hist-panel" id="panel-alcista" style="display:${activeHistTab==='alcista'?'block':'none'}">
        <div class="pos-capital-row">
          <label>Capital asignado a Alcista (€)</label>
          <input type="number" id="cap-alcista-input" class="wl-input" style="width:160px;" value="${capA??''}" placeholder="ej. 20000">
          <button class="btn" id="cap-alcista-save" style="font-size:10px;">Guardar</button>
        </div>
        ${metricsGrid(mA, capA!=null?'$'+capA.toFixed(0):'Sin definir')}
        ${historyTable(alcistas)}
      </div>

      <div class="pos-hist-panel" id="panel-bajista" style="display:${activeHistTab==='bajista'?'block':'none'}">
        <div class="pos-capital-row">
          <label>Capital asignado a Bajista (€)</label>
          <input type="number" id="cap-bajista-input" class="wl-input" style="width:160px;" value="${capB??''}" placeholder="ej. 10000">
          <button class="btn" id="cap-bajista-save" style="font-size:10px;">Guardar</button>
        </div>
        ${metricsGrid(mB, capB!=null?'$'+capB.toFixed(0):'Sin definir')}
        ${historyTable(bajistas)}
      </div>
    `;

    // Tabs
    el.querySelectorAll('.pos-hist-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeHistTab = btn.dataset.tab;
        renderHistory();
      });
    });

    // Guardar capital — integración con fondo de participaciones
    document.getElementById('cap-alcista-save')?.addEventListener('click', async () => {
      const v = parseFloat(document.getElementById('cap-alcista-input').value);
      if (isNaN(v)) return;
      const nuevo = v;
      const anterior = capitalAlcista || 0;
      const diferencia = nuevo - anterior;
      capitalAlcista = nuevo;
      await UserData.set('ethan_capital_alcista', capitalAlcista);

      // Actualizar fondo de participaciones
      try {
        const { getFondo, aportarCapital, retirarCapital, inicializarFondo, calcVL } = await import('../../fondo.js');
        const fondo = await getFondo();
        // Calcular valor actual de la cartera para el VL
        const pnlRealizado = history.filter(h=>(h.direction||'alcista')==='alcista').reduce((s,h)=>s+(h.pnlAbs||0),0);
        const valorActual = nuevo + pnlRealizado; // simplificado sin unrealized por ahora
        if (!fondo) {
          await inicializarFondo(nuevo, new Date().toISOString().slice(0,10));
        } else if (diferencia > 0) {
          await aportarCapital(diferencia, valorActual, 'Aportación alcista');
        } else if (diferencia < 0) {
          await retirarCapital(Math.abs(diferencia), valorActual, 'Retirada alcista');
        }
      } catch(e) { console.warn('Fondo:', e.message); }

      renderHistory();
    });
    document.getElementById('cap-bajista-save')?.addEventListener('click', async () => {
      const v = parseFloat(document.getElementById('cap-bajista-input').value);
      if (isNaN(v)) return;
      const nuevo = v;
      const anterior = capitalBajista || 0;
      const diferencia = nuevo - anterior;
      capitalBajista = nuevo;
      await UserData.set('ethan_capital_bajista', capitalBajista);

      // Actualizar fondo de participaciones
      try {
        const { getFondo, aportarCapital, retirarCapital, inicializarFondo } = await import('../../fondo.js');
        const fondo = await getFondo();
        const pnlRealizado = history.filter(h=>h.direction==='bajista').reduce((s,h)=>s+(h.pnlAbs||0),0);
        const valorActual = nuevo + pnlRealizado;
        if (!fondo) {
          await inicializarFondo(nuevo, new Date().toISOString().slice(0,10));
        } else if (diferencia > 0) {
          await aportarCapital(diferencia, valorActual, 'Aportación bajista');
        } else if (diferencia < 0) {
          await retirarCapital(Math.abs(diferencia), valorActual, 'Retirada bajista');
        }
      } catch(e) { console.warn('Fondo:', e.message); }

      renderHistory();
    });

    // Eliminar del historial
    el.querySelectorAll('.pos-del-btn[data-idx]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar esta operación del historial?')) return;
        history.splice(parseInt(btn.dataset.idx), 1);
        await saveHistory();
        renderHistory();
      });
    });
  }


  await loadCapitals();
  renderAll();
  return { destroy() {} };
}

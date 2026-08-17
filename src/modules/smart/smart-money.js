// ═══════════════════════════════════════════════
// MÓDULO: Smart Money Intelligence
// Insider Trading · Short Interest · Institutional Ownership
// ═══════════════════════════════════════════════

import { UserData } from '../../userdata.js';

const fmtPct = (n, d=1) => n != null && isFinite(n) ? (n*100).toFixed(d)+'%' : '—';
const fmtNum = n => n != null ? Math.abs(n).toLocaleString('es-ES') : '—';
const fmtDate = d => d && d.length >= 10 ? new Date(d+'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'}) : (d||'—');
const fmtM = n => n != null ? '$'+(n/1e6).toFixed(1)+'M' : '—';
const fmtB = n => n != null ? (Math.abs(n)>=1e9?'$'+(n/1e9).toFixed(1)+'B':'$'+(n/1e6).toFixed(0)+'M') : '—';

// ── Histórico Smart Money ─────────────────────────────────────────────────
const SM_HIST_KEY = ticker => `ethan_sm_hist_${ticker.toUpperCase()}`;

async function saveSmartMoneyHistory(ticker, shortFloat, instPct) {
  try {
    const key  = SM_HIST_KEY(ticker);
    const prev = await UserData.get(key) || [];
    const today = new Date().toISOString().slice(0, 10);
    // Solo guardar si es un día nuevo
    if (prev.length && prev[prev.length-1].date === today) return prev;
    const entry = { date: today, shortFloat, instPct };
    const updated = [...prev, entry].slice(-12); // máx 12 entradas (~3 meses)
    await UserData.set(key, updated);
    return updated;
  } catch { return []; }
}

async function getSmartMoneyHistory(ticker) {
  try {
    return await UserData.get(SM_HIST_KEY(ticker)) || [];
  } catch { return []; }
}

function renderTrend(current, history, label, fmt = fmtPct) {
  if (!history?.length || current == null) return '';
  const prev = history.length >= 2 ? history[history.length - 2] : null;
  if (!prev) return '';

  const field = label === 'inst' ? 'instPct' : 'shortFloat';
  const prevVal = prev[field];
  if (prevVal == null) return '';

  const diff  = current - prevVal;
  const absDiff = Math.abs(diff);
  if (absDiff < 0.001) return `<span style="font-family:var(--mono);font-size:10px;color:var(--text3);">= sin cambio vs ${fmtDate(prev.date)}</span>`;

  const up    = diff > 0;
  // Para institucionales: subir es bueno. Para short: subir es malo.
  const good  = label === 'inst' ? up : !up;
  const color = good ? 'var(--green)' : 'var(--red)';
  const arrow = up ? '▲' : '▼';

  return `<span style="font-family:var(--mono);font-size:10px;color:${color};">${arrow} ${fmt(absDiff)} vs ${fmtDate(prev.date)}</span>`;
}

// ── Recompras de acciones ─────────────────────────────────────────────────
const PROXIES_SM = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
];

async function fetchRecompras(ticker) {
  try {
    // 1. Yahoo Finance — datos de shares y mercado
    const yahooUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=defaultKeyStatistics,summaryDetail,financialData`;
    let yahoo = null;
    for (const fn of PROXIES_SM) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch(fn(yahooUrl), { signal: ctrl.signal });
        clearTimeout(tid);
        if (!r.ok) continue;
        const data = await r.json();
        yahoo = data?.quoteSummary?.result?.[0];
        if (yahoo) break;
      } catch {}
    }

    const stats   = yahoo?.defaultKeyStatistics || {};
    const summary = yahoo?.summaryDetail || {};
    const floatShares     = stats.floatShares?.raw ?? null;
    const sharesOut       = stats.sharesOutstanding?.raw ?? null;
    const marketCap       = summary.marketCap?.raw ?? null;
    const sharesShortPct  = stats.sharesPercentSharesOut?.raw ?? null;

    // 2. SEC EDGAR — último 10-Q o 10-K buscando recompras
    let secData = null;
    try {
      // Buscar CIK del ticker
      const cikUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${ticker}%22&dateRange=custom&startdt=2024-01-01&forms=10-Q,10-K`;
      const cikProxy = PROXIES_SM[0](cikUrl);
      const cikCtrl = new AbortController();
      const cikTid = setTimeout(() => cikCtrl.abort(), 8000);
      const cikRes = await fetch(cikProxy, { signal: cikCtrl.signal });
      clearTimeout(cikTid);

      if (cikRes.ok) {
        const cikData = await cikRes.json();
        const filing = cikData?.hits?.hits?.[0];
        if (filing) {
          const docUrl = `https://www.sec.gov${filing._source?.file_date ? '/cgi-bin/browse-edgar?action=getcompany&CIK=' + filing._source?.entity_id + '&type=10-Q&dateb=&owner=include&count=1&search_text=' : ''}`;
          // Extraer texto del filing via EDGAR full-text search
          const snippets = cikData?.hits?.hits?.slice(0,3)
            .map(h => h._source?.period_of_report + ': ' + (h.highlight?.['file_date']?.[0] || ''))
            .filter(Boolean);
          secData = { snippets, filingDate: filing?._source?.period_of_report };
        }
      }
    } catch {}

    // 3. Claude extrae el programa de recompras del texto de Yahoo + SEC
    let programa = null;
    try {
      const ctx = `Empresa: ${ticker}
Capitalización: ${marketCap ? fmtB(marketCap) : '—'}
Acciones en circulación: ${sharesOut ? (sharesOut/1e6).toFixed(1)+'M' : '—'}
Float: ${floatShares ? (floatShares/1e6).toFixed(1)+'M' : '—'}
Short interest: ${sharesShortPct ? (sharesShortPct*100).toFixed(1)+'%' : '—'}`;

      const prompt = `Eres un analista financiero. Basándote en el conocimiento público sobre ${ticker}, estima el programa de recompra de acciones más reciente conocido.

Contexto actual de la empresa:
${ctx}

Responde SOLO con JSON sin markdown:
{
  "tienePrograma": true,
  "aprobadoTotal": 90000000000,
  "ejecutadoEstimado": 67000000000,
  "pendienteEstimado": 23000000000,
  "pctFloatAnual": 3.2,
  "ultimaActualizacion": "Q1 2025",
  "fuente": "Estimación basada en reportes públicos",
  "nota": "Dato aproximado basado en últimos earnings conocidos. Puede estar desactualizado hasta 3 meses."
}

Si no tienes información suficiente sobre el programa de recompras de ${ticker}, responde con {"tienePrograma": false, "nota": "Sin datos de programa de recompras conocido"}

Sé conservador — solo incluye datos que conozcas con razonable certeza.`;

      const r = await fetch('/api/macro-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (r.ok) {
        const d = await r.json();
        const text = (d.text || '').replace(/```json\n?|```\n?/g,'').trim();
        const match = text.match(/\{[\s\S]*\}/);
        if (match) programa = JSON.parse(match[0]);
      }
    } catch {}

    return {
      floatShares, sharesOut, marketCap, sharesShortPct,
      programa,
    };
  } catch(e) {
    return null;
  }
}

function paintRecompras(recompras, ticker) {
  if (!recompras) return `<div style="font-family:var(--mono);font-size:11px;color:var(--text3);">Sin datos de recompras disponibles para ${ticker}</div>`;

  const { floatShares, sharesOut, marketCap, sharesShortPct, programa } = recompras;

  const floatHTML = floatShares || sharesOut || marketCap ? `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
      ${marketCap ? `<div style="background:var(--surface2);border-radius:8px;padding:12px 14px;">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-bottom:5px;text-transform:uppercase;">Market Cap</div>
        <div style="font-family:var(--serif);font-size:20px;font-style:italic;font-weight:600;">${fmtB(marketCap)}</div>
      </div>` : ''}
      ${floatShares ? `<div style="background:var(--surface2);border-radius:8px;padding:12px 14px;">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-bottom:5px;text-transform:uppercase;">Float</div>
        <div style="font-family:var(--serif);font-size:20px;font-style:italic;font-weight:600;">${(floatShares/1e6).toFixed(0)}M acc.</div>
      </div>` : ''}
      ${sharesShortPct != null ? `<div style="background:var(--surface2);border-radius:8px;padding:12px 14px;">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-bottom:5px;text-transform:uppercase;">Short % float</div>
        <div style="font-family:var(--serif);font-size:20px;font-style:italic;font-weight:600;color:${sharesShortPct>0.1?'var(--red)':'var(--text1)'};">${(sharesShortPct*100).toFixed(1)}%</div>
      </div>` : ''}
    </div>` : '';

  if (!programa || !programa.tienePrograma) {
    return floatHTML + `<div style="font-family:var(--mono);font-size:11px;color:var(--text3);padding:12px 14px;background:var(--surface2);border-radius:8px;">${programa?.nota || 'Sin datos de programa de recompras conocido'}</div>`;
  }

  const ejecutado = programa.ejecutadoEstimado || 0;
  const aprobado  = programa.aprobadoTotal || 1;
  const pctEjec   = Math.min(100, (ejecutado/aprobado*100));
  const pendiente = programa.pendienteEstimado || (aprobado - ejecutado);

  return `${floatHTML}
    <div style="background:var(--surface2);border-radius:10px;padding:16px 18px;margin-bottom:12px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px;">Programa de Recompras · ${programa.ultimaActualizacion || '—'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px;">
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:4px;">Total aprobado</div>
          <div style="font-family:var(--serif);font-size:22px;font-style:italic;font-weight:600;color:var(--text1);">${fmtB(aprobado)}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:4px;">Ejecutado (est.)</div>
          <div style="font-family:var(--serif);font-size:22px;font-style:italic;font-weight:600;color:var(--amber);">${fmtB(ejecutado)}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:4px;">Pendiente (est.)</div>
          <div style="font-family:var(--serif);font-size:22px;font-style:italic;font-weight:600;color:var(--green);">${fmtB(pendiente)}</div>
        </div>
      </div>
      <!-- Barra de progreso -->
      <div style="font-size:10px;color:var(--text3);margin-bottom:5px;">Progreso del programa</div>
      <div style="height:8px;background:var(--surface);border-radius:4px;overflow:hidden;margin-bottom:6px;">
        <div style="height:100%;width:${pctEjec.toFixed(0)}%;background:linear-gradient(90deg,var(--teal),var(--amber));border-radius:4px;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:9px;color:var(--text3);">
        <span>Ejecutado ${pctEjec.toFixed(0)}%</span>
        <span>Pendiente ${(100-pctEjec).toFixed(0)}%</span>
      </div>
      ${programa.pctFloatAnual ? `<div style="margin-top:10px;font-size:11px;color:var(--text2);">Ritmo de recompras: <strong style="color:var(--teal);">${programa.pctFloatAnual.toFixed(1)}% del float/año</strong> — equivalente a recomprar toda la empresa en ${(100/programa.pctFloatAnual).toFixed(0)} años al ritmo actual</div>` : ''}
    </div>
    <div style="font-family:var(--mono);font-size:9px;color:var(--text3);background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.2);border-radius:6px;padding:8px 12px;line-height:1.6;">
      ⚠ ${programa.nota || 'Datos aproximados basados en últimos reportes públicos conocidos. Pueden estar desactualizados hasta 3 meses. Verifica en los earnings reports oficiales de la empresa.'}
    </div>`;
}

const CSS = `
.sm-wrap{font-family:var(--sans);}
.sm-search{display:flex;gap:10px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px 22px;margin-bottom:16px;}
.sm-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px 22px;margin-bottom:14px;}
.sm-card-title{font-size:13px;font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:8px;}
.sm-card-desc{font-size:11px;color:var(--text2);margin-bottom:16px;}
.sm-table{width:100%;border-collapse:collapse;font-size:11px;}
.sm-table th{padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text2);border-bottom:1px solid var(--border);font-weight:600;background:var(--surface2);}
.sm-table th.r{text-align:right;}
.sm-table td{padding:9px 12px;border-bottom:1px solid var(--border);color:var(--text1);}
.sm-table td.r{text-align:right;font-family:var(--mono);}
.sm-table tbody tr:last-child td{border-bottom:none;}
.sm-table tbody tr:hover td{background:rgba(64,217,192,0.03);}
.sm-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1px;background:var(--border);border-radius:8px;overflow:hidden;margin-bottom:14px;}
.sm-kpi{background:var(--surface2);padding:14px 16px;}
.sm-kpi-lbl{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:var(--text2);margin-bottom:6px;}
.sm-kpi-val{font-family:var(--mono);font-size:20px;font-weight:700;}
.sm-kpi-sub{font-size:10px;color:var(--text2);margin-top:4px;}
.sm-badge{font-family:var(--mono);font-size:9px;padding:2px 8px;border-radius:3px;font-weight:700;}
.sm-badge.buy{background:rgba(74,222,128,0.12);color:var(--green);}
.sm-badge.sell{background:rgba(244,113,116,0.12);color:var(--red);}
.sm-badge.high{background:rgba(244,113,116,0.12);color:var(--red);}
.sm-badge.med{background:rgba(251,191,36,0.12);color:var(--amber);}
.sm-badge.low{background:rgba(74,222,128,0.12);color:var(--green);}
.sm-loader{display:flex;align-items:center;gap:10px;color:var(--text2);font-family:var(--mono);font-size:11px;padding:20px 0;}
.sm-empty{text-align:center;padding:30px;color:var(--text2);font-family:var(--mono);font-size:11px;}
.sm-insight{border-left:2px solid var(--teal);background:var(--teal-dim);padding:10px 14px;border-radius:0 8px 8px 0;font-size:11px;color:var(--text2);line-height:1.6;margin-top:12px;}
.sm-insight strong{color:var(--text1);}
.sm-section{font-family:var(--mono);font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text2);display:flex;align-items:center;gap:10px;margin:16px 0 10px;}
.sm-section::after{content:"";flex:1;height:1px;background:var(--border);}
`;

export async function render(container, { actionsSlot }) {
  if (!document.getElementById('sm-css')) {
    const s = document.createElement('style'); s.id = 'sm-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  actionsSlot.innerHTML = '';
  container.innerHTML = `<div class="sm-wrap" id="sm-wrap"></div>`;
  const el = document.getElementById('sm-wrap');

  el.innerHTML = `
    <!-- Tabs principales -->
    <div style="display:flex;gap:3px;border-bottom:1px solid var(--border);margin-bottom:18px;">
      <button class="sm-main-tab active" data-tab="smart" style="padding:10px 18px;background:transparent;border:none;color:var(--teal);cursor:pointer;font-size:11px;font-weight:600;letter-spacing:0.03em;border-bottom:2px solid var(--teal);font-family:var(--sans);">🏦 Smart Money</button>
      <button class="sm-main-tab" data-tab="13f" style="padding:10px 18px;background:transparent;border:none;color:var(--text3);cursor:pointer;font-size:11px;font-weight:600;letter-spacing:0.03em;border-bottom:2px solid transparent;font-family:var(--sans);">🐋 13F · Fondos Top</button>
    </div>

    <!-- Panel Smart Money (original) -->
    <div id="sm-panel-smart">
      <div class="sm-search">
        <input type="text" id="sm-ticker" class="wl-input" placeholder="Ticker (ej. AAPL, NVDA...)" style="width:220px;text-transform:uppercase;">
        <button class="btn btn-primary" id="sm-search-btn">🔍 Analizar Smart Money</button>
        <span id="sm-status" style="font-family:var(--mono);font-size:11px;color:var(--text2);"></span>
      </div>
      <div id="sm-results">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:40px;text-align:center;">
          <div style="font-size:32px;margin-bottom:12px;">🏦</div>
          <div style="font-size:14px;font-weight:600;margin-bottom:6px;">Smart Money Intelligence</div>
          <div style="font-size:11px;color:var(--text2);max-width:500px;margin:0 auto;line-height:1.6;">
            Introduce un ticker para ver las compras y ventas de insiders (SEC Form 4),
            el short interest institucional y los principales accionistas institucionales.
          </div>
        </div>
      </div>
    </div>

    <!-- Panel 13F Fondos Top -->
    <div id="sm-panel-13f" style="display:none;">
      <div id="sm-13f-content"></div>
    </div>
  `;

  async function analyze() {
    const ticker = (document.getElementById('sm-ticker')?.value || '').trim().toUpperCase();
    if (!ticker) return;
    const btn = document.getElementById('sm-search-btn');
    const st  = document.getElementById('sm-status');
    const res = document.getElementById('sm-results');

    btn.disabled = true; btn.textContent = '⏳ Cargando...';
    if (st) st.textContent = `Consultando SEC, FINRA y Yahoo para ${ticker}...`;
    res.innerHTML = `<div class="sm-loader"><div class="loader-ring"></div>Obteniendo datos de Smart Money para ${ticker}...</div>`;

    try {
      // Dos llamadas en paralelo para evitar timeout
      btn.disabled = true; btn.textContent = '⏳ Buscando...';
      if (st) st.textContent = `Consultando insiders y mercado para ${ticker} en paralelo...`;
      res.innerHTML = `<div class="sm-loader"><div class="loader-ring"></div>Buscando datos de Smart Money para ${ticker}... (15-30s)</div>`;

      const [insidersRes, marketRes, recomprasRes] = await Promise.allSettled([
        fetch(`/api/smart-money?ticker=${ticker}&section=insiders`, { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 58000); return c.signal; })() }).then(r => r.json()),
        fetch(`/api/smart-money?ticker=${ticker}&section=market`,   { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 58000); return c.signal; })() }).then(r => r.json()),
        fetchRecompras(ticker),
      ]);

      const insidersData  = insidersRes.status  === 'fulfilled' ? insidersRes.value  : {};
      const marketData    = marketRes.status    === 'fulfilled' ? marketRes.value    : {};
      const recomprasData = recomprasRes.status === 'fulfilled' ? recomprasRes.value : null;

      const data = {
        ticker,
        insiders:      insidersData.insiders      || [],
        shortInterest: marketData.shortInterest   || null,
        institutional: marketData.institutional   || null,
        recompras:     recomprasData,
        errors: [
          ...(insidersData.error ? ['Insiders: ' + insidersData.error.slice(0,60)] : []),
          ...(marketData.error   ? ['Market: '   + marketData.error.slice(0,60)]   : []),
          ...(insidersRes.status === 'rejected' ? ['Insiders timeout'] : []),
          ...(marketRes.status   === 'rejected' ? ['Market timeout']   : []),
        ],
      };

      // Guardar histórico y obtener tendencia
      const shortFloat = marketData.shortInterest?.shortFloat ?? null;
      const instPctVal = marketData.institutional?.pctInstitutions ?? null;
      const [history] = await Promise.all([
        getSmartMoneyHistory(ticker),
        saveSmartMoneyHistory(ticker, shortFloat, instPctVal),
      ]);
      data.history = history;

      paintResults(data, ticker);
      if (st) st.textContent = '';
    } catch(e) {
      res.innerHTML = `<div class="sm-card"><div style="color:var(--red);font-family:var(--mono);">⚠ Error: ${e.message}</div></div>`;
      if (st) st.textContent = '';
    }
    btn.disabled = false; btn.textContent = '🔍 Analizar Smart Money';
  }

  function paintResults(data, ticker) {
    const res = document.getElementById('sm-results');
    const { insiders, shortInterest, institutional, history } = data;

    // ── Señal resumen ────────────────────────────
    const buyCount  = insiders.filter(i => i.type === 'Compra' || i.type?.toLowerCase().includes('purchase')).length;
    const sellCount = insiders.filter(i => i.type === 'Venta'  || i.type?.toLowerCase().includes('sale')).length;
    const siPct   = shortInterest?.shortFloat;
    const instPct = institutional?.pctInstitutions;

    // Tendencias vs dato anterior guardado
    const trendInst  = renderTrend(instPct, history, 'inst');
    const trendShort = renderTrend(siPct,   history, 'short');

    // Semáforo de señal
    let signal = 'neutral', signalText = 'Neutral', signalCol = 'var(--amber)';
    if (buyCount > sellCount && buyCount > 0 && (!siPct || siPct < 0.15)) {
      signal = 'alcista'; signalText = 'Alcista'; signalCol = 'var(--green)';
    } else if (sellCount > buyCount*2 || (siPct && siPct > 0.25)) {
      signal = 'bajista'; signalText = 'Bajista'; signalCol = 'var(--red)';
    }

    res.innerHTML = `
      <!-- Resumen Smart Money -->
      <div class="sm-card" style="border-color:${signalCol};border-left:4px solid ${signalCol};">
        <div class="sm-card-title">
          <span style="color:${signalCol};font-size:20px;">${signal==='alcista'?'↑':signal==='bajista'?'↓':'→'}</span>
          Señal Smart Money: <span style="color:${signalCol};">${signalText}</span>
          <span style="font-family:var(--mono);font-size:10px;color:var(--text2);font-weight:400;margin-left:auto;">${ticker} · ${new Date().toLocaleDateString('es-ES')}</span>
        </div>
        <div class="sm-kpi-grid">
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">Compras insiders</div>
            <div class="sm-kpi-val" style="color:var(--green);">${buyCount}</div>
            <div class="sm-kpi-sub">últimos 6 meses</div>
          </div>
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">Ventas insiders</div>
            <div class="sm-kpi-val" style="color:var(--red);">${sellCount}</div>
            <div class="sm-kpi-sub">últimos 6 meses</div>
          </div>
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">Short Interest</div>
            <div class="sm-kpi-val" style="color:${siPct>0.2?'var(--red)':siPct>0.1?'var(--amber)':'var(--green)'};">${fmtPct(siPct)}</div>
            <div class="sm-kpi-sub">% del float</div>
            ${trendShort ? `<div style="margin-top:4px;">${trendShort}</div>` : ''}
          </div>
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">Days to Cover</div>
            <div class="sm-kpi-val" style="color:${shortInterest?.daysTocover>5?'var(--red)':shortInterest?.daysTocover>3?'var(--amber)':'var(--green)'};">${shortInterest?.daysTocover?.toFixed(1)||'—'}d</div>
            <div class="sm-kpi-sub">presión bajista</div>
          </div>
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">% Institucional</div>
            <div class="sm-kpi-val">${fmtPct(instPct)}</div>
            <div class="sm-kpi-sub">del float</div>
            ${trendInst ? `<div style="margin-top:4px;">${trendInst}</div>` : ''}
          </div>
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">% Insiders</div>
            <div class="sm-kpi-val">${fmtPct(institutional?.pctInsiders)}</div>
            <div class="sm-kpi-sub">del float</div>
          </div>
        </div>
        ${generateInsight(buyCount, sellCount, siPct, shortInterest?.daysTocover, instPct, ticker)}
      </div>

      <!-- Insider Trading -->
      <div class="sm-card">
        <div class="sm-card-title">📋 Insider Trading — SEC Form 4</div>
        <div class="sm-card-desc">Compras y ventas declaradas por directivos, consejeros y accionistas >10% en los últimos 6 meses.</div>
        ${insiders.length ? `
        <table class="sm-table">
          <thead><tr>
            <th>Fecha</th><th>Insider</th><th>Cargo</th>
            <th class="r">Tipo</th><th class="r">Cantidad</th>
            <th class="r">Precio</th><th class="r">Valor total</th>
          </tr></thead>
          <tbody>
            ${insiders.map(ins => `<tr>
              <td style="color:var(--text2);font-family:var(--mono);font-size:10px;">${fmtDate(ins.date)}</td>
              <td style="font-weight:600;">${ins.insider||ins.filer||'—'}</td>
              <td style="font-size:10px;color:var(--text2);">${ins.title||'—'}</td>
              <td class="r"><span class="sm-badge ${ins.type==='Compra'||ins.type?.toLowerCase().includes('purchase')?'buy':'sell'}">${ins.type==='Compra'?'▲ COMPRA':ins.type==='Venta'?'▼ VENTA':ins.type||'—'}</span></td>
              <td class="r">${ins.qty?fmtNum(ins.qty):'—'}</td>
              <td class="r">${ins.price||'—'}</td>
              <td class="r">${ins.value||'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div style="font-size:10px;color:var(--text2);margin-top:10px;font-family:var(--mono);">Fuente: OpenInsider / SEC EDGAR</div>` :
        `<div class="sm-empty">Sin transacciones de insiders en los últimos 6 meses</div>`}
      </div>

      <!-- Short Interest -->
      <div class="sm-card">
        <div class="sm-card-title">📉 Short Interest</div>
        <div class="sm-card-desc">Porcentaje del float vendido en corto. Alto short interest puede significar presión bajista o potencial short squeeze.</div>
        ${shortInterest ? `
        <div class="sm-kpi-grid">
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">Short Float</div>
            <div class="sm-kpi-val" style="color:${siPct>0.2?'var(--red)':siPct>0.1?'var(--amber)':'var(--green)'};">${fmtPct(siPct)}</div>
            <div class="sm-kpi-sub"><span class="sm-badge ${siPct>0.2?'high':siPct>0.1?'med':'low'}">${siPct>0.2?'Alto':siPct>0.1?'Moderado':'Bajo'}</span></div>
            ${trendShort ? `<div style="margin-top:6px;">${trendShort}</div>` : ''}
          </div>
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">Days to Cover</div>
            <div class="sm-kpi-val">${shortInterest.daysTocover?.toFixed(1)||'—'}</div>
            <div class="sm-kpi-sub">días para cubrir</div>
          </div>
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">Acciones en corto</div>
            <div class="sm-kpi-val" style="font-size:16px;">${fmtNum(shortInterest.shortVolume)}</div>
            <div class="sm-kpi-sub">${shortInterest.date}</div>
          </div>
        </div>
        <div class="sm-insight">
          <strong>Interpretación:</strong> Short float ${fmtPct(siPct)} —
          ${siPct > 0.2 ? `⚠ <strong>Short interest muy alto.</strong> Alto riesgo de presión bajista pero también potencial de <strong>short squeeze</strong> si hay catalizador positivo.` :
            siPct > 0.1 ? `Moderado. El mercado tiene cierta posición bajista en este valor — vigilar.` :
            siPct != null ? `✓ Bajo short interest. El mercado no está especialmente posicionado bajista.` : 'Sin datos suficientes.'}
          ${shortInterest.daysTocover > 5 ? ` Days to Cover elevado (${shortInterest.daysTocover?.toFixed(1)}d) — si el precio sube, la presión de recompra podría ser significativa.` : ''}
        </div>` :
        `<div class="sm-empty">Sin datos de short interest disponibles</div>`}
      </div>

      <!-- Institutional Ownership -->
      <div class="sm-card">
        <div class="sm-card-title">🏛️ Ownership Institucional</div>
        <div class="sm-card-desc">Fondos, ETFs y grandes gestoras con posiciones declaradas. Alto % institucional = validación del mercado profesional.</div>
        ${institutional ? `
        <div class="sm-kpi-grid" style="margin-bottom:16px;">
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">% Institucional</div>
            <div class="sm-kpi-val" style="color:${instPct>0.7?'var(--green)':instPct>0.4?'var(--amber)':'var(--text2)'};">${fmtPct(instPct)}</div>
            <div class="sm-kpi-sub">del float</div>
            ${trendInst ? `<div style="margin-top:6px;">${trendInst}</div>` : ''}
          </div>
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">% Insiders</div>
            <div class="sm-kpi-val">${fmtPct(institutional.pctInsiders)}</div>
            <div class="sm-kpi-sub">directivos y fundadores</div>
          </div>
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">% Público</div>
            <div class="sm-kpi-val">${fmtPct(1-(instPct||0)-(institutional.pctInsiders||0))}</div>
            <div class="sm-kpi-sub">retail y otros</div>
          </div>
        </div>
        ${institutional.topHolders?.length ? `
        <div class="sm-section">Top accionistas institucionales</div>
        <table class="sm-table">
          <thead><tr>
            <th>Institución</th><th class="r">% Float</th>
            <th class="r">Acciones</th><th class="r">Valor</th><th class="r">Cambio</th>
          </tr></thead>
          <tbody>
            ${institutional.topHolders.map(h => `<tr>
              <td style="font-weight:600;">${h.name||'—'}</td>
              <td class="r">${fmtPct(h.pct)}</td>
              <td class="r">${fmtNum(h.shares)}</td>
              <td class="r">${fmtM(h.value)}</td>
              <td class="r" style="color:${h.change>0?'var(--green)':h.change<0?'var(--red)':'var(--text2)'};">${h.change!=null?(h.change>=0?'+':'')+fmtPct(h.change):'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : ''}` :
        `<div class="sm-empty">Sin datos de ownership institucional</div>`}
      </div>

      ${data.errors?.length ? `
      <div style="font-size:10px;color:var(--text3);font-family:var(--mono);padding:8px 0;">
        ⚠ Datos parciales: ${data.errors.join(' · ')}
      </div>` : ''}

      <!-- Recompras de acciones -->
      <div class="sm-section">🔄 Recompra de Acciones</div>
      <div class="sm-card">
        <div class="sm-card-title">Programa de Recompras · Share Buyback</div>
        <div class="sm-card-desc">Datos de Yahoo Finance + estimación IA basada en últimos reportes públicos.</div>
        <div id="sm-recompras-content">
          ${paintRecompras(data.recompras, ticker)}
        </div>
      </div>
    `;
  }

  function generateInsight(buyCount, sellCount, siPct, dtc, instPct, ticker) {
    const signals = [];
    if (buyCount > 0 && buyCount > sellCount) signals.push(`<strong>${buyCount} compras de insiders</strong> vs ${sellCount} ventas — los que mejor conocen la empresa están comprando`);
    if (sellCount > buyCount*2) signals.push(`⚠ <strong>${sellCount} ventas de insiders</strong> — presión de distribución interna`);
    if (siPct > 0.2) signals.push(`<strong>Short interest elevado (${(siPct*100).toFixed(1)}%)</strong> — posible combustible para short squeeze`);
    if (siPct < 0.05 && siPct != null) signals.push(`Short interest bajo (${(siPct*100).toFixed(1)}%) — mercado no apuesta contra el valor`);
    if (instPct > 0.7) signals.push(`<strong>${(instPct*100).toFixed(0)}% en manos institucionales</strong> — alta validación profesional`);
    if (!signals.length) return '';
    return `<div class="sm-insight">${signals.join(' · ')}</div>`;
  }

  document.getElementById('sm-search-btn')?.addEventListener('click', analyze);
  document.getElementById('sm-ticker')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') analyze();
    setTimeout(() => { if(e.target) e.target.value = e.target.value.toUpperCase(); }, 0);
  });

  // ── Tabs principales ─────────────────────────────────────────
  document.querySelectorAll('.sm-main-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sm-main-tab').forEach(t => {
        t.style.color = 'var(--text3)';
        t.style.borderBottom = '2px solid transparent';
      });
      tab.style.color = 'var(--teal)';
      tab.style.borderBottom = '2px solid var(--teal)';
      document.getElementById('sm-panel-smart').style.display = tab.dataset.tab === 'smart' ? 'block' : 'none';
      document.getElementById('sm-panel-13f').style.display   = tab.dataset.tab === '13f'   ? 'block' : 'none';
      if (tab.dataset.tab === '13f') load13F();
    });
  });

  // ── 13F Fondos Top ────────────────────────────────────────────
  const FUNDS_META = {
    berkshire:  { name:'Berkshire Hathaway',    manager:'Warren Buffett', style:'Value concentrado',     color:'#40d9c0' },
    bridgewater:{ name:'Bridgewater Associates', manager:'Ray Dalio',     style:'Macro global',           color:'#5fa8e0' },
    pershing:   { name:'Pershing Square',        manager:'Bill Ackman',   style:'Activista concentrado',  color:'#a78bfa' },
    thirdpoint: { name:'Third Point',            manager:'Dan Loeb',       style:'Activista tech',         color:'#fbbf24' },
    scion:      { name:'Scion Asset Mgmt',       manager:'Michael Burry', style:'Contrarian extremo',     color:'#f47174' },
    baupost:    { name:'Baupost Group',           manager:'Seth Klarman',  style:'Value profundo',          color:'#4ade80' },
    fidelity:   { name:'Fidelity (FMR LLC)',      manager:'Will Danoff',   style:'Growth americano',        color:'#fb923c' },
    gic:        { name:'GIC — Singapore',         manager:'Lim Chow Kiat', style:'Fondo soberano SG',      color:'#e879f9' },
    norges:     { name:'Norges Bank (NBIM)',      manager:'Nicolai Tangen',style:'Fondo soberano Noruega', color:'#f43f5e' },
  };

  let loaded13F = false;

  async function load13F() {
    if (loaded13F) return;
    const el = document.getElementById('sm-13f-content');
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px;">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Buscar por fondo</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;" id="sm-13f-fund-btns">
            ${Object.entries(FUNDS_META).map(([key,f]) =>
              `<button class="btn" data-fund="${key}" style="border-color:${f.color}20;font-size:10px;padding:5px 10px;">${f.name}</button>`
            ).join('')}
          </div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px;">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">¿Qué fondos tienen este ticker?</div>
          <div style="display:flex;gap:8px;">
            <input type="text" id="sm-13f-ticker" class="wl-input" placeholder="AAPL, NVDA..." style="width:140px;text-transform:uppercase;">
            <button class="btn btn-primary" id="sm-13f-ticker-btn">Buscar</button>
          </div>
        </div>
      </div>
      <div id="sm-13f-result">
        <div style="text-align:center;padding:48px 20px;color:var(--text3);font-family:var(--mono);font-size:11px;">
          <div style="font-size:28px;margin-bottom:10px;">🐋</div>
          Selecciona un fondo o introduce un ticker para ver las posiciones 13F más recientes
        </div>
      </div>`;

    // Listeners
    document.querySelectorAll('#sm-13f-fund-btns .btn').forEach(btn => {
      btn.addEventListener('click', () => fetch13FbyFund(btn.dataset.fund));
    });
    document.getElementById('sm-13f-ticker-btn')?.addEventListener('click', () => {
      const t = document.getElementById('sm-13f-ticker')?.value?.trim().toUpperCase();
      if (t) fetch13FbyTicker(t);
    });
    document.getElementById('sm-13f-ticker')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const t = e.target.value.trim().toUpperCase();
        if (t) fetch13FbyTicker(t);
      }
    });
    loaded13F = true;
  }

  async function fetch13FbyFund(fund) {
    const result = document.getElementById('sm-13f-result');
    const meta = FUNDS_META[fund];
    result.innerHTML = `<div class="sm-loader"><div class="loader-ring"></div>Obteniendo último 13F de ${meta.name} via SEC EDGAR...</div>`;
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 30000);
      const r = await fetch(`/api/smart-13f?fund=${fund}`, { signal: ctrl.signal });
      clearTimeout(tid);
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      paint13FFund(data, meta);
    } catch(e) {
      result.innerHTML = `<div style="background:var(--surface);border:1px solid var(--red);border-radius:10px;padding:20px;color:var(--red);font-family:var(--mono);font-size:11px;">⚠ ${e.message}</div>`;
    }
  }

  async function fetch13FbyTicker(ticker) {
    const result = document.getElementById('sm-13f-result');
    result.innerHTML = `<div class="sm-loader"><div class="loader-ring"></div>Buscando ${ticker} en todos los 13F...</div>`;
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 60000);
      const r = await fetch(`/api/smart-13f?ticker=${ticker}`, { signal: ctrl.signal });
      clearTimeout(tid);
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      paint13FTicker(data, ticker);
    } catch(e) {
      result.innerHTML = `<div style="background:var(--surface);border:1px solid var(--red);border-radius:10px;padding:20px;color:var(--red);font-family:var(--mono);font-size:11px;">⚠ ${e.message}</div>`;
    }
  }

  function paint13FFund(data, meta) {
    const result = document.getElementById('sm-13f-result');
    const fmtB = n => n >= 1e9 ? '$'+(n/1e9).toFixed(1)+'B' : '$'+(n/1e6).toFixed(0)+'M';
    result.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
        <div style="padding:16px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-family:var(--serif);font-size:20px;font-style:italic;font-weight:600;">${meta.name}</div>
            <div style="font-family:var(--mono);font-size:9px;color:var(--text2);margin-top:3px;">${meta.manager} · ${meta.style}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:var(--mono);font-size:9px;color:var(--text3);">Portfolio 13F</div>
            <div style="font-family:var(--mono);font-size:14px;font-weight:700;color:var(--teal);">${fmtB(data.totalValue)}</div>
            <div style="font-family:var(--mono);font-size:9px;color:var(--text3);">Q${data.period} · ${data.totalPositions} posiciones</div>
          </div>
        </div>
        <div style="padding:8px 0;">
          <div style="display:grid;grid-template-columns:1fr auto auto auto;padding:8px 18px;font-family:var(--mono);font-size:9px;color:var(--text3);text-transform:uppercase;border-bottom:1px solid var(--border);">
            <span>Empresa</span><span style="text-align:right;padding-right:16px;">Valor</span><span style="text-align:right;padding-right:16px;">Acciones</span><span style="text-align:right;">% Portfolio</span>
          </div>
          ${data.holdings.map((h, i) => `
            <div style="display:grid;grid-template-columns:1fr auto auto auto;padding:9px 18px;border-bottom:1px solid var(--border);align-items:center;${i%2===0?'background:rgba(64,217,192,0.02)':''}">
              <div>
                <span style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-right:8px;">${i+1}</span>
                <span style="font-size:12px;font-weight:600;">${h.name}</span>
              </div>
              <span style="font-family:var(--mono);font-size:11px;text-align:right;padding-right:16px;">${fmtB(h.value)}</span>
              <span style="font-family:var(--mono);font-size:10px;color:var(--text2);text-align:right;padding-right:16px;">${h.shares.toLocaleString('es-ES')}</span>
              <div style="text-align:right;min-width:60px;">
                <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:${h.pct>=10?'var(--teal)':h.pct>=5?'var(--text1)':'var(--text2)'};">${h.pct.toFixed(1)}%</span>
                <div style="height:3px;background:var(--surface2);border-radius:2px;margin-top:3px;overflow:hidden;">
                  <div style="height:100%;width:${Math.min(100,h.pct*5)}%;background:var(--teal);border-radius:2px;"></div>
                </div>
              </div>
            </div>`).join('')}
        </div>
        <div style="padding:10px 18px;font-family:var(--mono);font-size:9px;color:var(--text3);">
          ⚠ Datos SEC EDGAR 13F-HR · Publicación trimestral con 45 días de retraso · Solo posiciones largas en RV americana
        </div>
      </div>`;
  }

  function paint13FTicker(data, ticker) {
    const result = document.getElementById('sm-13f-result');
    const fmtB = n => n >= 1e9 ? '$'+(n/1e9).toFixed(1)+'B' : '$'+(n/1e6).toFixed(0)+'M';

    if (!data.funds?.length) {
      result.innerHTML = `<div style="text-align:center;padding:40px;font-family:var(--mono);font-size:11px;color:var(--text3);">
        <div style="font-size:24px;margin-bottom:10px;">🔍</div>
        ${ticker} no aparece en el top 15 de ninguno de los 7 fondos monitorizados
      </div>`;
      return;
    }

    result.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
        <div style="padding:14px 18px;border-bottom:1px solid var(--border);">
          <div style="font-family:var(--serif);font-size:20px;font-style:italic;font-weight:600;">${ticker} · Presencia en fondos 13F</div>
          <div style="font-family:var(--mono);font-size:9px;color:var(--text2);margin-top:3px;">${data.funds.length} de 7 fondos tienen ${ticker} en su top 15</div>
        </div>
        ${data.funds.map(f => {
          const meta = FUNDS_META[f.key] || {};
          return `<div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:14px;">
            <div style="width:10px;height:10px;border-radius:50%;background:${meta.color||'var(--teal)'};flex-shrink:0;"></div>
            <div style="flex:1;">
              <div style="font-size:12px;font-weight:600;">${meta.name || f.fund.name}</div>
              <div style="font-family:var(--mono);font-size:9px;color:var(--text3);">${meta.manager || ''} · Q${f.period}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-family:var(--mono);font-size:13px;font-weight:700;">${fmtB(f.position.value)}</div>
              <div style="font-family:var(--mono);font-size:9px;color:var(--text2);">${f.position.shares.toLocaleString('es-ES')} acc.</div>
            </div>
            <div style="text-align:right;min-width:54px;">
              <div style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--teal);">${f.position.pct?.toFixed(1)}%</div>
              <div style="font-family:var(--mono);font-size:9px;color:var(--text3);">del fondo</div>
            </div>
          </div>`;
        }).join('')}
        ${data.funds.length >= 3 ? `
        <div style="padding:12px 18px;background:rgba(64,217,192,0.05);border-top:1px solid rgba(64,217,192,0.2);">
          <div style="font-family:var(--mono);font-size:9px;color:var(--teal);font-weight:700;">🐋 CONFLUENCIA DE WHALES</div>
          <div style="font-size:11px;color:var(--text1);margin-top:4px;">${data.funds.length} fondos independientes tienen ${ticker} en su top 15. Alta convicción institucional.</div>
        </div>` : ''}
        <div style="padding:10px 18px;font-family:var(--mono);font-size:9px;color:var(--text3);">
          ⚠ Datos SEC EDGAR 13F-HR · 45 días de retraso · Solo posiciones largas
        </div>
      </div>`;
  }

  return { destroy() { document.getElementById('sm-css')?.remove(); } };
}

// ═══════════════════════════════════════════════
// MÓDULO: Dashboard — Página de inicio ETHAN
// VL Fondo · Posiciones · Macro · Alertas · Noticias
// ═══════════════════════════════════════════════

import { UserData } from '../userdata.js';
import { navigateTo } from '../router.js';

const VL_INICIAL = 100;

const PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://soft-field-156f.miguel-gomez-anton.workers.dev/?url=${encodeURIComponent(u)}`,
];

const fmtE   = n => n != null && isFinite(n) ? (n<0?'-':'')+'€'+Math.abs(n).toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:0}) : '—';
const fmtPct = (n,d=2) => n != null && isFinite(n) ? (n>=0?'+':'')+n.toFixed(d)+'%' : '—';
const fmtVL  = n => n != null ? n.toFixed(2) : '—';
const fmtDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short'}) : '—';

// ── Earnings Calendar ────────────────────────────────────────
async function fetchEarnings(tickers) {
  if (!tickers?.length) return [];
  const results = [];
  await Promise.all(tickers.map(async ticker => {
    try {
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=calendarEvents`;
      const proxies = [
        u => `https://soft-field-156f.miguel-gomez-anton.workers.dev/?url=${encodeURIComponent(u)}`,
        u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
        u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
      ];
      for (const fn of proxies) {
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 8000);
          const r = await fetch(fn(url), { signal: ctrl.signal });
          clearTimeout(tid);
          if (!r.ok) continue;
          const data = await r.json();
          const cal = data?.quoteSummary?.result?.[0]?.calendarEvents;
          const earningsDate = cal?.earnings?.earningsDate?.[0]?.raw;
          if (earningsDate) {
            const date = new Date(earningsDate * 1000);
            const today = new Date();
            const daysUntil = Math.round((date - today) / 86400000);
            results.push({ ticker, date, daysUntil });
            break;
          }
        } catch {}
      }
    } catch {}
  }));
  return results
    .filter(e => e.daysUntil >= -1 && e.daysUntil <= 90)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

function paintEarnings(earnings) {
  const el = document.getElementById('db-earnings-content');
  if (!el) return;
  if (!earnings?.length) {
    el.innerHTML = '<div class="db-empty">Sin earnings próximos en los próximos 90 días</div>';
    return;
  }
  const fmtDate = d => d.toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' });
  const urgencyColor = days => days <= 3 ? 'var(--red)' : days <= 14 ? 'var(--amber)' : 'var(--text2)';
  const urgencyBg = days => days <= 3 ? 'rgba(244,113,116,0.08)' : days <= 14 ? 'rgba(251,191,36,0.08)' : 'var(--surface2)';

  el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;">
    ${earnings.map(e => `
      <div style="background:${urgencyBg(e.daysUntil)};border:1px solid ${e.daysUntil<=3?'rgba(244,113,116,0.3)':e.daysUntil<=14?'rgba(251,191,36,0.3)':'var(--border)'};border-radius:6px;padding:8px 12px;display:flex;align-items:center;gap:10px;">
        <div style="font-weight:700;font-family:var(--mono);font-size:12px;color:var(--text1);">${e.ticker}</div>
        <div style="font-size:10px;color:${urgencyColor(e.daysUntil)};font-family:var(--mono);">
          ${e.daysUntil === 0 ? '🔴 HOY' : e.daysUntil === 1 ? '🟠 MAÑANA' : e.daysUntil <= 3 ? `🔴 en ${e.daysUntil}d` : e.daysUntil <= 14 ? `🟡 en ${e.daysUntil}d` : `📅 en ${e.daysUntil}d`}
        </div>
        <div style="font-size:10px;color:var(--text3);font-family:var(--mono);">${fmtDate(e.date)}</div>
      </div>`).join('')}
  </div>
  <div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-top:8px;">Posiciones abiertas + watchlist alcista · 🔴 &lt;3d · 🟡 &lt;14d</div>`;
}

// ── Análisis de sentimiento por palabras clave ──
const POSITIVE_WORDS = ['beat','beats','surge','surges','soars','rises','gains','record','growth','profit','strong','upgrade','buy','outperform','bullish','rally','high','exceed','better','positive','boost','jump','up','increase','revenue beat','earnings beat','raised guidance','buyback','dividend'];
const NEGATIVE_WORDS = ['miss','misses','falls','drops','plunges','decline','loss','weak','downgrade','sell','underperform','bearish','cut','lower','layoff','layoffs','restructure','lawsuit','fine','penalty','warning','below','disappoints','disappointing','recall','investigation','probe','debt','bankruptcy','crash','tumbles','slumps','concerns','risk','negative'];

function analyzeSentiment(headlines) {
  if (!headlines || !headlines.length) return { score: 0, label: 'neutral', emoji: '⚪', color: 'var(--text3)' };
  let pos = 0, neg = 0;
  headlines.forEach(h => {
    const text = (h.title || h || '').toLowerCase();
    POSITIVE_WORDS.forEach(w => { if (text.includes(w)) pos++; });
    NEGATIVE_WORDS.forEach(w => { if (text.includes(w)) neg++; });
  });
  const total = pos + neg;
  const score = total > 0 ? (pos - neg) / total : 0;
  if (score > 0.2)  return { score, label: 'Positivo', emoji: '🟢', color: 'var(--green)' };
  if (score < -0.2) return { score, label: 'Negativo', emoji: '🔴', color: 'var(--red)' };
  return { score, label: 'Neutral', emoji: '🟡', color: 'var(--amber)' };
}
async function fetchNoticias() {
  try {
    const r = await fetch('/api/noticias', { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })() });
    if (!r.ok) return [];
    const data = await r.json();
    return data.items || [];
  } catch {
    return [];
  }
}

// ── Mini sparkline SVG ───────────────────────
function miniChart(serieBase100) {
  if (!serieBase100 || serieBase100.length < 2) return '';
  const vals = serieBase100.map(p => p.val);
  const W = 200, H = 50;
  const min = Math.min(...vals), max = Math.max(...vals), range = (max-min)||1;
  const pts = vals.map((v,i) => `${(i/(vals.length-1)*W).toFixed(1)},${(H-((v-min)/range*H)).toFixed(1)}`).join(' ');
  const last = vals[vals.length-1];
  const col = last >= 100 ? '#40d9c0' : '#f47174';
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;">
    <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${W}" cy="${(H-((last-min)/range*H)).toFixed(1)}" r="3" fill="${col}"/>
  </svg>`;
}

// ── Calcular alertas ─────────────────────────
async function calcAlertas(positions, history, watchlistAlc, watchlistBaj, correcciones) {
  const alertas = [];

  // 1. Posiciones abiertas que tocan el stop
  positions.forEach(p => {
    const current = p.currentPrice || p.entry;
    const stop = p.entryStop || p.stopManual;
    if (!stop || !current) return;
    const dir = p.direction || 'alcista';
    const tocaStop = dir === 'bajista' ? current >= stop : current <= stop;
    if (tocaStop) {
      alertas.push({
        tipo: 'stop',
        urgencia: 'alta',
        texto: `${p.ticker} ha tocado el stop loss`,
        detalle: `Stop: €${stop} · Precio actual: €${current}`,
        accion: 'car-cartera',
      });
    }
  });

  // 2. Watchlist alcista — valores LISTOS
  ;(watchlistAlc || []).forEach(w => {
    if (w.estado === 'ready' || w.estado === 'LISTO') {
      alertas.push({
        tipo: 'entrada',
        urgencia: 'media',
        texto: `${w.ticker} — señal alcista activa`,
        detalle: `Score: ${w.score || '—'} · ${w.sector || ''}`,
        accion: 'alc-rv-watchlist',
      });
    }
  });

  // 3. Watchlist bajista — valores LISTOS
  ;(watchlistBaj || []).forEach(w => {
    if (w.estado === 'ready' || w.estado === 'LISTO') {
      alertas.push({
        tipo: 'corto',
        urgencia: 'media',
        texto: `${w.ticker} — señal bajista activa`,
        detalle: `Score bajista: ${w.score || '—'}`,
        accion: 'baj-watchlist',
      });
    }
  });

  // 4. Correcciones con ENTRADA activa
  ;(correcciones || []).forEach(c => {
    if (c.resultado === 'entrada') {
      alertas.push({
        tipo: 'correccion',
        urgencia: 'media',
        texto: `${c.ticker} — corrección tipo ${c.tipo} con entrada`,
        detalle: c.nota || `Corrección tipo ${c.tipo}`,
        accion: 'alc-rv-correcciones',
      });
    }
  });

  return alertas;
}

// ── CSS ──────────────────────────────────────
const CSS = `
.db-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px;}
.db-grid-wide{display:grid;grid-template-columns:1.5fr 1fr;gap:14px;margin-bottom:14px;}
.db-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px;}
.db-card-title{font-family:var(--mono);font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3);margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;}
.db-card-title a{color:var(--teal);cursor:pointer;font-size:9px;}
.db-vl{font-family:'Cormorant Garamond',serif;font-size:42px;font-weight:600;font-style:italic;line-height:1;color:var(--teal);}
.db-vl-sub{font-family:var(--mono);font-size:11px;margin-top:6px;}
.db-stat{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:11px;}
.db-stat:last-child{border-bottom:none;}
.db-stat-lbl{color:var(--text2);}
.db-stat-val{font-family:var(--mono);font-weight:700;}
.db-pos-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);}
.db-pos-row:last-child{border-bottom:none;}
.db-pos-ticker{font-weight:700;font-size:12px;}
.db-pos-name{font-size:9px;color:var(--text2);}
.db-macro-score{font-family:'Cormorant Garamond',serif;font-size:48px;font-weight:600;font-style:italic;line-height:1;}
.db-alerta{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;}
.db-alerta:last-child{border-bottom:none;}
.db-alerta:hover{opacity:0.8;}
.db-alerta-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:3px;}
.db-alerta-texto{font-size:11px;font-weight:600;color:var(--text1);}
.db-alerta-detalle{font-size:10px;color:var(--text2);margin-top:2px;}
.db-noticia{padding:9px 0;border-bottom:1px solid var(--border);}
.db-noticia:last-child{border-bottom:none;}
.db-noticia a{font-size:11px;color:var(--text1);text-decoration:none;line-height:1.4;display:block;}
.db-noticia a:hover{color:var(--teal);}
.db-noticia-meta{font-family:var(--mono);font-size:9px;color:var(--text2);margin-top:4px;}
.db-empty{font-size:11px;color:var(--text2);padding:10px 0;font-family:var(--mono);}
.db-saludo{font-family:'Cormorant Garamond',serif;font-size:22px;font-style:italic;color:var(--text2);margin-bottom:18px;}
`;

// ── RENDER ───────────────────────────────────
export async function render(container, { actionsSlot }) {
  if (!document.getElementById('db-css')) {
    const s = document.createElement('style'); s.id = 'db-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  actionsSlot.innerHTML = `<button class="btn btn-primary" id="db-refresh">↻ Actualizar</button>`;
  container.innerHTML = `<div id="db-wrap"><div class="empty"><div class="loader-ring"></div><div class="empty-title">Cargando dashboard...</div></div></div>`;

  async function load() {
    const el = document.getElementById('db-wrap');
    el.innerHTML = `<div class="empty"><div class="loader-ring"></div><div class="empty-title">Cargando...</div></div>`;

    const hour = new Date().getHours();
    const saludo = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
    const today = new Date().toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });

    // Leer todo en paralelo
    const [fondo, positions, history, capA, capB,
           watchlistAlc, watchlistBaj, correcciones] = await Promise.all([
      UserData.get('ethan_fondo_v1'),
      UserData.get('ethan_positions').then(v => v || []),
      UserData.get('ethan_positions_history').then(v => v || []),
      UserData.get('ethan_capital_alcista').then(v => v || 0),
      UserData.get('ethan_capital_bajista').then(v => v || 0),
      UserData.get('ethan_watchlist_v1').then(v => v || []),
      UserData.get('ethan_watchlist_bajista_v1').then(v => v || []),
      UserData.get('ethan_correcciones_v1').then(v => v || []),
    ]);

    // Calcular VL
    const capitalTotal = capA + capB;
    const pnlRealizado = history.reduce((s,h) => s+(h.pnlAbs||0), 0);
    const pnlNoRealizado = positions.reduce((s,p) => {
      const cur = p.currentPrice || p.entry;
      if (!cur || !p.entry || !p.shares) return s;
      return s + ((p.direction||'alcista')==='bajista'
        ? (p.entry-cur)*p.shares : (cur-p.entry)*p.shares);
    }, 0);
    const valorCartera = capitalTotal + pnlRealizado + pnlNoRealizado;
    const participaciones = fondo?.participaciones || (capitalTotal / VL_INICIAL);
    const vlActual = participaciones > 0 ? valorCartera / participaciones : VL_INICIAL;
    const twr = (vlActual - VL_INICIAL) / VL_INICIAL;
    const twrCol = twr >= 0 ? 'var(--green)' : 'var(--red)';

    // Leer serie VL para mini gráfico
    const serieBase100 = await (async () => {
      try {
        const tickers = [...new Set([...positions.map(p=>p.ticker), ...history.map(h=>h.ticker)])];
        const priceMap = {};
        await Promise.all(tickers.map(async t => {
          const d = await UserData.get(`ethan_px_hist_${t}`);
          if (d) priceMap[t] = d;
        }));
        if (!Object.keys(priceMap).length) return null;

        const startDate = fondo?.movimientos?.[0]?.date || history[0]?.entryDateISO;
        if (!startDate) return null;

        const today2 = new Date().toISOString().slice(0,10);
        const days = [];
        let d = new Date(startDate);
        while (d.toISOString().slice(0,10) <= today2) {
          const ds = d.toISOString().slice(0,10);
          if (d.getDay()!==0 && d.getDay()!==6) days.push(ds);
          d.setDate(d.getDate()+1);
        }

        const serie = [];
        days.forEach(date => {
          let costeInv = 0, valorMkt = 0;
          let pnlAcum = history.filter(h=>h.exitDateISO<date).reduce((s,h)=>s+(h.pnlAbs||0),0);
          let hayDatos = false;
          ;[...history.filter(h=>h.entryDateISO<=date&&h.exitDateISO>=date),
             ...positions.filter(p=>p.entryDate<=date)].forEach(pos => {
            const ticker = pos.ticker;
            const hist = priceMap[ticker]||{};
            const precio = date===today2?(pos.currentPrice||pos.entry):(hist[date]||null);
            if (!precio) return;
            const shares = pos.shares||(pos.cost&&pos.entry?pos.cost/pos.entry:0);
            if (!shares) return;
            const coste = pos.cost||shares*pos.entry;
            const dir = pos.direction||'alcista';
            const vm = dir==='bajista'?shares*pos.entry*2-shares*precio:shares*precio;
            costeInv+=coste; valorMkt+=vm; hayDatos=true;
          });
          if (!hayDatos) return;
          const val = Math.max(0, capitalTotal+pnlAcum-costeInv+valorMkt)/participaciones;
          if (val>0) serie.push({ date, val: +(val/VL_INICIAL*100).toFixed(3) });
        });
        return serie.length>1 ? serie : null;
      } catch { return null; }
    })();

    // Calcular stats trading
    const avgReturn = history.length ? history.reduce((s,h)=>s+(h.pnlPct||0),0)/history.length : null;
    const opsWithDays = history.filter(h=>h.entryDateISO&&h.exitDateISO);
    const avgDays = opsWithDays.length
      ? Math.round(opsWithDays.reduce((s,h)=>s+Math.round((new Date(h.exitDateISO)-new Date(h.entryDateISO))/86400000),0)/opsWithDays.length)
      : null;

    // Alertas
    const alertas = await calcAlertas(positions, history, watchlistAlc, watchlistBaj, correcciones);

    // Noticias generales y por ticker — ambas en paralelo
    const tickers = positions.map(p => p.ticker).join(',');
    const allTickers = [...new Set([
      ...positions.map(p => p.ticker),
      ...(watchlistAlc || []).map(w => w.ticker).slice(0, 5),
    ])];
    const watchlistTickers = [...new Set([
      ...(watchlistAlc || []).map(w => w.ticker),
      ...(watchlistBaj || []).map(w => w.ticker),
    ])].slice(0, 5).join(',');

    const [noticiasProm, noticiasPosProm, noticiasWatchProm] = [
      fetchNoticias(),
      tickers ? fetch(`/api/noticias?tickers=${tickers}`, { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 12000); return c.signal; })() })
                 .then(r => r.json()).catch(() => ({ results: {} })) : Promise.resolve({ results: {} }),
      watchlistTickers ? fetch(`/api/noticias?tickers=${watchlistTickers}`, { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 12000); return c.signal; })() })
                 .then(r => r.json()).catch(() => ({ results: {} })) : Promise.resolve({ results: {} }),
    ];

    // Earnings Calendar — en paralelo sin bloquear
    fetchEarnings(allTickers).then(earnings => paintEarnings(earnings)).catch(() => {
      const el = document.getElementById('db-earnings-content');
      if (el) el.innerHTML = '<div class="db-empty">Sin datos de earnings disponibles</div>';
    });

    // Score macro — viene de sessionStorage (mismo tab)
    const macroRaw = sessionStorage.getItem('ethan_macro_cache');
    const macroCache = macroRaw ? JSON.parse(macroRaw) : null;
    const score = macroCache?.data?.scoreTotal ?? null;
    const scoreCol = score > 6 ? 'var(--green)' : score > 0 ? 'var(--amber)' : 'var(--red)';
    const scoreLabel = score > 8 ? 'Expansión' : score > 4 ? 'Moderado' : score > 0 ? 'Desaceleración' : score > -4 ? 'Contracción' : 'Recesión';

    el.innerHTML = `
      <div class="db-saludo" style="color:var(--text1);">${saludo} — ${today}</div>

      <!-- Fila 1: VL + Stats + Macro -->
      <div class="db-grid">

        <!-- VL del Fondo -->
        <div class="db-card">
          <div class="db-card-title">
            Fondo ETHAN
            <a id="db-goto-fondo">Ver detalle →</a>
          </div>
          <div class="db-vl">${fmtVL(vlActual)}</div>
          <div class="db-vl-sub" style="color:${twrCol};">${fmtPct(twr*100)} desde inicio</div>
          <div style="margin-top:12px;">${miniChart(serieBase100)}</div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;font-family:var(--mono);font-size:10px;color:var(--text3);">
            <span>VL inicio: ${VL_INICIAL}</span>
            <span>${participaciones.toFixed(2)} participaciones</span>
          </div>
        </div>

        <!-- Stats trading -->
        <div class="db-card">
          <div class="db-card-title">Estadísticas</div>
          <div class="db-stat">
            <span class="db-stat-lbl">Valor cartera</span>
            <span class="db-stat-val" style="color:var(--teal);">${fmtE(valorCartera)}</span>
          </div>
          <div class="db-stat">
            <span class="db-stat-lbl">P&L Realizado</span>
            <span class="db-stat-val" style="color:${pnlRealizado>=0?'var(--green)':'var(--red)'};">${fmtE(pnlRealizado)}</span>
          </div>
          <div class="db-stat">
            <span class="db-stat-lbl">P&L No Realizado</span>
            <span class="db-stat-val" style="color:${pnlNoRealizado>=0?'var(--green)':'var(--red)'};">${fmtE(pnlNoRealizado)}</span>
          </div>
          <div class="db-stat">
            <span class="db-stat-lbl">Rent. media/op</span>
            <span class="db-stat-val" style="color:${(avgReturn||0)>=0?'var(--green)':'var(--red)'};">${avgReturn!=null?fmtPct(avgReturn):'—'}</span>
          </div>
          <div class="db-stat">
            <span class="db-stat-lbl">Días medios/op</span>
            <span class="db-stat-val">${avgDays!=null?avgDays+'d':'—'}</span>
          </div>
          <div class="db-stat">
            <span class="db-stat-lbl">Operaciones</span>
            <span class="db-stat-val">${history.length} cerradas · ${positions.length} abiertas</span>
          </div>
        </div>

        <!-- Score Macro -->
        <div class="db-card">
          <div class="db-card-title">
            Score Macro
            <a id="db-goto-macro">Ver detalle →</a>
          </div>
          ${score != null ? `
          <div class="db-macro-score" style="color:${scoreCol};">${score > 0 ? '+' : ''}${score}</div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:18px;font-style:italic;color:${scoreCol};margin-top:4px;">${scoreLabel}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:8px;">Rango: −17 a +17</div>
          <div style="margin-top:12px;">
            <div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;">
              <div style="height:100%;width:${((score+17)/34*100).toFixed(0)}%;background:${scoreCol};border-radius:3px;transition:width 0.5s;"></div>
            </div>
          </div>` : `
                    <div class="db-empty">Visita <strong style="color:var(--teal);cursor:pointer;" id="db-goto-macro2">1.0 Macro Dashboard</strong> para cargar el score</div>`}
        </div>
      </div>

      <!-- Fila 2: Posiciones + Alertas -->
      <div class="db-grid-wide">

        <!-- Posiciones abiertas -->
        <div class="db-card">
          <div class="db-card-title">
            Posiciones abiertas
            <a id="db-goto-cartera">Ver detalle →</a>
          </div>
          ${positions.length ? positions.map(p => {
            const cur = p.currentPrice || p.entry;
            const dir = p.direction || 'alcista';
            const pnlPct = cur && p.entry ? (dir==='bajista'?(p.entry-cur)/p.entry:(cur-p.entry)/p.entry)*100 : 0;
            const pnlAbs = p.shares && p.entry ? (dir==='bajista'?(p.entry-cur):(cur-p.entry))*p.shares : null;
            const col = pnlPct >= 0 ? 'var(--green)' : 'var(--red)';
            const stop = p.entryStop || p.stopManual;
            const tocaStop = stop && (dir==='bajista' ? cur >= stop : cur <= stop);
            return `<div class="db-pos-row">
              <div>
                <div class="db-pos-ticker">${p.ticker} ${tocaStop?'⚠️':''} <span id="sent-${p.ticker}" style="font-size:11px;" title="Sentimiento noticias">⚪</span></div>
                <div class="db-pos-name">${p.name||''} · ${dir}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-family:var(--mono);font-size:12px;font-weight:700;color:${col};">${fmtPct(pnlPct)}</div>
                <div style="font-family:var(--mono);font-size:10px;color:${col};">${pnlAbs!=null?fmtE(pnlAbs):''}</div>
              </div>
            </div>`;
          }).join('') : '<div class="db-empty">Sin posiciones abiertas</div>'}
        </div>

        <!-- Alertas -->
        <div class="db-card">
          <div class="db-card-title">
            Alertas activas
            <span style="font-family:var(--mono);font-size:10px;color:${alertas.length>0?'var(--amber)':'var(--text3)'};">${alertas.length}</span>
          </div>
          ${alertas.length ? alertas.map(a => {
            const dotCol = a.urgencia==='alta'?'var(--red)':a.tipo==='correccion'?'var(--teal)':a.tipo==='corto'?'var(--red)':'var(--green)';
            return `<div class="db-alerta" data-accion="${a.accion}">
              <div class="db-alerta-dot" style="background:${dotCol};"></div>
              <div>
                <div class="db-alerta-texto">${a.texto}</div>
                <div class="db-alerta-detalle">${a.detalle}</div>
              </div>
            </div>`;
          }).join('') : '<div class="db-empty">Sin alertas activas</div>'}
        </div>
      </div>

      <!-- Fila 3: Earnings Calendar -->
      <div class="db-card" style="margin-bottom:14px;" id="db-earnings-card">
        <div class="db-card-title">📅 Próximos Earnings</div>
        <div id="db-earnings-content"><div class="db-empty">Cargando...</div></div>
      </div>

      <!-- Fila 4: Noticias generales -->
      <div class="db-card" id="db-noticias-card" style="margin-bottom:14px;">
        <div class="db-card-title">Noticias del mercado</div>
        <div id="db-noticias-content"><div class="db-empty">Cargando noticias...</div></div>
      </div>

      <!-- Fila 4: Sentimiento Watchlist -->
      ${watchlistAlc?.length || watchlistBaj?.length ? `
      <div class="db-card" style="margin-bottom:14px;" id="db-sent-watch-card">
        <div class="db-card-title">Sentimiento · Watchlist</div>
        <div id="db-sent-watch-content"><div class="db-empty">Cargando...</div></div>
      </div>` : ''}

      <!-- Fila 5: Noticias por posición -->
      ${positions.length ? `
      <div class="db-card" id="db-noticias-pos-card">
        <div class="db-card-title">Noticias de tus posiciones · ${positions.map(p=>p.ticker).join(', ')}</div>
        <div id="db-noticias-pos-content"><div class="db-empty">Cargando...</div></div>
      </div>` : ''}
    `;

    // Listeners navegación
    document.getElementById('db-goto-fondo')?.addEventListener('click', () => navigateTo('car-fondo'));
    document.getElementById('db-goto-macro')?.addEventListener('click', () => navigateTo('macro-home'));
    document.getElementById('db-goto-macro2')?.addEventListener('click', () => navigateTo('macro-home'));
    document.getElementById('db-goto-cartera')?.addEventListener('click', () => navigateTo('car-cartera'));
    el.querySelectorAll('.db-alerta[data-accion]').forEach(a => {
      a.addEventListener('click', () => navigateTo(a.dataset.accion));
    });

    // Noticias generales
    noticiasProm.then(noticias => {
      const nc = document.getElementById('db-noticias-content');
      if (!nc) return;
      if (!noticias.length) {
        nc.innerHTML = '<div class="db-empty">No se pudieron cargar las noticias</div>';
        return;
      }
      nc.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 24px;">
        ${noticias.map(n => `
          <div class="db-noticia">
            <a href="${n.link}" target="_blank" rel="noopener">${n.title}</a>
            <div class="db-noticia-meta">${n.source}${n.date ? ' · ' + new Date(n.date).toLocaleDateString('es-ES',{day:'2-digit',month:'short'}) : ''}</div>
          </div>`).join('')}
      </div>`;
    });

    // Sentimiento watchlist
    noticiasWatchProm.then(data => {
      const nc = document.getElementById('db-sent-watch-content');
      if (!nc) return;
      const results = data.results || {};
      const tks = Object.keys(results).filter(t => results[t]?.length > 0);
      if (!tks.length) { nc.innerHTML = '<div class="db-empty">Sin noticias para la watchlist</div>'; return; }
      nc.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${tks.map(ticker => {
          const news = results[ticker] || [];
          const sent = analyzeSentiment(news);
          const isAlc = (watchlistAlc||[]).some(w=>w.ticker===ticker);
          return `<div style="display:flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer;" 
                       title="${sent.label} · ${news.length} noticias recientes">
            <span style="font-family:var(--mono);font-size:11px;font-weight:700;">${ticker}</span>
            <span style="font-size:9px;color:${isAlc?'var(--green)':'var(--red)'};font-family:var(--mono);">${isAlc?'▲':'▼'}</span>
            <span style="font-size:14px;" title="${sent.label}">${sent.emoji}</span>
            <span style="font-size:9px;color:${sent.color};font-family:var(--mono);">${sent.label}</span>
          </div>`;
        }).join('')}
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:10px;font-family:var(--mono);">
        🟢 Positivo · 🟡 Neutral · 🔴 Negativo · ▲ Alcista · ▼ Bajista
      </div>`;
    });

    // Noticias por posición
    noticiasPosProm.then(data => {
      const nc = document.getElementById('db-noticias-pos-content');
      if (!nc) return;
      const results = data.results || {};
      const tks = Object.keys(results);
      if (!tks.length) { nc.innerHTML = '<div class="db-empty">Sin noticias</div>'; return; }
      const hasNews = tks.some(t => results[t]?.length > 0);
      if (!hasNews) { nc.innerHTML = '<div class="db-empty">No se encontraron noticias para tus posiciones</div>'; return; }

      // Actualizar semáforos — siempre, aunque estén vacíos
      tks.forEach(ticker => {
        const news = results[ticker] || [];
        const sent = news.length ? analyzeSentiment(news) : { emoji: '⚪', label: 'Sin datos', color: 'var(--text3)' };
        const sentEl = document.getElementById(`sent-${ticker}`);
        if (sentEl) {
          sentEl.textContent = sent.emoji;
          sentEl.title = `Sentimiento: ${sent.label}${news.length ? ` (${news.length} noticias)` : ' — sin noticias recientes'}`;
        }
      });
      // También actualizar los que no tienen noticias con ⚪
      positions.forEach(p => {
        if (!tks.includes(p.ticker)) {
          const sentEl = document.getElementById(`sent-${p.ticker}`);
          if (sentEl) { sentEl.textContent = '⚪'; sentEl.title = 'Sin noticias recientes'; }
        }
      });

      nc.innerHTML = `<div style="display:grid;grid-template-columns:repeat(${Math.min(tks.length,3)},1fr);gap:0 24px;">
        ${tks.map(ticker => {
          const news = results[ticker] || [];
          if (!news.length) return '';
          const sent = analyzeSentiment(news);
          return `<div>
            <div style="font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:var(--teal);margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
              <span>${ticker}</span>
              <span style="color:${sent.color};" title="${sent.label}">${sent.emoji} ${sent.label}</span>
            </div>
            ${news.map(n => `<div class="db-noticia">
              <a href="${n.link}" target="_blank" rel="noopener">${n.title}</a>
              <div class="db-noticia-meta">${n.date ? new Date(n.date).toLocaleDateString('es-ES',{day:'2-digit',month:'short'}) : ''}</div>
            </div>`).join('')}
          </div>`;
        }).join('')}
      </div>`;
    });
  }

  document.getElementById('db-refresh')?.addEventListener('click', load);
  load();
  return { destroy() { document.getElementById('db-css')?.remove(); } };
}

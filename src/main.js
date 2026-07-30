// ═══════════════════════════════════════════════
// MAIN — Punto de entrada de ETHAN Mercados
// ═══════════════════════════════════════════════

import { onAuthChange, login, logout, getCurrentUser } from './auth.js';
import { initState, cleanupState } from './state.js';
import { initRouter, registerPage, navigateTo, getInitialPageFromHash } from './router.js';

// ── Registro de páginas ─────────────────────────
// Cada loader es un import() dinámico: el módulo solo se descarga
// la primera vez que el usuario navega a esa página (code-splitting).

registerPage('dashboard', {
  crumb: 'ETHAN <span>›</span> Dashboard',
  title: 'Dashboard',
  loader: () => import('./modules/dashboard.js')
});

registerPage('macro-home', {
  crumb: '1. Macro <span>›</span> Dashboard',
  title: 'Dashboard Ejecutivo',
  loader: () => import('./modules/macro/home.js')
});
registerPage('macro-ciclo', {
  crumb: '1. Macro <span>›</span> Ciclo Económico',
  title: 'Ciclo Económico',
  loader: () => import('./modules/macro/ciclo.js')
});
registerPage('macro-liquidez', {
  crumb: '1. Macro <span>›</span> Liquidez',
  title: 'Liquidez Global',
  loader: () => import('./modules/macro/liquidez.js')
});
registerPage('macro-polmon', {
  crumb: '1. Macro <span>›</span> Política Monetaria',
  title: 'Política Monetaria',
  loader: () => import('./modules/macro/polmon.js')
});
registerPage('macro-inflacion', {
  crumb: '1. Macro <span>›</span> Inflación',
  title: 'Inflación',
  loader: () => import('./modules/macro/inflacion.js')
});
registerPage('macro-sentimiento', {
  crumb: '1. Macro <span>›</span> Sentimiento',
  title: 'Sentimiento de Mercado',
  loader: () => import('./modules/macro/sentimiento.js')
});
registerPage('macro-timeline', {
  crumb: '1. Macro <span>›</span> Timeline',
  title: 'Timeline Histórico',
  loader: () => import('./modules/macro/timeline.js')
});
registerPage('macro-correlaciones', {
  crumb: '1. Macro <span>›</span> Correlaciones',
  title: 'Correlaciones Históricas',
  loader: () => import('./modules/macro/correlaciones.js')
});
registerPage('macro-radar', {
  crumb: '1. Macro <span>›</span> Radar de Riesgos',
  title: 'Radar de Riesgos',
  loader: () => import('./modules/macro/radar.js')
});
registerPage('macro-calendario', {
  crumb: '1. Macro <span>›</span> Calendario',
  title: 'Calendario Macro',
  loader: () => import('./modules/macro/calendario.js')
});
registerPage('macro-inversor', {
  crumb: '1. Macro <span>›</span> Modo Inversor',
  title: 'Modo Inversor',
  loader: () => import('./modules/macro/inversor.js')
});

registerPage('alc-alertas', {
  crumb: '2. Alcista <span>›</span> Alertas',
  title: 'Alertas · Cambios en Watchlist',
  loader: () => import('./modules/alcista/alertas.js')
});
registerPage('alc-etf-screener', {
  crumb: '2. Alcista <span>›</span> 2.1 Renta Variable <span>›</span> Screener ETFs',
  title: 'Screener · ETFs RV',
  loader: () => import('./modules/alcista/etf-screener.js')
});
registerPage('alc-rv-analisis', {
  crumb: '2. Alcista <span>›</span> 2.1 Renta Variable <span>›</span> Análisis',
  title: 'Análisis Técnico',
  loader: () => import('./modules/alcista/rv-analisis.js')
});
registerPage('alc-rv-sectores', {
  crumb: '2. Alcista <span>›</span> 2.1 Renta Variable <span>›</span> Screener Sectores',
  title: 'Screener de Sectores',
  loader: () => import('./modules/alcista/rv-sectores.js')
});
registerPage('alc-rv-sp500', {
  crumb: '2. Alcista <span>›</span> 2.1 Renta Variable <span>›</span> Screener SP500 – NYSE',
  title: 'Screener SP500 / NYSE',
  loader: () => import('./modules/alcista/rv-sp500.js')
});
registerPage('alc-rv-watchlist', {
  crumb: '2. Alcista <span>›</span> 2.1 Renta Variable <span>›</span> Watchlist',
  title: 'Watchlist · Renta Variable',
  loader: () => import('./modules/alcista/rv-watchlist.js')
});
registerPage('alc-rv-correcciones', {
  crumb: '2. Alcista <span>›</span> 2.1 Renta Variable <span>›</span> Correcciones',
  title: 'Watchlist de Correcciones',
  loader: () => import('./modules/alcista/correcciones.js')
});
registerPage('alc-rf-screener', {
  crumb: '2. Alcista <span>›</span> 2.2 Renta Fija <span>›</span> Screener',
  title: 'Screener · Renta Fija',
  loader: () => import('./modules/alcista/rf-screener.js')
});
registerPage('alc-rf-watchlist', {
  crumb: '2. Alcista <span>›</span> 2.2 Renta Fija <span>›</span> Watchlist',
  title: 'Watchlist · Renta Fija',
  loader: () => import('./modules/alcista/rf-watchlist.js')
});
registerPage('alc-com-screener', {
  crumb: '2. Alcista <span>›</span> 2.3 Commodities <span>›</span> Screener',
  title: 'Screener · Commodities',
  loader: () => import('./modules/alcista/com-screener.js')
});
registerPage('alc-com-watchlist', {
  crumb: '2. Alcista <span>›</span> 2.3 Commodities <span>›</span> Watchlist',
  title: 'Watchlist · Commodities',
  loader: () => import('./modules/alcista/com-watchlist.js')
});

registerPage('baj-analisis', {
  crumb: '3. Bajista <span>›</span> Análisis',
  title: 'Bajista · Análisis Técnico',
  loader: () => import('./modules/bajista/analisis.js')
});
registerPage('baj-sectores', {
  crumb: '3. Bajista <span>›</span> 3.1 Screener Sectores',
  title: 'Screener de Sectores · Bajista',
  loader: () => import('./modules/bajista/sectores.js')
});
registerPage('baj-sp500', {
  crumb: '3. Bajista <span>›</span> 3.2 Screener SP500 – NYSE',
  title: 'Screener SP500 / NYSE · Bajista',
  loader: () => import('./modules/bajista/sp500.js')
});
registerPage('baj-watchlist', {
  crumb: '3. Bajista <span>›</span> 3.3 Watchlist',
  title: 'Watchlist · Bajista',
  loader: () => import('./modules/bajista/watchlist.js')
});

registerPage('car-fondo', {
  crumb: '4. Cartera <span>›</span> 4.1 Fondo ETHAN',
  title: 'Fondo ETHAN',
  loader: () => import('./modules/cartera/fondo.js')
});
registerPage('car-cartera', {
  crumb: '4. Cartera <span>›</span> 4.2 Posiciones',
  title: 'Posiciones',
  loader: () => import('./modules/cartera/cartera.js')
});
registerPage('car-metricas', {
  crumb: '4. Cartera <span>›</span> 4.3 Métricas',
  title: 'Métricas de Trading',
  loader: () => import('./modules/cartera/metricas.js')
});
registerPage('car-allocation', {
  crumb: '4. Cartera <span>›</span> 4.4 Asset Allocation',
  title: 'Asset Allocation',
  loader: () => import('./modules/cartera/allocation.js')
});
registerPage('car-money', {
  crumb: '4. Cartera <span>›</span> 4.5 Money Management',
  title: 'Money Management',
  loader: () => import('./modules/cartera/money.js')
});
registerPage('car-risk', {
  crumb: '4. Cartera <span>›</span> 4.6 Risk Management',
  title: 'Risk Management',
  loader: () => import('./modules/cartera/risk.js')
});
registerPage('car-backtest', {
  crumb: '4. Cartera <span>›</span> 4.7 Backtesting',
  title: 'Backtesting',
  loader: () => import('./modules/cartera/backtest.js')
});
registerPage('car-vitacora', {
  crumb: '4. Cartera <span>›</span> 4.8 Bitácora',
  title: 'Bitácora',
  loader: () => import('./modules/cartera/vitacora.js')
});

registerPage('fund-analisis', {
  crumb: '5. Fundamentales',
  title: 'Análisis Fundamental',
  loader: () => import('./modules/fundamentales/analisis.js')
});
registerPage('smart-money', {
  crumb: 'Smart Money <span>›</span> Insider Trading · Short Interest · Institucional',
  title: 'Smart Money Intelligence',
  loader: () => import('./modules/smart/smart-money.js')
});
registerPage('cava', {
  crumb: 'José Luis Cava <span>›</span> Análisis Diario',
  title: 'Cava · Análisis Técnico Diario',
  loader: () => import('./modules/cava/cava.js')
});

// ── Sidebar: acordeón de grupos y subgrupos ─────

function setupSidebarAccordion() {
  document.querySelectorAll('[data-toggle-grp]').forEach(head => {
    head.addEventListener('click', () => {
      const grp = head.closest('.grp');
      const wasOpen = grp.classList.contains('open');
      document.querySelectorAll('.grp').forEach(g => g.classList.remove('open'));
      if (!wasOpen) grp.classList.add('open');
    });
  });

  document.querySelectorAll('[data-toggle-sub]').forEach(head => {
    head.addEventListener('click', (evt) => {
      evt.stopPropagation();
      const sub = head.closest('.sub');
      const wasOpen = sub.classList.contains('open');
      const parentGrp = sub.closest('.grp');
      parentGrp.querySelectorAll('.sub').forEach(s => s.classList.remove('open'));
      if (!wasOpen) sub.classList.add('open');
    });
  });

  document.querySelectorAll('.mod[data-page]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  });
}

function setupSidebarToggle() {
  let collapsed = false;
  const app = document.getElementById('app');
  const btn = document.getElementById('sb-toggle-btn');
  const toggle = () => {
    collapsed = !collapsed;
    app.classList.toggle('collapsed', collapsed);
    btn.textContent = collapsed ? '▷' : '◁';
  };
  btn.addEventListener('click', toggle);
  document.getElementById('toggle-sidebar-btn')?.addEventListener('click', toggle);
  document.getElementById('h-brand-home')?.addEventListener('click', () => navigateTo('dashboard'));
}

// ── Reloj ────────────────────────────────────────

function startClock() {
  const el = document.getElementById('clock');
  const tick = () => { el.textContent = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
  tick();
  setInterval(tick, 1000);
}

// ── Ticker Tape dinámico ────────────────────────
// Índices fijos + posiciones abiertas de Firestore
// Scroll infinito CSS: duplica el contenido para
// que el loop sea perfectamente continuo.

const FIXED_SYMBOLS = [
  { yf:'SPY',     label:'SPY'  },
  { yf:'QQQ',     label:'QQQ'  },
  { yf:'%5EVIX',  label:'VIX'  },
  { yf:'GC%3DF',  label:'GC=F' },
  { yf:'%5ETNX',  label:'10Y'  },
  { yf:'DX-Y.NYB',label:'DXY'  },
  { yf:'%5EGSPC', label:'SP500'},
  { yf:'%5EIXIC', label:'NASDAQ'},
  { yf:'CL%3DF',  label:'OIL'  },
  { yf:'BTC-USD', label:'BTC'  },
];

const TAPE_PROXIES = [
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];

async function fetchTickerPrice(yf) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yf}?interval=1d&range=2d`;
  for (const fn of TAPE_PROXIES) {
    try {
      const r = await fetch(fn(url), { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 5000); return c.signal; })() });
      const j = await r.json();
      const meta = j.chart?.result?.[0]?.meta;
      if (!meta) continue;
      const price  = meta.regularMarketPrice;
      const prev   = meta.previousClose || meta.chartPreviousClose;
      const change = prev ? ((price - prev) / prev * 100) : null;
      return { price, change };
    } catch {}
  }
  return null;
}

function buildTickerItem(label, data, isCartera = false) {
  const priceStr = data
    ? (data.price < 10 ? data.price.toFixed(3) : data.price < 1000 ? data.price.toFixed(2) : data.price.toFixed(1))
    : '—';
  const chgStr   = data?.change != null
    ? (data.change >= 0 ? '+' : '') + data.change.toFixed(2) + '%'
    : '—';
  const chgClass = data?.change != null ? (data.change >= 0 ? 'up' : 'down') : '';
  return `<div class="ticker-item">
    <span class="t-sym ${isCartera ? 'cartera' : ''}">${label}</span>
    <span class="t-val">${priceStr}</span>
    <span class="t-chg ${chgClass}">${chgStr}</span>
  </div>`;
}

async function initTape() {
  const track = document.getElementById('tape-track');
  if (!track) return;

  // 1. Obtener posiciones abiertas de Firestore
  let positions = [];
  try {
    positions = (await UserData.get('ethan_positions')) || [];
  } catch {}
  const carteraTickers = positions
    .filter(p => p.ticker)
    .map(p => ({ yf: p.ticker, label: p.ticker, isCartera: true }));

  // 2. Lista total: índices fijos + separador + posiciones cartera
  const allSymbols = [
    ...FIXED_SYMBOLS.map(s => ({ ...s, isCartera: false })),
    ...(carteraTickers.length ? [null] : []), // separador
    ...carteraTickers
  ];

  // 3. Render inicial con —
  const renderItems = (data) => {
    const items = allSymbols.map(s => {
      if (s === null) return `<div class="ticker-item separator">◆ CARTERA</div>`;
      return buildTickerItem(s.label, data[s.label] || null, s.isCartera);
    }).join('');
    // Duplicar para scroll infinito continuo
    track.innerHTML = items + items;
    // Ajustar velocidad según número de items
    const totalItems = allSymbols.filter(s => s !== null).length;
    const duration = Math.max(30, totalItems * 4);
    track.style.animationDuration = duration + 's';
  };

  renderItems({});

  // 4. Cargar precios en paralelo
  const data = {};
  const fetchAll = allSymbols
    .filter(s => s !== null)
    .map(async s => {
      const d = await fetchTickerPrice(s.yf);
      if (d) data[s.label] = d;
    });
  await Promise.all(fetchAll);
  renderItems(data);

  // 5. Refresh cada 60s
  setInterval(async () => {
    const updates = allSymbols
      .filter(s => s !== null)
      .map(async s => {
        const d = await fetchTickerPrice(s.yf);
        if (d) data[s.label] = d;
      });
    await Promise.all(updates);
    renderItems(data);
  }, 60000);
}

// ── Login form ───────────────────────────────────

function setupLoginForm() {
  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Accediendo…';
    errorEl.textContent = '';

    const result = await login(email, pass);

    if (!result.ok) {
      errorEl.textContent = result.error;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Acceder a la plataforma';
    }
    // Si ok, onAuthChange se dispara solo y monta la app
  });

  document.getElementById('logout-btn').addEventListener('click', () => logout());
}

// ── Mostrar / ocultar pantallas ─────────────────

function showApp(user) {
  document.getElementById('login-screen').classList.add('hidden');
  setTimeout(() => { document.getElementById('login-screen').style.display = 'none'; }, 700);

  const app = document.getElementById('app');
  app.classList.add('active');

  document.getElementById('h-user-email').textContent = user.email;
  document.getElementById('sb-username').textContent = user.email.split('@')[0];
  document.getElementById('sb-avatar').textContent = user.email[0].toUpperCase();

  initRouter(document.getElementById('main'));
  initState();
  initTape();

  const initialPage = 'dashboard'; // Siempre empieza en el dashboard
  navigateTo(initialPage);
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.remove('active');
  cleanupState();
}

// ── Arranque ─────────────────────────────────────

setupSidebarAccordion();
setupSidebarToggle();
setupLoginForm();
startClock();

onAuthChange((user) => {
  if (user) showApp(user);
  else showLogin();
});

// Atajos Alt+1..5 para abrir/cerrar grupos del sidebar
document.addEventListener('keydown', (e) => {
  if (!document.getElementById('app').classList.contains('active')) return;
  if (e.altKey && e.key >= '1' && e.key <= '5') {
    e.preventDefault();
    const grps = document.querySelectorAll('.grp');
    const grp = grps[+e.key - 1];
    if (grp) grp.querySelector('[data-toggle-grp]').click();
  }
});

// ═══════════════════════════════════════════════
// MAIN — Punto de entrada de ETHAN Mercados
// ═══════════════════════════════════════════════

import { onAuthChange, login, logout, getCurrentUser } from './auth.js';
import { initState, cleanupState } from './state.js';
import { initRouter, registerPage, navigateTo, getInitialPageFromHash } from './router.js';

// ── Registro de páginas ─────────────────────────
// Cada loader es un import() dinámico: el módulo solo se descarga
// la primera vez que el usuario navega a esa página (code-splitting).

registerPage('macro-coyuntura', {
  crumb: '1. Macro <span>›</span> 1.1 Coyuntura',
  title: 'Coyuntura Macroeconómica',
  loader: () => import('./modules/macro/coyuntura.js')
});
registerPage('macro-indicadores', {
  crumb: '1. Macro <span>›</span> 1.2 Indicadores Seguimiento',
  title: 'Indicadores de Seguimiento',
  loader: () => import('./modules/macro/indicadores.js')
});
registerPage('macro-liquidez', {
  crumb: '1. Macro <span>›</span> 1.3 Liquidez',
  title: 'Liquidez Global',
  loader: () => import('./modules/macro/liquidez.js')
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

registerPage('car-allocation', {
  crumb: '4. Cartera <span>›</span> 4.1 Asset Allocation',
  title: 'Asset Allocation',
  loader: () => import('./modules/cartera/allocation.js')
});
registerPage('car-cartera', {
  crumb: '4. Cartera <span>›</span> 4.2 Cartera',
  title: 'Posiciones de Cartera',
  loader: () => import('./modules/cartera/cartera.js')
});
registerPage('car-money', {
  crumb: '4. Cartera <span>›</span> 4.3 Money Management',
  title: 'Money Management',
  loader: () => import('./modules/cartera/money.js')
});
registerPage('car-risk', {
  crumb: '4. Cartera <span>›</span> 4.4 Risk Management',
  title: 'Risk Management',
  loader: () => import('./modules/cartera/risk.js')
});
registerPage('car-backtest', {
  crumb: '4. Cartera <span>›</span> 4.5 Backtesting',
  title: 'Backtesting',
  loader: () => import('./modules/cartera/backtest.js')
});
registerPage('car-vitacora', {
  crumb: '4. Cartera <span>›</span> 4.6 Vitácora',
  title: 'Vitácora de Operaciones',
  loader: () => import('./modules/cartera/vitacora.js')
});

registerPage('fund-analisis', {
  crumb: '5. Fundamentales',
  title: 'Análisis Fundamental',
  loader: () => import('./modules/fundamentales/analisis.js')
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
  document.getElementById('toggle-sidebar-btn').addEventListener('click', toggle);
}

// ── Reloj ────────────────────────────────────────

function startClock() {
  const el = document.getElementById('clock');
  const tick = () => { el.textContent = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
  tick();
  setInterval(tick, 1000);
}

// ── Ticker tape (Yahoo Finance vía proxy) ───────

const SYMBOLS = [
  { yf: 'SPY',    els: ['t-spy-v', 't-spy-c'] },
  { yf: 'QQQ',    els: ['t-qqq-v', 't-qqq-c'] },
  { yf: '%5EVIX', els: ['t-vix-v', 't-vix-c'] },
  { yf: 'GC%3DF', els: ['t-gc-v',  't-gc-c']  },
  { yf: '%5ETNX', els: ['t-tnx-v', 't-tnx-c'] }
];

async function fetchTicker(yf) {
  const proxy = 'https://corsproxy.io/?';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yf}?interval=1d&range=2d`;
  try {
    const r = await fetch(proxy + encodeURIComponent(url));
    const j = await r.json();
    const meta = j.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prev = meta.previousClose || meta.chartPreviousClose;
    const change = prev ? ((price - prev) / prev * 100) : null;
    return { price, change };
  } catch (e) { return null; }
}

async function loadTickers() {
  for (const s of SYMBOLS) {
    const d = await fetchTicker(s.yf);
    if (!d) continue;
    const vEl = document.getElementById(s.els[0]);
    const cEl = document.getElementById(s.els[1]);
    if (vEl) vEl.textContent = d.price < 100 ? d.price.toFixed(2) : d.price.toFixed(1);
    if (cEl && d.change !== null) {
      cEl.textContent = (d.change >= 0 ? '+' : '') + d.change.toFixed(2) + '%';
      cEl.className = 't-chg ' + (d.change >= 0 ? 'up' : 'down');
    }
  }
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
  loadTickers();
  setInterval(loadTickers, 300000);

  const initialPage = getInitialPageFromHash('macro-coyuntura');
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

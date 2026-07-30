// ═══════════════════════════════════════════════
// MÓDULO: Alertas · Cambios en Watchlist
// Analiza todos los tickers de las 3 watchlists
// (RV, Commodities, RF) y detecta cambios de estado
// respecto al último análisis guardado.
// Estados: watching → close → diario → ready
// Guarda snapshot en UserData('ethan_alertas_snapshot')
// ═══════════════════════════════════════════════

import { UserData } from '../../userdata.js';

const SNAPSHOT_KEY = 'ethan_alertas_snapshot';
const WL_KEYS = {
  rv:  'ethan_watchlist_v1',
  com: 'ethan_watchlist_com_v1',
  rf:  'ethan_watchlist_rf_v1'
};

const ESTADO_RANK = { watching:0, close:1, diario:2, ready:3 };
const ESTADO_LABEL = {
  watching: '👁 Vigilando',
  close:    '🔶 Cerca',
  diario:   '⏳ Espera Diario',
  ready:    '🟢 Listo'
};
const WL_LABEL = { rv:'Renta Variable', com:'Commodities', rf:'Renta Fija' };

// ── Motor técnico (compacto) ───────────────────
const PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://soft-field-156f.miguel-gomez-anton.workers.dev/?url=${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
];

async function fetchOHLC(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=10y&events=history`;
  for (const fn of PROXIES) {
    try {
      const r = await fetch(fn(url), { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 8000); return c.signal; })() });
      if (!r.ok) continue;
      const text = await r.text();
      let j; try { j = JSON.parse(text); } catch { continue; }
      const res = j?.chart?.result?.[0]; if (!res) continue;
      const q = res.indicators?.quote?.[0]; if (!q) continue;
      const adj = res.indicators?.adjclose?.[0]?.adjclose || q.close;
      const ratio = adj.map((a,i) => (q.close[i]&&a) ? a/q.close[i] : 1);
      return { timestamps:res.timestamp, O:q.open.map((v,i)=>v*ratio[i]), H:q.high.map((v,i)=>v*ratio[i]), L:q.low.map((v,i)=>v*ratio[i]), C:adj, V:q.volume };
    } catch {}
  }
  throw new Error('Sin datos');
}

function ema(arr, p) {
  const k=2/(p+1), out=new Array(arr.length).fill(null);
  let s=arr.findIndex(v=>v!=null&&!isNaN(v));
  if(s<0)return out; out[s]=arr[s];
  for(let i=s+1;i<arr.length;i++){const v=(arr[i]!=null&&!isNaN(arr[i]))?arr[i]:out[i-1];out[i]=v*k+out[i-1]*(1-k);}
  return out;
}
function macd(c){const ef=ema(c,12),es=ema(c,26);const m=ef.map((v,i)=>(v!=null&&es[i]!=null)?v-es[i]:null);return{m,sl:ema(m.map(v=>v??0),9)};}
function rsi(c,p=14){const out=new Array(c.length).fill(null);if(c.length<p+1)return out;let g=0,l=0;for(let i=1;i<=p;i++){const d=c[i]-c[i-1];d>0?g+=d:l-=d;}let ag=g/p,al=l/p;out[p]=al===0?100:100-(100/(1+ag/al));for(let i=p+1;i<c.length;i++){const d=c[i]-c[i-1];ag=(ag*(p-1)+(d>0?d:0))/p;al=(al*(p-1)+(d<0?-d:0))/p;out[i]=al===0?100:100-(100/(1+ag/al));}return out;}
function stoch(H,L,C,p){const rk=C.map((c,i)=>{if(i<p-1)return null;const hh=Math.max(...H.slice(i-p+1,i+1)),ll=Math.min(...L.slice(i-p+1,i+1));return hh===ll?50:(c-ll)/(hh-ll)*100;});const k=ema(rk,3);return{k,d:ema(k.map(v=>v??0),3)};}
function resample(ts,O,H,L,C,V,freq){const g={};ts.forEach((t,i)=>{const dd=new Date(t*1000);let key;if(freq==='W'){const dy=dd.getDay(),df=dd.getDate()-dy+(dy===0?-6:1);const mo=new Date(+dd);mo.setDate(df);key=mo.toISOString().slice(0,10);}else key=`${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}`;if(!g[key])g[key]={O:O[i],H:H[i],L:L[i],C:C[i],V:V[i]};else{g[key].H=Math.max(g[key].H,H[i]);g[key].L=Math.min(g[key].L,L[i]);g[key].C=C[i];g[key].V+=V[i];}});const keys=Object.keys(g).sort();return{O:keys.map(k=>g[k].O),H:keys.map(k=>g[k].H),L:keys.map(k=>g[k].L),C:keys.map(k=>g[k].C),V:keys.map(k=>g[k].V)};}

function quickAnalyze(raw) {
  const {timestamps,O,H,L,C,V}=raw;
  const n=C.length, di=n-1;
  const W=resample(timestamps,O,H,L,C,V,'W'), wi=W.C.length-1;
  const M=resample(timestamps,O,H,L,C,V,'M'), mi=M.C.length-1;

  const mm=macd(M.C), ms89=stoch(M.H,M.L,M.C,89), ms8=stoch(M.H,M.L,M.C,8), mr=rsi(M.C), me=ema(M.C,10);
  const wm=macd(W.C), ws89=stoch(W.H,W.L,W.C,89), wr=rsi(W.C), we=ema(W.C,20);
  const dm=macd(C), dr=rsi(C);

  const mc=[mm.m[mi]>0&&mm.m[mi]>mm.sl[mi],(ms89.k[mi]>80&&ms89.k[mi]>ms89.d[mi])||ms89.k[mi]>92,mr[mi]>65,ms8.k[mi]>78,me[mi]&&M.C[mi]>me[mi]];
  const sc=[wm.m[wi]>0&&wm.m[wi]>wm.sl[wi],(ws89.k[wi]>85&&ws89.k[wi]>ws89.d[wi])||ws89.k[wi]>92,wr[wi]>67,we[wi]&&W.C[wi]>we[wi]];
  const mensualOk=mc.every(x=>x), semanalOk=sc.every(x=>x);
  const daily=dm.m[di]>dm.sl[di]&&di>0&&dm.m[di-1]<=dm.sl[di-1]&&dr[di]>57&&dm.m[di]>0;
  const score=mc.filter(x=>x).length+sc.filter(x=>x).length+(mensualOk&&semanalOk?1:0);

  let estado='watching';
  if(mensualOk&&semanalOk&&daily)estado='ready';
  else if(mensualOk&&semanalOk)estado='diario';
  else if(score>=7)estado='close';

  return { estado, score, price: C[di] };
}

// ── Render ─────────────────────────────────────
export async function render(container, { actionsSlot }) {
  actionsSlot.innerHTML = `
    <button class="btn btn-primary" id="alertas-refresh-btn">↻ Actualizar ahora</button>
  `;

  container.innerHTML = `<div id="alertas-content"><div class="empty"><div class="loader-ring"></div><div class="empty-title">Cargando watchlists...</div></div></div>`;

  async function runCheck() {
    const el = document.getElementById('alertas-content');
    if (!el) return;
    el.innerHTML = `<div class="empty"><div class="loader-ring"></div><div class="empty-title">Analizando valores...</div><div class="empty-desc">Esto puede tardar un minuto según el tamaño de tus watchlists</div></div>`;

    // Cargar las 3 watchlists y el snapshot anterior
    const [rvList, comList, rfList, snapshot] = await Promise.all([
      UserData.get(WL_KEYS.rv).then(v=>v||[]),
      UserData.get(WL_KEYS.com).then(v=>v||[]),
      UserData.get(WL_KEYS.rf).then(v=>v||[]),
      UserData.get(SNAPSHOT_KEY).then(v=>v||{})
    ]);

    const allTickers = [
      ...rvList.map(t=>({ticker:t,wl:'rv'})),
      ...comList.map(t=>({ticker:t,wl:'com'})),
      ...rfList.map(t=>({ticker:t,wl:'rf'}))
    ];

    if (allTickers.length === 0) {
      el.innerHTML = `
        <div class="empty">
          <div class="empty-icon">🔔</div>
          <div class="empty-title">Sin tickers en tus watchlists</div>
          <div class="empty-desc">Añade valores a la Watchlist de RV, Commodities o RF para recibir alertas de cambios de estado.</div>
        </div>`;
      return;
    }

    // Analizar en lotes
    const results = [];
    const BATCH = 5;
    let done = 0;

    for (let i=0; i<allTickers.length; i+=BATCH) {
      const batch = allTickers.slice(i, i+BATCH);
      const batchRes = await Promise.all(batch.map(async ({ticker, wl}) => {
        try {
          const raw = await fetchOHLC(ticker);
          const { estado, score, price } = quickAnalyze(raw);
          return { ticker, wl, estado, score, price, ok:true };
        } catch {
          return { ticker, wl, estado:null, score:null, price:null, ok:false };
        }
      }));
      results.push(...batchRes);
      done += batch.length;

      // Actualizar progreso en tiempo real
      const el2 = document.getElementById('alertas-content');
      if (el2) el2.innerHTML = `<div class="empty"><div class="loader-ring"></div><div class="empty-title">Analizando... ${done}/${allTickers.length}</div><div class="empty-desc">Comparando estados con el último análisis guardado</div></div>`;
      await new Promise(r=>setTimeout(r,200));
    }

    // Guardar nuevo snapshot
    const newSnapshot = {};
    const now = new Date().toLocaleString('es-ES');
    results.forEach(r => {
      if (r.ok) newSnapshot[r.ticker] = { estado:r.estado, score:r.score, price:r.price, ts:Date.now() };
    });
    await UserData.set(SNAPSHOT_KEY, newSnapshot);

    // Actualizar badge en menú
    const changes = results.filter(r => {
      if (!r.ok || !snapshot[r.ticker]) return false;
      return snapshot[r.ticker].estado !== r.estado;
    });
    updateBadge(changes.length);

    // Pintar resultados
    paintAlerts(el, results, snapshot, now);
  }

  function paintAlerts(el, results, snapshot, ts) {
    // Clasificar: mejoras, empeoramientos, sin cambio, error
    const improved   = results.filter(r => r.ok && snapshot[r.ticker] && ESTADO_RANK[r.estado] > ESTADO_RANK[snapshot[r.ticker].estado]);
    const worsened   = results.filter(r => r.ok && snapshot[r.ticker] && ESTADO_RANK[r.estado] < ESTADO_RANK[snapshot[r.ticker].estado]);
    const unchanged  = results.filter(r => r.ok && snapshot[r.ticker] && r.estado === snapshot[r.ticker].estado);
    const newEntries = results.filter(r => r.ok && !snapshot[r.ticker]);
    const failed     = results.filter(r => !r.ok);

    const hasChanges = improved.length > 0 || worsened.length > 0;

    el.innerHTML = `
      <div class="al-header">
        <div>
          <div class="al-title">Análisis completado</div>
          <div class="al-sub">${ts} · ${results.filter(r=>r.ok).length} valores analizados</div>
        </div>
        <div class="al-summary">
          ${improved.length  > 0 ? `<span class="al-chip up">↑ ${improved.length} mejoras</span>` : ''}
          ${worsened.length  > 0 ? `<span class="al-chip down">↓ ${worsened.length} empeoramientos</span>` : ''}
          ${!hasChanges      ? `<span class="al-chip neutral">Sin cambios de estado</span>` : ''}
        </div>
      </div>

      ${improved.length > 0 ? `
        <div class="al-section">
          <div class="al-section-title up">↑ MEJORAS DE ESTADO</div>
          ${improved.sort((a,b)=>ESTADO_RANK[b.estado]-ESTADO_RANK[a.estado]).map(r=>alertCard(r,snapshot[r.ticker],'up')).join('')}
        </div>` : ''}

      ${worsened.length > 0 ? `
        <div class="al-section">
          <div class="al-section-title down">↓ EMPEORAMIENTOS</div>
          ${worsened.sort((a,b)=>ESTADO_RANK[a.estado]-ESTADO_RANK[b.estado]).map(r=>alertCard(r,snapshot[r.ticker],'down')).join('')}
        </div>` : ''}

      ${newEntries.length > 0 ? `
        <div class="al-section">
          <div class="al-section-title new">✦ NUEVOS (primer análisis)</div>
          ${newEntries.map(r=>alertCard(r,null,'new')).join('')}
        </div>` : ''}

      ${unchanged.length > 0 ? `
        <div class="al-section collapsed">
          <div class="al-section-title neutral" style="cursor:pointer;" onclick="this.parentElement.classList.toggle('collapsed')">
            = SIN CAMBIOS (${unchanged.length}) <span style="font-size:10px;color:var(--text3)">▸ mostrar/ocultar</span>
          </div>
          <div class="al-collapsed-body">
            ${unchanged.map(r=>alertCard(r,snapshot[r.ticker],'neutral')).join('')}
          </div>
        </div>` : ''}

      ${failed.length > 0 ? `
        <div class="al-section">
          <div class="al-section-title error">⚠ SIN DATOS (${failed.length})</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;padding-top:8px;">
            ${failed.map(r=>`<span style="font-family:var(--mono);font-size:10px;color:var(--text3);background:var(--surface2);padding:3px 8px;border-radius:4px;">${r.ticker}</span>`).join('')}
          </div>
        </div>` : ''}
    `;
  }

  function alertCard(r, prev, type) {
    const stateColor = { ready:'var(--green)', diario:'var(--amber)', close:'var(--blue)', watching:'var(--text3)' };
    const prevLabel = prev ? ESTADO_LABEL[prev.estado] : '—';
    const currLabel = ESTADO_LABEL[r.estado] || '—';
    const arrow = type==='up'?'→':type==='down'?'→':'';
    const priceFmt = r.price ? '$'+r.price.toFixed(2) : '—';
    const prevPrice = prev?.price ? '$'+prev.price.toFixed(2) : null;

    return `
      <div class="al-card ${type}">
        <div class="al-card-left">
          <div class="al-ticker">${r.ticker}</div>
          <div class="al-wl">${WL_LABEL[r.wl]}</div>
        </div>
        <div class="al-card-center">
          ${prev ? `<span class="al-state prev">${prevLabel}</span><span class="al-arrow">${arrow}</span>` : ''}
          <span class="al-state curr" style="color:${stateColor[r.estado]||'var(--text3)'}">${currLabel}</span>
        </div>
        <div class="al-card-right">
          <div class="al-score">${r.score}/10</div>
          <div class="al-price">${priceFmt}${prevPrice&&prevPrice!==priceFmt?` <span style="color:var(--text3);font-size:9px;">(ant. ${prevPrice})</span>`:''}</div>
        </div>
      </div>`;
  }

  function updateBadge(count) {
    const badge = document.getElementById('alertas-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  }

  document.getElementById('alertas-refresh-btn')?.addEventListener('click', runCheck);

  // Ejecutar automáticamente al abrir el módulo
  runCheck();

  return { destroy() {} };
}

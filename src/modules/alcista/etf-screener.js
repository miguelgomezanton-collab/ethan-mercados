import { saveModuleState } from '../../router.js';
// ═══════════════════════════════════════════════
// MÓDULO: Screener · ETFs Renta Variable
// Universo definido por el usuario: añade ETFs
// por ticker con metadatos editables (categoría,
// descripción, TER, yield). Mismo motor /10 que
// el resto de screeners. Persiste en Firestore.
// ═══════════════════════════════════════════════

import { UserData } from '../../userdata.js';

const STORAGE_KEY = 'ethan_etf_rv_universe';
const VOL_AVG = 11;

const PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://soft-field-156f.miguel-gomez-anton.workers.dev/?url=${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
];

async function fetchJSON(url) {
  for (const fn of PROXIES) {
    try {
      const r = await fetch(fn(url), { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 8000); return c.signal; })() });
      if (!r.ok) continue;
      const text = await r.text();
      return JSON.parse(text);
    } catch {}
  }
  throw new Error('Sin proxy disponible');
}

async function searchETF(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`;
  const j = await fetchJSON(url);
  const meta = j?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error('ETF no encontrado');
  return {
    ticker:   ticker.toUpperCase(),
    name:     meta.shortName || meta.longName || ticker,
    price:    meta.regularMarketPrice || null,
    currency: meta.currency || 'USD',
    exchange: meta.exchangeName || '',
    category: '', description: '', expenseRatio: '', etfYield: '',
    addedAt:  new Date().toLocaleDateString('es-ES'),
  };
}

// ── Motor técnico ──────────────────────────────
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
function resample(ts,O,H,L,C,V,freq){const g={};ts.forEach((t,i)=>{const dd=new Date(t*1000);let key;if(freq==='W'){const dy=dd.getDay(),df=dd.getDate()-dy+(dy===0?-6:1);const mo=new Date(+dd);mo.setDate(df);key=mo.toISOString().slice(0,10);}else key=`${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}`;if(!g[key])g[key]={o:O[i],h:H[i],l:L[i],c:C[i],v:V[i]};else{g[key].h=Math.max(g[key].h,H[i]);g[key].l=Math.min(g[key].l,L[i]);g[key].c=C[i];g[key].v+=V[i];}});const keys=Object.keys(g).sort();return{opens:keys.map(k=>g[k].o),highs:keys.map(k=>g[k].h),lows:keys.map(k=>g[k].l),closes:keys.map(k=>g[k].c),vols:keys.map(k=>g[k].v)};}

async function analyzeETF(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=10y&events=history`;
  const j = await fetchJSON(url);
  const res = j?.chart?.result?.[0]; if(!res)throw new Error('Sin datos');
  const q = res.indicators?.quote?.[0]; if(!q)throw new Error('Sin quotes');
  const adj = res.indicators?.adjclose?.[0]?.adjclose||q.close;
  const ratio = adj.map((a,i)=>(q.close[i]&&a)?a/q.close[i]:1);
  const C=adj, H=q.high.map((v,i)=>v*ratio[i]), L=q.low.map((v,i)=>v*ratio[i]);
  const O=q.open.map((v,i)=>v*ratio[i]), V=q.volume, ts=res.timestamp;
  const n=C.length, di=n-1;
  const avgVol11=V.slice(-VOL_AVG).reduce((a,b)=>a+(b||0),0)/VOL_AVG;

  const W=resample(ts,O,H,L,C,V,'W'), wi=W.closes.length-1;
  const M=resample(ts,O,H,L,C,V,'M'), mi=M.closes.length-1;

  const mm=macd(M.closes),ms89=stoch(M.highs,M.lows,M.closes,89),ms8=stoch(M.highs,M.lows,M.closes,8),mr=rsi(M.closes),me=ema(M.closes,10);
  const wm=macd(W.closes),ws89=stoch(W.highs,W.lows,W.closes,89),wr=rsi(W.closes),we=ema(W.closes,20);
  const dm=macd(C),dr=rsi(C);

  const mc=[mm.m[mi]>0&&mm.m[mi]>mm.sl[mi],(ms89.k[mi]>80&&ms89.k[mi]>ms89.d[mi])||ms89.k[mi]>92,mr[mi]>65,ms8.k[mi]>78,me[mi]&&M.closes[mi]>me[mi]];
  const sc=[wm.m[wi]>0&&wm.m[wi]>wm.sl[wi],(ws89.k[wi]>85&&ws89.k[wi]>ws89.d[wi])||ws89.k[wi]>92,wr[wi]>67,we[wi]&&W.closes[wi]>we[wi]];
  const mensualOk=mc.every(x=>x),semanalOk=sc.every(x=>x);
  const daily=dm.m[di]>dm.sl[di]&&di>0&&dm.m[di-1]<=dm.sl[di-1]&&dr[di]>57&&dm.m[di]>0;
  const score=mc.filter(x=>x).length+sc.filter(x=>x).length+(mensualOk&&semanalOk?1:0);

  let estado='watching';
  if(mensualOk&&semanalOk&&daily)estado='ready';
  else if(mensualOk&&semanalOk)estado='diario';
  else if(score>=7)estado='close';

  return{score,estado,price:C[di],avgVol11};
}

// ── RENDER ─────────────────────────────────────
export async function render(container, { actionsSlot, savedState }) {
  let universe = (await UserData.get(STORAGE_KEY)) || [];
  let scanResults = savedState?.scanResults || [];
  let scanning = false;
  let previewData = null;

  // ── Actions slot: buscador ──────────────────
  actionsSlot.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;">
      <input type="text" id="etf-input" placeholder="Ticker: SPY, QQQ, XLK..." class="wl-input" style="width:200px;text-transform:uppercase;" autocomplete="off">
      <button class="btn btn-primary" id="etf-search-btn">🔍 Buscar ETF</button>
    </div>
  `;

  container.innerHTML = `
    <div class="etf-wrap">

      <!-- Preview card -->
      <div id="etf-preview" style="display:none;"></div>

      <!-- Universe chips -->
      <div class="etf-universe-bar">
        <span class="etf-universe-label">UNIVERSO</span>
        <div id="etf-chips" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
        <span id="etf-universe-count" style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-left:auto;"></span>
      </div>

      <!-- Toolbar -->
      <div class="sc2-toolbar">
        <div class="sc2-filters">
          <div class="sc2-filter"><label>SCORE MÍN.</label>
            <select id="etf-f-score" class="sc2-sel">
              <option value="9">≥ 9</option><option value="8">≥ 8</option>
              <option value="7" selected>≥ 7</option><option value="6">≥ 6</option>
              <option value="0">Todos</option>
            </select>
          </div>
          <div class="sc2-filter"><label>ESTADO</label>
            <select id="etf-f-estado" class="sc2-sel">
              <option value="all">Todos</option>
              <option value="ready">🟢 Ready</option>
              <option value="diario">🟡 Espera diario</option>
              <option value="close">🔵 Cerca</option>
            </select>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="cm-status" id="etf-status"></span>
          <button class="cm-scan-btn" id="etf-scan-btn" disabled>▶ Escanear</button>
        </div>
      </div>

      <div class="sc2-progress" id="etf-progress" style="display:none">
        <div class="sc2-progress-fill" id="etf-progress-fill"></div>
      </div>

      <div id="etf-results">
        <div class="sc2-empty">Añade ETFs al universo y pulsa Escanear</div>
      </div>

    </div>
  `;

  // ── Preview card ────────────────────────────
  async function showPreview(ticker) {
    const el = document.getElementById('etf-preview');
    el.style.display = 'block';
    el.innerHTML = `
      <div class="etf-preview-card">
        <div style="display:flex;align-items:center;gap:10px;color:var(--text3);font-family:var(--mono);font-size:11px;">
          <div class="loader-ring"></div>Buscando ${ticker}...
        </div>
      </div>`;

    try {
      previewData = await searchETF(ticker);
      el.innerHTML = `
        <div class="etf-preview-card">
          <div class="etf-preview-header">
            <div>
              <div style="font-family:var(--mono);font-size:18px;font-weight:700;color:var(--teal);">${previewData.ticker}</div>
              <div style="font-family:var(--serif);font-size:15px;font-style:italic;color:var(--text1);margin-top:4px;">${previewData.name}</div>
              <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:3px;">${previewData.exchange} · ${previewData.currency}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-family:var(--mono);font-size:20px;color:var(--text1);">${previewData.price?'$'+previewData.price.toFixed(2):'—'}</div>
            </div>
          </div>
          <div class="etf-preview-fields">
            <div class="etf-pf">
              <label>Categoría / Sector</label>
              <input type="text" id="pf-cat" placeholder="ej. Technology, Semiconductors..." value="${previewData.category}">
            </div>
            <div class="etf-pf">
              <label>TER (ratio de gastos)</label>
              <input type="text" id="pf-ter" placeholder="ej. 0.20%" value="${previewData.expenseRatio}">
            </div>
            <div class="etf-pf">
              <label>Yield / Dividendo</label>
              <input type="text" id="pf-yield" placeholder="ej. 1.5%" value="${previewData.etfYield}">
            </div>
            <div class="etf-pf" style="grid-column:1/-1">
              <label>Descripción / Notas</label>
              <textarea id="pf-desc" placeholder="ej. ETF de semiconductores con exposición a NVDA, AMD, INTC...">${previewData.description}</textarea>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
            <button class="btn" id="preview-cancel">Cancelar</button>
            <button class="btn btn-primary" id="preview-add">+ Añadir al universo</button>
          </div>
        </div>`;

      document.getElementById('preview-cancel').addEventListener('click', () => {
        el.style.display = 'none';
        document.getElementById('etf-input').value = '';
      });

      document.getElementById('preview-add').addEventListener('click', async () => {
        const final = {
          ...previewData,
          category:    document.getElementById('pf-cat').value,
          expenseRatio:document.getElementById('pf-ter').value,
          etfYield:    document.getElementById('pf-yield').value,
          description: document.getElementById('pf-desc').value,
        };
        if (!universe.find(e => e.ticker === final.ticker)) {
          universe.push(final);
          await UserData.set(STORAGE_KEY, universe);
        }
        el.style.display = 'none';
        document.getElementById('etf-input').value = '';
        renderChips();
        renderTable();
      });

    } catch(err) {
      el.innerHTML = `<div class="etf-preview-card" style="color:var(--red);font-family:var(--mono);font-size:11px;">✗ ${err.message}</div>`;
    }
  }

  // ── Chips del universo ──────────────────────
  function renderChips() {
    const el  = document.getElementById('etf-chips');
    const cnt = document.getElementById('etf-universe-count');
    el.innerHTML = universe.map(etf => `
      <span class="rf-custom-chip" title="${etf.name}${etf.category?' · '+etf.category:''}">
        ${etf.ticker}
        <button class="rf-custom-remove" data-ticker="${etf.ticker}">✕</button>
      </span>`).join('');
    cnt.textContent = `${universe.length} ETF${universe.length!==1?'s':''}`;
    document.getElementById('etf-scan-btn').disabled = universe.length === 0;

    el.querySelectorAll('.rf-custom-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        universe = universe.filter(e => e.ticker !== btn.dataset.ticker);
        await UserData.set(STORAGE_KEY, universe);
        renderChips();
        renderTable();
      });
    });
  }

  // ── Tabla de resultados ─────────────────────
  function renderTable() {
    const minScore  = parseInt(document.getElementById('etf-f-score')?.value || '7');
    const filterEst = document.getElementById('etf-f-estado')?.value || 'all';

    const filtered = scanResults.filter(r => {
      if (r.score < minScore) return false;
      if (filterEst !== 'all' && r.estado !== filterEst) return false;
      return true;
    }).sort((a,b) => b.score - a.score);

    const el = document.getElementById('etf-results');
    if (!el) return;

    if (scanResults.length === 0) {
      el.innerHTML = `<div class="sc2-empty">${universe.length > 0 ? `${universe.length} ETFs listos · pulsa Escanear` : 'Añade ETFs al universo y pulsa Escanear'}</div>`;
      return;
    }
    if (filtered.length === 0) {
      el.innerHTML = `<div class="sc2-empty">Ningún ETF cumple los filtros actuales</div>`;
      return;
    }

    const sc = s => s>=9?'var(--green)':s>=7?'var(--amber)':'var(--text3)';
    const estLabel = {ready:'🟢 LISTO',diario:'⏳ ESPERA DIARIO',close:'🔶 CERCA',watching:'👁 VIGILANDO'};
    const estColor = e => e==='ready'?'var(--green)':e==='diario'?'var(--amber)':e==='close'?'var(--blue)':'var(--text3)';

    el.innerHTML = `
      <div style="font-size:11px;color:var(--text2);padding:6px 0 10px;border-bottom:1px solid var(--border);margin-bottom:4px;">
        ${filtered.length} ETFs · <strong style="color:var(--green)">${filtered.filter(r=>r.estado==='ready').length} listos</strong>
        · ${filtered.filter(r=>r.estado==='diario').length} espera diario
      </div>
      <table class="sc2-table">
        <thead>
          <tr><th>ETF</th><th>CATEGORÍA</th><th>SCORE</th><th>ESTADO</th><th>PRECIO</th><th>VOL MEDIA 11s</th><th></th></tr>
        </thead>
        <tbody>
          ${filtered.map(r => {
            const meta = universe.find(e=>e.ticker===r.ticker)||{};
            return `
              <tr>
                <td>
                  <div class="sc2-ticker">${r.ticker}</div>
                  <div style="font-size:10px;color:var(--text2);margin-top:2px;">${meta.name||'—'}</div>
                  ${meta.description?`<div style="font-size:9px;color:var(--text3);margin-top:2px;max-width:220px;line-height:1.4;">${meta.description.slice(0,80)}${meta.description.length>80?'…':''}</div>`:''}
                </td>
                <td>
                  <div style="font-size:10px;color:var(--text3);font-family:var(--mono);">${meta.category||'—'}</div>
                  ${meta.expenseRatio?`<div style="font-size:9px;color:var(--text3);font-family:var(--mono);">TER: ${meta.expenseRatio}</div>`:''}
                  ${meta.etfYield?`<div style="font-size:9px;color:var(--text3);font-family:var(--mono);">Yield: ${meta.etfYield}</div>`:''}
                </td>
                <td class="sc2-score" style="color:${sc(r.score)}">${r.score}/10</td>
                <td style="color:${estColor(r.estado)};font-size:10px;font-weight:600">${estLabel[r.estado]||'—'}</td>
                <td class="sc2-price">${r.price?'$'+r.price.toFixed(2):'—'}</td>
                <td class="sc2-vol">${r.avgVol11>=1e6?(r.avgVol11/1e6).toFixed(1)+'M':Math.round(r.avgVol11/1e3)+'k'}</td>
                <td><button class="sc2-wl-btn" data-wl="${r.ticker}">+ WL</button></td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;

    el.querySelectorAll('.sc2-wl-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const list = (await UserData.get('ethan_watchlist_v1')) || [];
          if (!list.includes(btn.dataset.wl)) {
            list.push(btn.dataset.wl);
            await UserData.set('ethan_watchlist_v1', list);
          }
          btn.textContent = '✓'; btn.style.color = 'var(--green)'; btn.disabled = true;
        } catch {}
      });
    });
  }

  // ── Escaneo ─────────────────────────────────
  async function startScan() {
    if (scanning || universe.length === 0) return;
    scanning = true; scanResults = [];

    const btn  = document.getElementById('etf-scan-btn');
    const st   = document.getElementById('etf-status');
    const prog = document.getElementById('etf-progress');
    const fill = document.getElementById('etf-progress-fill');

    btn.disabled = true; btn.textContent = '⏳ Escaneando...';
    prog.style.display = 'block'; fill.style.width = '0%';

    const BATCH = 5;
    let done = 0;
    for (let i=0; i<universe.length; i+=BATCH) {
      const batch = universe.slice(i, i+BATCH);
      const res = await Promise.all(batch.map(async etf => {
        try { return { ticker:etf.ticker, ...(await analyzeETF(etf.ticker)) }; }
        catch { return null; }
      }));
      res.forEach(r => { if(r) scanResults.push(r); });
      done += batch.length;
      fill.style.width = (done/universe.length*100).toFixed(0)+'%';
      st.textContent = `${universe[Math.min(i+BATCH-1,universe.length-1)].ticker} (${done}/${universe.length})`;
      renderTable();
      await new Promise(r=>setTimeout(r,300));
    }

    scanning = false;
    btn.disabled = false; btn.textContent = '↻ Re-escanear';
    prog.style.display = 'none';
    st.textContent = `${scanResults.length} ETFs · ${scanResults.filter(r=>r.estado==='ready').length} listos`;
    renderTable();
    saveModuleState('alc-etf-screener', { scanResults });
  }

  // ── Listeners ───────────────────────────────
  document.getElementById('etf-search-btn')?.addEventListener('click', () => {
    const t = document.getElementById('etf-input')?.value.trim().toUpperCase();
    if (t) showPreview(t);
  });
  document.getElementById('etf-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const t = e.target.value.trim().toUpperCase(); if(t) showPreview(t); }
    e.target.value = e.target.value.toUpperCase();
  });
  document.getElementById('etf-scan-btn')?.addEventListener('click', startScan);
  ['etf-f-score','etf-f-estado'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderTable);
  });

  renderChips();
  renderTable();

  // Restaurar resultados si hay savedState
  if (savedState?.scanResults?.length > 0) renderTable?.();

  return { destroy() {} };
}

import { saveModuleState } from '../../router.js';
import { UserData } from '../../userdata.js';
// ═══════════════════════════════════════════════
// MÓDULO: Screener · Renta Fija
// Universo de ETFs de renta fija organizados por
// categoría. Mismo motor técnico que el resto de
// screeners: score /10, estados Ready/Diario/Cerca.
// Botón + WL integra con ethan_watchlist_rf_v1.
// ═══════════════════════════════════════════════

const RF_ETFS = [
  // ── BONOS GOBIERNO USA ──
  { ticker:'TLT',  name:'Bonos Tesoro USA 20+ años',     cat:'gov-usa',   emoji:'🇺🇸' },
  { ticker:'IEF',  name:'Bonos Tesoro USA 7-10 años',    cat:'gov-usa',   emoji:'🇺🇸' },
  { ticker:'SHY',  name:'Bonos Tesoro USA 1-3 años',     cat:'gov-usa',   emoji:'🇺🇸' },
  { ticker:'IEI',  name:'Bonos Tesoro USA 3-7 años',     cat:'gov-usa',   emoji:'🇺🇸' },
  { ticker:'GOVT', name:'Bonos Gobierno USA (todos)',     cat:'gov-usa',   emoji:'🇺🇸' },
  { ticker:'TIP',  name:'Bonos TIPS (inflación USA)',     cat:'gov-usa',   emoji:'🇺🇸' },
  { ticker:'SCHP', name:'TIPS Schwab',                   cat:'gov-usa',   emoji:'🇺🇸' },
  { ticker:'VGIT', name:'Bonos Gobierno USA 5-10a',      cat:'gov-usa',   emoji:'🇺🇸' },
  { ticker:'VGLT', name:'Bonos Gobierno USA 25+a',       cat:'gov-usa',   emoji:'🇺🇸' },
  { ticker:'SPTL', name:'Bonos Largo Plazo SPDR',        cat:'gov-usa',   emoji:'🇺🇸' },

  // ── BONOS CORPORATIVOS USA ──
  { ticker:'LQD',  name:'Bonos Corp. Investment Grade',  cat:'corp-usa',  emoji:'🏢' },
  { ticker:'VCIT', name:'Bonos Corp. Medio Plazo',       cat:'corp-usa',  emoji:'🏢' },
  { ticker:'VCLT', name:'Bonos Corp. Largo Plazo',       cat:'corp-usa',  emoji:'🏢' },
  { ticker:'USIG', name:'Bonos Corp. IG USA',            cat:'corp-usa',  emoji:'🏢' },
  { ticker:'IGSB', name:'Bonos Corp. Corto Plazo IG',   cat:'corp-usa',  emoji:'🏢' },
  { ticker:'IGIB', name:'Bonos Corp. Medio Plazo IG',   cat:'corp-usa',  emoji:'🏢' },

  // ── HIGH YIELD (BONOS BASURA) ──
  { ticker:'HYG',  name:'High Yield Corporativo iShares', cat:'high-yield', emoji:'⚡' },
  { ticker:'JNK',  name:'High Yield SPDR',               cat:'high-yield', emoji:'⚡' },
  { ticker:'USHY', name:'High Yield USA iShares',        cat:'high-yield', emoji:'⚡' },
  { ticker:'HYLD', name:'High Yield Activo',             cat:'high-yield', emoji:'⚡' },
  { ticker:'ANGL', name:'Fallen Angels USD Bond',        cat:'high-yield', emoji:'⚡' },

  // ── BONOS INTERNACIONALES ──
  { ticker:'BNDX', name:'Bonos Internacionales Vanguard', cat:'intl',     emoji:'🌍' },
  { ticker:'BWX',  name:'Bonos Gobierno Internac.',      cat:'intl',      emoji:'🌍' },
  { ticker:'EMB',  name:'Bonos Emergentes USD iShares',  cat:'intl',      emoji:'🌍' },
  { ticker:'PCY',  name:'Bonos Emergentes USD Invesco',  cat:'intl',      emoji:'🌍' },
  { ticker:'VWOB', name:'Bonos Emergentes Vanguard',     cat:'intl',      emoji:'🌍' },
  { ticker:'IGOV', name:'Bonos Gobierno DM iShares',    cat:'intl',      emoji:'🌍' },
  { ticker:'IAGG', name:'Bonos Agregado Intl. iShares', cat:'intl',      emoji:'🌍' },

  // ── AGREGADOS USA (BROAD) ──
  { ticker:'BND',  name:'Agregado USA Vanguard',         cat:'broad',     emoji:'📊' },
  { ticker:'AGG',  name:'Agregado USA iShares',          cat:'broad',     emoji:'📊' },
  { ticker:'FBND', name:'Agregado USA Fidelity',         cat:'broad',     emoji:'📊' },
  { ticker:'SCHZ', name:'Agregado USA Schwab',           cat:'broad',     emoji:'📊' },
  { ticker:'SPAB', name:'Agregado USA SPDR',             cat:'broad',     emoji:'📊' },

  // ── CORTO PLAZO / MONETARIO ──
  { ticker:'SHV',  name:'Letras Tesoro USA <1 año',      cat:'short',     emoji:'💵' },
  { ticker:'BIL',  name:'T-Bills 1-3 meses',             cat:'short',     emoji:'💵' },
  { ticker:'SGOV', name:'T-Bills 0-3 meses iShares',    cat:'short',     emoji:'💵' },
  { ticker:'CLTL', name:'Tesoro Corto Plazo Invesco',   cat:'short',     emoji:'💵' },
  { ticker:'MINT', name:'Money Market PIMCO',            cat:'short',     emoji:'💵' },
];

const CATS_CONFIG = [
  { key:'all',       label:'Todos',           emoji:'📋' },
  { key:'gov-usa',   label:'Gobierno USA',    emoji:'🇺🇸' },
  { key:'corp-usa',  label:'Corporativo USA', emoji:'🏢' },
  { key:'high-yield',label:'High Yield',      emoji:'⚡' },
  { key:'intl',      label:'Internacional',   emoji:'🌍' },
  { key:'broad',     label:'Agregados',       emoji:'📊' },
  { key:'short',     label:'Corto Plazo',     emoji:'💵' },
];

const VOL_AVG_PERIODS = 11;
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
      const res = j?.chart?.result?.[0];
      if (!res) continue;
      const q = res.indicators?.quote?.[0];
      if (!q) continue;
      const adj = res.indicators?.adjclose?.[0]?.adjclose || q.close;
      const ratio = adj.map((a,i) => (q.close[i] && a) ? a/q.close[i] : 1);
      return {
        timestamps: res.timestamp,
        opens: q.open.map((v,i) => v*ratio[i]),
        highs: q.high.map((v,i) => v*ratio[i]),
        lows:  q.low.map((v,i)  => v*ratio[i]),
        closes: adj, vols: q.volume
      };
    } catch (e) {}
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
function resample(ts,O,H,L,C,V,freq){const g={};ts.forEach((t,i)=>{const dd=new Date(t*1000);let key;if(freq==='W'){const dy=dd.getDay(),df=dd.getDate()-dy+(dy===0?-6:1);const mo=new Date(+dd);mo.setDate(df);key=mo.toISOString().slice(0,10);}else key=`${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}`;if(!g[key])g[key]={o:O[i],h:H[i],l:L[i],c:C[i],v:V[i]};else{g[key].h=Math.max(g[key].h,H[i]);g[key].l=Math.min(g[key].l,L[i]);g[key].c=C[i];g[key].v+=V[i];}});const keys=Object.keys(g).sort();return{dates:keys,opens:keys.map(k=>g[k].o),highs:keys.map(k=>g[k].h),lows:keys.map(k=>g[k].l),closes:keys.map(k=>g[k].c),vols:keys.map(k=>g[k].v)};}

function analyzeAsset(raw) {
  const {timestamps,opens,highs,lows,closes,vols}=raw;
  const n=closes.length;
  const lastVol=vols[n-1]||0;
  const avgVol11=vols.slice(-VOL_AVG_PERIODS).reduce((a,b)=>a+(b||0),0)/VOL_AVG_PERIODS;
  const W=resample(timestamps,opens,highs,lows,closes,vols,'W');
  const M=resample(timestamps,opens,highs,lows,closes,vols,'M');
  const mi=M.closes.length-1,wi=W.closes.length-1,di=n-1;
  const mm=macd(M.closes),ms89=stoch(M.highs,M.lows,M.closes,89),ms8=stoch(M.highs,M.lows,M.closes,8),mr=rsi(M.closes),me=ema(M.closes,10);
  const wm=macd(W.closes),ws89=stoch(W.highs,W.lows,W.closes,89),wr=rsi(W.closes),we=ema(W.closes,20);
  const dm=macd(closes),dr=rsi(closes);
  const mc=[mm.m[mi]>0&&mm.m[mi]>mm.sl[mi],(ms89.k[mi]>80&&ms89.k[mi]>ms89.d[mi])||ms89.k[mi]>92,mr[mi]>65,ms8.k[mi]>78,me[mi]&&M.closes[mi]>me[mi]];
  const sc=[wm.m[wi]>0&&wm.m[wi]>wm.sl[wi],(ws89.k[wi]>85&&ws89.k[wi]>ws89.d[wi])||ws89.k[wi]>92,wr[wi]>67,we[wi]&&W.closes[wi]>we[wi]];
  const mensualOk=mc.every(x=>x),semanalOk=sc.every(x=>x);
  const daily=dm.m[di]>dm.sl[di]&&dm.m[di-1]<=dm.sl[di-1]&&dr[di]>57&&dm.m[di]>0;
  const score=mc.filter(x=>x).length+sc.filter(x=>x).length+(daily?1:0);
  let estado='watching';
  if(mensualOk&&semanalOk&&daily)estado='ready';
  else if(mensualOk&&semanalOk)estado='diario';
  else if(score>=7)estado='close';
  return{score,estado,price:closes[di],lastVol,avgVol11};
}

async function addToWatchlistLocal(ticker) {
  try {
    const list = (await UserData.get('ethan_watchlist_rf_v1')) || [];
    if (!list.includes(ticker)) {
      list.push(ticker);
      await UserData.set('ethan_watchlist_rf_v1', list);
    }
    const btn = document.querySelector(`[data-wl="${ticker}"]`);
    if (btn) { btn.textContent = '✓'; btn.style.color = 'var(--green)'; btn.disabled = true; }
  } catch (e) {}
}

const CUSTOM_KEY = 'ethan_rf_custom_etfs';

async function loadCustomEtfs() {
  try { return (await UserData.get(CUSTOM_KEY)) || []; } catch { return []; }
}
async function saveCustomEtfs(list) {
  await UserData.set(CUSTOM_KEY, list);
}
async function buildUniverse() {
  const custom = await loadCustomEtfs();
  const baseTickers = new Set(RF_ETFS.map(e => e.ticker));
  const customEtfs = custom
    .filter(c => !baseTickers.has(typeof c === 'string' ? c : c.ticker))
    .map(c => typeof c === 'string'
      ? { ticker: c, name: c, cat: 'custom', emoji: '➕' }
      : { ticker: c.ticker, name: c.name||c.ticker, cat: c.category||'custom', emoji: '➕' }
    );
  return [...RF_ETFS, ...customEtfs];
}

async function searchETF(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`;
  for (const fn of PROXIES) {
    try {
      const r = await fetch(fn(url), { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 8000); return c.signal; })() });
      if (!r.ok) continue;
      const text = await r.text();
      let j; try { j = JSON.parse(text); } catch { continue; }
      const meta = j?.chart?.result?.[0]?.meta;
      if (!meta) continue;
      return {
        ticker:   ticker.toUpperCase(),
        name:     meta.shortName || meta.longName || ticker,
        price:    meta.regularMarketPrice || null,
        currency: meta.currency || 'USD',
        exchange: meta.exchangeName || '',
        category: '', description: '', expenseRatio: '', etfYield: '',
      };
    } catch {}
  }
  throw new Error('ETF no encontrado');
}

export async function render(container, { actionsSlot, savedState }) {
  let scanResults = savedState?.scanResults || [];
  let scanning = false;
  let activeCategory = 'all';
  let customEtfs = await loadCustomEtfs();

  actionsSlot.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <input type="text" id="rf-custom-input" placeholder="Ticker: TLT, HYG, EMLC..." class="wl-input" style="width:200px;text-transform:uppercase;" autocomplete="off">
      <button class="btn btn-primary" id="rf-custom-add-btn" style="font-size:11px;">🔍 Buscar ETF</button>
      <span style="width:1px;height:16px;background:var(--border);display:inline-block;"></span>
      <span class="cm-status" id="rf-status"></span>
      <button class="cm-scan-btn" id="rf-scan-btn">▶ Escanear</button>
    </div>
  `;

  async function renderCustomChips() {
    const el = document.getElementById('rf-custom-chips');
    if (!el) return;
    const custom = await loadCustomEtfs();
    if (custom.length === 0) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:5px;padding:8px 0 4px;">
        <span style="font-size:9px;color:var(--text3);font-family:var(--mono);align-self:center;margin-right:4px;">AÑADIDOS AL UNIVERSO:</span>
        ${custom.map(t => `
          <span class="rf-custom-chip">
            ➕ ${t}
            <button class="rf-custom-remove" data-ticker="${t}">✕</button>
          </span>
        `).join('')}
      </div>
    `;
    el.querySelectorAll('.rf-custom-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const t = btn.dataset.ticker;
        const updated = (await loadCustomEtfs()).filter(x => x !== t);
        await saveCustomEtfs(updated);
        customEtfs = updated;
        await renderCustomChips();
        await updateUniverseCount();
      });
    });
  }

  async function updateUniverseCount() {
    const total = (await buildUniverse()).length;
    const el = document.getElementById('rf-universe-count');
    if (el) el.textContent = `${total} ETFs en universo`;
  }

  container.innerHTML = `
    <div class="cm-wrap">
      <div id="rf-preview"></div>
      <div id="rf-custom-chips"></div>
      <div class="cm-tabs">
        ${CATS_CONFIG.map((c,i) => `
          <button class="cm-tab ${i===0?'active':''}" data-cat="${c.key}">
            ${c.emoji} ${c.label}
            <span class="cm-tab-badge" id="rf-badge-${c.key}"></span>
          </button>
        `).join('')}
        <span id="rf-universe-count" style="margin-left:auto;font-size:9px;color:var(--text3);font-family:var(--mono);align-self:center;padding-right:4px;"></span>
      </div>

      <div class="sc2-toolbar" style="margin-top:14px;">
        <div class="sc2-filters">
          <div class="sc2-filter"><label>SCORE MÍN.</label>
            <select id="rf-filter-score" class="sc2-sel">
              <option value="9">≥ 9</option>
              <option value="8">≥ 8</option>
              <option value="7" selected>≥ 7</option>
              <option value="6">≥ 6</option>
              <option value="5">≥ 5</option>
              <option value="0">Todos</option>
            </select>
          </div>
          <div class="sc2-filter"><label>ESTADO</label>
            <select id="rf-filter-estado" class="sc2-sel">
              <option value="all">Todos</option>
              <option value="ready">🟢 Ready</option>
              <option value="diario">🟡 Espera diario</option>
              <option value="close">🔵 Cerca</option>
            </select>
          </div>
        </div>
      </div>

      <div class="sc2-progress" id="rf-progress" style="display:none">
        <div class="sc2-progress-fill" id="rf-progress-fill"></div>
      </div>

      <div id="rf-results">
        <div class="sc2-empty" id="rf-empty-msg">Pulsa Escanear para analizar los ETFs de Renta Fija</div>
      </div>
    </div>
  `;

  await renderCustomChips();
  await updateUniverseCount();

  function renderResults() {
    const minScore   = parseInt(document.getElementById('rf-filter-score')?.value || '7');
    const filterEst  = document.getElementById('rf-filter-estado')?.value || 'all';

    const filtered = scanResults.filter(r => {
      if (r.score < minScore) return false;
      if (activeCategory !== 'all' && r.cat !== activeCategory) return false;
      if (filterEst !== 'all' && r.estado !== filterEst) return false;
      return true;
    }).sort((a,b) => b.score - a.score);

    // Badges
    CATS_CONFIG.forEach(c => {
      const badge = document.getElementById(`rf-badge-${c.key}`);
      if (!badge) return;
      const catR = scanResults.filter(r => c.key === 'all' || r.cat === c.key);
      const ready = catR.filter(r => r.estado === 'ready').length;
      const strong = catR.filter(r => r.score >= 7).length;
      if (strong > 0) {
        badge.textContent = ready > 0 ? ready : strong;
        badge.style.background = ready > 0 ? 'var(--green)' : 'var(--text3)';
        badge.style.display = 'inline';
      } else { badge.style.display = 'none'; }
    });

    const el = document.getElementById('rf-results');
    if (!el) return;
    if (filtered.length === 0) {
      el.innerHTML = `<div class="sc2-empty">${scanResults.length > 0 ? 'Ningún ETF cumple los filtros actuales' : 'Pulsa Escanear para analizar el universo de Renta Fija'}</div>`;
      return;
    }

    const sc = s => s>=9?'var(--green)':s>=7?'var(--amber)':'var(--text3)';
    const estLabel = {ready:'🟢 LISTO',diario:'⏳ ESPERA DIARIO',close:'🔶 CERCA',watching:'👁 VIGILANDO'};
    const estColor = e => e==='ready'?'var(--green)':e==='diario'?'var(--amber)':'var(--text3)';
    const catName = { 'gov-usa':'GOB. USA', 'corp-usa':'CORP. USA', 'high-yield':'HIGH YIELD', 'intl':'INTL.', 'broad':'AGREGADO', 'short':'CORTO PLAZO' };

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
          ${filtered.map(r => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:10px;">
                  <div style="font-size:18px;line-height:1;">${r.emoji}</div>
                  <div>
                    <div class="sc2-ticker">${r.ticker}</div>
                    <div class="cm-name">${r.name}</div>
                  </div>
                </div>
              </td>
              <td style="font-size:9.5px;color:var(--text3);text-transform:uppercase;font-family:var(--mono)">${catName[r.cat]||r.cat}</td>
              <td class="sc2-score" style="color:${sc(r.score)}">${r.score}/10</td>
              <td style="color:${estColor(r.estado)};font-size:10px;font-weight:600">${estLabel[r.estado]||'—'}</td>
              <td class="sc2-price">${r.price?'$'+r.price.toFixed(2):'—'}</td>
              <td class="sc2-vol">${r.avgVol11>=1e6?(r.avgVol11/1e6).toFixed(1)+'M':Math.round(r.avgVol11/1e3)+'k'}</td>
              <td><button class="sc2-wl-btn" data-wl="${r.ticker}">+ WL</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    el.querySelectorAll('.sc2-wl-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); addToWatchlistLocal(btn.dataset.wl); });
    });
  }

  async function startScan() {
    if (scanning) return;
    scanning = true;
    scanResults = [];

    const universe = await buildUniverse();
    const btn  = document.getElementById('rf-scan-btn');
    const st   = document.getElementById('rf-status');
    const prog = document.getElementById('rf-progress');
    const fill = document.getElementById('rf-progress-fill');

    if (btn)  { btn.disabled=true; btn.textContent='⏳ Escaneando...'; }
    if (prog) prog.style.display='block';
    if (fill) fill.style.width='0%';

    const BATCH = 6;
    let done = 0;
    for (let i=0; i<universe.length; i+=BATCH) {
      const batch = universe.slice(i, i+BATCH);
      const res = await Promise.all(batch.map(async etf => {
        try {
          const raw = await fetchOHLC(etf.ticker);
          return { ...etf, ...analyzeAsset(raw) };
        } catch { return null; }
      }));
      res.forEach(r => { if(r) scanResults.push(r); });
      done += batch.length;
      if (fill) fill.style.width=(done/universe.length*100).toFixed(0)+'%';
      if (st)   st.textContent=`${universe[Math.min(i+BATCH-1,universe.length-1)].ticker} (${done}/${universe.length})`;
      renderResults();
      await new Promise(r=>setTimeout(r,300));
    }

    scanning = false;
    if (btn)  { btn.disabled=false; btn.textContent='↻ Re-escanear'; }
    if (prog) prog.style.display='none';
    if (st)   st.textContent=`${scanResults.length} ETFs · ${scanResults.filter(r=>r.estado==='ready').length} listos`;
    renderResults();
  }

  // ── Preview card: buscar y verificar ETF ──────
  async function showPreview(ticker) {
    const el = document.getElementById('rf-preview');
    if (!el) return;
    el.innerHTML = `
      <div class="etf-preview-card" style="margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;color:var(--text3);font-family:var(--mono);font-size:11px;">
          <div class="loader-ring"></div>Buscando ${ticker}...
        </div>
      </div>`;

    try {
      const info = await searchETF(ticker);
      el.innerHTML = `
        <div class="etf-preview-card" style="margin-bottom:14px;">
          <div class="etf-preview-header">
            <div>
              <div style="font-family:var(--mono);font-size:18px;font-weight:700;color:var(--teal);">${info.ticker}</div>
              <div style="font-family:var(--serif);font-size:15px;font-style:italic;color:var(--text1);margin-top:4px;">${info.name}</div>
              <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:3px;">${info.exchange} · ${info.currency}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-family:var(--mono);font-size:20px;color:var(--text1);">${info.price?'$'+info.price.toFixed(2):'—'}</div>
            </div>
          </div>
          <div class="etf-preview-fields">
            <div class="etf-pf">
              <label>Categoría</label>
              <input type="text" id="rf-pf-cat" placeholder="ej. High Yield, Emergentes..." value="${info.category}">
            </div>
            <div class="etf-pf">
              <label>TER (ratio de gastos)</label>
              <input type="text" id="rf-pf-ter" placeholder="ej. 0.15%" value="${info.expenseRatio}">
            </div>
            <div class="etf-pf">
              <label>Yield / Cupón</label>
              <input type="text" id="rf-pf-yield" placeholder="ej. 4.5%" value="${info.etfYield}">
            </div>
            <div class="etf-pf" style="grid-column:1/-1">
              <label>Descripción / Notas</label>
              <textarea id="rf-pf-desc" placeholder="ej. ETF de bonos emergentes en divisa local, exposición a LatAm y Asia...">${info.description||''}</textarea>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
            <button class="btn" id="rf-preview-cancel">Cancelar</button>
            <button class="btn btn-primary" id="rf-preview-add">+ Añadir al universo</button>
          </div>
        </div>`;

      document.getElementById('rf-preview-cancel').addEventListener('click', () => {
        el.innerHTML = '';
        document.getElementById('rf-custom-input').value = '';
      });

      document.getElementById('rf-preview-add').addEventListener('click', async () => {
        const final = {
          ...info,
          category:    document.getElementById('rf-pf-cat').value,
          expenseRatio:document.getElementById('rf-pf-ter').value,
          etfYield:    document.getElementById('rf-pf-yield').value,
          description: document.getElementById('rf-pf-desc').value,
        };
        const baseTickers = new Set(RF_ETFS.map(e => e.ticker));
        const current = await loadCustomEtfs();
        const alreadyIn = current.some(c => (typeof c === 'string' ? c : c.ticker) === final.ticker);
        if (!baseTickers.has(final.ticker) && !alreadyIn) {
          current.push(final);
          await saveCustomEtfs(current);
          customEtfs = current;
        }
        el.innerHTML = '';
        document.getElementById('rf-custom-input').value = '';
        await renderCustomChips();
        await updateUniverseCount();
      });

    } catch(err) {
      el.innerHTML = `<div class="etf-preview-card" style="margin-bottom:14px;color:var(--red);font-family:var(--mono);font-size:11px;">✗ ${err.message} — comprueba el ticker</div>`;
    }
  }

  // ── Listeners ──────────────────────────────────
  document.getElementById('rf-custom-add-btn')?.addEventListener('click', () => {
    const inp = document.getElementById('rf-custom-input');
    const t = inp?.value.trim().toUpperCase();
    if (t) showPreview(t);
  });

  document.getElementById('rf-custom-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const t = e.target.value.trim().toUpperCase();
      if (t) showPreview(t);
    }
    e.target.value = e.target.value.toUpperCase();
  });

  container.querySelectorAll('.cm-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeCategory = tab.dataset.cat;
      container.querySelectorAll('.cm-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderResults();
    });
  });

  ['rf-filter-score','rf-filter-estado'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderResults);
  });

  document.getElementById('rf-scan-btn')?.addEventListener('click', startScan);

  // Restaurar resultados si hay savedState
  if (savedState?.scanResults?.length > 0) { renderResults?.(); }

  return { destroy() {} };
}

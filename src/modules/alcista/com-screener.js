// ═══════════════════════════════════════════════
// MÓDULO: Screener · Commodities
// Universo mixto: futuros (=F) + ETFs replicantes.
// Motor técnico idéntico al screener de índices:
// MACD(12,26,9) + Stoch(89,3,3) + RSI(14) + EMA
// mensual, semanal y cruce diario → score /10.
// Tabs por categoría: Metales / Energía / Industriales / Agricultura
// ═══════════════════════════════════════════════

const COMMODITIES = [
  // ── METALES PRECIOSOS ──
  { ticker:'GC=F',  name:'Oro',                        cat:'metales',      type:'futures', emoji:'🥇' },
  { ticker:'GLD',   name:'Oro · SPDR Gold Trust',      cat:'metales',      type:'etf',     emoji:'🥇' },
  { ticker:'IAU',   name:'Oro · iShares Gold ETF',     cat:'metales',      type:'etf',     emoji:'🥇' },
  { ticker:'SI=F',  name:'Plata',                      cat:'metales',      type:'futures', emoji:'🥈' },
  { ticker:'SLV',   name:'Plata · iShares Silver',     cat:'metales',      type:'etf',     emoji:'🥈' },
  { ticker:'PL=F',  name:'Platino',                    cat:'metales',      type:'futures', emoji:'⬜' },
  { ticker:'PA=F',  name:'Paladio',                    cat:'metales',      type:'futures', emoji:'🔘' },
  { ticker:'PPLT',  name:'Platino · Sprott ETF',       cat:'metales',      type:'etf',     emoji:'⬜' },
  // ── ENERGÍA ──
  { ticker:'CL=F',  name:'Petróleo WTI',               cat:'energia',      type:'futures', emoji:'🛢️' },
  { ticker:'BZ=F',  name:'Petróleo Brent',             cat:'energia',      type:'futures', emoji:'🛢️' },
  { ticker:'USO',   name:'Petróleo · US Oil Fund',     cat:'energia',      type:'etf',     emoji:'🛢️' },
  { ticker:'UCO',   name:'Petróleo · ProShares 2x',    cat:'energia',      type:'etf',     emoji:'🛢️' },
  { ticker:'NG=F',  name:'Gas Natural',                cat:'energia',      type:'futures', emoji:'🔥' },
  { ticker:'UNG',   name:'Gas Natural · US Fund',      cat:'energia',      type:'etf',     emoji:'🔥' },
  { ticker:'RB=F',  name:'Gasolina RBOB',              cat:'energia',      type:'futures', emoji:'⛽' },
  { ticker:'HO=F',  name:'Gasóleo / Fuel Oil',         cat:'energia',      type:'futures', emoji:'🏭' },
  // ── METALES INDUSTRIALES ──
  { ticker:'HG=F',  name:'Cobre',                      cat:'industriales', type:'futures', emoji:'🟤' },
  { ticker:'CPER',  name:'Cobre · US Copper ETF',      cat:'industriales', type:'etf',     emoji:'🟤' },
  { ticker:'COPX',  name:'Cobre · Mineras ETF',        cat:'industriales', type:'etf',     emoji:'🟤' },
  { ticker:'ALI=F', name:'Aluminio',                   cat:'industriales', type:'futures', emoji:'🔩' },
  { ticker:'ZNC=F', name:'Zinc',                       cat:'industriales', type:'futures', emoji:'⚙️' },
  // ── AGRICULTURA ──
  { ticker:'ZW=F',  name:'Trigo',                      cat:'agricultura',  type:'futures', emoji:'🌾' },
  { ticker:'WEAT',  name:'Trigo · Teucrium ETF',       cat:'agricultura',  type:'etf',     emoji:'🌾' },
  { ticker:'ZC=F',  name:'Maíz',                       cat:'agricultura',  type:'futures', emoji:'🌽' },
  { ticker:'CORN',  name:'Maíz · Teucrium ETF',        cat:'agricultura',  type:'etf',     emoji:'🌽' },
  { ticker:'ZS=F',  name:'Soja',                       cat:'agricultura',  type:'futures', emoji:'🫘' },
  { ticker:'SOYB',  name:'Soja · Teucrium ETF',        cat:'agricultura',  type:'etf',     emoji:'🫘' },
  { ticker:'SB=F',  name:'Azúcar',                     cat:'agricultura',  type:'futures', emoji:'🍬' },
  { ticker:'CANE',  name:'Azúcar · Teucrium ETF',      cat:'agricultura',  type:'etf',     emoji:'🍬' },
  { ticker:'KC=F',  name:'Café',                       cat:'agricultura',  type:'futures', emoji:'☕' },
  { ticker:'JO',    name:'Café · iPath ETF',           cat:'agricultura',  type:'etf',     emoji:'☕' },
  { ticker:'CC=F',  name:'Cacao',                      cat:'agricultura',  type:'futures', emoji:'🍫' },
  { ticker:'NIB',   name:'Cacao · iPath ETF',          cat:'agricultura',  type:'etf',     emoji:'🍫' },
  { ticker:'CT=F',  name:'Algodón',                    cat:'agricultura',  type:'futures', emoji:'🤍' },
  { ticker:'LE=F',  name:'Ganado Bovino',              cat:'agricultura',  type:'futures', emoji:'🐄' },
  { ticker:'HE=F',  name:'Cerdos',                     cat:'agricultura',  type:'futures', emoji:'🐷' },
  // ── ÍNDICES AMPLIOS ──
  { ticker:'GSG',   name:'Commodities · iShares S&P',  cat:'all',          type:'etf',     emoji:'🌐' },
  { ticker:'PDBC',  name:'Commodities · Invesco',      cat:'all',          type:'etf',     emoji:'🌐' },
  { ticker:'DJP',   name:'Commodities · iPath',        cat:'all',          type:'etf',     emoji:'🌐' },
  { ticker:'COMT',  name:'Commodities · iShares GSCI', cat:'all',          type:'etf',     emoji:'🌐' },
];

const CATS_CONFIG = [
  { key:'all',          label:'Todos',              emoji:'🌐' },
  { key:'metales',      label:'Metales Preciosos',  emoji:'🥇' },
  { key:'energia',      label:'Energía',            emoji:'⚡' },
  { key:'industriales', label:'Met. Industriales',  emoji:'⚙️' },
  { key:'agricultura',  label:'Agricultura',        emoji:'🌾' },
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
      const r = await fetch(fn(url), { signal: AbortSignal.timeout(8000) });
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
  const {timestamps:ts,opens,highs,lows,closes,vols}=raw;
  const n=closes.length;
  const lastVol=vols[n-1]||0;
  const avgVol11=vols.slice(-VOL_AVG_PERIODS).reduce((a,b)=>a+(b||0),0)/VOL_AVG_PERIODS;
  const W=resample(ts,opens,highs,lows,closes,vols,'W');
  const M=resample(ts,opens,highs,lows,closes,vols,'M');
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

export async function render(container, { actionsSlot }) {
  let scanResults = [];
  let scanning = false;
  let activeCategory = 'all';

  actionsSlot.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span class="cm-status" id="cm-status"></span>
      <button class="cm-scan-btn" id="cm-scan-btn">▶ Escanear</button>
    </div>
  `;

  container.innerHTML = `
    <div class="cm-wrap">
      <div class="cm-tabs">
        ${CATS_CONFIG.map((c,i) => `
          <button class="cm-tab ${i===0?'active':''}" data-cat="${c.key}">
            ${c.emoji} ${c.label}
            <span class="cm-tab-badge" id="cm-badge-${c.key}"></span>
          </button>
        `).join('')}
      </div>

      <div class="sc2-toolbar" style="margin-top:14px;">
        <div class="sc2-filters">
          <div class="sc2-filter"><label>SCORE MÍN.</label>
            <select id="cm-filter-score" class="sc2-sel">
              <option value="9">≥ 9</option>
              <option value="8">≥ 8</option>
              <option value="7" selected>≥ 7</option>
              <option value="6">≥ 6</option>
              <option value="5">≥ 5</option>
              <option value="0">Todos</option>
            </select>
          </div>
          <div class="sc2-filter"><label>TIPO</label>
            <select id="cm-filter-tipo" class="sc2-sel">
              <option value="all">Futuros + ETFs</option>
              <option value="futures">Solo Futuros</option>
              <option value="etf">Solo ETFs</option>
            </select>
          </div>
          <div class="sc2-filter"><label>ESTADO</label>
            <select id="cm-filter-estado" class="sc2-sel">
              <option value="all">Todos</option>
              <option value="ready">🟢 Ready</option>
              <option value="diario">🟡 Espera diario</option>
              <option value="close">🔵 Cerca</option>
            </select>
          </div>
        </div>
      </div>

      <div class="sc2-progress" id="cm-progress" style="display:none">
        <div class="sc2-progress-fill" id="cm-progress-fill"></div>
      </div>

      <div id="cm-results">
        <div class="sc2-empty">Pulsa Escanear para analizar el universo de commodities (${COMMODITIES.length} activos)</div>
      </div>
    </div>
  `;

  function renderResults() {
    const minScore   = parseInt(document.getElementById('cm-filter-score')?.value || '7');
    const filterTipo = document.getElementById('cm-filter-tipo')?.value || 'all';
    const filterEst  = document.getElementById('cm-filter-estado')?.value || 'all';

    const filtered = scanResults.filter(r => {
      if (r.score < minScore) return false;
      if (activeCategory !== 'all' && r.cat !== activeCategory) return false;
      if (filterTipo !== 'all' && r.type !== filterTipo) return false;
      if (filterEst  !== 'all' && r.estado !== filterEst)  return false;
      return true;
    }).sort((a,b) => b.score - a.score);

    // Badges por categoría
    CATS_CONFIG.forEach(c => {
      const badge = document.getElementById(`cm-badge-${c.key}`);
      if (!badge) return;
      const catR = scanResults.filter(r => c.key === 'all' || r.cat === c.key);
      const ready = catR.filter(r => r.estado === 'ready').length;
      const strong = catR.filter(r => r.score >= 7).length;
      if (catR.length > 0 && strong > 0) {
        badge.textContent = ready > 0 ? ready : strong;
        badge.style.background = ready > 0 ? 'var(--green)' : 'var(--text3)';
        badge.style.display = 'inline';
      } else {
        badge.style.display = 'none';
      }
    });

    const el = document.getElementById('cm-results');
    if (!el) return;
    if (filtered.length === 0) {
      el.innerHTML = `<div class="sc2-empty">${scanResults.length > 0 ? 'Ningún activo cumple los filtros actuales' : 'Pulsa Escanear para analizar el universo de commodities'}</div>`;
      return;
    }

    const sc = s => s>=9?'var(--green)':s>=7?'var(--amber)':'var(--text3)';
    const estLabel = {ready:'🟢 LISTO',diario:'⏳ ESPERA DIARIO',close:'🔶 CERCA',watching:'👁 VIGILANDO'};
    const estColor = e => e==='ready'?'var(--green)':e==='diario'?'var(--amber)':'var(--text3)';

    el.innerHTML = `
      <div style="font-size:11px;color:var(--text2);padding:6px 0 10px;border-bottom:1px solid var(--border);margin-bottom:4px;">
        ${filtered.length} activos · <strong style="color:var(--green)">${filtered.filter(r=>r.estado==='ready').length} listos</strong>
        · ${filtered.filter(r=>r.estado==='diario').length} espera diario
      </div>
      <table class="sc2-table">
        <thead>
          <tr><th>ACTIVO</th><th>CATEGORÍA</th><th>SCORE</th><th>ESTADO</th><th>PRECIO</th><th>VOLUMEN MEDIA 11s</th></tr>
        </thead>
        <tbody>
          ${filtered.map(r => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:10px;">
                  <div style="font-size:20px;line-height:1;">${r.emoji}</div>
                  <div>
                    <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px;">
                      <span class="sc2-ticker">${r.ticker.replace('=F','')}</span>
                      <span class="cm-type-badge ${r.type==='futures'?'cm-type-futures':'cm-type-etf'}">${r.type==='futures'?'FUTURO':'ETF'}</span>
                    </div>
                    <div class="cm-name">${r.name}</div>
                  </div>
                </div>
              </td>
              <td style="font-size:10px;color:var(--text3);text-transform:uppercase;font-family:var(--mono)">${r.cat==='all'?'AMPLIO':r.cat.toUpperCase()}</td>
              <td class="sc2-score" style="color:${sc(r.score)}">${r.score}/10</td>
              <td style="color:${estColor(r.estado)};font-size:10px;font-weight:600">${estLabel[r.estado]||'—'}</td>
              <td class="sc2-price">${r.price?r.price.toFixed(2):'—'}</td>
              <td class="sc2-vol">${r.type==='futures'?(r.avgVol11>=1000?Math.round(r.avgVol11/1000)+'k contratos':'—'):(r.avgVol11>=1e6?(r.avgVol11/1e6).toFixed(1)+'M':Math.round(r.avgVol11/1e3)+'k')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  async function startScan() {
    if (scanning) return;
    scanning = true;
    scanResults = [];

    const btn  = document.getElementById('cm-scan-btn');
    const st   = document.getElementById('cm-status');
    const prog = document.getElementById('cm-progress');
    const fill = document.getElementById('cm-progress-fill');

    if (btn)  { btn.disabled=true; btn.textContent='⏳ Escaneando...'; }
    if (prog) prog.style.display='block';
    if (fill) fill.style.width='0%';

    const BATCH = 6;
    let done = 0;
    for (let i=0; i<COMMODITIES.length; i+=BATCH) {
      const batch = COMMODITIES.slice(i, i+BATCH);
      const res = await Promise.all(batch.map(async c => {
        try {
          const raw = await fetchOHLC(c.ticker);
          return { ...c, ...analyzeAsset(raw) };
        } catch { return null; }
      }));
      res.forEach(r => { if(r) scanResults.push(r); });
      done += batch.length;
      if (fill) fill.style.width=(done/COMMODITIES.length*100).toFixed(0)+'%';
      if (st)   st.textContent=`${COMMODITIES[Math.min(i+BATCH-1,COMMODITIES.length-1)].ticker} (${done}/${COMMODITIES.length})`;
      renderResults();
      await new Promise(r=>setTimeout(r,300));
    }

    scanning = false;
    if (btn)  { btn.disabled=false; btn.textContent='↻ Re-escanear'; }
    if (prog) prog.style.display='none';
    if (st)   st.textContent=`${scanResults.length} activos · ${scanResults.filter(r=>r.estado==='ready').length} listos`;
    renderResults();
  }

  // Listeners
  container.querySelectorAll('.cm-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeCategory = tab.dataset.cat;
      container.querySelectorAll('.cm-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderResults();
    });
  });

  ['cm-filter-score','cm-filter-tipo','cm-filter-estado'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderResults);
  });

  document.getElementById('cm-scan-btn')?.addEventListener('click', startScan);

  return { destroy() {} };
}

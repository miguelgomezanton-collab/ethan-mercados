// ═══════════════════════════════════════════════
// MÓDULO: Watchlist · Renta Variable v2.0
// Replicación exacta del sistema original:
// - Cards expandibles con desglose M/W/D
// - Score 0-10 (punto 10 = mensualOk AND semanalOk)
// - Stop loss = EMA10 semanal
// - Persistencia en localStorage('ethan_watchlist_bajista_v1')
// - Integración con screeners: botón + Watchlist
//   escribe directamente en la misma clave
// ═══════════════════════════════════════════════

import { UserData } from '../../userdata.js';

const STORAGE_KEY = 'ethan_watchlist_bajista_v1';
const VOL_AVG = 11;

const PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://soft-field-156f.miguel-gomez-anton.workers.dev/?url=${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
];

// ── Motor técnico ──────────────────────────────
function ema(arr, p) {
  const k=2/(p+1), out=new Array(arr.length).fill(null);
  let s=arr.findIndex(v=>v!=null&&!isNaN(v));
  if(s<0)return out; out[s]=arr[s];
  for(let i=s+1;i<arr.length;i++){
    const v=(arr[i]!=null&&!isNaN(arr[i]))?arr[i]:out[i-1];
    out[i]=v*k+out[i-1]*(1-k);
  }
  return out;
}
function calcMACD(c,f=12,s=26,sig=9){
  const ef=ema(c,f),es=ema(c,s);
  const m=ef.map((v,i)=>(v!=null&&es[i]!=null)?v-es[i]:null);
  return{m,sl:ema(m.map(v=>v??0),sig)};
}
function calcRSI(c,p=14){
  const out=new Array(c.length).fill(null);
  if(c.length<p+1)return out;
  let g=0,l=0;
  for(let i=1;i<=p;i++){const d=c[i]-c[i-1];d>0?g+=d:l-=d;}
  let ag=g/p,al=l/p;
  out[p]=al===0?100:100-(100/(1+ag/al));
  for(let i=p+1;i<c.length;i++){
    const d=c[i]-c[i-1];
    ag=(ag*(p-1)+(d>0?d:0))/p;al=(al*(p-1)+(d<0?-d:0))/p;
    out[i]=al===0?100:100-(100/(1+ag/al));
  }
  return out;
}
function calcStoch(H,L,C,p=14,sk=3){
  const rk=C.map((c,i)=>{
    if(i<p-1)return null;
    const hh=Math.max(...H.slice(i-p+1,i+1)),ll=Math.min(...L.slice(i-p+1,i+1));
    return hh===ll?50:(c-ll)/(hh-ll)*100;
  });
  // SMA para suavizado del Stochastic (matemáticamente correcto)
  function smaSimple(arr,per){
    return arr.map((v,i)=>{
      if(i<per-1)return null;
      const sl=arr.slice(i-per+1,i+1).filter(x=>x!=null);
      return sl.length===per?sl.reduce((a,b)=>a+b,0)/per:null;
    });
  }
  const k=smaSimple(rk,sk);
  return{k,d:smaSimple(k.map(v=>v??0),sk)};
}
function resample(ts,O,H,L,C,V,freq){
  const g={};
  ts.forEach((t,i)=>{
    const dd=new Date(t*1000);let key;
    if(freq==='W'){
      const dy=dd.getDay(),df=dd.getDate()-dy+(dy===0?-6:1);
      const mo=new Date(+dd);mo.setDate(df);key=mo.toISOString().slice(0,10);
    }else key=`${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}`;
    if(!g[key])g[key]={o:O[i],h:H[i],l:L[i],c:C[i],v:V[i]};
    else{g[key].h=Math.max(g[key].h,H[i]);g[key].l=Math.min(g[key].l,L[i]);g[key].c=C[i];g[key].v+=V[i];}
  });
  const keys=Object.keys(g).sort();
  return{dates:keys,opens:keys.map(k=>g[k].o),highs:keys.map(k=>g[k].h),lows:keys.map(k=>g[k].l),closes:keys.map(k=>g[k].c),vols:keys.map(k=>g[k].v)};
}

async function fetchData(ticker){
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=10y&events=history`;
  for(const fn of PROXIES){
    try{
      const r=await fetch(fn(url),{signal:(() => { const c = new AbortController(); setTimeout(() => c.abort(), 8000); return c.signal; })()});
      if(!r.ok)continue;
      const text=await r.text();
      let j;try{j=JSON.parse(text);}catch{continue;}
      const res=j?.chart?.result?.[0];if(!res)continue;
      const q=res.indicators?.quote?.[0];if(!q)continue;
      const adj=res.indicators?.adjclose?.[0]?.adjclose||q.close;
      const ratio=adj.map((a,i)=>(q.close[i]&&a)?a/q.close[i]:1);
      const meta=res.meta||{};
      return{
        timestamps:res.timestamp,
        opens:q.open.map((v,i)=>v*ratio[i]),
        highs:q.high.map((v,i)=>v*ratio[i]),
        lows:q.low.map((v,i)=>v*ratio[i]),
        closes:adj,vols:q.volume,
        name:meta.shortName||meta.longName||ticker,
        currency:meta.currency||'USD'
      };
    }catch(e){}
  }
  throw new Error('Sin datos disponibles');
}

function analyze(raw){
  const{timestamps,opens,highs,lows,closes,vols,name,currency}=raw;
  const n=closes.length;
  const W=resample(timestamps,opens,highs,lows,closes,vols,'W');
  const M=resample(timestamps,opens,highs,lows,closes,vols,'M');

  const d_mc=calcMACD(closes),d_r14=calcRSI(closes,14);
  const d_ema5=ema(closes,5),d_ema10=ema(closes,10);
  const di=n-1;

  const w_mc=calcMACD(W.closes),w_s89=calcStoch(W.highs,W.lows,W.closes,89);
  const w_r14=calcRSI(W.closes,14);
  const w_ema10=ema(W.closes,10),w_ema20=ema(W.closes,20);
  const wi=W.closes.length-1;

  const m_mc=calcMACD(M.closes),m_s89=calcStoch(M.highs,M.lows,M.closes,89);
  const m_s8=calcStoch(M.highs,M.lows,M.closes,8);
  const m_r14=calcRSI(M.closes,14),m_ema10=ema(M.closes,10);
  const mi=M.closes.length-1;

  const f=v=>v!=null&&!isNaN(v)?v.toFixed(2):'—';

  // ── CONDICIONES BAJISTAS ──
  // MENSUAL (6): Precio<EMA10, MACD↓<0, Stoch89↓, RSI<41, Stoch14<30, Stoch8↓
  const m_s14=calcStoch(M.highs,M.lows,M.closes,14);
  const mc_precio={ok:m_ema10[mi]!=null&&M.closes[mi]<m_ema10[mi],  label:'P<EMA10',   val:f(M.closes[mi])};
  const mc_macd  ={ok:m_mc.m[mi]<0&&m_mc.m[mi]<m_mc.sl[mi],        label:'MACD↓<0',   val:f(m_mc.m[mi])};
  const mc_s89   ={ok:m_s89.k[mi]<m_s89.d[mi]&&(mi<1||m_s89.k[mi-1]>=m_s89.d[mi-1]||m_s89.k[mi]<20), label:'Stoch89↓', val:f(m_s89.k[mi])};
  const mc_rsi   ={ok:m_r14[mi]<41,                                 label:'RSI<41',    val:f(m_r14[mi])};
  const mc_s14   ={ok:m_s14.k[mi]<30,                               label:'Stoch14<30',val:f(m_s14.k[mi])};
  const mc_s8    ={ok:m_s8.k[mi]<m_s8.d[mi]&&(mi<1||m_s8.k[mi-1]>=m_s8.d[mi-1]||m_s8.k[mi]<20), label:'Stoch8↓', val:f(m_s8.k[mi])};
  const mensualOk=mc_precio.ok&&mc_macd.ok&&mc_s89.ok&&mc_rsi.ok&&mc_s14.ok&&mc_s8.ok;

  // SEMANAL (4): MACD↓<0, Stoch89↓<20, Stoch14<20, RSI<40
  const w_s14=calcStoch(W.highs,W.lows,W.closes,14);
  const sc_macd  ={ok:w_mc.m[wi]<0&&w_mc.m[wi]<w_mc.sl[wi],        label:'MACD↓<0',   val:f(w_mc.m[wi])};
  const sc_s89   ={ok:w_s89.k[wi]<20&&w_s89.k[wi]<w_s89.d[wi],     label:'Stoch89↓<20',val:f(w_s89.k[wi])};
  const sc_s14   ={ok:w_s14.k[wi]<20,                               label:'Stoch14<20',val:f(w_s14.k[wi])};
  const sc_rsi   ={ok:w_r14[wi]<40,                                 label:'RSI<40',    val:f(w_r14[wi])};
  const semanalOk=sc_macd.ok&&sc_s89.ok&&sc_s14.ok&&sc_rsi.ok;

  // DIARIO — señal de entrada: Stoch8 corta a la baja
  const d_s8=calcStoch(highs,lows,closes,8);
  const dc_s8cross=di>0&&d_s8.k[di]<d_s8.d[di]&&d_s8.k[di-1]>=d_s8.d[di-1];
  const dailyReady=dc_s8cross;

  // Score /10: 6 mensuales + 4 semanales
  let score=0;
  if(mc_precio.ok)score++;if(mc_macd.ok)score++;if(mc_s89.ok)score++;
  if(mc_rsi.ok)score++;if(mc_s14.ok)score++;if(mc_s8.ok)score++;
  if(sc_macd.ok)score++;if(sc_s89.ok)score++;if(sc_s14.ok)score++;if(sc_rsi.ok)score++;

  let estado='watching';
  if(mensualOk&&semanalOk&&dailyReady)estado='ready';
  else if(mensualOk&&semanalOk)estado='diario';
  else if(score>=7)estado='close';

  return{
    name,currency,price:closes[di],score,estado,mensualOk,semanalOk,dailyReady,
    mc:[mc_precio,mc_macd,mc_s89,mc_rsi,mc_s14,mc_s8],
    sc:[sc_macd,sc_s89,sc_s14,sc_rsi],
    dc:{s8cross:{ok:dc_s8cross,label:'Stoch8↓',val:dc_s8cross?'SÍ':'NO'}},
    stopSemanal:w_ema20[wi],
    ema5d:d_ema5[di],ema10d:d_ema10[di]
  };
}

// ── Helpers visuales ───────────────────────────
function scoreColor(s){return s>=9?'var(--green)':s>=7?'#6ee7b7':s>=5?'var(--amber)':'var(--text3)';}
function stateLabel(e){return{ready:'🔴 CORTO LISTO',diario:'⏳ ESPERA DIARIO',close:'🔶 CERCA',watching:'👁 VIGILANDO'}[e]||'—';}
function stateClass(e){return{ready:'wl-chip-ready',diario:'wl-chip-diario',close:'wl-chip-close',watching:'wl-chip-watching'}[e]||'';}
function condTag(c){return`<span class="wl-cond ${c.ok?'ok':''} ${c.opt?'opt':''}">${c.label}</span>`;}
function missingTags(conds){return conds.map(c=>condTag(c)).join('');}
function detailRow(c){
  return`<div class="wl-detail-row">
    <span class="wl-cond-dot ${c.ok?'ok':''}"></span>
    <span class="wl-detail-label">${c.label}</span>
    <span class="wl-detail-val">${c.val}</span>
  </div>`;
}

// ══════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════
export async function render(container, { actionsSlot }) {
  let watchTickers = (await UserData.get(STORAGE_KEY)) || [];
  const tickerData = {};
  const expanded = {};

  actionsSlot.innerHTML = `
    <div class="wl-add-bar">
      <input type="text" id="wl-input" placeholder="Añadir ticker..." autocomplete="off" class="wl-input">
      <button class="btn btn-primary" id="wl-add-btn">+ Añadir</button>
      <span class="last-update" id="wl-last-update"></span>
    </div>
  `;

  container.innerHTML = `<div id="wl-list"></div>`;

  // ── Render de cards ─────────────────────────
  function renderCard(ticker){
    const d=tickerData[ticker];
    const isOpen=!!expanded[ticker];

    if(!d||d.status==='loading') return `
      <div class="wl-card loading" id="wlcard-${ticker}">
        <div class="wl-card-main">
          <div><div class="wl-ticker">${ticker}</div></div>
          <div><span class="wl-spinner"></span></div>
          <div class="wl-card-center">Cargando...</div>
          <div></div><div></div><div></div>
          <div><button class="wl-del-btn" data-ticker="${ticker}">✕</button></div>
        </div>
      </div>`;

    if(d.status==='error') return `
      <div class="wl-card error" id="wlcard-${ticker}">
        <div class="wl-card-main">
          <div><div class="wl-ticker">${ticker}</div><div class="wl-name" style="color:var(--red)">Error al cargar</div></div>
          <div>—</div><div>—</div>
          <div style="font-size:11px;color:var(--red)">${d.error||'Sin datos'}</div>
          <div></div><div></div>
          <div><button class="wl-del-btn" data-ticker="${ticker}">✕</button></div>
        </div>
      </div>`;

    const r=d.result;
    const sc=scoreColor(r.score);
    const stopDist=r.stopSemanal?((r.price-r.stopSemanal)/r.price*100).toFixed(1):null;
    const fmtP=v=>v!=null&&!isNaN(v)?'$'+v.toFixed(2):'—';

    return `
      <div class="wl-card ${r.estado}" id="wlcard-${ticker}">
        <div class="wl-card-main wl-expandable" data-ticker="${ticker}">
          <div>
            <div class="wl-ticker">${ticker}</div>
            <div class="wl-name">${r.name||''}</div>
          </div>
          <div>
            <div class="wl-price">${fmtP(r.price)}</div>
            ${stopDist!=null?`<div class="wl-stop">Stop: ${fmtP(r.stopSemanal)} (${stopDist}%)</div>`:''}
          </div>
          <div class="wl-score-wrap">
            <div class="wl-score-num" style="color:${sc}">${r.score}</div>
            <div>
              <div class="wl-score-track"><div class="wl-score-fill" style="width:${r.score*10}%;background:${sc}"></div></div>
              <div class="wl-score-max">/10</div>
            </div>
          </div>
          <div class="wl-conds">${missingTags(r.mc)}</div>
          <div class="wl-conds">${missingTags(r.sc)}</div>
          <div><span class="wl-state-chip ${stateClass(r.estado)}">${stateLabel(r.estado)}</span></div>
          <div><button class="wl-del-btn" data-ticker="${ticker}">✕</button></div>
        </div>
        <div class="wl-detail ${isOpen?'open':''}" id="wldetail-${ticker}">
          <div class="wl-detail-grid">
            <div class="wl-detail-block">
              <div class="wl-detail-title mensual">◆ MENSUAL ${r.mensualOk?'✓':''}</div>
              ${r.mc.map(c=>detailRow(c)).join('')}
            </div>
            <div class="wl-detail-block">
              <div class="wl-detail-title semanal">◆ SEMANAL ${r.semanalOk?'✓':''}</div>
              ${r.sc.map(c=>detailRow(c)).join('')}
            </div>
            <div class="wl-detail-block">
              <div class="wl-detail-title diario">◆ DIARIO — Timing</div>
              ${Object.values(r.dc).map(c=>detailRow(c)).join('')}
              <div class="wl-daily-signal ${r.dailyReady?'ready':''}">
                ${r.dailyReady?'🔴 ENTRADA CORTO ACTIVA — Stoch8 cortó a la baja':'⏳ Sin señal de entrada bajista todavía'}
              </div>
              ${r.stopSemanal!=null?`<div class="wl-ema-row"><span>Stop (EMA20 sem.)</span><span>$${r.stopSemanal.toFixed(2)}</span></div>`:''}
              ${r.ema10d!=null?`<div class="wl-ema-row"><span>EMA10d ref.</span><span>$${r.ema10d.toFixed(2)}</span></div>`:''}
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderAll(){
    const el=document.getElementById('wl-list');
    if(!el)return;
    if(watchTickers.length===0){
      el.innerHTML=`
        <div class="empty">
          <div class="empty-icon">👁</div>
          <div class="empty-title">Watchlist vacía</div>
          <div class="empty-desc">Añade tickers aquí arriba o pulsa + Watchlist en cualquier screener</div>
        </div>`;
      return;
    }
    const sorted=[...watchTickers].sort((a,b)=>{
      const sa=tickerData[a]?.result?.score??-1;
      const sb=tickerData[b]?.result?.score??-1;
      return sb-sa;
    });
    el.innerHTML=sorted.map(t=>renderCard(t)).join('');
    const lastUpEl=document.getElementById('wl-last-update');
    if(lastUpEl)lastUpEl.textContent='Actualizado: '+new Date().toLocaleTimeString('es-ES');
    attachCardListeners();
  }

  function attachCardListeners(){
    document.querySelectorAll('.wl-expandable').forEach(el=>{
      el.addEventListener('click',e=>{
        if(e.target.classList.contains('wl-del-btn'))return;
        const ticker=el.dataset.ticker;
        expanded[ticker]=!expanded[ticker];
        const det=document.getElementById(`wldetail-${ticker}`);
        if(det)det.classList.toggle('open',expanded[ticker]);
      });
    });
    document.querySelectorAll('.wl-del-btn').forEach(btn=>{
      btn.addEventListener('click',e=>{
        e.stopPropagation();
        const ticker=btn.dataset.ticker;
        watchTickers=watchTickers.filter(t=>t!==ticker);
        UserData.set(STORAGE_KEY, watchTickers);
        delete tickerData[ticker];
        renderAll();
      });
    });
  }

  async function loadTicker(ticker){
    tickerData[ticker]={status:'loading'};
    renderAll();
    try{
      const raw=await fetchData(ticker);
      tickerData[ticker]={status:'ok',result:analyze(raw)};
    }catch(err){
      tickerData[ticker]={status:'error',error:err.message.slice(0,50)};
    }
    renderAll();
  }

  function addTicker(ticker){
    const t=ticker.trim().toUpperCase().replace(/\s+/g,'');
    if(!t)return;
    if(watchTickers.includes(t)){renderAll();return;}
    watchTickers.push(t);
    UserData.set(STORAGE_KEY, watchTickers);
    loadTicker(t);
  }

  // Listeners
  document.getElementById('wl-add-btn')?.addEventListener('click',()=>{
    const input=document.getElementById('wl-input');
    if(!input?.value.trim())return;
    addTicker(input.value);
    input.value='';
  });
  document.getElementById('wl-input')?.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      const input=document.getElementById('wl-input');
      if(!input?.value.trim())return;
      addTicker(input.value);
      input.value='';
    }
  });

  // Carga inicial de todos los tickers guardados
  renderAll();
  for(const t of watchTickers) loadTicker(t);

  return{destroy(){}};
}

// ── API pública para los screeners ─────────────
// Los screeners llaman a esta función para añadir
// un ticker directamente a la watchlist desde sus
// resultados, sin necesidad de navegar al módulo.
export async function addToWatchlist(ticker){
  try{
    const list = (await UserData.get(STORAGE_KEY)) || [];
    if(!list.includes(ticker)){
      list.push(ticker);
      await UserData.set(STORAGE_KEY, list);
    }
  }catch(e){}
}


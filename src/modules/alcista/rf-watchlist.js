import { UserData } from '../../userdata.js';
// ═══════════════════════════════════════════════
// MÓDULO: Watchlist · Renta Fija v1.0
// Mismo motor que rv-watchlist y com-watchlist.
// Solo ETFs de renta fija — sin futuros.
// Persistencia en localStorage('ethan_watchlist_rf_v1')
// Integración con screener RF via botón + WL.
// ═══════════════════════════════════════════════

const STORAGE_KEY = 'ethan_watchlist_rf_v1';
const VOL_AVG = 11;

const PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://soft-field-156f.miguel-gomez-anton.workers.dev/?url=${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
];

// Info de ETFs conocidos de RF
const RF_INFO = {
  'TLT':{'name':'Bonos Tesoro USA 20+a','emoji':'🇺🇸','cat':'Gobierno USA'},
  'IEF':{'name':'Bonos Tesoro USA 7-10a','emoji':'🇺🇸','cat':'Gobierno USA'},
  'SHY':{'name':'Bonos Tesoro USA 1-3a','emoji':'🇺🇸','cat':'Gobierno USA'},
  'IEI':{'name':'Bonos Tesoro USA 3-7a','emoji':'🇺🇸','cat':'Gobierno USA'},
  'GOVT':{'name':'Bonos Gobierno USA','emoji':'🇺🇸','cat':'Gobierno USA'},
  'TIP':{'name':'TIPS inflación USA','emoji':'🇺🇸','cat':'Gobierno USA'},
  'SCHP':{'name':'TIPS Schwab','emoji':'🇺🇸','cat':'Gobierno USA'},
  'VGIT':{'name':'Bonos Gobierno 5-10a','emoji':'🇺🇸','cat':'Gobierno USA'},
  'VGLT':{'name':'Bonos Gobierno 25+a','emoji':'🇺🇸','cat':'Gobierno USA'},
  'SPTL':{'name':'Bonos Largo Plazo SPDR','emoji':'🇺🇸','cat':'Gobierno USA'},
  'LQD':{'name':'Corp. Investment Grade','emoji':'🏢','cat':'Corporativo USA'},
  'VCIT':{'name':'Corp. Medio Plazo','emoji':'🏢','cat':'Corporativo USA'},
  'VCLT':{'name':'Corp. Largo Plazo','emoji':'🏢','cat':'Corporativo USA'},
  'USIG':{'name':'Corp. IG USA','emoji':'🏢','cat':'Corporativo USA'},
  'IGSB':{'name':'Corp. Corto Plazo IG','emoji':'🏢','cat':'Corporativo USA'},
  'IGIB':{'name':'Corp. Medio Plazo IG','emoji':'🏢','cat':'Corporativo USA'},
  'HYG':{'name':'High Yield iShares','emoji':'⚡','cat':'High Yield'},
  'JNK':{'name':'High Yield SPDR','emoji':'⚡','cat':'High Yield'},
  'USHY':{'name':'High Yield USA','emoji':'⚡','cat':'High Yield'},
  'ANGL':{'name':'Fallen Angels USD','emoji':'⚡','cat':'High Yield'},
  'BNDX':{'name':'Bonos Intl. Vanguard','emoji':'🌍','cat':'Internacional'},
  'BWX':{'name':'Bonos Gobierno Intl.','emoji':'🌍','cat':'Internacional'},
  'EMB':{'name':'Bonos Emergentes USD','emoji':'🌍','cat':'Internacional'},
  'PCY':{'name':'Bonos Emergentes Invesco','emoji':'🌍','cat':'Internacional'},
  'VWOB':{'name':'Bonos Emergentes Vanguard','emoji':'🌍','cat':'Internacional'},
  'IGOV':{'name':'Bonos Gobierno DM','emoji':'🌍','cat':'Internacional'},
  'IAGG':{'name':'Agregado Intl. iShares','emoji':'🌍','cat':'Internacional'},
  'BND':{'name':'Agregado USA Vanguard','emoji':'📊','cat':'Agregado'},
  'AGG':{'name':'Agregado USA iShares','emoji':'📊','cat':'Agregado'},
  'FBND':{'name':'Agregado USA Fidelity','emoji':'📊','cat':'Agregado'},
  'SCHZ':{'name':'Agregado USA Schwab','emoji':'📊','cat':'Agregado'},
  'SPAB':{'name':'Agregado USA SPDR','emoji':'📊','cat':'Agregado'},
  'SHV':{'name':'Letras Tesoro <1a','emoji':'💵','cat':'Corto Plazo'},
  'BIL':{'name':'T-Bills 1-3 meses','emoji':'💵','cat':'Corto Plazo'},
  'SGOV':{'name':'T-Bills 0-3m iShares','emoji':'💵','cat':'Corto Plazo'},
  'MINT':{'name':'Money Market PIMCO','emoji':'💵','cat':'Corto Plazo'},
};

function getRFInfo(ticker) {
  return RF_INFO[ticker] || { name: ticker, emoji: '📈', cat: 'ETF RF' };
}

// ── Motor técnico ──────────────────────────────
function ema(arr, p) {
  const k=2/(p+1), out=new Array(arr.length).fill(null);
  let s=arr.findIndex(v=>v!=null&&!isNaN(v));
  if(s<0)return out; out[s]=arr[s];
  for(let i=s+1;i<arr.length;i++){const v=(arr[i]!=null&&!isNaN(arr[i]))?arr[i]:out[i-1];out[i]=v*k+out[i-1]*(1-k);}
  return out;
}
function calcMACD(c){const ef=ema(c,12),es=ema(c,26);const m=ef.map((v,i)=>(v!=null&&es[i]!=null)?v-es[i]:null);return{m,sl:ema(m.map(v=>v??0),9)};}
function calcRSI(c,p=14){const out=new Array(c.length).fill(null);if(c.length<p+1)return out;let g=0,l=0;for(let i=1;i<=p;i++){const d=c[i]-c[i-1];d>0?g+=d:l-=d;}let ag=g/p,al=l/p;out[p]=al===0?100:100-(100/(1+ag/al));for(let i=p+1;i<c.length;i++){const d=c[i]-c[i-1];ag=(ag*(p-1)+(d>0?d:0))/p;al=(al*(p-1)+(d<0?-d:0))/p;out[i]=al===0?100:100-(100/(1+ag/al));}return out;}
function calcStoch(H,L,C,p=14,sk=3){
  const rk=C.map((c,i)=>{if(i<p-1)return null;const hh=Math.max(...H.slice(i-p+1,i+1)),ll=Math.min(...L.slice(i-p+1,i+1));return hh===ll?50:(c-ll)/(hh-ll)*100;});
  function sma(arr,per){return arr.map((v,i)=>{if(i<per-1)return null;const sl=arr.slice(i-per+1,i+1).filter(x=>x!=null);return sl.length===per?sl.reduce((a,b)=>a+b,0)/per:null;});}
  const k=sma(rk,sk);return{k,d:sma(k.map(v=>v??0),sk)};
}
function resample(ts,O,H,L,C,V,freq){const g={};ts.forEach((t,i)=>{const dd=new Date(t*1000);let key;if(freq==='W'){const dy=dd.getDay(),df=dd.getDate()-dy+(dy===0?-6:1);const mo=new Date(+dd);mo.setDate(df);key=mo.toISOString().slice(0,10);}else key=`${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}`;if(!g[key])g[key]={o:O[i],h:H[i],l:L[i],c:C[i],v:V[i]};else{g[key].h=Math.max(g[key].h,H[i]);g[key].l=Math.min(g[key].l,L[i]);g[key].c=C[i];g[key].v+=V[i];}});const keys=Object.keys(g).sort();return{dates:keys,opens:keys.map(k=>g[k].o),highs:keys.map(k=>g[k].h),lows:keys.map(k=>g[k].l),closes:keys.map(k=>g[k].c),vols:keys.map(k=>g[k].v)};}

async function fetchData(ticker) {
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
      return{timestamps:res.timestamp,opens:q.open.map((v,i)=>v*ratio[i]),highs:q.high.map((v,i)=>v*ratio[i]),lows:q.low.map((v,i)=>v*ratio[i]),closes:adj,vols:q.volume};
    }catch(e){}
  }
  throw new Error('Sin datos disponibles');
}

function analyze(raw, ticker) {
  const{timestamps,opens,highs,lows,closes,vols}=raw;
  const n=closes.length;
  const info=getRFInfo(ticker);
  const W=resample(timestamps,opens,highs,lows,closes,vols,'W');
  const M=resample(timestamps,opens,highs,lows,closes,vols,'M');
  const d_mc=calcMACD(closes),d_r14=calcRSI(closes),d_ema5=ema(closes,5),d_ema10=ema(closes,10);
  const di=n-1;
  const w_mc=calcMACD(W.closes),w_s89=calcStoch(W.highs,W.lows,W.closes,89),w_r14=calcRSI(W.closes),w_ema10=ema(W.closes,10),w_ema20=ema(W.closes,20);
  const wi=W.closes.length-1;
  const m_mc=calcMACD(M.closes),m_s89=calcStoch(M.highs,M.lows,M.closes,89),m_s8=calcStoch(M.highs,M.lows,M.closes,8),m_r14=calcRSI(M.closes),m_ema10=ema(M.closes,10);
  const mi=M.closes.length-1;
  const f=v=>v!=null&&!isNaN(v)?v.toFixed(2):'—';

  const mc_macd ={ok:m_mc.m[mi]>0&&m_mc.m[mi]>m_mc.sl[mi],label:'MACD>0↑',val:f(m_mc.m[mi])};
  const mc_s89  ={ok:(m_s89.k[mi]>80&&m_s89.k[mi]>m_s89.d[mi])||m_s89.k[mi]>92,opt:m_s89.k[mi]>92,label:'Stoch89>80',val:f(m_s89.k[mi])};
  const mc_rsi  ={ok:m_r14[mi]>65,label:'RSI>65',val:f(m_r14[mi])};
  const mc_s8   ={ok:m_s8.k[mi]>78,label:'Stoch8>78',val:f(m_s8.k[mi])};
  const mc_precio={ok:m_ema10[mi]!=null&&M.closes[mi]>m_ema10[mi],label:'P>EMA10',val:f(M.closes[mi])};
  const mensualOk=mc_macd.ok&&mc_s89.ok&&mc_rsi.ok&&mc_s8.ok&&mc_precio.ok;

  const sc_macd ={ok:w_mc.m[wi]>0&&w_mc.m[wi]>w_mc.sl[wi],label:'MACD>0↑',val:f(w_mc.m[wi])};
  const sc_s89  ={ok:(w_s89.k[wi]>85&&w_s89.k[wi]>w_s89.d[wi])||w_s89.k[wi]>92,opt:w_s89.k[wi]>92,label:'Stoch89>85',val:f(w_s89.k[wi])};
  const sc_rsi  ={ok:w_r14[wi]>67,label:'RSI>67',val:f(w_r14[wi])};
  const sc_precio={ok:w_ema20[wi]!=null&&W.closes[wi]>w_ema20[wi],label:'P>EMA20',val:f(W.closes[wi])};
  const semanalOk=sc_macd.ok&&sc_s89.ok&&sc_rsi.ok&&sc_precio.ok;

  const dc_pos=d_mc.m[di]>0,dc_cross=di>0&&d_mc.m[di]>d_mc.sl[di]&&d_mc.m[di-1]<=d_mc.sl[di-1],dc_rsi=d_r14[di]>57;
  const dailyReady=dc_pos&&dc_cross&&dc_rsi;

  let score=0;
  if(mc_macd.ok)score++;if(mc_s89.ok)score++;if(mc_rsi.ok)score++;if(mc_s8.ok)score++;if(mc_precio.ok)score++;
  if(sc_macd.ok)score++;if(sc_s89.ok)score++;if(sc_rsi.ok)score++;if(sc_precio.ok)score++;
  if(mensualOk&&semanalOk)score++;

  let estado='watching';
  if(mensualOk&&semanalOk&&dailyReady)estado='ready';
  else if(mensualOk&&semanalOk)estado='diario';
  else if(score>=7)estado='close';

  return{
    name:info.name,emoji:info.emoji,cat:info.cat,price:closes[di],score,estado,
    mensualOk,semanalOk,dailyReady,
    mc:[mc_macd,mc_s89,mc_rsi,mc_s8,mc_precio],
    sc:[sc_macd,sc_s89,sc_rsi,sc_precio],
    dc:{pos:{ok:dc_pos,label:'MACD>0',val:f(d_mc.m[di])},cross:{ok:dc_cross,label:'MACD↑ cruza',val:dc_cross?'SÍ':'NO'},rsi:{ok:dc_rsi,label:'RSI>57',val:f(d_r14[di])}},
    stopSemanal:w_ema10[wi],ema5d:d_ema5[di],ema10d:d_ema10[di]
  };
}

// ── Helpers visuales ──────────────────────────
function scoreColor(s){return s>=9?'var(--green)':s>=7?'#6ee7b7':s>=5?'var(--amber)':'var(--text3)';}
function stateLabel(e){return{ready:'🟢 LISTO',diario:'⏳ ESPERA DIARIO',close:'🔶 CERCA',watching:'👁 VIGILANDO'}[e]||'—';}
function stateClass(e){return{ready:'wl-chip-ready',diario:'wl-chip-diario',close:'wl-chip-close',watching:'wl-chip-watching'}[e]||'';}
function condTag(c){return`<span class="wl-cond ${c.ok?'ok':''} ${c.opt?'opt':''}">${c.label}</span>`;}
function detailRow(c){return`<div class="wl-detail-row"><span class="wl-cond-dot ${c.ok?'ok':''}"></span><span class="wl-detail-label">${c.label}</span><span class="wl-detail-val">${c.val}</span></div>`;}

export async function render(container, { actionsSlot }) {
  let watchTickers = [];
  try { watchTickers = (await UserData.get(STORAGE_KEY)) || []; } catch { watchTickers = []; }
  const tickerData = {};
  const expanded = {};

  actionsSlot.innerHTML = `
    <div class="wl-add-bar">
      <input type="text" id="wl-rf-input" placeholder="ETF: TLT, IEF, HYG, BNDX..." autocomplete="off" class="wl-input">
      <button class="btn btn-primary" id="wl-rf-add-btn">+ Añadir</button>
      <span class="last-update" id="wl-rf-last-update"></span>
    </div>
  `;

  container.innerHTML = `<div id="wl-rf-list"></div>`;

  function renderCard(ticker) {
    const d=tickerData[ticker];
    const isOpen=!!expanded[ticker];
    const info=getRFInfo(ticker);

    if(!d||d.status==='loading') return `
      <div class="wl-card loading">
        <div class="wl-card-main">
          <div><div style="display:flex;align-items:center;gap:8px;"><span style="font-size:18px">${info.emoji}</span><div><div class="wl-ticker">${ticker}</div><div class="wl-name">${info.name}</div></div></div></div>
          <div><span class="wl-spinner"></span></div>
          <div>Cargando...</div><div></div><div></div><div></div>
          <div><button class="wl-del-btn" data-ticker="${ticker}">✕</button></div>
        </div>
      </div>`;

    if(d.status==='error') return `
      <div class="wl-card error">
        <div class="wl-card-main">
          <div><div style="display:flex;align-items:center;gap:8px;"><span style="font-size:18px">${info.emoji}</span><div><div class="wl-ticker">${ticker}</div><div class="wl-name" style="color:var(--red)">Error al cargar</div></div></div></div>
          <div>—</div><div>—</div><div style="font-size:11px;color:var(--red)">${d.error||'Sin datos'}</div>
          <div></div><div></div>
          <div><button class="wl-del-btn" data-ticker="${ticker}">✕</button></div>
        </div>
      </div>`;

    const r=d.result;
    const sc=scoreColor(r.score);
    const stopDist=r.stopSemanal?((r.price-r.stopSemanal)/r.price*100).toFixed(1):null;
    const fmtP=v=>v!=null&&!isNaN(v)?'$'+v.toFixed(2):'—';

    return `
      <div class="wl-card ${r.estado}">
        <div class="wl-card-main wl-expandable" data-ticker="${ticker}">
          <div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:20px;line-height:1">${r.emoji}</span>
              <div>
                <div style="display:flex;align-items:center;gap:7px;">
                  <span class="wl-ticker">${ticker}</span>
                  <span style="font-size:8px;color:var(--text3);font-family:var(--mono);background:var(--surface2);padding:1px 5px;border-radius:3px;">${r.cat}</span>
                </div>
                <div class="wl-name">${r.name}</div>
              </div>
            </div>
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
          <div class="wl-conds">${r.mc.map(c=>condTag(c)).join('')}</div>
          <div class="wl-conds">${r.sc.map(c=>condTag(c)).join('')}</div>
          <div><span class="wl-state-chip ${stateClass(r.estado)}">${stateLabel(r.estado)}</span></div>
          <div><button class="wl-del-btn" data-ticker="${ticker}">✕</button></div>
        </div>
        <div class="wl-detail ${isOpen?'open':''}" id="wldetail-rf-${ticker}">
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
                ${r.dailyReady?'🚀 ENTRADA ACTIVA':'⏳ Sin señal de entrada diaria todavía'}
              </div>
              ${r.ema5d!=null?`<div class="wl-ema-row"><span>EMA5d</span><span>${fmtP(r.ema5d)}</span></div>`:''}
              ${r.ema10d!=null?`<div class="wl-ema-row"><span>EMA10d (stop)</span><span>${fmtP(r.ema10d)}</span></div>`:''}
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderAll() {
    const el=document.getElementById('wl-rf-list');
    if(!el)return;
    if(watchTickers.length===0){
      el.innerHTML=`
        <div class="empty">
          <div class="empty-icon">📋</div>
          <div class="empty-title">Watchlist de Renta Fija vacía</div>
          <div class="empty-desc">Añade ETFs aquí arriba o pulsa + WL en el screener de RF.<br>Ejemplos: TLT, IEF, BND, HYG, BNDX, EMB...</div>
        </div>`;
      return;
    }
    const sorted=[...watchTickers].sort((a,b)=>(tickerData[b]?.result?.score??-1)-(tickerData[a]?.result?.score??-1));
    el.innerHTML=sorted.map(t=>renderCard(t)).join('');
    const lu=document.getElementById('wl-rf-last-update');
    if(lu)lu.textContent='Actualizado: '+new Date().toLocaleTimeString('es-ES');
    attachListeners();
  }

  function attachListeners() {
    document.querySelectorAll('.wl-expandable').forEach(el=>{
      el.addEventListener('click',e=>{
        if(e.target.classList.contains('wl-del-btn'))return;
        const t=el.dataset.ticker;
        expanded[t]=!expanded[t];
        const det=document.getElementById(`wldetail-rf-${t}`);
        if(det)det.classList.toggle('open',expanded[t]);
      });
    });
    document.querySelectorAll('.wl-del-btn').forEach(btn=>{
      btn.addEventListener('click',e=>{
        e.stopPropagation();
        const t=btn.dataset.ticker;
        watchTickers=watchTickers.filter(x=>x!==t);
        UserData.set(STORAGE_KEY, watchTickers);
        delete tickerData[t];
        renderAll();
      });
    });
  }

  async function loadTicker(ticker) {
    tickerData[ticker]={status:'loading'};
    renderAll();
    try{
      const raw=await fetchData(ticker);
      tickerData[ticker]={status:'ok',result:analyze(raw,ticker)};
    }catch(err){
      tickerData[ticker]={status:'error',error:err.message.slice(0,50)};
    }
    renderAll();
  }

  async function addTicker(ticker) {
    const t=ticker.trim().toUpperCase();
    if(!t)return;
    if(watchTickers.includes(t))return;
    watchTickers.push(t);
    await UserData.set(STORAGE_KEY, watchTickers);
    loadTicker(t);
  }

  document.getElementById('wl-rf-add-btn')?.addEventListener('click',()=>{
    const inp=document.getElementById('wl-rf-input');
    if(!inp?.value.trim())return;
    addTicker(inp.value); inp.value='';
  });
  document.getElementById('wl-rf-input')?.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();const inp=document.getElementById('wl-rf-input');if(!inp?.value.trim())return;addTicker(inp.value);inp.value='';}
  });

  renderAll();
  for(const t of watchTickers) loadTicker(t);

  return{destroy(){}};
}

export async function addToWatchlist(ticker){
  try{
    const list=(await UserData.get(STORAGE_KEY))||[];
    if(!list.includes(ticker)){list.push(ticker);await UserData.set(STORAGE_KEY,list);}
  }catch(e){}
}

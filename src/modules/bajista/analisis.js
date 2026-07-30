// ═══════════════════════════════════════════════
// MÓDULO: Análisis Técnico · Bajista
// Mismo formato visual que rv-analisis.js
// Condiciones RV BAJISTA:
// MENSUAL: Precio<EMA10 + MACD↓<0 + Stoch(89)↓
//   + RSI(14)<41 + Stoch(14)<30 + Stoch(8)↓
// SEMANAL: MACD↓<0 + Stoch(89)↓<20
//   + Stoch(14)<20 + RSI(14)<40
// ENTRADA (diario): Stoch(8) corta↓
//   o Precio toca EMA20 + Stoch(8) corta↓
import { saveModuleState } from '../../router.js';
// ═══════════════════════════════════════════════

const PROXIES=[
  u=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u=>`https://corsproxy.io/?${encodeURIComponent(u)}`,
  u=>`https://soft-field-156f.miguel-gomez-anton.workers.dev/?url=${encodeURIComponent(u)}`,
  u=>`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
];

function calcEMA(arr,p){
  const k=2/(p+1);const out=new Array(arr.length).fill(null);
  let s=0,c=0;
  for(let i=0;i<arr.length;i++){
    if(arr[i]==null)continue;
    if(c<p){s+=arr[i];c++;if(c===p)out[i]=s/p;}
    else out[i]=(arr[i]-out[i-1])*k+out[i-1];
  }
  return out;
}
function calcMACD(c,f=12,s=26,sig=9){
  const ef=calcEMA(c,f),es=calcEMA(c,s);
  const m=c.map((_,i)=>ef[i]!=null&&es[i]!=null?ef[i]-es[i]:null);
  const sl=calcEMA(m.map(v=>v??0),sig);
  return{m,sl};
}
function calcRSI(c,p=14){
  const out=new Array(c.length).fill(null);
  let ug=0,dl=0;
  for(let i=1;i<c.length;i++){
    const d=c[i]-c[i-1];
    if(i<=p){ug+=Math.max(d,0);dl+=Math.max(-d,0);
      if(i===p){ug/=p;dl/=p;out[i]=100-100/(1+ug/Math.max(dl,1e-10));}}
    else if(out[i-1]!=null){
      ug=(ug*(p-1)+Math.max(d,0))/p;dl=(dl*(p-1)+Math.max(-d,0))/p;
      out[i]=100-100/(1+ug/Math.max(dl,1e-10));
    }
  }
  return out;
}
function calcStoch(H,L,C,p=14,sk=3){
  const k=new Array(C.length).fill(null);
  for(let i=p-1;i<C.length;i++){
    const hh=Math.max(...H.slice(i-p+1,i+1).filter(v=>v!=null));
    const ll=Math.min(...L.slice(i-p+1,i+1).filter(v=>v!=null));
    k[i]=hh!==ll?(C[i]-ll)/(hh-ll)*100:50;
  }
  const d=calcEMA(k.map(v=>v??0),sk);
  return{k,d};
}
function resample(ts,O,H,L,C,V,tf){
  const fmt=t=>{const d=new Date(t*1000);
    return tf==='W'
      ?`${d.getFullYear()}-W${String(Math.ceil((d-new Date(d.getFullYear(),0,1))/604800000)).padStart(2,'0')}`
      :`${d.getFullYear()}-${d.getMonth()}`;
  };
  const map={},keys=[];
  ts.forEach((t,i)=>{
    if(C[i]==null)return;const k=fmt(t);
    if(!map[k]){map[k]={o:O[i],h:H[i],l:L[i],c:C[i],v:V[i]??0};keys.push(k);}
    else{map[k].h=Math.max(map[k].h,H[i]);map[k].l=Math.min(map[k].l,L[i]);map[k].c=C[i];map[k].v+=V[i]??0;}
  });
  return{O:keys.map(k=>map[k].o),H:keys.map(k=>map[k].h),L:keys.map(k=>map[k].l),
    C:keys.map(k=>map[k].c),V:keys.map(k=>map[k].v)};
}

async function fetchOHLC(ticker){
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=10y`;
  for(const fn of PROXIES){
    try{
      const r=await fetch(fn(url),{signal:(() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })()});
      if(!r.ok)continue;
      const j=JSON.parse(await r.text());
      const res=j?.chart?.result?.[0];if(!res)continue;
      const meta=res.meta,q=res.indicators?.quote?.[0];
      const adj=res.indicators?.adjclose?.[0]?.adjclose||q.close;
      const ratio=adj.map((a,i)=>q.close[i]&&a?a/q.close[i]:1);
      return{
        timestamps:res.timestamp,
        O:q.open.map((v,i)=>v*ratio[i]),
        H:q.high.map((v,i)=>v*ratio[i]),
        L:q.low.map((v,i)=>v*ratio[i]),
        C:adj,V:q.volume,
        name:meta.shortName||meta.longName||ticker,
        currency:meta.currency||'USD'
      };
    }catch{}
  }
  throw new Error(`No se pudo obtener datos de ${ticker}`);
}

function evaluate(raw){
  const{timestamps,O,H,L,C,V,name,currency}=raw;
  const n=C.length,di=n-1;

  // ── Diario ──
  const d_macd =calcMACD(C);
  const d_s8   =calcStoch(H,L,C,8);
  const d_s14  =calcStoch(H,L,C,14);
  const d_ema20=calcEMA(C,20);

  // ── Semanal ──
  const W  =resample(timestamps,O,H,L,C,V,'W');
  const wi =W.C.length-1;
  const w_macd=calcMACD(W.C);
  const w_s89 =calcStoch(W.H,W.L,W.C,89);
  const w_s14 =calcStoch(W.H,W.L,W.C,14);
  const w_rsi =calcRSI(W.C,14);
  const w_ema10=calcEMA(W.C,10);

  // ── Mensual ──
  const M  =resample(timestamps,O,H,L,C,V,'M');
  const mi =M.C.length-1;
  const m_macd=calcMACD(M.C);
  const m_s89 =calcStoch(M.H,M.L,M.C,89);
  const m_s14 =calcStoch(M.H,M.L,M.C,14);
  const m_s8  =calcStoch(M.H,M.L,M.C,8);
  const m_rsi =calcRSI(M.C,14);
  const m_ema10=calcEMA(M.C,10);

  const price    =C[di];
  const prevClose=C[di-1];
  const change   =price-prevClose;
  const changePct=(change/prevClose)*100;
  const stopRef  =w_ema10[wi]; // referencia de stop (por encima para cortos)
  const stopDist =stopRef!=null?((stopRef-price)/price*100).toFixed(2):null;

  // ══ CONDICIONES MENSUAL ══
  // MACD cortado a la baja < 0: macd<0 Y macd<signal
  const m_macd_ok = m_macd.m[mi]!=null && m_macd.m[mi]<0 && m_macd.m[mi]<m_macd.sl[mi];
  // Stoch(89) cortado a la baja: k<d (cruce bajista)
  const m_s89_ok  = m_s89.k[mi]!=null && m_s89.k[mi]<m_s89.d[mi]
    && (mi<1 || m_s89.k[mi-1]>=m_s89.d[mi-1] || m_s89.k[mi]<20);
  // RSI(14) < 41
  const m_rsi_ok  = m_rsi[mi]!=null && m_rsi[mi]<41;
  // Stoch(14) < 30
  const m_s14_ok  = m_s14.k[mi]!=null && m_s14.k[mi]<30;
  // Stoch(8) cortado a la baja
  const m_s8_ok   = m_s8.k[mi]!=null && m_s8.k[mi]<m_s8.d[mi]
    && (mi<1 || m_s8.k[mi-1]>=m_s8.d[mi-1] || m_s8.k[mi]<20);
  // Precio < EMA10
  const m_precio_ok = m_ema10[mi]!=null && M.C[mi]<m_ema10[mi];

  const mc={
    macd: m_macd_ok, s89: m_s89_ok, rsi14: m_rsi_ok,
    s14: m_s14_ok,   s8:  m_s8_ok,  precio: m_precio_ok,
    vals:{
      macd:m_macd.m[mi], macd_sl:m_macd.sl[mi],
      s89:m_s89.k[mi],   s89d:m_s89.d[mi],
      rsi14:m_rsi[mi],   s14:m_s14.k[mi],
      s8:m_s8.k[mi],     s8d:m_s8.d[mi],
      close:M.C[mi],     ema10:m_ema10[mi]
    }
  };
  mc.cumple=mc.macd&&mc.s89&&mc.rsi14&&mc.s14&&mc.s8&&mc.precio;

  // ══ CONDICIONES SEMANAL ══
  // MACD cortado a la baja < 0
  const w_macd_ok = w_macd.m[wi]!=null && w_macd.m[wi]<0 && w_macd.m[wi]<w_macd.sl[wi];
  // Stoch(89) cortado a la baja < 20
  const w_s89_ok  = w_s89.k[wi]!=null && w_s89.k[wi]<20 && w_s89.k[wi]<w_s89.d[wi];
  // Stoch(14) < 20
  const w_s14_ok  = w_s14.k[wi]!=null && w_s14.k[wi]<20;
  // RSI(14) < 40
  const w_rsi_ok  = w_rsi[wi]!=null && w_rsi[wi]<40;

  const sc={
    macd: w_macd_ok, s89: w_s89_ok, s14: w_s14_ok, rsi14: w_rsi_ok,
    vals:{
      macd:w_macd.m[wi], macd_sl:w_macd.sl[wi],
      s89:w_s89.k[wi],   s89d:w_s89.d[wi],
      s14:w_s14.k[wi],   rsi14:w_rsi[wi],
      close:W.C[wi],     ema10:w_ema10[wi]
    }
  };
  sc.cumple=sc.macd&&sc.s89&&sc.s14&&sc.rsi14;

  // ══ SEÑALES DE ENTRADA (Diario) ══
  // 1: Stoch(8) corta a la baja
  const s8_cross_down = di>0
    && d_s8.k[di]<d_s8.d[di]
    && d_s8.k[di-1]>=d_s8.d[di-1];
  // 2: Precio toca EMA20 + Stoch(8) corta a la baja
  const toca_ema20 = d_ema20[di]!=null
    && price<=d_ema20[di]*1.005
    && price>=d_ema20[di]*0.995;
  const señal_s8     = s8_cross_down && !toca_ema20;
  const señal_ema20  = toca_ema20 && s8_cross_down;
  const haySeñal     = señal_s8 || señal_ema20;

  // ══ SCORE /10 ══
  // 6 mensuales + 4 semanales = 10
  let score=0;
  if(mc.precio)score++; if(mc.macd)score++; if(mc.s89)score++;
  if(mc.rsi14)score++;  if(mc.s14)score++;  if(mc.s8)score++;
  if(sc.macd)score++;   if(sc.s89)score++;  if(sc.s14)score++; if(sc.rsi14)score++;

  return{
    price,prevClose,change,changePct,
    stopRef,stopDist,score,
    mc,sc,
    señal_s8,señal_ema20,haySeñal,
    d_s8_k:d_s8.k[di], d_s8_d:d_s8.d[di],
    d_ema20:d_ema20[di],
    name,currency
  };
}

// ── Helpers ─────────────────────────────────────
const fmt  = v=>v!=null&&!isNaN(v)?v.toFixed(2):'—';
const fmtP = v=>v!=null&&!isNaN(v)?v.toFixed(2):'—';

function condRow(ok,label,val,threshold){
  return `<div class="an-cond-row ${ok?'ok':'fail'}">
    <span class="an-cond-dot"></span>
    <span class="an-cond-label">${label}</span>
    <span class="an-cond-val">${val}</span>
    <span class="an-cond-thresh">${threshold}</span>
  </div>`;
}

function signal(icon,name,active,desc){
  return `<div class="an-signal-card ${active?'active':''}">
    <div class="an-signal-icon">${icon}</div>
    <div class="an-signal-name">${name}</div>
    <div class="an-signal-status">${active?'ACTIVA':'NO'}</div>
    <div class="an-signal-desc">${desc}</div>
  </div>`;
}

export async function render(container,{actionsSlot, savedState}){
  actionsSlot.innerHTML='';

  container.innerHTML=`
    <div class="an-search-row">
      <input type="text" id="baj-ticker-input" class="wl-input"
        placeholder="Ticker para análisis bajista (ej. TSLA, NVDA...)"
        style="max-width:340px;text-transform:uppercase;">
      <button class="btn btn-primary" id="baj-analyze-btn">Analizar</button>
    </div>
    <div id="an-content">
      <div class="empty">
        <div class="empty-icon">📉</div>
        <div class="empty-title">Análisis Técnico Bajista</div>
        <div class="empty-desc">Introduce un ticker para ver el score bajista, condiciones por timeframe y señales de entrada corta.</div>
      </div>
    </div>
  `;

  const contentEl=()=>document.getElementById('an-content');

  function paintAnalysis(r,ticker){
    const el=contentEl();if(!el)return;

    const scoreColor = r.score>=9?'var(--red)':r.score>=7?'var(--amber)':'var(--text3)';
    const scoreVerdict = r.score===10?'CANDIDATO ÓPTIMO':r.score>=8?'MONITOREAR':'NO CUMPLE';
    const scoreVClass  = r.score>=8?'bad':'fail'; // rojo=bueno para bajista
    const changeDir    = r.change<=0?'down':'up'; // invertido: baja = verde para bajista
    const stopDist     = r.stopDist;

    el.innerHTML=`
      <!-- PRECIO HERO -->
      <div class="an-hero">
        <div class="an-hero-card">
          <div class="an-hero-label">PRECIO ACTUAL</div>
          <div class="an-hero-value">${fmtP(r.price)}</div>
          <div class="an-hero-sub">${r.name} · ${r.currency}</div>
        </div>
        <div class="an-hero-card">
          <div class="an-hero-label">VARIACIÓN</div>
          <div class="an-hero-value ${changeDir}">${r.change>=0?'+':''}${fmtP(r.change)} (${r.changePct>=0?'+':''}${fmt(r.changePct)}%)</div>
          <div class="an-hero-sub">vs cierre anterior</div>
        </div>
        <div class="an-hero-card">
          <div class="an-hero-label">STOP REFERENCIA</div>
          <div class="an-hero-value" style="color:var(--amber)">${fmtP(r.stopRef)}</div>
          <div class="an-hero-sub">EMA10 semanal · dist. ${stopDist!=null?stopDist+'%':'—'}</div>
        </div>
      </div>

      <!-- SCORE BAR -->
      <div class="an-score-section">
        <div class="an-score-label">SCORE BAJISTA</div>
        <div class="an-score-track">
          <div class="an-score-fill" style="width:${r.score*10}%;background:linear-gradient(90deg,${scoreColor}88,${scoreColor})"></div>
          <div class="an-score-dot" style="left:${r.score*10}%;background:${scoreColor}"></div>
        </div>
        <div class="an-score-num" style="color:${scoreColor}">${r.score}/10</div>
        <div class="an-score-verdict ${scoreVClass}">${scoreVerdict}</div>
      </div>

      <!-- TIMEFRAME GRID -->
      <div class="an-tf-grid">

        <!-- MENSUAL -->
        <div class="an-tf-block">
          <div class="an-tf-header">
            <div class="an-tf-title mensual">◆ MENSUAL</div>
            <div class="an-tf-badge ${r.mc.cumple?'ok':'fail'}">${r.mc.cumple?'✓ CUMPLE':'✗ FALLO'}</div>
          </div>
          ${condRow(r.mc.precio,'Precio &lt; EMA 10',       `${fmtP(r.mc.vals.close)} / EMA ${fmtP(r.mc.vals.ema10)}`,'')}
          ${condRow(r.mc.macd,  'MACD cortado ↓ &lt; 0',   `${fmt(r.mc.vals.macd)} / sig ${fmt(r.mc.vals.macd_sl)}`, '< 0')}
          ${condRow(r.mc.s89,   'Estocástico 89 cortado ↓', `K ${fmt(r.mc.vals.s89)} / D ${fmt(r.mc.vals.s89d)}`,    'K corta ↓')}
          ${condRow(r.mc.rsi14, 'RSI 14 &lt; 41',           `${fmt(r.mc.vals.rsi14)}`,                               '< 41')}
          ${condRow(r.mc.s14,   'Estocástico 14 &lt; 30',   `K ${fmt(r.mc.vals.s14)}`,                               '< 30')}
          ${condRow(r.mc.s8,    'Estocástico 8 cortado ↓',  `K ${fmt(r.mc.vals.s8)} / D ${fmt(r.mc.vals.s8d)}`,     'K corta ↓')}
        </div>

        <!-- SEMANAL -->
        <div class="an-tf-block">
          <div class="an-tf-header">
            <div class="an-tf-title semanal">◆ SEMANAL</div>
            <div class="an-tf-badge ${r.sc.cumple?'ok':'fail'}">${r.sc.cumple?'✓ CUMPLE':'✗ FALLO'}</div>
          </div>
          ${condRow(r.sc.macd,  'MACD cortado ↓ &lt; 0',       `${fmt(r.sc.vals.macd)} / sig ${fmt(r.sc.vals.macd_sl)}`, '< 0')}
          ${condRow(r.sc.s89,   'Estocástico 89 cortado ↓ &lt; 20', `K ${fmt(r.sc.vals.s89)} / D ${fmt(r.sc.vals.s89d)}`, 'K < 20 ↓')}
          ${condRow(r.sc.s14,   'Estocástico 14 &lt; 20',       `K ${fmt(r.sc.vals.s14)}`,                               '< 20')}
          ${condRow(r.sc.rsi14, 'RSI 14 &lt; 40',               `${fmt(r.sc.vals.rsi14)}`,                               '< 40')}
          <div class="an-ema-row">EMA10 sem. ${fmtP(r.sc.vals.ema10)} · Precio ${fmtP(r.sc.vals.close)}</div>
        </div>

        <!-- DIARIO (timing) -->
        <div class="an-tf-block">
          <div class="an-tf-header">
            <div class="an-tf-title diario">◆ DIARIO (timing)</div>
            <div class="an-tf-badge ${r.haySeñal?'ok':r.mc.cumple&&r.sc.cumple?'wait':'fail'}">
              ${r.haySeñal?'✓ ENTRADA':r.mc.cumple&&r.sc.cumple?'⏳ ESPERAR':'✗ INACTIVO'}
            </div>
          </div>
          ${condRow(r.señal_s8,   'Estocástico 8 corta ↓',          r.señal_s8   ?'SÍ':'NO', '')}
          ${condRow(r.señal_ema20,'Precio toca EMA20 + Estoc.8 ↓',  r.señal_ema20?'SÍ':'NO', '')}
          <div class="an-ema-row">Estoc.8 K ${fmt(r.d_s8_k)} / D ${fmt(r.d_s8_d)} · EMA20 ${fmtP(r.d_ema20)}</div>
        </div>

        <!-- SEÑALES -->
        <div class="an-tf-block">
          <div class="an-tf-header">
            <div class="an-tf-title señales">◆ SEÑALES DE ENTRADA</div>
            <div class="an-tf-badge ${r.haySeñal?'ok':r.mc.cumple&&r.sc.cumple?'wait':'fail'}">
              ${r.haySeñal?'✓ ENTRADA ACTIVA':r.mc.cumple&&r.sc.cumple?'⏳ ESPERA':'✗ INACTIVO'}
            </div>
          </div>
          <div class="an-signals-grid">
            ${signal('📉','Estoc.8 corta ↓',            r.señal_s8,    `K ${fmt(r.d_s8_k)} / D ${fmt(r.d_s8_d)}`)}
            ${signal('🔄','Rebote EMA20 + Estoc.8 ↓',   r.señal_ema20, `EMA20: ${fmtP(r.d_ema20)}`)}
          </div>
        </div>

      </div><!-- /tf-grid -->
    `;
  }

  async function runAnalysis(ticker){
    saveModuleState('baj-analisis', { ticker });
    const el=contentEl();if(!el)return;
    el.innerHTML=`<div class="empty"><div class="loader-ring"></div><div class="empty-title">Analizando ${ticker}...</div></div>`;
    try{
      const raw=await fetchOHLC(ticker);
      const r=evaluate(raw);
      paintAnalysis(r,ticker);
    }catch(err){
      const el=contentEl();if(!el)return;
      el.innerHTML=`<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Error al analizar ${ticker}</div><div class="empty-desc">${err.message}</div></div>`;
    }
  }

  document.getElementById('baj-analyze-btn').addEventListener('click',()=>{
    const t=document.getElementById('baj-ticker-input').value.trim().toUpperCase();
    if(t)runAnalysis(t);
  });
  document.getElementById('baj-ticker-input').addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      const t=e.target.value.trim().toUpperCase();
      if(t)runAnalysis(t);
    }
  });

  // Restaurar último análisis al volver
  if(savedState?.ticker){
    document.getElementById('baj-ticker-input').value=savedState.ticker;
    runAnalysis(savedState.ticker);
  }

  return{destroy(){}};
}

// ═══════════════════════════════════════════════
// MÓDULO: Screener por Sectores
// Misma interfaz y motor que el Screener de Índices.
// Pestañas por sector SPDR con los componentes del SP500
// clasificados por sector. Escaneo independiente por pestaña.
// ═══════════════════════════════════════════════

const SECTORS_CONFIG = [
  { key: 'XLK',  label: 'Tech',        emoji: '💻' },
  { key: 'XLF',  label: 'Financials',  emoji: '🏦' },
  { key: 'XLV',  label: 'Health',      emoji: '🏥' },
  { key: 'XLE',  label: 'Energy',      emoji: '⚡' },
  { key: 'XLY',  label: 'Consumer D',  emoji: '🛍️' },
  { key: 'XLP',  label: 'Consumer S',  emoji: '🛒' },
  { key: 'XLI',  label: 'Industrials', emoji: '🏭' },
  { key: 'XLB',  label: 'Materials',   emoji: '⚗️' },
  { key: 'XLU',  label: 'Utilities',   emoji: '💡' },
  { key: 'XLRE', label: 'Real Estate', emoji: '🏢' },
  { key: 'XLC',  label: 'Comm',        emoji: '📡' },
];

const SECTOR_TICKERS = {
  XLK:  ["AAPL","MSFT","NVDA","AVGO","ORCL","CRM","AMD","QCOM","AMAT","ACN","CSCO","INTU","NOW","IBM","TXN","ADI","KLAC","LRCX","PANW","SNPS","CDNS","MCHP","FTNT","ADSK","ANSS","ANET","KEYS","GDDY","IT","EPAM","CTSH","NXPI","ON","SWKS","JNPR","HPQ","HPE","CDW","WDC","STX","NTAP","PTC","VRSN","TDY","FFIV","AKAM","TRMB","TYL","LDOS","GLW","QRVO","MPWR"],
  XLF:  ["JPM","BAC","WFC","GS","MS","BX","KKR","BLK","SCHW","C","AXP","USB","PNC","TFC","COF","ICE","CME","SPGI","MCO","BK","STT","MTB","CFG","HBAN","RF","KEY","NTRS","FITB","CMA","ZION","AFL","MET","PRU","AIG","TRV","CB","ALL","PGR","HIG","AJG","MMC","AON","WTW","BRO","CINF","RE","ACGL","FNF","FAF","SYF","DFS","GL","RJF","ALLY","EFX","NDAQ","V","MA","PYPL","FIS","FI","GPN","CBOE"],
  XLV:  ["UNH","JNJ","LLY","ABBV","MRK","TMO","ABT","DHR","PFE","BMY","ELV","CVS","CI","SYK","MDT","ISRG","GILD","BSX","VRTX","REGN","HUM","HCA","MOH","CNC","EW","IDXX","BDX","IQV","A","ZBH","WAT","RMD","HOLX","BIIB","INCY","DGX","LH","BAX","STE","HSIC","TECH","BIO","RVTY","PODD","MTD","DXCM","ALGN","DVA","UHS","MRNA"],
  XLE:  ["XOM","CVX","COP","EOG","SLB","MPC","PSX","VLO","OXY","WMB","KMI","HAL","DVN","BKR","FANG","APA","MRO","OKE","TRGP","HES","LNG","CQP","PXD","NOG","MTDR","SM","CIVI","PR","CHRD","MGY","PBF","DINO","HFC","VVV","ET","WES","MPLX","EPD","PAA"],
  XLY:  ["AMZN","TSLA","HD","MCD","NKE","LOW","BKNG","TJX","CMG","SBUX","F","GM","ORLY","AZO","ABNB","MAR","HLT","YUM","DPZ","DRI","RCL","CCL","NCLH","EL","ETSY","APTV","BWA","LKQ","KMX","RL","PVH","TPR","VFC","HAS","WHR","POOL","DHI","LEN","PHM","NVR","TOL","EXPE","ULTA","BBWI","CZR","MGM","LVS","WYNN","HGV","VAC"],
  XLP:  ["PG","KO","PEP","COST","WMT","PM","MO","MDLZ","KMB","CL","GIS","K","SJM","CAG","HRL","TSN","MKC","CPB","CHD","CLX","SFM","USFD","SYY","BG","ADM","MOS","NTR","CF","CTVA","FMC","CALM","LANC","JJSF","UTZ","SMPL","WEIS","SPTN","MGPI","IPAR"],
  XLI:  ["RTX","HON","UPS","CAT","GE","DE","BA","LMT","ETN","EMR","GD","NOC","PH","ITW","ROK","AME","IR","PCAR","OTIS","CARR","AXON","TT","XYL","GNRC","JCI","ROP","GWW","SNA","FAST","EXPD","ODFL","CSX","UNP","NSC","WAB","JBHT","FDX","CTAS","MSM","NDSN","RBC","HWM","TDG","TXT","HII","LDOS","BAH","SAIC","MANT","KBR","CHRW","XPO","GXO","SAIA","ARCB","WERN","BMI","CFX","GTLS","MWA","ESCO","DCI"],
  XLB:  ["LIN","APD","SHW","ECL","FCX","NEM","DOW","DD","LYB","PPG","NUE","STLD","VMC","MLM","CF","IP","PKG","ALB","EMN","IFF","AVY","BALL","AMCR","ATI","AA","OLN","HUN","TROX","FUL","RPM","AXTA","CBT","ASIX","BCPC","HWKN","CTVA","FMC","MOS","ADM","BG"],
  XLU:  ["NEE","DUK","SO","D","AEP","EXC","SRE","PEG","XEL","ED","EIX","AEE","LNT","WEC","ES","CMS","DTE","NI","CNP","EVRG","PNW","ATO","AWK","WTR","SJW","OGE","IDA","HE","AVA","MGEE","BKH","ARTNA","CWCO"],
  XLRE: ["PLD","AMT","CCI","EQIX","SBAC","DLR","PSA","EXR","AVB","EQR","WELL","SPG","IRM","ESS","MAA","CPT","UDR","VTR","ARE","HST","REG","O","NNN","VICI","BXP","SLG","KIM","FRT","INVH","TRNO","EGP","FR","REXR","STAG","COLD","IIPR","ADC","NTST","EPRT","NHI","HR","DOC","MPW","PEB","RHP","XHR","APLE","CLDT","MAC","SKT"],
  XLC:  ["META","GOOGL","GOOG","NFLX","CMCSA","DIS","T","VZ","CHTR","TMUS","EA","TTWO","WBD","FOX","FOXA","PARA","LYV","IPG","OMC","LU","MSG","MSGS","DISH","LUMN","FYBR","CABO","CNK","IMAX","AMC"]
};

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
  const k = 2/(p+1), out = new Array(arr.length).fill(null);
  let s = arr.findIndex(v => v != null && !isNaN(v));
  if (s < 0) return out; out[s] = arr[s];
  for (let i = s+1; i < arr.length; i++) {
    const v = (arr[i] != null && !isNaN(arr[i])) ? arr[i] : out[i-1];
    out[i] = v*k + out[i-1]*(1-k);
  }
  return out;
}
function macd(closes) {
  const ef = ema(closes,12), es = ema(closes,26);
  const m = ef.map((v,i) => (v!=null&&es[i]!=null)?v-es[i]:null);
  return { m, sl: ema(m.map(v=>v??0),9) };
}
function rsi(closes, p=14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length < p+1) return out;
  let g=0, l=0;
  for (let i=1; i<=p; i++) { const d=closes[i]-closes[i-1]; d>0?g+=d:l-=d; }
  let ag=g/p, al=l/p;
  out[p] = al===0?100:100-(100/(1+ag/al));
  for (let i=p+1; i<closes.length; i++) {
    const d=closes[i]-closes[i-1];
    ag=(ag*(p-1)+(d>0?d:0))/p; al=(al*(p-1)+(d<0?-d:0))/p;
    out[i]=al===0?100:100-(100/(1+ag/al));
  }
  return out;
}
function stoch(highs, lows, closes, p) {
  const rawK = closes.map((c,i) => {
    if (i<p-1) return null;
    const hh=Math.max(...highs.slice(i-p+1,i+1));
    const ll=Math.min(...lows.slice(i-p+1,i+1));
    return hh===ll?50:(c-ll)/(hh-ll)*100;
  });
  const k = ema(rawK,3);
  return { k, d: ema(k.map(v=>v??0),3) };
}
function resample(ts, opens, highs, lows, closes, vols, freq) {
  const groups = {};
  ts.forEach((t,i) => {
    const dd = new Date(t*1000);
    let key;
    if (freq==='W') {
      const day=dd.getDay(), diff=dd.getDate()-day+(day===0?-6:1);
      const mo=new Date(+dd); mo.setDate(diff);
      key=mo.toISOString().slice(0,10);
    } else {
      key=`${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}`;
    }
    if (!groups[key]) groups[key]={o:opens[i],h:highs[i],l:lows[i],c:closes[i],v:vols[i]};
    else { groups[key].h=Math.max(groups[key].h,highs[i]); groups[key].l=Math.min(groups[key].l,lows[i]); groups[key].c=closes[i]; groups[key].v+=vols[i]; }
  });
  const keys=Object.keys(groups).sort();
  return { dates:keys, opens:keys.map(k=>groups[k].o), highs:keys.map(k=>groups[k].h), lows:keys.map(k=>groups[k].l), closes:keys.map(k=>groups[k].c), vols:keys.map(k=>groups[k].v) };
}

function analyzeAsset(raw) {
  const {timestamps,opens,highs,lows,closes,vols}=raw;
  const n=closes.length;
  const lastVol=vols[n-1]||0;
  const avgVol11=vols.slice(-VOL_AVG_PERIODS).reduce((a,b)=>a+(b||0),0)/VOL_AVG_PERIODS;

  const W=resample(timestamps,opens,highs,lows,closes,vols,'W');
  const M=resample(timestamps,opens,highs,lows,closes,vols,'M');
  const mi=M.closes.length-1, wi=W.closes.length-1, di=n-1;

  const m_macd=macd(M.closes), m_s89=stoch(M.highs,M.lows,M.closes,89);
  const m_s8=stoch(M.highs,M.lows,M.closes,8), m_rsi=rsi(M.closes,14);
  const m_ema10=ema(M.closes,10);
  const w_macd=macd(W.closes), w_s89=stoch(W.highs,W.lows,W.closes,89);
  const w_rsi=rsi(W.closes,14), w_ema20=ema(W.closes,20);
  const d_macd=macd(closes), d_rsi=rsi(closes,14);

  const mc_ok=[
    m_macd.m[mi]>0&&m_macd.m[mi]>m_macd.sl[mi],
    (m_s89.k[mi]>80&&m_s89.k[mi]>m_s89.d[mi])||m_s89.k[mi]>92,
    m_rsi[mi]>65, m_s8.k[mi]>78,
    m_ema10[mi]&&M.closes[mi]>m_ema10[mi]
  ];
  const sc_ok=[
    w_macd.m[wi]>0&&w_macd.m[wi]>w_macd.sl[wi],
    (w_s89.k[wi]>85&&w_s89.k[wi]>w_s89.d[wi])||w_s89.k[wi]>92,
    w_rsi[wi]>67, w_ema20[wi]&&W.closes[wi]>w_ema20[wi]
  ];

  const mensualOk=mc_ok.every(x=>x), semanalOk=sc_ok.every(x=>x);
  const dailyReady=d_macd.m[di]>d_macd.sl[di]&&d_macd.m[di-1]<=d_macd.sl[di-1]&&d_rsi[di]>57&&d_macd.m[di]>0;
  const score=mc_ok.filter(x=>x).length+sc_ok.filter(x=>x).length+(dailyReady?1:0);

  let estado='watching';
  if (mensualOk&&semanalOk&&dailyReady) estado='ready';
  else if (mensualOk&&semanalOk) estado='diario';
  else if (score>=7) estado='close';

  return { score, estado, price: closes[di], lastVol, avgVol11 };
}

export async function render(container, { actionsSlot }) {
  const sectorState = {};
  SECTORS_CONFIG.forEach(cfg => {
    sectorState[cfg.key] = { results: [], scanning: false, done: 0, total: 0 };
  });
  let activeTab = 'XLK';
  let activeView = 'rotacion'; // 'rotacion' | 'componentes'
  let rotacionResults = [];
  let rotacionScanning = false;

  actionsSlot.innerHTML = '';

  // Los 11 ETFs sectoriales para la Rotación
  const ETFS_SECTORIALES = [
    { ticker: 'XLK',  name: 'Technology',       emoji: '💻' },
    { ticker: 'XLF',  name: 'Financials',        emoji: '🏦' },
    { ticker: 'XLV',  name: 'Health Care',       emoji: '🏥' },
    { ticker: 'XLE',  name: 'Energy',            emoji: '⚡' },
    { ticker: 'XLY',  name: 'Consumer Discret.', emoji: '🛍️' },
    { ticker: 'XLP',  name: 'Consumer Staples',  emoji: '🛒' },
    { ticker: 'XLI',  name: 'Industrials',       emoji: '🏭' },
    { ticker: 'XLB',  name: 'Materials',         emoji: '⚗️' },
    { ticker: 'XLU',  name: 'Utilities',         emoji: '💡' },
    { ticker: 'XLRE', name: 'Real Estate',       emoji: '🏢' },
    { ticker: 'XLC',  name: 'Communication',     emoji: '📡' },
  ];

  container.innerHTML = `
    <div class="sc2-wrap">

      <!-- Selector de vista principal -->
      <div class="sct-view-tabs">
        <button class="sct-view-tab active" data-view="rotacion">📊 Rotación Sectorial</button>
        <button class="sct-view-tab" data-view="componentes">🔍 Componentes por Sector</button>
      </div>

      <!-- VISTA 1: ROTACIÓN -->
      <div id="sct-panel-rotacion" class="sct-view-panel active">
        <div class="sc2-toolbar">
          <div style="font-size:11px;color:var(--text3);">
            Analiza los 11 ETFs sectoriales SPDR y los rankea por fuerza técnica (score /10)
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="sc2-status" id="rot-status"></span>
            <button class="sc2-btn-scan" id="rot-scan-btn">▶ Escanear Sectores</button>
          </div>
        </div>
        <div class="sc2-progress" id="rot-progress" style="display:none">
          <div class="sc2-progress-fill" id="rot-progress-fill"></div>
        </div>
        <div id="rot-results">
          <div class="sc2-empty">Pulsa Escanear para analizar los 11 ETFs sectoriales</div>
        </div>
      </div>

      <!-- VISTA 2: COMPONENTES -->
      <div id="sct-panel-componentes" class="sct-view-panel" style="display:none">
        <div class="sc2-tabs" id="sc2s-tabs">
          ${SECTORS_CONFIG.map((cfg,i) => `
            <button class="sc2-tab ${i===0?'active':''}" data-sector="${cfg.key}">
              ${cfg.emoji} ${cfg.label}
              <span class="sc2-tab-badge" id="sbadge-${cfg.key}" style="display:none"></span>
            </button>
          `).join('')}
        </div>

        ${SECTORS_CONFIG.map((cfg,i) => `
          <div class="sc2-panel ${i===0?'active':''}" id="spanel-${cfg.key}">
            <div class="sc2-toolbar">
              <div class="sc2-filters">
                <div class="sc2-filter"><label>SCORE MÍN.</label>
                  <select id="sfs-${cfg.key}" class="sc2-sel">
                    <option value="9">≥ 9</option>
                    <option value="8">≥ 8</option>
                    <option value="7" selected>≥ 7</option>
                    <option value="6">≥ 6</option>
                    <option value="5">≥ 5</option>
                    <option value="0">Todos</option>
                  </select>
                </div>
                <div class="sc2-filter"><label>VOLUMEN</label>
                  <select id="sfv-${cfg.key}" class="sc2-sel">
                    <option value="0">Cualquiera</option>
                    <option value="500000">› 500k</option>
                    <option value="990000" selected>› 990k</option>
                    <option value="2000000">› 2M</option>
                    <option value="5000000">› 5M</option>
                  </select>
                </div>
                <div class="sc2-filter"><label>ESTADO</label>
                  <select id="sfe-${cfg.key}" class="sc2-sel">
                    <option value="all">Todos</option>
                    <option value="ready">🟢 Ready</option>
                    <option value="diario">🟡 Espera diario</option>
                    <option value="close">🔵 Cerca</option>
                  </select>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:12px;">
                <span class="sc2-status" id="sst-${cfg.key}"></span>
                <button class="sc2-btn-scan" id="sbtn-${cfg.key}" data-sector="${cfg.key}">▶ Escanear</button>
              </div>
            </div>
            <div class="sc2-progress" id="sprog-${cfg.key}" style="display:none">
              <div class="sc2-progress-fill" id="sprogfill-${cfg.key}"></div>
            </div>
            <div id="sres-${cfg.key}">
              <div class="sc2-empty">Pulsa Escanear para analizar ${(SECTOR_TICKERS[cfg.key]||[]).length} valores del sector ${cfg.label}</div>
            </div>
          </div>
        `).join('')}
      </div>

    </div>
  `;

  function addToWatchlistLocal(ticker) {
    try {
      const list = JSON.parse(localStorage.getItem('ethan_watchlist_v1') || '[]');
      if (!list.includes(ticker)) {
        list.push(ticker);
        localStorage.setItem('ethan_watchlist_v1', JSON.stringify(list));
      }
      const btn = document.querySelector(`[data-wl="${ticker}"]`);
      if (btn) { btn.textContent = '✓'; btn.style.color = 'var(--green)'; btn.disabled = true; }
    } catch (e) {}
  }

  function renderTable(sectorKey) {
    const state = sectorState[sectorKey];
    const minScore = parseInt(document.getElementById(`sfs-${sectorKey}`)?.value || '7');
    const minVol   = parseInt(document.getElementById(`sfv-${sectorKey}`)?.value || '0');
    const filterEstado = document.getElementById(`sfe-${sectorKey}`)?.value || 'all';

    const filtered = state.results.filter(r => {
      if (r.score < minScore) return false;
      if (minVol > 0 && r.avgVol11 < minVol) return false;
      if (filterEstado !== 'all' && r.estado !== filterEstado) return false;
      return true;
    }).sort((a,b) => b.score - a.score);

    const el = document.getElementById(`sres-${sectorKey}`);
    if (!el) return;

    const badge = document.getElementById(`sbadge-${sectorKey}`);
    const readyCount = state.results.filter(r => r.estado === 'ready').length;
    if (badge) {
      if (state.results.length > 0) {
        badge.style.display = 'inline';
        badge.textContent = readyCount > 0 ? readyCount : state.results.length;
        badge.style.background = readyCount > 0 ? 'var(--green)' : 'var(--text3)';
      } else { badge.style.display = 'none'; }
    }

    if (filtered.length === 0) {
      el.innerHTML = `<div class="sc2-empty">${state.results.length > 0 ? 'Ningún valor cumple los filtros' : 'Sin datos — pulsa Escanear'}</div>`;
      return;
    }

    const estadoLabel = { ready:'🟢 LISTO', diario:'⏳ ESPERA DIARIO', close:'🔶 CERCA', watching:'👁 VIGILANDO' };
    const scoreColor  = s => s >= 9 ? 'var(--green)' : s >= 7 ? 'var(--amber)' : 'var(--text3)';

    el.innerHTML = `
      <table class="sc2-table">
        <thead>
          <tr><th>TICKER</th><th>SCORE</th><th>ESTADO</th><th>PRECIO</th><th>VOL MEDIA 11s</th><th></th></tr>
        </thead>
        <tbody>
          ${filtered.map(r => `
            <tr>
              <td class="sc2-ticker">${r.ticker}</td>
              <td class="sc2-score" style="color:${scoreColor(r.score)}">${r.score}/10</td>
              <td style="color:${r.estado==='ready'?'var(--green)':r.estado==='diario'?'var(--amber)':'var(--text3)'}">${estadoLabel[r.estado]||'—'}</td>
              <td class="sc2-price">${r.price ? r.price.toFixed(2) : '—'}</td>
              <td class="sc2-vol">${r.avgVol11 >= 1e6 ? (r.avgVol11/1e6).toFixed(1)+'M' : Math.round(r.avgVol11/1e3)+'k'}</td>
              <td><button class="sc2-wl-btn" data-wl="${r.ticker}">+ WL</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    el.querySelectorAll('.sc2-wl-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        addToWatchlistLocal(btn.dataset.wl);
      });
    });
  }

  async function startScan(sectorKey) {
    const state = sectorState[sectorKey];
    if (state.scanning) return;

    state.scanning = true;
    state.results = [];

    const tickers = SECTOR_TICKERS[sectorKey] || [];
    state.total = tickers.length;

    const btn  = document.getElementById(`sbtn-${sectorKey}`);
    const st   = document.getElementById(`sst-${sectorKey}`);
    const prog = document.getElementById(`sprog-${sectorKey}`);
    const fill = document.getElementById(`sprogfill-${sectorKey}`);

    if (btn)  { btn.disabled = true; btn.textContent = '⏳ Escaneando...'; }
    if (prog) prog.style.display = 'block';
    if (fill) fill.style.width = '0%';

    const BATCH = 8;
    let done = 0;
    for (let i = 0; i < tickers.length; i += BATCH) {
      const batch = tickers.slice(i, i + BATCH);
      const batchRes = await Promise.all(batch.map(async ticker => {
        try {
          const raw = await fetchOHLC(ticker);
          const result = analyzeAsset(raw);
          result.ticker = ticker;
          return result;
        } catch { return null; }
      }));

      batchRes.forEach(r => { if (r) state.results.push(r); });
      done += batch.length;

      const pct = (done / state.total * 100).toFixed(1);
      if (fill) fill.style.width = pct + '%';
      if (st)   st.textContent = `${tickers[Math.min(i+BATCH-1, tickers.length-1)]} (${done}/${state.total})`;

      if (activeTab === sectorKey) renderTable(sectorKey);
      await new Promise(r => setTimeout(r, 250));
    }

    state.scanning = false;
    if (btn)  { btn.disabled = false; btn.textContent = '↻ Re-escanear'; }
    if (prog) prog.style.display = 'none';
    if (st)   st.textContent = `${state.results.length} valores · ${state.results.filter(r=>r.estado==='ready').length} listos`;
    renderTable(sectorKey);
  }

  // ── Rotación Sectorial ──────────────────────
  function renderRotacion() {
    const el = document.getElementById('rot-results');
    if (!el) return;
    if (rotacionResults.length === 0) {
      el.innerHTML = `<div class="sc2-empty">Pulsa Escanear para analizar los 11 ETFs sectoriales</div>`;
      return;
    }
    const sorted = [...rotacionResults].sort((a,b) => b.score - a.score);
    const scoreColor = s => s >= 9 ? 'var(--green)' : s >= 7 ? 'var(--amber)' : s >= 5 ? 'var(--blue)' : 'var(--text3)';
    const estadoLabel = { ready:'🟢 LISTO', diario:'⏳ ESPERA DIARIO', close:'🔶 CERCA', watching:'👁 VIGILANDO' };
    const estadoColor = e => e==='ready'?'var(--green)':e==='diario'?'var(--amber)':'var(--text3)';

    el.innerHTML = `
      <div class="sct-rotation-grid">
        ${sorted.map((r, i) => {
          const etf = ETFS_SECTORIALES.find(e => e.ticker === r.ticker) || {};
          const barPct = (r.score / 10 * 100).toFixed(0);
          const rankColor = i === 0 ? 'var(--green)' : i <= 2 ? 'var(--amber)' : 'var(--text3)';
          return `
            <div class="sct-rot-card ${r.estado === 'ready' ? 'rot-ready' : ''}">
              <div class="sct-rot-rank" style="color:${rankColor}">#${i+1}</div>
              <div class="sct-rot-main">
                <div class="sct-rot-header">
                  <span class="sct-rot-emoji">${etf.emoji || ''}</span>
                  <div>
                    <div class="sct-rot-ticker">${r.ticker}</div>
                    <div class="sct-rot-name">${etf.name || ''}</div>
                  </div>
                  <div class="sct-rot-score" style="color:${scoreColor(r.score)}">${r.score}<span style="font-size:11px;font-style:normal;color:var(--text3);font-family:var(--mono)">/10</span></div>
                </div>
                <div class="sct-rot-bar-wrap">
                  <div class="sct-rot-bar-fill" style="width:${barPct}%;background:${scoreColor(r.score)}"></div>
                </div>
                <div class="sct-rot-footer">
                  <span style="color:${estadoColor(r.estado)};font-size:10px;font-weight:600">${estadoLabel[r.estado]||'—'}</span>
                  <span class="sct-rot-price">${r.price ? '$'+r.price.toFixed(2) : '—'}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  async function startRotacionScan() {
    if (rotacionScanning) return;
    rotacionScanning = true;
    rotacionResults = [];

    const btn  = document.getElementById('rot-scan-btn');
    const st   = document.getElementById('rot-status');
    const prog = document.getElementById('rot-progress');
    const fill = document.getElementById('rot-progress-fill');

    if (btn)  { btn.disabled = true; btn.textContent = '⏳ Escaneando...'; }
    if (prog) prog.style.display = 'block';
    if (fill) fill.style.width = '0%';

    // 11 ETFs en paralelo — son pocos, no hay riesgo de saturar proxies
    const results = await Promise.all(ETFS_SECTORIALES.map(async (etf, i) => {
      try {
        const raw = await fetchOHLC(etf.ticker);
        const result = analyzeAsset(raw);
        result.ticker = etf.ticker;
        if (fill) fill.style.width = `${((i+1)/ETFS_SECTORIALES.length*100).toFixed(0)}%`;
        if (st)   st.textContent = `${etf.ticker} (${i+1}/${ETFS_SECTORIALES.length})`;
        return result;
      } catch { return null; }
    }));

    rotacionResults = results.filter(Boolean);
    rotacionScanning = false;
    if (btn)  { btn.disabled = false; btn.textContent = '↻ Re-escanear'; }
    if (prog) prog.style.display = 'none';
    if (st)   st.textContent = `${rotacionResults.length} sectores analizados`;
    renderRotacion();
  }

  // ── Listeners vista principal ───────────────
  container.querySelectorAll('.sct-view-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      container.querySelectorAll('.sct-view-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('sct-panel-rotacion').style.display   = view === 'rotacion'    ? 'block' : 'none';
      document.getElementById('sct-panel-componentes').style.display = view === 'componentes' ? 'block' : 'none';
    });
  });

  document.getElementById('rot-scan-btn')?.addEventListener('click', startRotacionScan);

  container.querySelectorAll('.sc2-tab[data-sector]').forEach(tab => {
    tab.addEventListener('click', () => {
      const key = tab.dataset.sector;
      activeTab = key;
      container.querySelectorAll('.sc2-tab[data-sector]').forEach(t => t.classList.remove('active'));
      container.querySelectorAll('.sc2-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`spanel-${key}`)?.classList.add('active');
      renderTable(key);
    });
  });

  container.querySelectorAll('.sc2-btn-scan[data-sector]').forEach(btn => {
    btn.addEventListener('click', () => startScan(btn.dataset.sector));
  });

  SECTORS_CONFIG.forEach(cfg => {
    [`sfs-${cfg.key}`,`sfv-${cfg.key}`,`sfe-${cfg.key}`].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => renderTable(cfg.key));
    });
  });

  return { destroy() {} };
}

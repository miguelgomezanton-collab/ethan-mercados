// ═══════════════════════════════════════════════
// MÓDULO: Screener Alcista
// SP500 + NASDAQ 100 + NYSE principales
// Filtro de volumen en fase 1 (>990k y media 11 sesiones >990k)
// Análisis técnico completo solo a los que pasan el filtro
// Motor: MACD(12,26,9) + Stoch(89,3,3) + RSI(14) + EMA
// ═══════════════════════════════════════════════

// ── Universos ──────────────────────────────────
const INDICES = {
  SP500: ["MMM","AOS","ABT","ABBV","ACN","ADBE","AMD","AES","AFL","A","APD","ABNB","AKAM","ALB","ARE","ALGN","ALLE","LNT","ALL","GOOGL","GOOG","MO","AMZN","AMCR","AEE","AAL","AEP","AXP","AIG","AMT","AWK","AMP","AME","AMGN","APH","ADI","ANSS","AON","APA","AAPL","AMAT","APTV","ACGL","ADM","ANET","AJG","AIZ","T","ATO","ADSK","ADP","AZO","AVB","AVY","AXON","BKR","BALL","BAC","BBWI","BAX","BDX","BRK-B","BBY","TECH","BIIB","BIO","BLK","BX","BK","BA","BKNG","BWA","BSX","BMY","AVGO","BR","BRO","BF-B","BG","CHRW","CDNS","CZR","CPT","CPB","COF","CAH","KMX","CCL","CARR","CTLT","CAT","CBOE","CBRE","CDW","CE","COR","CNC","CNP","CF","CHTR","CVX","CMG","CB","CHD","CI","CINF","CTAS","CSCO","C","CFG","CLX","CME","CMS","KO","CTSH","CL","CMCSA","CMA","CAG","COP","ED","STZ","CEG","COO","CPRT","GLW","CPAY","CTVA","CSGP","COST","CTRA","CRWD","CCI","CSX","CMI","CVS","DHR","DRI","DVA","DAY","DECK","DE","DELL","DAL","DVN","DXCM","FANG","DLR","DFS","DG","DLTR","D","DPZ","DOV","DOW","DHI","DTE","DUK","DD","EMN","ETN","EBAY","ECL","EIX","EW","EA","ELV","EMR","ENPH","ETR","EOG","EPAM","EQT","EFX","EQIX","EQR","ESS","EL","ETSY","EG","EVRG","ES","EXC","EXPE","EXPD","EXR","XOM","FFIV","FDS","FICO","FAST","FRT","FDX","FITB","FSLR","FE","FIS","FI","FLT","FMC","F","FTNT","FTV","FOXA","FOX","BEN","FCX","GRMN","IT","GE","GEHC","GEN","GD","GIS","GM","GPC","GILD","GPN","GL","GDDY","GS","HAL","HIG","HAS","HCA","DOC","HSIC","HSY","HES","HPE","HLT","HOLX","HD","HON","HRL","HST","HWM","HPQ","HUBB","HUM","HBAN","HII","IBM","IEX","IDXX","ITW","INCY","IR","PODD","INTC","ICE","IFF","IP","IPG","INTU","ISRG","IVZ","INVH","IQV","IRM","JBHT","JBL","JKHY","J","JNJ","JCI","JPM","JNPR","K","KVUE","KDP","KEY","KEYS","KMB","KIM","KMI","KKR","KLAC","KHC","KR","LHX","LH","LRCX","LW","LVS","LDOS","LEN","LIN","LYV","LKQ","LMT","L","LOW","LULU","LYB","MTB","MRO","MPC","MKTX","MAR","MMC","MLM","MAS","MA","MTCH","MKC","MCD","MCK","MDT","MRK","META","MET","MTD","MGM","MCHP","MU","MSFT","MAA","MRNA","MHK","MOH","TAP","MDLZ","MPWR","MNST","MCO","MS","MOS","MSI","MSCI","NDAQ","NTAP","NFLX","NEM","NWSA","NWS","NEE","NKE","NI","NDSN","NSC","NTRS","NOC","NCLH","NRG","NUE","NVDA","NVR","NXPI","ORLY","OXY","ODFL","OMC","ON","OKE","ORCL","OTIS","PCAR","PKG","PANW","PARA","PH","PAYX","PAYC","PYPL","PNR","PEP","PFE","PCG","PM","PSX","PNW","PNC","POOL","PPG","PPL","PFG","PG","PGR","PLD","PRU","PEG","PTC","PSA","PHM","QRVO","PWR","QCOM","DGX","RL","RJF","RTX","O","REG","REGN","RF","RSG","RMD","RVTY","ROK","ROL","ROP","ROST","RCL","SPGI","CRM","SBAC","SLB","STX","SRE","NOW","SHW","SPG","SWKS","SJM","SW","SNA","SOLV","SO","LUV","SWK","SBUX","STT","STLD","STE","SYK","SMCI","SYF","SNPS","SYY","TMUS","TROW","TTWO","TPR","TRGP","TGT","TEL","TDY","TFX","TER","TSLA","TXN","TXT","TMO","TJX","TSCO","TT","TDG","TRV","TRMB","TFC","TYL","TSN","USB","UBER","UDR","ULTA","UNP","UAL","UPS","URI","UNH","UHS","VLO","VTR","VRSN","VRSK","VZ","VRTX","VLTO","VFC","VTRS","VICI","V","VST","VMC","WRB","GWW","WAB","WBA","WMT","DIS","WBD","WM","WAT","WEC","WFC","WELL","WST","WDC","WY","WMB","WTW","WYNN","XEL","XYL","YUM","ZBRA","ZBH","ZTS"],

  NDX100: ["AAPL","MSFT","NVDA","AMZN","META","GOOGL","GOOG","TSLA","AVGO","COST","NFLX","TMUS","CSCO","AMD","ADBE","PEP","INTU","TXN","QCOM","ISRG","CMCSA","BKNG","AMAT","REGN","MU","PANW","LRCX","VRTX","KLAC","ADI","MRVL","ABNB","CDNS","SNPS","CRWD","CEG","MELI","ORLY","CTAS","MAR","FTNT","PCAR","PAYX","DASH","WDAY","ROST","AZO","ODFL","CPRT","FANG","FAST","KHC","BIIB","ON","DDOG","IDXX","TEAM","SIRI","EXC","MNST","DLTR","GEHC","MRNA","NXPI","WBD","SPLK","SBUX","VRSK","SMCI","ROP","TTWO","ALGN","WBA","DXCM","ANSS","GFS","ILMN","MDB","LCID","ZS","ENPH","OKTA","RIVN","SNOW","TTD","VRSN","CHTR","MTCH","ASML","SGEN","PYPL","BMRN","CTSH","GILD","LULU","ADSK","EA","EBAY","AEP","TSCO"],

  NYSE: ["JPM","BAC","WFC","C","GS","MS","AXP","BX","KKR","BLK","USB","PNC","TFC","COF","SCHW","ICE","CME","SPGI","MCO","BK","STT","MTB","CFG","HBAN","RF","KEY","NTRS","FITB","FIS","FI","PYPL","V","MA","ACN","IBM","ORCL","SAP","HPQ","HPE","CDW","DELL","WDC","STX","NCR","DXC","UNH","CVS","ELV","CI","HUM","MOH","CNC","HCA","DGX","LH","SYK","MDT","BSX","ABT","BDX","DHR","TMO","A","WAT","IQV","ZBH","BAX","HRC","JNJ","PFE","MRK","LLY","BMY","ABBV","AMGN","GILD","REGN","BIIB","VRTX","MRNA","XOM","CVX","COP","OXY","DVN","HAL","SLB","BKR","MPC","VLO","PSX","EOG","FANG","PXD","APA","MRO","KMI","WMB","OKE","TRGP","LIN","APD","ECL","DOW","DD","LYB","PPG","SHW","NEM","FCX","NUE","STLD","AA","CF","MLM","VMC","IP","PKG","SEE","AVY","BALL","AMCR","UPS","FDX","GE","HON","RTX","LMT","NOC","GD","BA","CAT","DE","EMR","ETN","PH","ITW","ROK","AME","IR","PCAR","OTIS","CARR","AXON","TT","XYL","GNRC","JCI","ROP","CTAS","FAST","EXPD","ODFL","CSX","UNP","NSC","WAB","JBHT","RCL","CCL","MAR","HLT","WH","H","CHH","MGM","LVS","WYNN","CZR","DRI","YUM","MCD","SBUX","CMG","DPZ","EL","NKE","PVH","RL","HBI","TPR","VFC","LEVI","KMX","AZO","ORLY","AUTO","APTV","BWA","LKQ","WHR","HD","LOW","WSM","RH","POOL","DHI","LEN","PHM","NVR","TOL","MHO","KBH","MDC","CCS","WY","PLD","AMT","CCI","SBAC","EQIX","DLR","EXR","PSA","AVB","EQR","ESS","MAA","CPT","UDR","WELL","VTR","HST","REG","O","NNN","WPC","SRC","VICI","GLPI","MPW","BXP","SLG","KIM","FRT","SPG","MAC","CBL","PEI","SKT","PINE","ADC","NTST","EPRT","STAG","EGP","TRNO","FR","RexFord","REXR","IIPR","COLD","PEB","SHO","CHSP","RHP","IRM","COR","UHS","THC","HCA","ENSG","AMED","HCSG","CHE","ADUS","EHTH","PFG","AFL","MET","PRU","GL","CNO","FNF","FAF","BHF","AIG","TRV","CB","ALL","PGR","MKL","RLI","HIG","AJG","MMC","AON","WTW","BRO","ERIE","CINF","THG","RNR","AWH","RE","EG","ACGL","AIZ","RGA","FG","FNB","GBCI","PPBI","CVBF","WAFD","HOMB","BANR","NBT","CATY","CVLY","ONB","NBTB","HFWA","STBA","FBIZ","SFNC","BSVN","GWW","MSM","FAST","NDSN","RBC","SNA","KMT","WMS","RXN","BMI","CFX","GTLS","MWA","ESCO","DCI","TRMK","HI","ESE","FELE","LYTS","ASGN","KFRC","TBI","HSII","MPS","KELYA","NARA","SFM","USFD","SYY","US","PFGC","CHEF","BJ","COST","WMT","KR","ACI","WEIS","INGR","BG","ADM","MOS","NTR","CF","CTVA","FMC","TVA","AWK","WTR","MSEX","CWCO","ARTNA","YORW","GWRS","SJW","MGEE","UTRS"]
};

const SECTOR_MAP = {
  'A':'XLV','AAPL':'XLK','ABBV':'XLV','ABNB':'XLY','ABT':'XLV','ACN':'XLK','ADBE':'XLK','ADI':'XLK','ADP':'XLI','ADSK':'XLK','AEE':'XLU','AEP':'XLU','AFL':'XLF','AIG':'XLF','AJG':'XLF','AKAM':'XLK','ALB':'XLB','ALGN':'XLV','ALL':'XLF','ALLE':'XLI','AMAT':'XLK','AMCR':'XLB','AMD':'XLK','AME':'XLI','AMGN':'XLV','AMP':'XLF','AMT':'XLRE','AMZN':'XLY','ANSS':'XLK','AON':'XLF','AOS':'XLI','APA':'XLE','APD':'XLB','APH':'XLK','ARE':'XLRE','ATO':'XLU','AVB':'XLRE','AVGO':'XLK','AVY':'XLB','AWK':'XLU','AXON':'XLI','AXP':'XLF','AZO':'XLY','BA':'XLI','BAC':'XLF','BALL':'XLB','BAX':'XLV','BBY':'XLY','BDX':'XLV','BEN':'XLF','BG':'XLP','BIO':'XLV','BK':'XLF','BKNG':'XLY','BKR':'XLE','BLK':'XLF','BMY':'XLV','BR':'XLI','BSX':'XLV','BWA':'XLY','C':'XLF','CAG':'XLP','CAH':'XLV','CARR':'XLI','CAT':'XLI','CB':'XLF','CBOE':'XLF','CBRE':'XLRE','CCI':'XLRE','CCL':'XLY','CDNS':'XLK','CE':'XLB','CEG':'XLU','CF':'XLB','CFG':'XLF','CHD':'XLP','CHRW':'XLI','CHTR':'XLC','CI':'XLV','CINF':'XLF','CL':'XLP','CLX':'XLP','CMA':'XLF','CMCSA':'XLC','CME':'XLF','CMG':'XLY','CMI':'XLI','CMS':'XLU','CNC':'XLV','CNP':'XLU','COF':'XLF','COP':'XLE','COR':'XLV','COST':'XLP','CPB':'XLP','CPRT':'XLI','CPT':'XLRE','CRM':'XLK','CSCO':'XLK','CSX':'XLI','CTRA':'XLE','CTSH':'XLK','CTVA':'XLB','CVS':'XLV','CVX':'XLE','CZR':'XLY','D':'XLU','DD':'XLB','DE':'XLI','DFS':'XLF','DG':'XLP','DGX':'XLV','DHI':'XLY','DHR':'XLV','DIS':'XLC','DLR':'XLRE','DLTR':'XLP','DOC':'XLRE','DOV':'XLI','DOW':'XLB','DPZ':'XLY','DRI':'XLY','DTE':'XLU','DUK':'XLU','DVA':'XLV','DVN':'XLE','DXCM':'XLV','EA':'XLC','EBAY':'XLY','ECL':'XLB','ED':'XLU','EFX':'XLF','EIX':'XLU','ELV':'XLV','EMN':'XLB','EMR':'XLI','ENPH':'XLK','EOG':'XLE','EQIX':'XLRE','EQR':'XLRE','EQT':'XLE','ES':'XLU','ESS':'XLRE','ETN':'XLI','ETSY':'XLY','EVRG':'XLU','EW':'XLV','EXC':'XLU','EXPD':'XLI','EXPE':'XLY','EXR':'XLRE','F':'XLY','FANG':'XLE','FAST':'XLI','FCX':'XLB','FDS':'XLF','FDX':'XLI','FE':'XLU','FFIV':'XLK','FICO':'XLK','FIS':'XLF','FITB':'XLF','FMC':'XLB','FOX':'XLC','FOXA':'XLC','FRT':'XLRE','FTNT':'XLK','FTV':'XLI','GD':'XLI','GDDY':'XLK','GE':'XLI','GILD':'XLV','GIS':'XLP','GLW':'XLK','GM':'XLY','GOOG':'XLC','GOOGL':'XLC','GPC':'XLY','GRMN':'XLY','GS':'XLF','HAL':'XLE','HBAN':'XLF','HCA':'XLV','HD':'XLY','HES':'XLE','HIG':'XLF','HLT':'XLY','HOLX':'XLV','HON':'XLI','HPQ':'XLK','HRL':'XLP','HSIC':'XLV','HST':'XLRE','HSY':'XLP','HUBB':'XLI','HUM':'XLV','HWM':'XLI','ICE':'XLF','IDXX':'XLV','IEX':'XLI','IFF':'XLB','INTC':'XLK','INTU':'XLK','INVH':'XLRE','IP':'XLB','IPG':'XLC','IQV':'XLV','IR':'XLI','ISRG':'XLV','IT':'XLK','ITW':'XLI','IVZ':'XLF','J':'XLI','JBHT':'XLI','JNJ':'XLV','JPM':'XLF','K':'XLP','KDP':'XLP','KEY':'XLF','KEYS':'XLK','KIM':'XLRE','KLAC':'XLK','KMB':'XLP','KMI':'XLE','KMX':'XLY','KO':'XLP','KR':'XLP','L':'XLF','LDOS':'XLI','LEN':'XLY','LH':'XLV','LHX':'XLI','LIN':'XLB','LKQ':'XLY','LMT':'XLI','LNT':'XLU','LOW':'XLY','LRCX':'XLK','LVS':'XLY','LW':'XLP','LYV':'XLC','LYB':'XLB','MA':'XLF','MAA':'XLRE','MAR':'XLY','MAS':'XLI','MCD':'XLY','MCHP':'XLK','MCK':'XLV','MCO':'XLF','MDLZ':'XLP','MDT':'XLV','MET':'XLF','META':'XLC','MGM':'XLY','MKC':'XLP','MLM':'XLB','MMC':'XLF','MMM':'XLI','MNST':'XLP','MO':'XLP','MOH':'XLV','MPC':'XLE','MPWR':'XLK','MRK':'XLV','MRO':'XLE','MS':'XLF','MSCI':'XLF','MSFT':'XLK','MTB':'XLF','MTD':'XLV','NDAQ':'XLF','NDSN':'XLI','NEE':'XLU','NEM':'XLB','NFLX':'XLC','NI':'XLU','NKE':'XLY','NOC':'XLI','NOW':'XLK','NSC':'XLI','NTAP':'XLK','NTRS':'XLF','NUE':'XLB','NVDA':'XLK','NWSA':'XLC','NXPI':'XLK','O':'XLRE','ODFL':'XLI','OKE':'XLE','OMC':'XLC','ON':'XLK','ORLY':'XLY','OTIS':'XLI','OXY':'XLE','PANW':'XLK','PARA':'XLC','PAYC':'XLK','PAYX':'XLI','PCAR':'XLI','PEG':'XLU','PEP':'XLP','PFE':'XLV','PG':'XLP','PGR':'XLF','PH':'XLI','PHM':'XLY','PKG':'XLB','PLD':'XLRE','PM':'XLP','PNC':'XLF','PNW':'XLU','PPG':'XLB','PPL':'XLU','PRU':'XLF','PSA':'XLRE','PSX':'XLE','PTC':'XLK','PWR':'XLI','PYPL':'XLF','QCOM':'XLK','RCL':'XLY','REG':'XLRE','REGN':'XLV','RF':'XLF','RL':'XLY','RMD':'XLV','ROK':'XLI','ROL':'XLI','ROP':'XLK','ROST':'XLY','RSG':'XLI','RTX':'XLI','SBUX':'XLY','SFM':'XLP','SHW':'XLB','SJM':'XLP','SLB':'XLE','SNA':'XLI','SNPS':'XLK','SO':'XLU','SPG':'XLRE','SPGI':'XLF','SRE':'XLU','STE':'XLV','STT':'XLF','STX':'XLK','STZ':'XLP','SWK':'XLI','SWKS':'XLK','SYF':'XLF','SYK':'XLV','SYY':'XLP','T':'XLC','TAP':'XLP','TDG':'XLI','TDY':'XLK','TER':'XLK','TFC':'XLF','TFX':'XLV','TJX':'XLY','TMO':'XLV','TMUS':'XLC','TPR':'XLY','TRGP':'XLE','TROW':'XLF','TRV':'XLF','TSCO':'XLP','TSLA':'XLY','TSN':'XLP','TTWO':'XLC','TXN':'XLK','TYL':'XLK','UDR':'XLRE','UHS':'XLV','ULTA':'XLY','UNH':'XLV','UNP':'XLI','UPS':'XLI','URI':'XLI','USB':'XLF','V':'XLF','VICI':'XLRE','VLO':'XLE','VMC':'XLB','VRSK':'XLI','VRSN':'XLK','VRTX':'XLV','VTR':'XLRE','VTRS':'XLV','VZ':'XLC','WAB':'XLI','WAT':'XLV','WBD':'XLC','WDC':'XLK','WEC':'XLU','WELL':'XLRE','WFC':'XLF','WM':'XLI','WMB':'XLE','WMT':'XLP','WRB':'XLF','WST':'XLV','WTW':'XLF','WYNN':'XLY','XEL':'XLU','XOM':'XLE','XYL':'XLI','YUM':'XLY','ZBRA':'XLK','ZBH':'XLV','ZTS':'XLV'
};

const SECTOR_NAMES = {
  'XLK':'Tech','XLF':'Financials','XLV':'Health','XLE':'Energy',
  'XLY':'Consumer D','XLP':'Consumer S','XLI':'Industrials',
  'XLB':'Materials','XLU':'Utilities','XLRE':'Real Estate','XLC':'Comm'
};

const VOL_THRESHOLD = 990000;
const VOL_AVG_PERIODS = 11;

// ── Proxies CORS ───────────────────────────────
const PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  u => `https://soft-field-156f.miguel-gomez-anton.workers.dev/?url=${encodeURIComponent(u)}`
];

async function fetchWithProxy(url) {
  for (const fn of PROXIES) {
    try {
      const r = await fetch(fn(url), { signal: AbortSignal.timeout(7000) });
      if (!r.ok) continue;
      const text = await r.text();
      try { return JSON.parse(text); } catch { continue; }
    } catch (e) {}
  }
  throw new Error('Sin proxy disponible');
}

// ── Fase 1: volumen rápido (lotes de 10 tickers) ──
async function fetchVolumesBatch(tickers) {
  const symbols = tickers.join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=regularMarketVolume,averageDailyVolume10Day,symbol`;
  const data = await fetchWithProxy(url);
  const results = data?.quoteResponse?.result || [];
  return results.reduce((acc, q) => {
    acc[q.symbol] = {
      vol: q.regularMarketVolume || 0,
      avgVol: q.averageDailyVolume10Day || 0
    };
    return acc;
  }, {});
}

// ── Motor técnico (idéntico al original) ──
function ema(arr, p) {
  const k = 2/(p+1), out = new Array(arr.length).fill(null);
  let s = arr.findIndex(v => v != null && !isNaN(v));
  if (s < 0) return out;
  out[s] = arr[s];
  for (let i = s+1; i < arr.length; i++) {
    const v = (arr[i] != null && !isNaN(arr[i])) ? arr[i] : out[i-1];
    out[i] = v*k + out[i-1]*(1-k);
  }
  return out;
}
function macd(closes) {
  const ef = ema(closes,12), es = ema(closes,26);
  const m = ef.map((v,i) => (v!=null && es[i]!=null) ? v-es[i] : null);
  const sl = ema(m.map(v => v??0), 9);
  return { m, sl };
}
function rsi(closes, p=14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length < p+1) return out;
  let g=0, l=0;
  for (let i=1; i<=p; i++) { const d=closes[i]-closes[i-1]; d>0?g+=d:l-=d; }
  let ag=g/p, al=l/p;
  out[p] = al===0 ? 100 : 100-(100/(1+ag/al));
  for (let i=p+1; i<closes.length; i++) {
    const d = closes[i]-closes[i-1];
    ag = (ag*(p-1)+(d>0?d:0))/p;
    al = (al*(p-1)+(d<0?-d:0))/p;
    out[i] = al===0 ? 100 : 100-(100/(1+ag/al));
  }
  return out;
}
function stoch(highs, lows, closes, p) {
  const rawK = closes.map((c,i) => {
    if (i<p-1) return null;
    const hh = Math.max(...highs.slice(i-p+1,i+1));
    const ll = Math.min(...lows.slice(i-p+1,i+1));
    return hh===ll ? 50 : (c-ll)/(hh-ll)*100;
  });
  const k = ema(rawK,3);
  const d = ema(k.map(v=>v??0),3);
  return { k, d };
}
function resample(ts, opens, highs, lows, closes, vols, freq) {
  const groups = {};
  ts.forEach((t,i) => {
    const dd = new Date(t*1000);
    let key;
    if (freq==='W') {
      const day = dd.getDay();
      const diff = dd.getDate() - day + (day===0?-6:1);
      const mo = new Date(+dd); mo.setDate(diff);
      key = mo.toISOString().slice(0,10);
    } else {
      key = `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}`;
    }
    if (!groups[key]) {
      groups[key] = { o:opens[i], h:highs[i], l:lows[i], c:closes[i], v:vols[i] };
    } else {
      groups[key].h = Math.max(groups[key].h, highs[i]);
      groups[key].l = Math.min(groups[key].l, lows[i]);
      groups[key].c = closes[i];
      groups[key].v += vols[i];
    }
  });
  const keys = Object.keys(groups).sort();
  return {
    dates: keys,
    opens: keys.map(k=>groups[k].o), highs: keys.map(k=>groups[k].h),
    lows: keys.map(k=>groups[k].l), closes: keys.map(k=>groups[k].c), vols: keys.map(k=>groups[k].v)
  };
}

async function fetchOHLC(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y&events=history`;
  const j = await fetchWithProxy(url);
  const res = j?.chart?.result?.[0];
  if (!res) throw new Error('Sin datos');
  const q = res.indicators?.quote?.[0];
  const adj = res.indicators?.adjclose?.[0]?.adjclose || q.close;
  const ratio = adj.map((a,i) => (q.close[i] && a) ? a/q.close[i] : 1);
  return {
    timestamps: res.timestamp,
    opens: q.open.map((v,i) => v*ratio[i]),
    highs: q.high.map((v,i) => v*ratio[i]),
    lows: q.low.map((v,i) => v*ratio[i]),
    closes: adj,
    vols: q.volume
  };
}

function analyzeAsset(raw) {
  const { timestamps, opens, highs, lows, closes, vols } = raw;
  const n = closes.length;

  // Filtro de volumen: último día > 990k Y media 11 sesiones > 990k
  const lastVol = vols[n-1];
  const avgVol11 = vols.slice(-VOL_AVG_PERIODS).reduce((a,b) => a+(b||0), 0) / VOL_AVG_PERIODS;
  if (lastVol < VOL_THRESHOLD || avgVol11 < VOL_THRESHOLD) return null; // no pasa el filtro

  const W = resample(timestamps, opens, highs, lows, closes, vols, 'W');
  const M = resample(timestamps, opens, highs, lows, closes, vols, 'M');

  const m_macd = macd(M.closes);
  const m_s89 = stoch(M.highs, M.lows, M.closes, 89);
  const m_s8  = stoch(M.highs, M.lows, M.closes, 8);
  const m_rsi = rsi(M.closes, 14);
  const m_ema10 = ema(M.closes, 10);
  const mi = M.closes.length - 1;

  const w_macd = macd(W.closes);
  const w_s89 = stoch(W.highs, W.lows, W.closes, 89);
  const w_rsi = rsi(W.closes, 14);
  const w_ema20 = ema(W.closes, 20);
  const wi = W.closes.length - 1;

  const d_macd = macd(closes);
  const d_rsi = rsi(closes, 14);
  const di = n - 1;

  const mc_ok = [
    m_macd.m[mi] > 0 && m_macd.m[mi] > m_macd.sl[mi],
    (m_s89.k[mi] > 80 && m_s89.k[mi] > m_s89.d[mi]) || m_s89.k[mi] > 92,
    m_rsi[mi] > 65,
    m_s8.k[mi] > 78,
    m_ema10[mi] && M.closes[mi] > m_ema10[mi]
  ];
  const sc_ok = [
    w_macd.m[wi] > 0 && w_macd.m[wi] > w_macd.sl[wi],
    (w_s89.k[wi] > 85 && w_s89.k[wi] > w_s89.d[wi]) || w_s89.k[wi] > 92,
    w_rsi[wi] > 67,
    w_ema20[wi] && W.closes[wi] > w_ema20[wi]
  ];

  const score = mc_ok.filter(x=>x).length + sc_ok.filter(x=>x).length;
  const mensualOk = mc_ok.every(x=>x);
  const semanalOk = sc_ok.every(x=>x);
  const dailyReady = d_macd.m[di] > d_macd.sl[di] &&
                     d_macd.m[di-1] <= d_macd.sl[di-1] &&
                     d_rsi[di] > 57 &&
                     d_macd.m[di] > 0;

  let estado = 'watching';
  if (mensualOk && semanalOk && dailyReady) estado = 'ready';
  else if (mensualOk && semanalOk) estado = 'diario';
  else if (score >= 7) estado = 'close';

  return { score, estado, price: closes[di], lastVol, avgVol11 };
}

// ── RENDER ─────────────────────────────────────
export async function render(container, { actionsSlot }) {
  let scanResults = [];
  let scanning = false;
  let currentIndex = 'SP500';

  actionsSlot.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;">
      <select id="sc-index-select" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--text1);font-family:var(--mono);font-size:11px;">
        <option value="SP500">S&P 500</option>
        <option value="NDX100">NASDAQ 100</option>
        <option value="NYSE">NYSE Principales</option>
      </select>
      <button class="btn btn-primary" id="sc-scan-btn">▶ Escanear</button>
    </div>
  `;

  container.innerHTML = `
    <div class="sc-wrap">
      <div class="sc-header-bar">
        <div class="sc-filters" id="sc-filters" style="display:none;">
          <select id="sc-filter-score" class="sc-select">
            <option value="6">Score ≥ 6</option>
            <option value="7">Score ≥ 7</option>
            <option value="8">Score = 8</option>
            <option value="5">Score ≥ 5</option>
          </select>
          <select id="sc-filter-estado" class="sc-select">
            <option value="all">Todos los estados</option>
            <option value="ready">🟢 Ready</option>
            <option value="diario">🟡 Esperando diario</option>
            <option value="close">🔵 Cerca</option>
          </select>
          <select id="sc-filter-sector" class="sc-select">
            <option value="all">Todos los sectores</option>
            <option value="XLK">Tech</option>
            <option value="XLF">Financials</option>
            <option value="XLV">Health</option>
            <option value="XLE">Energy</option>
            <option value="XLY">Consumer D</option>
            <option value="XLP">Consumer S</option>
            <option value="XLI">Industrials</option>
            <option value="XLB">Materials</option>
            <option value="XLU">Utilities</option>
            <option value="XLRE">Real Estate</option>
            <option value="XLC">Comm</option>
          </select>
        </div>
      </div>

      <div class="sc-progress-wrap" id="sc-progress-wrap" style="display:none;">
        <div class="sc-progress-bar"><div class="sc-progress-fill" id="sc-progress-fill"></div></div>
        <div class="sc-status" id="sc-status"></div>
      </div>

      <div id="sc-results">
        <div class="empty">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">Screener Alcista</div>
          <div class="empty-desc">Selecciona el índice y pulsa Escanear. Se aplicará filtro de volumen (>990k y media 11 sesiones >990k) antes del análisis técnico.</div>
        </div>
      </div>
    </div>
  `;

  function renderResults() {
    const minScore = parseInt(document.getElementById('sc-filter-score')?.value || '6');
    const filterEstado = document.getElementById('sc-filter-estado')?.value || 'all';
    const filterSector = document.getElementById('sc-filter-sector')?.value || 'all';

    let filtered = scanResults.filter(r => {
      if (r.score < minScore) return false;
      if (filterEstado !== 'all' && r.estado !== filterEstado) return false;
      if (filterSector !== 'all' && r.sector !== filterSector) return false;
      return true;
    }).sort((a,b) => b.score - a.score);

    const el = document.getElementById('sc-results');
    if (!el) return;

    if (filtered.length === 0) {
      el.innerHTML = `
        <div class="empty">
          <div class="empty-title">Sin resultados</div>
          <div class="empty-desc">Ningún valor supera los filtros actuales. Prueba a bajar el score mínimo.</div>
        </div>
      `;
      return;
    }

    const estadoConfig = {
      ready:    { label:'🟢 Ready',           color:'var(--green)',  desc:'Mensual+Semanal OK + cruce MACD diario' },
      diario:   { label:'🟡 Esperando diario', color:'var(--amber)', desc:'Mensual+Semanal OK · Esperando señal diaria' },
      close:    { label:'🔵 Cerca',            color:'var(--blue)',  desc:'Score ≥ 7 · Muy próximo a condiciones completas' },
      watching: { label:'⚪ Watching',          color:'var(--text3)', desc:'En seguimiento' }
    };

    el.innerHTML = `
      <div class="sc-summary">
        <span>${filtered.length} valores · <strong>${scanResults.filter(r=>r.estado==='ready').length} ready</strong> · ${scanResults.filter(r=>r.estado==='diario').length} esperando diario · ${scanResults.filter(r=>r.estado==='close').length} cerca</span>
      </div>
      <div class="sc-grid">
        ${filtered.map(r => {
          const est = estadoConfig[r.estado] || estadoConfig.watching;
          const scoreColor = r.score >= 8 ? 'var(--green)' : r.score >= 7 ? '#6ee7b7' : r.score >= 6 ? 'var(--amber)' : 'var(--text3)';
          return `
            <div class="sc-card">
              <div class="sc-card-top">
                <div>
                  <div class="sc-card-ticker">${r.ticker}</div>
                  <div class="sc-card-sector">${SECTOR_NAMES[r.sector] || r.sector || '—'}</div>
                </div>
                <div class="sc-card-score" style="color:${scoreColor}">${r.score}<span style="font-size:11px;color:var(--text3);font-family:var(--mono);font-style:normal">/9</span></div>
              </div>
              <div class="sc-card-estado" style="color:${est.color}">${est.label}</div>
              <div class="sc-card-price">$${r.price?.toFixed(2) || '—'}</div>
              <div class="sc-card-vol">Vol: ${(r.lastVol/1e6).toFixed(1)}M · Avg11: ${(r.avgVol11/1e6).toFixed(1)}M</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  async function startScan() {
    if (scanning) return;
    scanning = true;
    scanResults = [];

    const indexKey = document.getElementById('sc-index-select')?.value || 'SP500';
    const tickers = INDICES[indexKey] || INDICES.SP500;

    document.getElementById('sc-filters').style.display = 'none';
    document.getElementById('sc-progress-wrap').style.display = 'block';
    document.getElementById('sc-scan-btn').disabled = true;
    document.getElementById('sc-results').innerHTML = `
      <div class="empty"><div class="loader-ring"></div><div class="empty-title">Analizando ${tickers.length} valores...</div><div class="empty-desc">Fase 1: filtro de volumen</div></div>
    `;

    const fill = document.getElementById('sc-progress-fill');
    const status = document.getElementById('sc-status');
    let analyzed = 0;

    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      const pct = ((i+1) / tickers.length * 100).toFixed(1);
      fill.style.width = pct + '%';
      status.textContent = `${ticker} (${i+1}/${tickers.length}) · ${scanResults.length} encontrados`;

      try {
        const raw = await fetchOHLC(ticker);
        const result = analyzeAsset(raw);
        if (result) {
          result.ticker = ticker;
          result.sector = SECTOR_MAP[ticker] || null;
          scanResults.push(result);
          if (result.score >= 6) renderResults();
        }
        analyzed++;
      } catch (e) {
        // continuar con el siguiente
      }

      // Pequeña pausa para no saturar los proxies
      if (i % 5 === 4) await new Promise(r => setTimeout(r, 200));
    }

    scanning = false;
    document.getElementById('sc-scan-btn').disabled = false;
    document.getElementById('sc-progress-wrap').style.display = 'none';
    document.getElementById('sc-filters').style.display = 'flex';
    status.textContent = `Completado: ${analyzed} analizados · ${scanResults.length} pasaron filtro de volumen`;
    renderResults();
  }

  // Listeners
  document.getElementById('sc-scan-btn')?.addEventListener('click', startScan);
  ['sc-filter-score','sc-filter-estado','sc-filter-sector'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderResults);
  });

  return { destroy() {} };
}

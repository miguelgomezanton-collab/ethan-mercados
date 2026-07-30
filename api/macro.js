// /api/macro.js — ETHAN Mercados · Sistema Macro v3
// 11 indicadores · rango −17 a +17
// Fuente: FRED API + CNN Fear & Greed + Yahoo Finance (VIX SMA200)
// M2 Global: FRED (USA) + ECB (EUR) + BOJ (JPN) + manual (CHN)

const FRED    = 'https://api.stlouisfed.org/fred/series/observations';
const FG_URL  = 'https://feargreedchart.com/api/?action=all';
const FG_ALT  = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
const ECB_URL = 'https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SRS_10Y_2Y?lastNObservations=1&format=csvdata';

// Serie M2 Eurozona BCE (millones EUR, fin de mes, sin ajuste estacional)
const ECB_M2_URL = 'https://data-api.ecb.europa.eu/service/data/BSI/M.U2.N.V.M20.X.1.U2.2300.Z01.E?lastNObservations=14&format=csvdata';

// BOJ API — M2 mensual (base MD02)
// El código de serie correcto para M2 average amounts outstanding es MD02'AM'MABJMNE3S0000000M
// Usamos el endpoint de metadatos para descubrir el código si falla el directo
const BOJ_M2_URL = 'https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=json&lang=en&db=MD02&code=MD02%27AM%27MABJMNE3S0000000M';

// ── FRED helper ───────────────────────────────
async function fred(id, key, limit = 14) {
  const url = `${FRED}?series_id=${id}&api_key=${key}&file_type=json&sort_order=desc&limit=${limit}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FRED ${id}: ${r.status}`);
  const d = await r.json();
  return (d.observations || [])
    .filter(o => o.value !== '.')
    .map(o => ({ date: o.date, value: parseFloat(o.value) }));
}

// ── Yahoo Finance helper ──────────────────────
async function yahoo(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`Yahoo ${sym}: ${r.status}`);
  const m = (await r.json()).chart?.result?.[0]?.meta;
  if (!m) throw new Error(`Yahoo ${sym}: sin datos`);
  const prev = m.previousClose || m.chartPreviousClose;
  return { value: +m.regularMarketPrice.toFixed(2), change: prev ? +((m.regularMarketPrice - prev) / prev * 100).toFixed(2) : null };
}

// ── ECB M2 Eurozona ───────────────────────────
async function fetchECBm2() {
  const r = await fetch(ECB_M2_URL, { headers: { 'Accept': 'text/csv' } });
  if (!r.ok) throw new Error(`ECB M2: ${r.status}`);
  const text = await r.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('ECB M2: sin datos');
  const h = lines[0].split(',');
  const di = h.indexOf('TIME_PERIOD'), vi = h.indexOf('OBS_VALUE');
  if (di < 0 || vi < 0) throw new Error('ECB M2: formato inesperado');
  // Devolver últimas 14 observaciones ordenadas desc
  return lines.slice(1)
    .map(l => { const c = l.split(','); return { date: c[di], value: parseFloat(c[vi]) }; })
    .filter(p => !isNaN(p.value))
    .reverse(); // más reciente primero
}

// ── BOJ M2 Japón ──────────────────────────────
async function fetchBOJm2() {
  // Intenta la API directa del BOJ primero
  try {
    const r = await fetch(BOJ_M2_URL, {
      headers: { 'User-Agent': 'EthanMacroPlatform/1.0', 'Accept': 'application/json' }
    });
    if (!r.ok) throw new Error(`BOJ API: ${r.status}`);
    const d = await r.json();
    // El JSON del BOJ tiene estructura: { data: [ { date, value } ] }
    const obs = d?.data || d?.DATA || [];
    if (obs.length < 2) throw new Error('BOJ: sin observaciones');
    // Ordenar desc y devolver últimas 14
    return obs
      .filter(o => o.value != null && !isNaN(parseFloat(o.value)))
      .map(o => ({ date: o.date || o.DATE, value: parseFloat(o.value || o.VALUE) }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14);
  } catch {
    // Fallback: serie de Japón vía ECB Data Portal (RTD dataset)
    const url = 'https://data-api.ecb.europa.eu/service/data/RTD/M.JP.Y.M_M2.J?lastNObservations=14&format=csvdata';
    const r2 = await fetch(url, { headers: { 'Accept': 'text/csv' } });
    if (!r2.ok) throw new Error(`ECB RTD JP M2: ${r2.status}`);
    const text = await r2.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) throw new Error('ECB RTD JP M2: sin datos');
    const h = lines[0].split(',');
    const di = h.indexOf('TIME_PERIOD'), vi = h.indexOf('OBS_VALUE');
    return lines.slice(1)
      .map(l => { const c = l.split(','); return { date: c[di], value: parseFloat(c[vi]) }; })
      .filter(p => !isNaN(p.value))
      .reverse();
  }
}

// ── Calcular M2 Global USA + EUR + JPN ────────
async function calcGlobalM2(fredKey, manualChinaM2pct) {
  const [rUsM2, rEurM2, rJpM2, rEURUSD, rUSDJPY] = await Promise.allSettled([
    fred('M2SL', fredKey, 14),  // USA M2 en miles de millones USD
    fetchECBm2(),               // EUR M2 en millones EUR
    fetchBOJm2(),               // JPN M2 en miles de millones JPY
    yahoo('EURUSD%3DX'),        // EURUSD
    yahoo('USDJPY%3DX'),        // USDJPY
  ]);

  const errors = [];
  let usM2 = null, eurM2 = null, jpM2 = null;
  let usYoY = null, eurYoY = null, jpYoY = null;
  let eurusd = null, usdjpy = null;

  // USA M2 YoY
  if (rUsM2.status === 'fulfilled' && rUsM2.value.length >= 13) {
    const obs = rUsM2.value; // desc
    usM2 = obs[0].value; // miles de millones USD
    usYoY = +((obs[0].value - obs[12].value) / obs[12].value * 100).toFixed(2);
  } else errors.push('USA M2: ' + rUsM2.reason?.message);

  // EUR M2 YoY
  if (rEurM2.status === 'fulfilled' && rEurM2.value.length >= 13) {
    const obs = rEurM2.value; // desc
    eurM2 = obs[0].value; // millones EUR
    eurYoY = +((obs[0].value - obs[12].value) / obs[12].value * 100).toFixed(2);
  } else errors.push('EUR M2: ' + rEurM2.reason?.message);

  // JPN M2 YoY
  if (rJpM2.status === 'fulfilled' && rJpM2.value.length >= 13) {
    const obs = rJpM2.value; // desc
    jpM2 = obs[0].value;
    jpYoY = +((obs[0].value - obs[12].value) / obs[12].value * 100).toFixed(2);
  } else errors.push('JPN M2: ' + rJpM2.reason?.message);

  // Tipos de cambio
  if (rEURUSD.status === 'fulfilled') eurusd = rEURUSD.value.value;
  else errors.push('EURUSD: ' + rEURUSD.reason?.message);
  if (rUSDJPY.status === 'fulfilled') usdjpy = rUSDJPY.value.value;
  else errors.push('USDJPY: ' + rUSDJPY.reason?.message);

  // M2 Global en USD (solo regiones disponibles)
  let globalM2usd = null;
  if (usM2 && eurM2 && eurusd && jpM2 && usdjpy) {
    const usUSD  = usM2 * 1e9;                  // miles de millones → USD
    const eurUSD = (eurM2 * 1e6) * eurusd;       // millones EUR → USD
    const jpUSD  = (jpM2 * 1e9) / usdjpy;        // miles de millones JPY → USD  (ajustar si unidad diferente)
    globalM2usd = usUSD + eurUSD + jpUSD;
  }

  // YoY global ponderado (promedio simple de las 3 regiones disponibles)
  // Peso aproximado: USA ~35%, EUR ~25%, JPN ~10%, CHN ~30%
  // Con China manual se ajusta; sin él, las 3 representan ~70% del total
  const weights = { us: 35, eur: 25, jp: 10 };
  const available = [
    usYoY  !== null ? { yoy: usYoY,  w: weights.us  } : null,
    eurYoY !== null ? { yoy: eurYoY, w: weights.eur } : null,
    jpYoY  !== null ? { yoy: jpYoY,  w: weights.jp  } : null,
    manualChinaM2pct !== null ? { yoy: manualChinaM2pct, w: 30 } : null,
  ].filter(Boolean);

  let globalYoY = null;
  if (available.length > 0) {
    const totalW = available.reduce((s, x) => s + x.w, 0);
    globalYoY = +(available.reduce((s, x) => s + x.yoy * x.w, 0) / totalW).toFixed(2);
  }

  // Fuentes disponibles
  const sources = [
    usYoY  !== null ? 'FRED M2SL (USA)'  : null,
    eurYoY !== null ? 'ECB BSI (EUR)'    : null,
    jpYoY  !== null ? 'BOJ MD02 (JPN)'   : null,
    manualChinaM2pct !== null ? 'Manual (CHN)' : null,
  ].filter(Boolean);

  return {
    globalYoY,
    globalM2usd,
    components: { usYoY, eurYoY, jpYoY, chnYoY: manualChinaM2pct },
    fx: { eurusd, usdjpy },
    sources,
    errors,
    chinaPending: manualChinaM2pct === null,
    coverage: `${sources.length}/4 regiones` +
      (manualChinaM2pct === null ? ' — introduce China M2 manualmente para completar' : ''),
  };
}

// ── VIX con SMA200 ────────────────────────────
async function fetchVIX() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=2y`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`Yahoo VIX: ${r.status}`);
  const res = (await r.json()).chart?.result?.[0];
  if (!res) throw new Error('Yahoo VIX: sin datos');
  const closes = res.indicators?.quote?.[0]?.close?.filter(v => v != null) || [];
  const current = closes[closes.length - 1];
  const sma200 = closes.length >= 200
    ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200
    : closes.reduce((a, b) => a + b, 0) / closes.length;
  const aboveSMA200 = current > sma200;
  return {
    value: +current.toFixed(2),
    sma200: +sma200.toFixed(2),
    aboveSMA200,
    signal: aboveSMA200 ? 'Alerta: VIX sobre SMA200 — volatilidad elevada (bajista)' : 'VIX bajo SMA200 — volatilidad contenida',
  };
}

// ── CNN Fear & Greed — CNN directo + macromicro via worker + VIX sintético ──
async function fetchFearGreed() {
  // 1. Intentar CNN directo
  for (const url of [FG_URL, FG_ALT]) {
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.cnn.com/',
          'Origin': 'https://www.cnn.com',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) continue;
      const d = await r.json();
      if (d?.now?.score != null) {
        return { value: Math.round(d.now.score), label: d.now.valueText,
          previousClose: d.previousClose?.score != null ? Math.round(d.previousClose.score) : null,
          previousWeek:  d.previousWeek?.score  != null ? Math.round(d.previousWeek.score)  : null,
          previousMonth: d.previousMonth?.score != null ? Math.round(d.previousMonth.score) : null,
          source: 'CNN' };
      }
      const fg = d?.fear_and_greed;
      if (fg?.score != null) {
        return { value: Math.round(fg.score), label: fg.rating,
          previousClose: fg.previous_close  != null ? Math.round(fg.previous_close)  : null,
          previousWeek:  fg.previous_1_week  != null ? Math.round(fg.previous_1_week)  : null,
          previousMonth: fg.previous_1_month != null ? Math.round(fg.previous_1_month) : null,
          source: 'CNN' };
      }
    } catch {}
  }

  // 2. Macromicro via worker (HTML scraping)
  try {
    const mmUrl = 'https://en.macromicro.me/collections/34/us-stock-relative/50108/cnn-fear-and-greed';
    const workerUrl = `https://soft-field-156f.miguel-gomez-anton.workers.dev/?url=${encodeURIComponent(mmUrl)}`;
    const r = await fetch(workerUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(10000),
    });
    if (r.ok) {
      const html = await r.text();
      // Buscar el valor del Fear & Greed en el HTML
      // macromicro suele tener el dato en un JSON inline o en atributos data-
      const patterns = [
        /"value"\s*:\s*(\d+\.?\d*)/,
        /fear.and.greed[^:]*:\s*(\d+)/i,
        /currentValue[^:]*:\s*(\d+\.?\d*)/,
        /"score"\s*:\s*(\d+\.?\d*)/,
        /data-value="(\d+\.?\d*)"/,
        /class="[^"]*value[^"]*"[^>]*>(\d+)/,
      ];
      for (const p of patterns) {
        const m = html.match(p);
        if (m) {
          const value = Math.round(parseFloat(m[1]));
          if (value >= 0 && value <= 100) {
            const label = value >= 75 ? 'Extreme Greed' : value >= 55 ? 'Greed' :
                          value >= 45 ? 'Neutral' : value >= 25 ? 'Fear' : 'Extreme Fear';
            return { value, label, source: 'MacroMicro/CNN' };
          }
        }
      }
    }
  } catch {}

  // 3. Fallback sintético desde VIX
  try {
    const vixUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d';
    const proxies = [
      u => `https://soft-field-156f.miguel-gomez-anton.workers.dev/?url=${encodeURIComponent(u)}`,
      u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    ];
    for (const fn of proxies) {
      try {
        const r = await fetch(fn(vixUrl), { signal: AbortSignal.timeout(6000) });
        if (!r.ok) continue;
        const j = JSON.parse(await r.text());
        const closes = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
        if (!closes?.length) continue;
        const vix = closes[closes.length - 1];
        const prevVix = closes[closes.length - 2] || vix;
        if (!vix) continue;
        const calcScore = v => {
          let s;
          if (v < 12)      s = Math.round(85 + (12-v)*1.25);
          else if (v < 16) s = Math.round(60 + (16-v)*6.25);
          else if (v < 20) s = Math.round(40 + (20-v)*5);
          else if (v < 28) s = Math.round(20 + (28-v)*2.5);
          else             s = Math.max(0, Math.round(20-(v-28)*1.5));
          return Math.max(0, Math.min(100, s));
        };
        const score = calcScore(vix);
        const label = score >= 75 ? 'Extreme Greed' : score >= 55 ? 'Greed' :
                      score >= 45 ? 'Neutral' : score >= 25 ? 'Fear' : 'Extreme Fear';
        return { value: score, label, previousClose: calcScore(prevVix),
          vix: vix.toFixed(1), source: 'VIX sintético' };
      } catch {}
    }
  } catch {}

  throw new Error('Fear & Greed: sin datos disponibles');
}

// ── ECB Curva EUR ─────────────────────────────
async function fetchCurvaEUR() {
  const r = await fetch(ECB_URL, { headers: { 'Accept': 'text/csv' } });
  if (!r.ok) throw new Error(`ECB: ${r.status}`);
  const lines = (await r.text()).trim().split('\n');
  const h = lines[0].split(','), last = lines[lines.length - 1].split(',');
  const di = h.indexOf('TIME_PERIOD'), vi = h.indexOf('OBS_VALUE');
  const v = parseFloat(last[vi]);
  if (isNaN(v)) throw new Error('ECB: valor no parseable');
  return { value: +v.toFixed(2), date: last[di] };
}

// ══════════════════════════════════════════════
// SCORING — Sistema oficial ETHAN Macro v3
// ══════════════════════════════════════════════

// Indicador 1: Curva USD (×1)
function scCurvaUSD(v) {
  if (v >= 0.90) return +1;
  if (v >= 0.48) return  0;
  return -1;
}
// Indicador 2: Curva EUR (×1)
function scCurvaEUR(v) {
  if (v >= 0.60) return +1;
  if (v >= 0.40) return  0;
  return -1;
}
// Indicador 3: LEI USA (×1)
function scLEI(v) {
  if (v >=  0.3) return +1;
  if (v >= -0.3) return  0;
  return -1;
}
// Indicador 4: M2 Global (×3)
function scM2(v) {
  if (v >= 5.0) return +3;
  if (v >= 3.0) return +1;
  return -3;
}
// Indicador 5: Crédito vs Nominal GDP (×3)
function scCredito(v) {
  if (v >= 3.0) return +3;
  if (v >= 1.5) return  0;
  return -3;
}
// Indicador 6: Impulso Crediticio (×2)
function scImpulso(v) {
  if (v >= 1.0) return +2;
  if (v >= 0.5) return +1;
  return -2;
}
// Indicador 7: Velocidad M2 (×2)
function scVelM2(v) {
  if (v >=  0.0) return +2;
  if (v >= -1.5) return -1;
  return -2;
}
// Indicador 8: Reservas Bancarias (×1) — por valor absoluto en $T
function scReservas(v) {
  if (v >= 3.5) return +1;
  if (v >= 2.5) return -1;
  return -2;
}
// Indicador 9: Tipo Real FFR−CPI (×1)
function scTipoReal(v) {
  if (v >= 1.0) return +1;
  if (v >= 0.5) return  0;
  return -1;
}
// Indicador 10: BBB Spread (×1)
function scBBB(v) {
  if (v <= 1.00) return +1;
  if (v <= 1.50) return  0;
  return -1;
}
// Indicador 11: Fear & Greed / Put-Call proxy (×1)
function scFG(v) {
  if (v < 40)  return +1;   // miedo = oportunidad contrarian
  if (v <= 54) return  0;
  return -1;                 // euforia = riesgo
}

// Zona de ciclo
function zone(s) {
  if (s >= 10)  return 'Boom / Euforia';
  if (s >=  4)  return 'Expansión';
  if (s >=  0)  return 'Desaceleración';
  if (s >= -4)  return 'Recesión Leve';
  return 'Recesión Severa';
}

// Probabilidades por score
function probabilities(s) {
  if (s >= 4)  return { recesion: 15, stagflation: 15, softLanding: 45, expansion: 25 };
  if (s >= 0)  return { recesion: 40, stagflation: 30, softLanding: 25, expansion:  5 };
  return             { recesion: 65, stagflation: 25, softLanding:  8, expansion:  2 };
}

// Riesgo contagio inflacionario
function riesgoContagio(cpiYoY, cpiCoreYoY) {
  const pct = cpiYoY <= 2.5 ? 10 : cpiYoY <= 3.0 ? 20 : cpiYoY <= 3.5 ? 30 : cpiYoY <= 4.0 ? 50 : 75;
  const gap  = +(cpiYoY - cpiCoreYoY).toFixed(2);
  const tipo = gap < 0.5 ? 'estructural' : 'coyuntural';
  return {
    headline: cpiYoY, core: cpiCoreYoY, gap, tipo, pct,
    nivel: pct <= 20 ? 'bajo' : pct <= 40 ? 'moderado' : 'alto',
    label: pct <= 20 ? 'Riesgo bajo — inflación bajo control'
      : pct <= 40  ? `Presión ${tipo} moderada — monitorear`
      : `Riesgo alto de contagio estructural (${pct}%) — vigilar espiral salarios-precios`
  };
}

// ── Handler principal ─────────────────────────
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=900,stale-while-revalidate=1800');
  const key = process.env.FRED_API_KEY;
  if (!key) return res.status(500).json({ error: 'FRED_API_KEY no configurada' });

  // Override manual China M2 YoY% (único que no tiene API gratuita)
  const man = {
    lei:        req.query.lei     != null ? parseFloat(req.query.lei)     : null,
    chinM2:     req.query.chinaM2 != null ? parseFloat(req.query.chinaM2) : null,
    credito:    req.query.credito != null ? parseFloat(req.query.credito)  : null,
    impulso:    req.query.impulso != null ? parseFloat(req.query.impulso)  : null,
  };

  const errs = [];

  // ── Fetch en paralelo — dos grupos ───────────
  // Grupo 1: indicadores principales (rápidos)
  // Grupo 2: M2 Global (más lento — llama a ECB + BOJ + Yahoo FX)
  const [
    rDgs10, rDgs2, rDff, rBbb, rCpi, rCpiCore,
    rFg, rVix, rCurvaEUR,
    rHy, rBreakeven1y, rBreakeven5y, rBreakeven5yAlt,
    rWti, rBrent, rM2v, rWresbal,
    rLeiFreD, rTotll, rGdp, rMich,
  ] = await Promise.allSettled([
    fred('DGS10',        key, 5),
    fred('DGS2',         key, 5),
    fred('DFF',          key, 5),
    fred('BAMLC0A4CBBB', key, 5),
    fred('CPIAUCSL',     key, 14),
    fred('CPILFESL',     key, 14),
    fetchFearGreed(),
    fetchVIX(),
    fetchCurvaEUR(),
    fred('BAMLH0A0HYM2', key, 5),
    fred('EXPINF1YR',    key, 10),   // Fed Cleveland 1Y inflation expectations
    fred('T5YIE',        key, 10),   // Breakeven 5Y
    fred('T5YIFR',       key, 10),   // Breakeven 5Y forward rate (alternativa)
    yahoo('CL%3DF'),
    yahoo('BZ%3DF'),
    fred('M2V',          key, 6),
    fred('WRESBAL',      key, 60),
    fred('USSLIND',      key, 14),
    fred('TOTLL',        key, 14),
    fred('GDP',          key, 6),
    fred('MICH',         key, 10),   // Univ. Michigan 1Y inflation expectations (fallback)
  ]);

  // M2 Global en paralelo pero con timeout propio para no bloquear el resto
  const rGlobalM2 = await Promise.race([
    calcGlobalM2(key, man.chinM2).then(v => ({ status: 'fulfilled', value: v })).catch(e => ({ status: 'rejected', reason: e })),
    new Promise(resolve => setTimeout(() => resolve({ status: 'rejected', reason: new Error('M2 Global timeout') }), 8000)),
  ]);

  // ── Procesar series automáticas ───────────────
  let t10y = null, t2y = null, ffr = null, cpiYoY = null, cpiCoreYoY = null;

  if (rDgs10.status === 'fulfilled' && rDgs10.value[0])
    t10y = { value: rDgs10.value[0].value, date: rDgs10.value[0].date };
  else errs.push('DGS10: ' + rDgs10.reason?.message);

  if (rDgs2.status === 'fulfilled' && rDgs2.value[0])
    t2y = { value: rDgs2.value[0].value, date: rDgs2.value[0].date };
  else errs.push('DGS2: ' + rDgs2.reason?.message);

  if (rDff.status === 'fulfilled' && rDff.value[0])
    ffr = { value: rDff.value[0].value, date: rDff.value[0].date };
  else errs.push('DFF: ' + rDff.reason?.message);

  if (rCpi.status === 'fulfilled' && rCpi.value.length >= 13) {
    const l = rCpi.value[0].value, ya = rCpi.value[12].value;
    cpiYoY = +(((l - ya) / ya) * 100).toFixed(2);
  } else errs.push('CPI: ' + rCpi.reason?.message);

  if (rCpiCore.status === 'fulfilled' && rCpiCore.value.length >= 13) {
    const l = rCpiCore.value[0].value, ya = rCpiCore.value[12].value;
    cpiCoreYoY = +(((l - ya) / ya) * 100).toFixed(2);
  } else errs.push('CPICore: ' + rCpiCore.reason?.message);

  // ── Construir indicadores con score ──────────
  const ind = {};

  // 1. Curva USD (auto)
  if (t10y && t2y) {
    const v = +(t10y.value - t2y.value).toFixed(2);
    ind.curvaUSD = { label: 'Curva USD (10Y−2Y)', value: v, date: t10y.date,
      score: scCurvaUSD(v), weight: 1 };
  }

  // 2. Curva EUR (manual o ECB)
  if (rCurvaEUR.status === 'fulfilled') {
    const v = rCurvaEUR.value.value;
    ind.curvaEUR = { label: 'Curva EUR (10Y−2Y)', value: v, date: rCurvaEUR.value.date,
      score: scCurvaEUR(v), weight: 1, manual: rCurvaEUR.value.manual || false };
  } else errs.push('CurvaEUR: ' + rCurvaEUR.reason?.message);

  // 3. LEI USA — FRED USSLIND (Conference Board Leading Index, mensual)
  // USSLIND es el índice en nivel. Calculamos variación mensual % como proxy del dato que publica CB.
  // Si el manual override existe (man.lei), lo usamos preferentemente.
  if (man.lei != null) {
    ind.lei = { label: 'LEI USA', value: man.lei, date: null,
      score: scLEI(man.lei), weight: 1, manual: true };
  } else if (rLeiFreD.status === 'fulfilled' && rLeiFreD.value.length >= 2) {
    const obs = rLeiFreD.value; // ya ordenado desc
    const latest = obs[0].value, prev = obs[1].value;
    const mom = prev > 0 ? +(((latest - prev) / prev) * 100).toFixed(2) : null;
    ind.lei = { label: 'LEI USA (FRED USSLIND)', value: mom, rawValue: latest,
      date: obs[0].date, score: mom != null ? scLEI(mom) : null, weight: 1, auto: true };
  } else {
    errs.push('USSLIND: ' + rLeiFreD.reason?.message);
    ind.lei = { label: 'LEI USA', value: man.lei ?? null, date: null,
      score: man.lei != null ? scLEI(man.lei) : null, weight: 1, manual: man.lei != null };
  }

  // 4. M2 Global — USA (FRED) + EUR (ECB) + JPN (BOJ) + CHN (manual opcional)
  if (rGlobalM2.status === 'fulfilled' && rGlobalM2.value.globalYoY != null) {
    const g = rGlobalM2.value;
    if (g.errors?.length) errs.push(...g.errors.map(e => 'M2Global: ' + e));
    ind.m2 = {
      label: 'M2 Global (USA+EUR+JPN' + (g.components.chnYoY != null ? '+CHN' : ', CHN pendiente') + ')',
      value: g.globalYoY,
      components: g.components,
      fx: g.fx,
      coverage: g.coverage,
      sources: g.sources,
      date: null,
      score: scM2(g.globalYoY), weight: 3, auto: true,
    };
  } else if (man.chinM2 != null || rGlobalM2.reason) {
    // Si calcGlobalM2 falló pero tenemos override manual completo
    errs.push('M2 Global auto falló: ' + rGlobalM2.reason?.message);
    ind.m2 = { label: 'M2 Global', value: null, date: null, score: null, weight: 3, manual: true };
  } else {
    ind.m2 = { label: 'M2 Global', value: null, date: null, score: null, weight: 3, manual: true };
  }

  // 5. Crédito vs Nominal GDP — FRED TOTLL (Total Loans, mensual) vs GDP (trimestral, SAAR)
  // Calculamos YoY de cada uno y el diferencial.
  // Si el manual override existe, lo usamos preferentemente.
  if (man.credito != null) {
    ind.credito = { label: 'Crédito vs Nominal GDP', value: man.credito, date: null,
      score: scCredito(man.credito), weight: 3, manual: true };
  } else if (
    rTotll.status === 'fulfilled' && rTotll.value.length >= 13 &&
    rGdp.status   === 'fulfilled' && rGdp.value.length   >= 5
  ) {
    // Crédito YoY (mensual)
    const tl = rTotll.value; // desc
    const creditYoY = +(((tl[0].value - tl[12].value) / tl[12].value) * 100).toFixed(2);
    // GDP nominal YoY (trimestral — 4 obs = 1 año)
    const gdp = rGdp.value; // desc
    const gdpYoY = +(((gdp[0].value - gdp[4].value) / gdp[4].value) * 100).toFixed(2);
    const diff = +(creditYoY - gdpYoY).toFixed(2);
    ind.credito = {
      label: 'Crédito vs Nominal GDP (TOTLL vs GDP)',
      value: diff, creditYoY, gdpYoY,
      date: tl[0].date,
      score: scCredito(diff), weight: 3, auto: true
    };
  } else {
    if (rTotll.status !== 'fulfilled') errs.push('TOTLL: ' + rTotll.reason?.message);
    if (rGdp.status   !== 'fulfilled') errs.push('GDP: '   + rGdp.reason?.message);
    ind.credito = { label: 'Crédito vs Nominal GDP', value: man.credito ?? null, date: null,
      score: man.credito != null ? scCredito(man.credito) : null, weight: 3, manual: man.credito != null };
  }

  // 6. Impulso Crediticio — derivado de la aceleración del crédito (TOTLL)
  // Si tenemos TOTLL: impulso = variación del YoY vs hace 3 meses (aceleración del crédito)
  // Si override manual, usar ese.
  if (man.impulso != null) {
    ind.impulso = { label: 'Impulso Crediticio', value: man.impulso, date: null,
      score: scImpulso(man.impulso), weight: 2, manual: true };
  } else if (rTotll.status === 'fulfilled' && rTotll.value.length >= 16) {
    const tl = rTotll.value; // desc
    // YoY actual vs YoY de hace 3 meses = aceleración del crédito
    const yoyNow  = ((tl[0].value  - tl[12].value) / tl[12].value) * 100;
    const yoy3m   = ((tl[3].value  - tl[15].value) / tl[15].value) * 100;
    const impulso = +(yoyNow - yoy3m).toFixed(2);
    ind.impulso = {
      label: 'Impulso Crediticio (aceleración TOTLL)',
      value: impulso, yoyNow: +yoyNow.toFixed(2), yoy3mAgo: +yoy3m.toFixed(2),
      date: tl[0].date,
      score: scImpulso(impulso), weight: 2, auto: true
    };
  } else {
    ind.impulso = { label: 'Impulso Crediticio', value: man.impulso ?? null, date: null,
      score: man.impulso != null ? scImpulso(man.impulso) : null, weight: 2, manual: man.impulso != null };
  }

  // 7. Velocidad M2 — FRED M2V (trimestral, YoY vs hace 4 trimestres)
  if (rM2v.status === 'fulfilled' && rM2v.value.length >= 5) {
    const latest = rM2v.value[0].value, ya = rM2v.value[4].value;
    const yoy = +(((latest - ya) / ya) * 100).toFixed(2);
    ind.velM2 = { label: 'Velocidad M2', value: yoy, rawValue: latest,
      date: rM2v.value[0].date, score: scVelM2(yoy), weight: 2 };
  } else {
    errs.push('M2V: ' + rM2v.reason?.message);
    ind.velM2 = { label: 'Velocidad M2', value: null, date: null, score: null, weight: 2 };
  }

  // 8. Reservas Bancarias — FRED WRESBAL (semanal, valor absoluto en $B → convertir a $T)
  if (rWresbal.status === 'fulfilled' && rWresbal.value[0]) {
    const rawB = rWresbal.value[0].value;              // en miles de millones $
    const rawT = +(rawB / 1000).toFixed(2);            // convertir a $T
    ind.reservas = { label: 'Reservas Bancarias Fed', value: rawT, rawValue: rawT,
      date: rWresbal.value[0].date, score: scReservas(rawT), weight: 1 };
  } else {
    errs.push('WRESBAL: ' + rWresbal.reason?.message);
    ind.reservas = { label: 'Reservas Bancarias Fed', value: null, date: null, score: null, weight: 1 };
  }

  // 9. Tipo Real (auto)
  if (ffr && cpiYoY != null) {
    const v = +(ffr.value - cpiYoY).toFixed(2);
    ind.tipoReal = { label: 'Tipo Real (FFR−CPI)', value: v, date: ffr.date,
      score: scTipoReal(v), weight: 1 };
  }

  // 10. BBB Spread (auto)
  if (rBbb.status === 'fulfilled' && rBbb.value[0]) {
    const v = rBbb.value[0].value;
    ind.bbb = { label: 'BBB Corporate Spread', value: v, date: rBbb.value[0].date,
      score: scBBB(v), weight: 1 };
  } else errs.push('BBB: ' + rBbb.reason?.message);

  // 11. Fear & Greed / Put-Call proxy (auto)
  const fg = rFg.status === 'fulfilled' ? rFg.value : null;
  if (fg) {
    ind.fearGreed = { label: 'Fear & Greed (CNN)', value: fg.value, date: null,
      score: scFG(fg.value), weight: 1,
      previousClose: fg.previousClose, previousWeek: fg.previousWeek, previousMonth: fg.previousMonth,
      label_text: fg.label };
  } else errs.push('FearGreed: ' + rFg.reason?.message);

  // ── Score total ───────────────────────────────
  let scoreTotal = 0, maxPossible = 0, minPossible = 0;
  const scoreDetail = {};
  Object.entries(ind).forEach(([k, i]) => {
    if (i.score != null) {
      scoreTotal  += i.score;
      scoreDetail[k] = { score: i.score, weight: i.weight };
    }
    maxPossible += i.weight || 1;
    minPossible -= i.weight || 1;
  });

  // ── Seguimiento (sin score) ───────────────────
  const seguimiento = {
    t10y,
    t2y,
    ffr,
    t10y2y: t10y && t2y ? { value: +(t10y.value - t2y.value).toFixed(2), date: t10y.date } : null,
    cpi:     cpiYoY    != null ? { value: cpiYoY,    date: rCpi.value?.[0]?.date }    : null,
    cpiCore: cpiCoreYoY != null ? { value: cpiCoreYoY, date: rCpiCore.value?.[0]?.date } : null,
    bbb:     ind.bbb   || null,
    hySpread: rHy.status === 'fulfilled' && rHy.value[0]
      ? { value: rHy.value[0].value, date: rHy.value[0].date } : null,
    breakeven1y: (() => {
      // EXPINF1YR — Fed de Cleveland (más preciso que T1YIE)
      if (rBreakeven1y.status === 'fulfilled') {
        const valid = rBreakeven1y.value.find(o => o.value != null && !isNaN(o.value));
        if (valid) return { value: valid.value, date: valid.date, series: 'EXPINF1YR' };
      }
      // Fallback: MICH (Univ. Michigan)
      if (rMich?.status === 'fulfilled') {
        const valid = rMich.value.find(o => o.value != null && !isNaN(o.value));
        if (valid) return { value: valid.value, date: valid.date, series: 'MICH' };
      }
      errs.push('EXPINF1YR+MICH: sin datos válidos');
      return null;
    })(),
    breakeven5y: (() => {
      if (rBreakeven5y.status === 'fulfilled') {
        const valid = rBreakeven5y.value.find(o => o.value != null && !isNaN(o.value));
        if (valid) return { value: valid.value, date: valid.date };
      }
      // Fallback a T5YIFR
      if (rBreakeven5yAlt.status === 'fulfilled') {
        const valid = rBreakeven5yAlt.value.find(o => o.value != null && !isNaN(o.value));
        if (valid) return { value: valid.value, date: valid.date, series: 'T5YIFR' };
      }
      errs.push('T5YIE+T5YIFR: sin datos válidos');
      return null;
    })(),
    vix:   rVix.status   === 'fulfilled' ? rVix.value   : null,
    wti:   rWti.status   === 'fulfilled' ? rWti.value   : null,
    brent: rBrent.status === 'fulfilled' ? rBrent.value : null,
  };
  if (rVix.status !== 'fulfilled') errs.push('VIX: ' + rVix.reason?.message);
  if (rBreakeven1y.status !== 'fulfilled') errs.push('T1YIE: ' + rBreakeven1y.reason?.message);
  if (rBreakeven5y.status !== 'fulfilled') errs.push('T5YIE: ' + rBreakeven5y.reason?.message);

  // Riesgo contagio
  const rc = cpiYoY != null && cpiCoreYoY != null ? riesgoContagio(cpiYoY, cpiCoreYoY) : null;

  return res.status(200).json({
    updatedAt: new Date().toISOString(),
    scoreTotal,
    zone: zone(scoreTotal),
    probabilities: probabilities(scoreTotal),
    riesgoContagio: rc,

    // 1.1 Coyuntura — indicadores con score
    coyuntura: {
      curvaUSD:  ind.curvaUSD,
      curvaEUR:  ind.curvaEUR,
      lei:       ind.lei,
      cpi:       seguimiento.cpi ? { ...seguimiento.cpi, cpiCore: cpiCoreYoY } : null,
      tipoReal:  ind.tipoReal,
    },

    // 1.2 Seguimiento — automáticos sin score
    seguimiento,

    // 1.3 Liquidez — indicadores con score (manuales)
    liquidez: {
      m2:       ind.m2,
      credito:  ind.credito,
      impulso:  ind.impulso,
      velM2:    ind.velM2,
      reservas: ind.reservas,
      bbb:      ind.bbb,
    },

    // Todos los indicadores con score (para debug y Kelly)
    indicators: ind,
    scoreDetail,
    errors: errs.length ? errs : undefined,
  });
}

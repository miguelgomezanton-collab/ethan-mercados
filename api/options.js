// ═══════════════════════════════════════════════
// /api/options.js — Vercel Serverless Function
// ═══════════════════════════════════════════════
// Recibe ?ticker=AAPL&date=TIMESTAMP (opcional)
// Devuelve la cadena de opciones de Yahoo Finance
// con crumb/cookie obtenidos server-side.

const YF_CRUMB_URL  = 'https://query1.finance.yahoo.com/v1/test/getcrumb';
const YF_CONSENT    = 'https://finance.yahoo.com';
const YF_OPTIONS    = 'https://query2.finance.yahoo.com/v7/finance/options';

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/'
};

async function getYahooCrumb() {
  const homeRes = await fetch(YF_CONSENT, {
    headers: { ...BASE_HEADERS, 'Accept': 'text/html' },
    redirect: 'follow'
  });
  const cookie = homeRes.headers.get('set-cookie') || '';
  const crumbRes = await fetch(YF_CRUMB_URL, {
    headers: { ...BASE_HEADERS, 'Cookie': cookie }
  });
  if (!crumbRes.ok) throw new Error(`Crumb HTTP ${crumbRes.status}`);
  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb.length < 3) throw new Error('Crumb inválido');
  return { crumb, cookie };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ticker, date } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Falta ticker' });

  try {
    const { crumb, cookie } = await getYahooCrumb();
    let url = `${YF_OPTIONS}/${encodeURIComponent(ticker)}?crumb=${encodeURIComponent(crumb)}`;
    if (date) url += `&date=${date}`;

    const r = await fetch(url, { headers: { ...BASE_HEADERS, 'Cookie': cookie } });
    if (!r.ok) throw new Error(`Yahoo Finance HTTP ${r.status}`);

    const j = await r.json();
    const chain = j?.optionChain?.result?.[0];
    if (!chain) throw new Error('Sin cadena de opciones para ' + ticker);

    res.status(200).json({
      expirationDates: chain.expirationDates || [],
      calls: chain.options?.[0]?.calls || [],
      puts:  chain.options?.[0]?.puts  || [],
      price: chain.quote?.regularMarketPrice || null,
      symbol: chain.underlyingSymbol || ticker
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

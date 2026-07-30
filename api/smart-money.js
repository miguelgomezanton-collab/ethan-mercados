// /api/smart-money.js — Smart Money Intelligence
// Yahoo Finance (crumb+cookies) + SEC EDGAR Form 4

const YF_BASE = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary';
const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/',
};

async function getYahooCrumb() {
  const homeRes = await fetch('https://finance.yahoo.com', {
    headers: { ...BASE_HEADERS, 'Accept': 'text/html' },
    redirect: 'follow',
  });
  const cookie = homeRes.headers.get('set-cookie') || '';
  const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { ...BASE_HEADERS, 'Cookie': cookie },
  });
  if (!crumbRes.ok) throw new Error(`Crumb HTTP ${crumbRes.status}`);
  const crumb = await crumbRes.text();
  return { crumb, cookie };
}

async function fetchYahooModules(ticker, modules, crumb, cookie) {
  const url = `${YF_BASE}/${ticker}?modules=${modules.join(',')}&crumb=${encodeURIComponent(crumb)}`;
  const r = await fetch(url, {
    headers: { ...BASE_HEADERS, 'Cookie': cookie },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
  const data = await r.json();
  const result = data?.quoteSummary?.result?.[0];
  if (!result) throw new Error('Sin datos de Yahoo');
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { ticker, section } = req.query;
  if (!ticker) return res.status(400).json({ error: 'ticker requerido' });
  const T = ticker.toUpperCase();

  // ── Insiders — SEC EDGAR ──────────────────────────────────────
  if (section === 'insiders') {
    try {
      const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=&CIK=${T}&type=4&dateb=&owner=include&count=12&search_text=&output=atom`;
      const r = await fetch(url, {
        headers: { 'User-Agent': 'ETHAN-Research contact@ethan.com', 'Accept': 'application/atom+xml' },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw new Error(`SEC HTTP ${r.status}`);
      const xml = await r.text();

      const insiders = [];
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let m;
      while ((m = entryRegex.exec(xml)) !== null && insiders.length < 8) {
        const entry = m[1];
        const title   = (/<title>([\s\S]*?)<\/title>/.exec(entry)?.[1] || '').replace(/<[^>]+>/g,'').trim();
        const updated = (/<updated>(.*?)<\/updated>/.exec(entry)?.[1] || '').slice(0,10);
        const link    = (/<link[^>]+href="([^"]+)"/.exec(entry)?.[1] || '');
        // Limpiar CIK del nombre
        const name = title.replace(/\s*\(CIK\s*\d+\)/gi,'').trim();
        if (name && updated) {
          insiders.push({ date: updated, insider: name, title: '—', type: '—', qty: null, price: '—', value: '—', fileUrl: link });
        }
      }
      return res.status(200).json({ ticker: T, insiders });
    } catch(e) {
      return res.status(200).json({ ticker: T, insiders: [], error: e.message });
    }
  }

  // ── Short Interest + Institutional — Yahoo Finance ────────────
  if (section === 'market') {
    try {
      const { crumb, cookie } = await getYahooCrumb();
      const data = await fetchYahooModules(T,
        ['defaultKeyStatistics', 'majorHoldersBreakdown', 'institutionOwnership'],
        crumb, cookie
      );

      const stats   = data.defaultKeyStatistics;
      const holders = data.majorHoldersBreakdown;
      const instOwn = data.institutionOwnership;

      return res.status(200).json({
        ticker: T,
        shortInterest: stats ? {
          shortFloat:  stats.shortPercentOfFloat?.raw ?? null,
          daysTocover: stats.shortRatio?.raw ?? null,
          shortVolume: stats.sharesShort?.raw ?? null,
          source: 'Yahoo Finance',
        } : null,
        institutional: holders ? {
          pctInsiders:     holders.insidersPercentHeld?.raw ?? null,
          pctInstitutions: holders.institutionsPercentHeld?.raw ?? null,
          topHolders: (instOwn?.ownershipList || []).slice(0,5).map(h => ({
            name:   h.organization,
            pct:    h.pctHeld?.raw ?? null,
            shares: h.position?.raw ?? null,
            value:  h.value?.raw ?? null,
            change: h.pctChange?.raw ?? null,
          })),
        } : null,
      });
    } catch(e) {
      return res.status(200).json({ ticker: T, shortInterest: null, institutional: null, error: e.message });
    }
  }

  return res.status(200).json({ ticker: T, ready: true });
}

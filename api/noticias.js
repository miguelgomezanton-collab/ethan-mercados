// /api/noticias.js — fetch RSS desde servidor (sin CORS)
// GET /api/noticias?tickers=AAPL,AVGO

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const tickers = req.query?.tickers?.split(',').filter(Boolean) || [];

  // Si hay tickers, buscar noticias específicas
  if (tickers.length > 0) {
    const results = {};
    for (const ticker of tickers.slice(0, 5)) {
      try {
        const query = encodeURIComponent(`${ticker} stock`);
        const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${ticker}&region=US&lang=en-US`;
        const r = await fetch(url, {
          signal: AbortSignal.timeout(6000),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ETHAN/1.0)' },
        });
        if (!r.ok) { results[ticker] = []; continue; }
        const text = await r.text();
        const items = [];
        const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/g);
        for (const match of itemMatches) {
          const item = match[1];
          const title = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || '';
          const link  = item.match(/<link>(.*?)<\/link>/)?.[1]?.trim() || '';
          const date  = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() || '';
          if (title && title.length > 5) items.push({ title, link, source: 'Yahoo Finance', date });
          if (items.length >= 3) break;
        }
        results[ticker] = items;
      } catch { results[ticker] = []; }
    }
    return res.status(200).json({ type: 'tickers', results });
  }

  // Noticias generales en español
  const feeds = [
    'https://www.expansion.com/rss/mercados.xml',
    'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada',
    'https://www.cincodias.elpais.com/rss/section/mercados/',
    'https://www.eleconomista.es/rss/rss-mercados-financieros.php',
  ];

  for (const feed of feeds) {
    try {
      const r = await fetch(feed, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ETHAN/1.0)' },
      });
      if (!r.ok) continue;
      const text = await r.text();
      const items = [];
      const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/g);
      for (const match of itemMatches) {
        const item = match[1];
        const title = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || '';
        const link  = item.match(/<link>(.*?)<\/link>/)?.[1]?.trim()
                   || item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1]?.trim() || '';
        const date  = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() || '';
        const source = new URL(feed).hostname.replace('www.','').replace('feeds.','');
        if (title && title.length > 5) items.push({ title, link, source, date });
        if (items.length >= 6) break;
      }
      if (items.length >= 3) return res.status(200).json({ type: 'general', items, source: feed });
    } catch {}
  }

  return res.status(200).json({ type: 'general', items: [], error: 'No se pudieron cargar noticias' });
}

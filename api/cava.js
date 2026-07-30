// /api/cava.js — José Luis Cava · Resumen de vídeos
// Sin dependencias externas — fetch nativo para transcripción

const CHANNEL_ID = 'UC6cpU68F1BiwwXoAC3sgcGQ';

async function getLatestVideos(n = 8) {
  // 1. Intentar scraping de la página del canal via worker — más reciente
  try {
    const channelUrl = 'https://www.youtube.com/@JoseLuisCavatv/videos';
    const workerUrl = `https://soft-field-156f.miguel-gomez-anton.workers.dev/?url=${encodeURIComponent(channelUrl)}`;
    const r = await fetch(workerUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'es-ES,es;q=0.9' },
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 12000); return c.signal; })(),
    });
    if (r.ok) {
      const html = await r.text();
      // Extraer initialData JSON que contiene los vídeos
      const dataMatch = html.match(/var ytInitialData = ({.+?});<\/script>/s) ||
                        html.match(/ytInitialData = ({.+?});\s*(?:var|window|<)/s);
      if (dataMatch) {
        const data = JSON.parse(dataMatch[1]);
        const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
        const videosTab = tabs.find(t => t.tabRenderer?.title === 'Videos' || t.tabRenderer?.selected);
        const items = videosTab?.tabRenderer?.content?.richGridRenderer?.contents ||
                      tabs[1]?.tabRenderer?.content?.richGridRenderer?.contents || [];
        const videos = [];
        for (const item of items) {
          if (videos.length >= n) break;
          const v = item?.richItemRenderer?.content?.videoRenderer;
          if (!v?.videoId) continue;
          const id = v.videoId;
          const title = v.title?.runs?.[0]?.text || v.title?.simpleText || '';
          const published = v.publishedTimeText?.simpleText || '';
          if (id && title) videos.push({
            id, title, published,
            thumb: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
            url: `https://www.youtube.com/watch?v=${id}`,
          });
        }
        if (videos.length > 0) return videos;
      }
    }
  } catch {}

  // 2. Fallback: RSS oficial
  const urls = [
    `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`,
    'https://www.youtube.com/feeds/videos.xml?user=JoseLuisCavatv',
  ];

  let xml = null;
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/xml' },
        signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })(),
      });
      if (r.ok) { xml = await r.text(); break; }
    } catch {}
  }
  if (!xml) throw new Error('YouTube: no se pudo obtener el feed del canal');

  const videos = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = entryRegex.exec(xml)) !== null && videos.length < n) {
    const entry = m[1];
    const id        = (/<yt:videoId>([^<]+)/.exec(entry)?.[1] || '').trim();
    const title     = (/<title>([^<]+)/.exec(entry)?.[1] || '').trim();
    const published = (/<published>([^<]+)/.exec(entry)?.[1] || '').slice(0,10);
    if (id && title) videos.push({
      id, title, published,
      thumb: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
      url:   `https://www.youtube.com/watch?v=${id}`,
    });
  }
  return videos;
}

async function getTranscript(videoId) {
  try {
    // Obtener la página del vídeo para extraer el endpoint de subtítulos
    const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const r = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })(),
    });
    if (!r.ok) return null;
    const html = await r.text();

    // Extraer URL de captions del playerResponse
    const captionsMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (!captionsMatch) return null;

    const tracks = JSON.parse(captionsMatch[1].replace(/\\u0026/g,'&').replace(/\\\\/g,'\\'));
    // Preferir español, luego cualquier idioma
    const track = tracks.find(t => t.languageCode === 'es') ||
                  tracks.find(t => t.languageCode?.startsWith('es')) ||
                  tracks[0];
    if (!track?.baseUrl) return null;

    // Descargar los subtítulos
    const sr = await fetch(track.baseUrl, { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 8000); return c.signal; })() });
    if (!sr.ok) return null;
    const xml = await sr.text();

    // Parsear XML de subtítulos
    const texts = [];
    const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/g;
    let tm;
    while ((tm = textRegex.exec(xml)) !== null) {
      const text = tm[1]
        .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
        .replace(/&quot;/g,'"').replace(/&#39;/g,"'")
        .replace(/<[^>]+>/g,'').trim();
      if (text) texts.push(text);
    }
    return texts.join(' ').slice(0, 8000);
  } catch { return null; }
}

async function summarize(title, transcript, apiKey) {
  const content = transcript
    ? `Título: ${title}\n\nTranscripción:\n${transcript}`
    : `Título del vídeo de José Luis Cava: "${title}"\n\nNo hay transcripción. Basándote SOLO en el título, genera tips de trading concretos y específicos sobre el activo o tema que menciona. Si menciona un activo concreto (oro, China, tipos, inflación...) genera tips accionables sobre ese activo.`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: `Eres un asistente de trading especializado en el estilo de José Luis Cava — análisis técnico, macro y especulación. ${content}

Responde SOLO con JSON sin markdown:
{"tips":["tip 1 concreto y accionable","tip 2","tip 3","tip 4","tip 5"],"resumen":"Una frase resumen del análisis"}

Los tips deben ser MUY concretos: niveles de precio, activos específicos, señales técnicas, sectores. Evita generalidades.` }],
    }),
    signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 30000); return c.signal; })(),
  });
  if (!r.ok) throw new Error(`Claude: ${r.status}`);
  const data = await r.json();
  const text = data.content?.find(b => b.type === 'text')?.text || '{}';
  const clean = text.replace(/```json\n?|```\n?/g,'').trim();
  try { return JSON.parse(clean); }
  catch { const m = clean.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : {}; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800');

  const apiKey = process.env.ANTHROPIC_API_KEY;

  try {
    const videos = await getLatestVideos(5);
    if (!videos.length) return res.status(200).json({ videos: [], error: 'Sin vídeos' });

    const results = await Promise.all(videos.map(async (v, i) => {
      if (i >= 5) return { ...v, tips: [], resumen: '', hasTranscript: false };
      const transcript = await getTranscript(v.id);
      if (!apiKey) return { ...v, tips: [], resumen: '', hasTranscript: !!transcript };
      const summary = await summarize(v.title, transcript, apiKey).catch(() => ({ tips: [], resumen: '' }));
      return { ...v, tips: summary.tips || [], resumen: summary.resumen || '', hasTranscript: !!transcript };
    }));

    return res.status(200).json({ videos: results, timestamp: new Date().toISOString() });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}

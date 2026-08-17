import { getMacroData } from './macro-data.js';
import { UserData } from '../../userdata.js';

const ESTRATEGIA_KEY = 'ethan_estrategia_ia';

// ── Fetch sectores via proxy ─────────────────────────────
const SECTOR_ETFS = [
  { name:'Tecnología',          etf:'XLK',  proxy:'QQQ' },
  { name:'Semiconductores',     etf:'SOXX', proxy:'SOXX' },
  { name:'Consumo discrecional',etf:'XLY',  proxy:'XLY' },
  { name:'Energía',             etf:'XLE',  proxy:'XLE' },
  { name:'Financiero',          etf:'XLF',  proxy:'XLF' },
  { name:'Healthcare',          etf:'XLV',  proxy:'XLV' },
  { name:'Utilities',           etf:'XLU',  proxy:'XLU' },
  { name:'Inmobiliario',        etf:'XLRE', proxy:'XLRE' },
];

const PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
];

async function fetchETFData(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=3mo`;
  for (const fn of PROXIES) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(fn(url), { signal: ctrl.signal });
      clearTimeout(tid);
      if (!r.ok) continue;
      const data = await r.json();
      const res = data?.chart?.result?.[0];
      if (!res) continue;
      const closes = res.indicators?.quote?.[0]?.close?.filter(v => v != null);
      if (!closes?.length) continue;
      const last  = closes[closes.length-1];
      const prev  = closes[closes.length-2] || last;
      const ma20  = closes.slice(-20).reduce((a,b)=>a+b,0)/Math.min(20,closes.length);
      const ma50  = closes.slice(-50).reduce((a,b)=>a+b,0)/Math.min(50,closes.length);
      const chg1d = (last-prev)/prev*100;
      const chg1m = closes.length>20?(last-closes[closes.length-21])/closes[closes.length-21]*100:0;
      // Score técnico simple: precio vs MA20 vs MA50
      let score = 50;
      if (last > ma20) score += 15;
      if (last > ma50) score += 15;
      if (ma20 > ma50) score += 10;
      if (chg1m > 0)   score += 10;
      score = Math.min(100, Math.max(0, score));
      return { last, chg1d, chg1m, ma20, ma50, score };
    } catch {}
  }
  return null;
}

// ── Fetch Cava ─────────────────────────────────────────
async function fetchCava() {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch('/api/cava', { signal: ctrl.signal });
    clearTimeout(tid);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.videos || []).slice(0,3);
  } catch { return []; }
}

// ── Generar estrategia con Claude ───────────────────────
async function generarEstrategia(macro, sectores, cavaVideos, posiciones) {
  const scoreTotal = macro?.scoreTotal ?? 0;
  const coyuntura  = macro?.coyuntura?.label || 'Desaceleración';
  const rvPct      = scoreTotal>=10?'75-90%':scoreTotal>=4?'55-70%':scoreTotal>=0?'35-55%':'15-35%';

  const sectoresTexto = sectores.map(s =>
    `${s.name} (${s.etf}): score técnico ${s.score ?? '—'}/100, cambio 1m ${s.chg1m?.toFixed(1) ?? '—'}%`
  ).join('\n');

  const cavaTexto = cavaVideos.map(v => {
    const tips = v.tips?.length ? v.tips.map((t,i)=>`  ${i+1}. ${t}`).join('\n') : '  Sin tips disponibles';
    return `"${v.title}" (${v.published}):\n${tips}`;
  }).join('\n\n');

  const posicionesTexto = posiciones?.length
    ? posiciones.map(p => `${p.ticker}: ${p.direction||'alcista'}, entrada ${p.entry}`).join(', ')
    : 'Sin posiciones abiertas';

  const prompt = `Eres el asistente de inversión de la plataforma ETHAN Mercados. Analiza la siguiente información y genera una estrategia de inversión concreta para los próximos 30 días.

SCORE MACRO ETHAN: ${scoreTotal}/+17 — Fase: ${coyuntura}
Exposición RV recomendada por score: ${rvPct}

ANÁLISIS SECTORIAL (score técnico 0-100):
${sectoresTexto}

ÚLTIMOS ANÁLISIS DE JOSÉ LUIS CAVA:
${cavaTexto}

POSICIONES ABIERTAS ACTUALES:
${posicionesTexto}

Genera una estrategia de inversión en formato JSON exacto (sin markdown, sin texto extra):
{
  "titulo": "Título conciso de la estrategia",
  "resumen": "Párrafo de 3-4 frases explicando el contexto macro y la tesis principal",
  "acciones": [
    {
      "tipo": "comprar|vigilar|evitar",
      "titulo": "Nombre del activo o sector",
      "descripcion": "2-3 frases explicando por qué y cómo",
      "tags": ["tag1", "tag2"]
    }
  ],
  "distribucion": [
    {
      "nombre": "Sector o tipo de activo",
      "pct": 35,
      "razon": "Una frase",
      "etf": "ETF o ticker de referencia"
    }
  ],
  "riesgos": ["riesgo 1", "riesgo 2", "riesgo 3"],
  "catalizadores": ["catalizador 1", "catalizador 2", "catalizador 3"]
}

Sé concreto y accionable. Usa los datos reales proporcionados. Máximo 4 acciones y 4 entradas en distribución.`;

  const r = await fetch('/api/macro-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!r.ok) throw new Error(`Error API: ${r.status}`);
  const data = await r.json();
  const text = data.text || data.resultado || data.content || '';
  if (!text) throw new Error('Sin respuesta de la IA — comprueba los créditos de Anthropic');
  const clean = text.replace(/```json\n?|```\n?/g,'').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Respuesta IA no válida');
  return JSON.parse(match[0]);
}

// ── CSS ─────────────────────────────────────────────────
const CSS = `
.inv-tabs{display:flex;gap:3px;border-bottom:1px solid var(--border);margin-bottom:20px;}
.inv-tab{padding:10px 18px;background:transparent;border:none;color:var(--text3);cursor:pointer;font-size:11px;font-weight:600;letter-spacing:0.03em;border-bottom:2px solid transparent;font-family:var(--sans);transition:all 0.15s;}
.inv-tab:hover{color:var(--text2);}
.inv-tab.active{color:var(--teal);border-bottom-color:var(--teal);}
.inv-panel{display:none;}
.inv-panel.active{display:block;animation:fadeIn 0.2s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}

.inv-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px 22px;margin-bottom:14px;}
.inv-card-sm{background:var(--surface2);border-radius:8px;padding:14px 16px;}
.inv-card-title{font-family:var(--mono);font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--text3);margin-bottom:12px;}
.inv-g2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}
.inv-g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px;}

/* Macro banner */
.inv-macro-banner{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px 24px;display:grid;grid-template-columns:auto 1fr auto;gap:24px;align-items:center;margin-bottom:14px;}
.inv-score-big{font-family:var(--serif);font-size:64px;font-weight:600;font-style:italic;line-height:1;}
.inv-score-label{font-family:var(--serif);font-size:22px;font-style:italic;margin-bottom:4px;}
.inv-score-sub{font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:0.12em;}
.inv-pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;}
.inv-pill{background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:4px 10px;font-family:var(--mono);font-size:9px;color:var(--text2);}
.inv-pill.pos{border-color:rgba(74,222,128,0.3);color:var(--green);}
.inv-pill.neg{border-color:rgba(244,113,116,0.3);color:var(--red);}
.inv-pill.neu{border-color:rgba(251,191,36,0.3);color:var(--amber);}

/* Sectores */
.inv-sector-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);}
.inv-sector-row:last-child{border-bottom:none;}
.inv-sector-name{font-size:11px;color:var(--text1);width:170px;flex-shrink:0;}
.inv-sector-etf{font-family:var(--mono);font-size:9px;color:var(--text3);width:44px;}
.inv-bar-track{flex:1;height:5px;background:var(--surface2);border-radius:3px;overflow:hidden;}
.inv-bar-fill{height:100%;border-radius:3px;}
.inv-sector-score{font-family:var(--mono);font-size:11px;font-weight:700;width:36px;text-align:right;}
.inv-sector-chg{font-family:var(--mono);font-size:9px;width:52px;text-align:right;}
.inv-signal{font-family:var(--mono);font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;white-space:nowrap;}
.inv-signal.buy{background:rgba(74,222,128,0.12);color:var(--green);}
.inv-signal.neu{background:rgba(251,191,36,0.08);color:var(--amber);}
.inv-signal.avoid{background:rgba(244,113,116,0.08);color:var(--red);}

/* Cava */
.inv-cava-title{font-size:12px;font-weight:600;color:var(--text1);margin-bottom:4px;}
.inv-cava-date{font-family:var(--mono);font-size:9px;color:var(--text3);margin-bottom:10px;}
.inv-tip-row{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);align-items:flex-start;}
.inv-tip-row:last-child{border-bottom:none;}
.inv-tip-num{font-family:var(--mono);font-size:9px;color:var(--teal);font-weight:700;flex-shrink:0;width:18px;}
.inv-tip-text{font-size:11px;color:var(--text1);line-height:1.5;}

/* Confluencias */
.inv-conf-card{background:var(--surface2);border-radius:8px;padding:12px 14px;border-left:3px solid transparent;}
.inv-conf-card.pos{border-left-color:var(--green);}
.inv-conf-card.neg{border-left-color:var(--red);}
.inv-conf-card.neu{border-left-color:var(--amber);}
.inv-conf-tipo{font-family:var(--mono);font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;}
.inv-conf-titulo{font-size:12px;font-weight:600;color:var(--text1);margin-bottom:5px;}
.inv-conf-desc{font-size:11px;color:var(--text2);line-height:1.5;}

/* Generar */
.inv-generate-bar{background:linear-gradient(135deg,rgba(64,217,192,0.06),rgba(64,217,192,0.02));border:1px solid rgba(64,217,192,0.2);border-radius:12px;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
.inv-generate-info h3{font-family:var(--serif);font-size:20px;font-style:italic;color:var(--text1);margin-bottom:3px;}
.inv-generate-info p{font-size:10px;color:var(--text2);font-family:var(--mono);}
.inv-sources{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;}
.inv-source{background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-family:var(--mono);font-size:9px;color:var(--text2);display:flex;align-items:center;gap:5px;}
.inv-dot{width:6px;height:6px;border-radius:50%;}

/* Estrategia output */
.inv-strategy-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;}
.inv-strategy-title{font-family:var(--serif);font-size:28px;font-weight:400;font-style:italic;line-height:1.2;}
.inv-strategy-meta{font-family:var(--mono);font-size:9px;color:var(--text3);text-align:right;line-height:1.8;}
.inv-resumen{font-family:var(--serif);font-size:15px;font-weight:300;color:var(--text2);line-height:1.8;border-left:3px solid var(--teal);padding-left:18px;margin-bottom:20px;}
.inv-resumen em{color:var(--teal);font-style:italic;}

.inv-accion{background:var(--surface2);border-radius:10px;padding:14px 16px;border-left:3px solid transparent;}
.inv-accion.comprar{border-left-color:var(--green);}
.inv-accion.vigilar{border-left-color:var(--amber);}
.inv-accion.evitar{border-left-color:var(--red);}
.inv-accion-tipo{font-family:var(--mono);font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:5px;}
.inv-accion-tipo.comprar{color:var(--green);}
.inv-accion-tipo.vigilar{color:var(--amber);}
.inv-accion-tipo.evitar{color:var(--red);}
.inv-accion-titulo{font-size:12px;font-weight:600;color:var(--text1);margin-bottom:5px;}
.inv-accion-desc{font-size:11px;color:var(--text2);line-height:1.5;}
.inv-accion-tags{display:flex;gap:5px;margin-top:7px;flex-wrap:wrap;}
.inv-accion-tag{font-family:var(--mono);font-size:9px;background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:2px 6px;color:var(--text3);}

.inv-dist-row{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--surface2);border-radius:8px;}
.inv-dist-pct{font-family:var(--serif);font-size:24px;font-style:italic;font-weight:600;width:56px;text-align:right;flex-shrink:0;}
.inv-dist-name{font-size:12px;font-weight:600;color:var(--text1);margin-bottom:2px;}
.inv-dist-razon{font-size:10px;color:var(--text2);line-height:1.4;}
.inv-dist-etf{font-family:var(--mono);font-size:9px;color:var(--text3);margin-top:2px;}

.inv-disclaimer{font-family:var(--mono);font-size:9px;color:var(--text3);background:var(--surface2);border-radius:6px;padding:10px 14px;margin-top:14px;line-height:1.6;}
.inv-insight{border-left:2px solid var(--teal);background:rgba(64,217,192,0.05);padding:10px 14px;border-radius:0 8px 8px 0;font-size:11px;color:var(--text2);line-height:1.6;margin-top:12px;}
.inv-insight strong{color:var(--text1);}
.inv-divider{height:1px;background:var(--border);margin:14px 0;}

.inv-empty{text-align:center;padding:48px 20px;color:var(--text3);font-family:var(--mono);font-size:11px;}
.inv-empty-icon{font-size:32px;margin-bottom:12px;}
.inv-empty-title{font-size:13px;color:var(--text2);margin-bottom:6px;}
.inv-empty-desc{font-size:11px;color:var(--text3);}
.inv-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:14px;}
.inv-loader-ring{width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--teal);border-radius:50%;animation:spin 0.8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}
`;

// ── Render ───────────────────────────────────────────────
export async function render(container, { actionsSlot }) {
  if (!document.getElementById('inv-css')) {
    const s = document.createElement('style'); s.id = 'inv-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  actionsSlot.innerHTML = `<button class="btn btn-primary" id="inv-refresh">↻ Actualizar</button>`;
  container.innerHTML = `
    <div id="inv-wrap">
      <div class="inv-tabs">
        <button class="inv-tab active" data-tab="analisis">📊 Análisis Actual</button>
        <button class="inv-tab" data-tab="estrategia">🤖 Estrategia IA</button>
      </div>
      <div class="inv-panel active" id="inv-panel-analisis">
        <div class="inv-loader"><div class="inv-loader-ring"></div></div>
      </div>
      <div class="inv-panel" id="inv-panel-estrategia">
        <div class="inv-loader"><div class="inv-loader-ring"></div></div>
      </div>
    </div>`;

  // Tab switching
  container.querySelectorAll('.inv-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.inv-tab').forEach(t => t.classList.remove('active'));
      container.querySelectorAll('.inv-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('inv-panel-' + tab.dataset.tab).classList.add('active');
    });
  });

  let macroData = null, sectoresData = [], cavaData = [], posicionesData = [];

  async function load() {
    try {
      // Cargar todo en paralelo
      const [macro, positions, estrategia] = await Promise.all([
        getMacroData(false),
        UserData.get('ethan_positions').then(v => v || []),
        UserData.get(ESTRATEGIA_KEY).then(v => v || null),
      ]);
      macroData = macro;
      posicionesData = positions.filter(p => !p.exitDateISO);

      // Cargar sectores y Cava en paralelo (no bloquean el render inicial)
      paintAnalisis(macro, [], []);
      paintEstrategia(estrategia);

      // Carga secundaria: sectores + Cava
      const [sectores, cava] = await Promise.all([
        Promise.all(SECTOR_ETFS.map(async s => {
          const data = await fetchETFData(s.etf);
          return { ...s, ...(data || {}) };
        })),
        fetchCava(),
      ]);
      sectoresData = sectores;
      cavaData = cava;
      paintAnalisis(macro, sectores, cava);
    } catch(e) {
      document.getElementById('inv-panel-analisis').innerHTML =
        `<div class="inv-empty"><div class="inv-empty-icon">⚠</div><div class="inv-empty-title">Error al cargar</div><div class="inv-empty-desc">${e.message}</div></div>`;
    }
  }

  function paintAnalisis(macro, sectores, cava) {
    const el = document.getElementById('inv-panel-analisis');
    const s = macro?.scoreTotal ?? 0;
    const mainCol = s >= 4 ? 'var(--green)' : s >= 0 ? 'var(--amber)' : 'var(--red)';
    const fase = macro?.coyuntura?.label || (s>=8?'Expansión':s>=4?'Desaceleración moderada':s>=0?'Contracción':'Crisis');
    const rvPct = s>=10?'75-90%':s>=4?'55-70%':s>=0?'35-55%':'15-35%';
    const ind = macro?.indicators || {};
    const fmtN = (v,d=2) => v!=null?Number(v).toFixed(d):'—';

    // Sectores
    const sectoresHTML = sectores.length ? sectores.map(s => {
      const score = s.score ?? 50;
      const barCol = score >= 65 ? 'linear-gradient(90deg,var(--green),rgba(74,222,128,0.4))' :
                     score >= 45 ? 'linear-gradient(90deg,var(--amber),rgba(251,191,36,0.4))' :
                                   'linear-gradient(90deg,var(--red),rgba(244,113,116,0.4))';
      const scoreCol = score >= 65 ? 'var(--green)' : score >= 45 ? 'var(--amber)' : 'var(--red)';
      const signal = score >= 65 ? '<span class="inv-signal buy">COMPRAR</span>' :
                     score >= 45 ? '<span class="inv-signal neu">NEUTRAL</span>' :
                                   '<span class="inv-signal avoid">EVITAR</span>';
      const chgCol = (s.chg1m ?? 0) >= 0 ? 'var(--green)' : 'var(--red)';
      return `<div class="inv-sector-row">
        <span class="inv-sector-name">${s.name}</span>
        <span class="inv-sector-etf">${s.etf}</span>
        <div class="inv-bar-track"><div class="inv-bar-fill" style="width:${score}%;background:${barCol}"></div></div>
        <span class="inv-sector-score" style="color:${scoreCol}">${score}</span>
        <span class="inv-sector-chg" style="color:${chgCol}">${(s.chg1m??0)>=0?'+':''}${fmtN(s.chg1m,1)}%</span>
        ${signal}
      </div>`;
    }).join('') : `<div style="text-align:center;padding:20px;font-family:var(--mono);font-size:11px;color:var(--text3);">Cargando datos sectoriales...</div>`;

    // Cava
    const cavaHTML = cava.length ? cava.slice(0,2).map(v => `
      <div style="margin-bottom:14px;">
        <div class="inv-cava-title">${v.title}</div>
        <div class="inv-cava-date">${v.published}</div>
        ${(v.tips||[]).slice(0,3).map((t,i) => `
          <div class="inv-tip-row"><span class="inv-tip-num">${i+1}</span><span class="inv-tip-text">${t}</span></div>
        `).join('')}
      </div>
      <div class="inv-divider"></div>`).join('')
    : `<div style="font-family:var(--mono);font-size:11px;color:var(--text3);padding:10px 0;">Sin vídeos de Cava disponibles</div>`;

    // Confluencias
    const buySectors = sectores.filter(s => (s.score??50) >= 65).map(s=>s.name);
    const avoidSectors = sectores.filter(s => (s.score??50) < 45).map(s=>s.name);

    el.innerHTML = `
      <!-- Macro banner -->
      <div class="inv-macro-banner">
        <div class="inv-score-big" style="color:${mainCol}">${s > 0 ? '+' : ''}${s}</div>
        <div>
          <div class="inv-score-label" style="color:${mainCol}">${fase}</div>
          <div class="inv-score-sub">Score macro ETHAN · −17 a +17 · ${new Date().toLocaleDateString('es-ES')}</div>
          <div class="inv-pills">
            ${ind.curvaUS != null ? `<span class="inv-pill ${ind.curvaUS>0?'pos':'neg'}">📈 Curva ${fmtN(ind.curvaUS)}%</span>` : ''}
            ${ind.m2Global != null ? `<span class="inv-pill ${ind.m2Global>0?'pos':'neg'}">💧 M2 ${fmtN(ind.m2Global,1)}%</span>` : ''}
            ${ind.fearGreed != null ? `<span class="inv-pill ${ind.fearGreed>50?'pos':ind.fearGreed>30?'neu':'neg'}">😰 F&G ${Math.round(ind.fearGreed)}</span>` : ''}
            ${ind.vix != null ? `<span class="inv-pill ${ind.vix<15?'pos':ind.vix<25?'neu':'neg'}">⚡ VIX ${fmtN(ind.vix,1)}</span>` : ''}
          </div>
        </div>
        <div style="text-align:right;">
          <div class="inv-score-sub" style="margin-bottom:6px;">Exposición RV recomendada</div>
          <div style="font-family:var(--serif);font-size:32px;font-style:italic;font-weight:600;color:${mainCol}">${rvPct}</div>
        </div>
      </div>

      <div class="inv-g2">
        <!-- Sectores -->
        <div class="inv-card">
          <div class="inv-card-title">Señal técnica sectorial</div>
          ${sectoresHTML}
        </div>

        <!-- Cava -->
        <div class="inv-card">
          <div class="inv-card-title">José Luis Cava — Últimos análisis</div>
          ${cavaHTML}
          ${cava[0]?.resumen ? `<div class="inv-insight"><strong>Resumen:</strong> ${cava[0].resumen}</div>` : ''}
        </div>
      </div>

      <!-- Confluencias -->
      <div class="inv-card">
        <div class="inv-card-title">Confluencias — Macro · Sectores · Cava</div>
        <div class="inv-g3">
          <div class="inv-conf-card pos">
            <div class="inv-conf-tipo" style="color:var(--green);">✓ Confluencia alcista</div>
            <div class="inv-conf-titulo">${buySectors.slice(0,2).join(' + ') || 'Sin señal clara'}</div>
            <div class="inv-conf-desc">Score macro positivo + señal técnica fuerte. Mayor probabilidad de continuidad alcista.</div>
          </div>
          <div class="inv-conf-card neg">
            <div class="inv-conf-tipo" style="color:var(--red);">✗ Confluencia bajista</div>
            <div class="inv-conf-titulo">${avoidSectors.slice(0,2).join(' + ') || 'Sin señal clara'}</div>
            <div class="inv-conf-desc">Señal técnica débil en entorno macro de desaceleración. Evitar o posición corta táctica.</div>
          </div>
          <div class="inv-conf-card neu">
            <div class="inv-conf-tipo" style="color:var(--amber);">◈ Gestión de riesgo</div>
            <div class="inv-conf-titulo">Exposición actual vs recomendada</div>
            <div class="inv-conf-desc">Score ${s >= 0 ? '+' : ''}${s} sugiere RV ${rvPct}. Ajusta la cartera si tu exposición actual difiere significativamente.</div>
          </div>
        </div>
      </div>`;
  }

  function paintEstrategia(estrategia) {
    const el = document.getElementById('inv-panel-estrategia');

    el.innerHTML = `
      <div class="inv-generate-bar">
        <div class="inv-generate-info">
          <h3>Estrategia IA</h3>
          <p>Combina score macro · señales sectoriales · análisis de Cava · posiciones actuales</p>
        </div>
        <button class="btn btn-primary" id="inv-generar-btn" ${!estrategia?'':'style="background:transparent;border-color:rgba(64,217,192,0.3);"'}>
          ${estrategia ? '↺ Nueva estrategia' : '⚡ Generar estrategia'}
        </button>
      </div>
      <div class="inv-sources">
        <div class="inv-source"><div class="inv-dot" style="background:var(--teal)"></div>Score macro</div>
        <div class="inv-source"><div class="inv-dot" style="background:var(--blue)"></div>11 sectores</div>
        <div class="inv-source"><div class="inv-dot" style="background:var(--amber)"></div>Vídeos Cava</div>
        <div class="inv-source"><div class="inv-dot" style="background:var(--green)"></div>${posicionesData.length} posiciones</div>
      </div>
      <div id="inv-estrategia-output">
        ${estrategia ? renderEstrategiaHTML(estrategia) : `
          <div class="inv-empty">
            <div class="inv-empty-icon">🤖</div>
            <div class="inv-empty-title">Sin estrategia generada</div>
            <div class="inv-empty-desc">Pulsa el botón para generar tu primera estrategia de inversión con IA</div>
          </div>`}
      </div>`;

    document.getElementById('inv-generar-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('inv-generar-btn');
      const output = document.getElementById('inv-estrategia-output');
      btn.disabled = true;
      btn.textContent = 'Analizando...';
      output.innerHTML = `
        <div class="inv-loader">
          <div class="inv-loader-ring"></div>
          <div style="font-family:var(--mono);font-size:11px;color:var(--text2);">Analizando macro, sectores y Cava con IA...</div>
          <div style="font-family:var(--mono);font-size:10px;color:var(--text3);">Puede tardar 20-30 segundos</div>
        </div>`;
      try {
        const estrategia = await generarEstrategia(macroData, sectoresData, cavaData, posicionesData);
        estrategia.generadoEn = new Date().toISOString();
        await UserData.set(ESTRATEGIA_KEY, estrategia);
        output.innerHTML = renderEstrategiaHTML(estrategia);
        btn.textContent = '↺ Nueva estrategia';
        btn.style.cssText = 'background:transparent;border-color:rgba(64,217,192,0.3);';
      } catch(e) {
        output.innerHTML = `<div class="inv-empty"><div class="inv-empty-icon">⚠</div><div class="inv-empty-title">Error al generar</div><div class="inv-empty-desc">${e.message}</div></div>`;
        btn.textContent = '⚡ Intentar de nuevo';
      }
      btn.disabled = false;
    });
  }

  function renderEstrategiaHTML(e) {
    if (!e) return '';
    const fecha = e.generadoEn ? new Date(e.generadoEn).toLocaleString('es-ES',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    const accionesHTML = (e.acciones||[]).map(a => `
      <div class="inv-accion ${a.tipo}">
        <div class="inv-accion-tipo ${a.tipo}">${a.tipo==='comprar'?'✓ Buscar entradas':a.tipo==='vigilar'?'⚠ Vigilar':'✗ Evitar'}</div>
        <div class="inv-accion-titulo">${a.titulo}</div>
        <div class="inv-accion-desc">${a.descripcion}</div>
        ${(a.tags||[]).length?`<div class="inv-accion-tags">${a.tags.map(t=>`<span class="inv-accion-tag">${t}</span>`).join('')}</div>`:''}
      </div>`).join('');

    const distHTML = (e.distribucion||[]).map(d => {
      const col = d.pct >= 30 ? 'var(--teal)' : d.nombre.toLowerCase().includes('cash') ? 'var(--text3)' : 'var(--text2)';
      return `<div class="inv-dist-row">
        <div class="inv-dist-pct" style="color:${col}">${d.pct}%</div>
        <div>
          <div class="inv-dist-name">${d.nombre}</div>
          <div class="inv-dist-razon">${d.razon}</div>
          <div class="inv-dist-etf">${d.etf}</div>
        </div>
      </div>`;
    }).join('');

    const riesgosHTML = (e.riesgos||[]).map(r=>`<div style="padding:3px 0;font-size:11px;color:var(--text2);">— ${r}</div>`).join('');
    const catHTML = (e.catalizadores||[]).map(c=>`<div style="padding:3px 0;font-size:11px;color:var(--text2);">— ${c}</div>`).join('');

    return `<div class="inv-card">
      <div class="inv-strategy-header">
        <div class="inv-strategy-title">${e.titulo || 'Estrategia de inversión'}</div>
        <div class="inv-strategy-meta">
          <div style="color:var(--teal);font-weight:700;font-family:var(--mono);">Generado con IA</div>
          <div>${fecha}</div>
        </div>
      </div>
      <div class="inv-resumen">${e.resumen||''}</div>

      <div class="inv-card-title" style="margin-bottom:10px;">Acciones recomendadas</div>
      <div class="inv-g2" style="margin-bottom:20px;">${accionesHTML}</div>

      <div class="inv-card-title" style="margin-bottom:10px;">Distribución sugerida</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">${distHTML}</div>

      <div class="inv-g2">
        <div class="inv-card-sm">
          <div class="inv-card-title">Riesgos principales</div>
          ${riesgosHTML}
        </div>
        <div class="inv-card-sm">
          <div class="inv-card-title">Catalizadores positivos</div>
          ${catHTML}
        </div>
      </div>
      <div class="inv-disclaimer">⚠ Estrategia generada por IA con datos de ETHAN Mercados. No constituye asesoramiento financiero. Verifica siempre las señales M+S+D antes de ejecutar.</div>
    </div>`;
  }

  document.getElementById('inv-refresh')?.addEventListener('click', load);
  load();
  return { destroy() { document.getElementById('inv-css')?.remove(); } };
}

import { getMacroData } from './macro-data.js';

const f1 = v => v != null ? Number(v).toFixed(1) : '—';
const f2 = v => v != null ? Number(v).toFixed(2) : '—';

// ── Construir prompt para Claude ─────────────
function buildPrompt(macro) {
  const co  = macro.coyuntura  || {};
  const liq = macro.liquidez   || {};
  const seg = macro.seguimiento|| {};
  const ind = macro.indicators || {};
  const rc  = macro.riesgoContagio;
  const p   = macro.probabilities || {};
  const s   = macro.scoreTotal ?? 0;

  const line = (label, val, unit='') => val != null ? `- ${label}: ${typeof val==='number'?(val>=0?'+':'')+f2(val):val}${unit}` : null;

  const dataBlock = [
    `SCORE MACRO TOTAL: ${s>=0?'+':''}${s} / +17 → ${macro.zone}`,
    '',
    '## INDICADORES ADELANTADOS',
    line('Curva USD (10Y−2Y)', co.curvaUSD?.value, '%') + (co.curvaUSD?.score!=null ? ` → score ${co.curvaUSD.score>0?'+1':co.curvaUSD.score===0?'0':'-1'} (umbral: ≥+0.90%→+1, +0.48-0.89%→0, <+0.48%→-1)` : ''),
    line('Curva EUR (10Y−2Y)', co.curvaEUR?.value, '%') + (co.curvaEUR?.score!=null ? ` → score ${co.curvaEUR.score>0?'+1':co.curvaEUR.score===0?'0':'-1'} (umbral: ≥+0.60%→+1)` : ''),
    line('LEI USA m/m', ind.lei?.value, '%') + (ind.lei?.score!=null ? ` → score ${ind.lei.score>0?'+1':ind.lei.score===0?'0':'-1'} (umbral: ≥+0.3%→+1)` : ''),
    '',
    '## LIQUIDEZ GLOBAL',
    line('M2 Global YoY', liq.m2?.value, '%') + (liq.m2?.score!=null ? ` → score ${liq.m2.score} (umbral: ≥+5%→+3, +3-4.9%→+1, <+3%→-3, peso ×3)` : ''),
    liq.m2?.components ? `  Desglose: USA ${f2(liq.m2.components.usYoY)}% / EUR ${f2(liq.m2.components.eurYoY)}% / JPN ${f2(liq.m2.components.jpYoY)}% / CHN ${liq.m2.components.chnYoY!=null?f2(liq.m2.components.chnYoY)+'%':'pendiente'}` : null,
    line('Crédito vs Nominal GDP', liq.credito?.value, '%') + (liq.credito?.score!=null ? ` → score ${liq.credito.score} (peso ×3)` : ''),
    liq.credito?.creditYoY!=null ? `  Desglose: crédito YoY ${f2(liq.credito.creditYoY)}% vs GDP YoY ${f2(liq.credito.gdpYoY)}%` : null,
    line('Impulso Crediticio', liq.impulso?.value) + (liq.impulso?.score!=null ? ` → score ${liq.impulso.score} (peso ×2)` : ''),
    line('Velocidad M2 YoY', liq.velM2?.value, '%') + (liq.velM2?.score!=null ? ` → score ${liq.velM2.score} (peso ×2)` : ''),
    line('Reservas Bancarias Fed', liq.reservas?.value, 'T$') + (liq.reservas?.score!=null ? ` → score ${liq.reservas.score} (umbral: ≥$3.5T→+1)` : ''),
    line('BBB Spread', liq.bbbSpread?.value, '%') + (liq.bbbSpread?.score!=null ? ` → score ${liq.bbbSpread.score} (umbral: ≤1.00%→+1)` : ''),
    '',
    '## POLÍTICA MONETARIA & INFLACIÓN',
    line('Fed Funds Rate', seg.ffr?.value, '%'),
    line('Tipo Real (FFR−CPI)', co.tipoReal?.value, '%') + (co.tipoReal?.score!=null ? ` → score ${co.tipoReal.score>0?'+1':co.tipoReal.score===0?'0':'-1'} (umbral: ≥+1.0%→+1)` : ''),
    line('CPI Headline YoY', co.cpi?.value, '%'),
    line('CPI Core YoY', co.cpi?.cpiCore, '%'),
    rc ? `- Riesgo de Contagio inflacionario: ${rc.nivel.toUpperCase()} (${rc.pct}%) — tipo ${rc.tipo}` : null,
    line('Breakeven 1Y (T1YIE)', seg.breakeven1y?.value, '%'),
    line('Breakeven 5Y (T5YIE)', seg.breakeven5y?.value, '%'),
    '',
    '## SENTIMIENTO & CRÉDITO',
    ind.fearGreed?.value!=null ? `- Fear & Greed CNN: ${ind.fearGreed.value} (${ind.fearGreed.label_text||'—'}) → score ${ind.fearGreed.score>0?'+1':ind.fearGreed.score===0?'0':'-1'} (umbral: <40→+1 contrarian, >54→-1 riesgo)` : null,
    seg.vix ? `- VIX: ${f1(seg.vix.value)} vs SMA200: ${f1(seg.vix.sma200)} → ${seg.vix.aboveSMA200?'SOBRE SMA200 — alerta volatilidad bajista':'bajo SMA200 — volatilidad contenida'}` : null,
    line('HY Spread', seg.hySpread?.value, '%'),
    seg.wti ? `- WTI: $${f1(seg.wti.value)} (${seg.wti.change>=0?'+':''}${f1(seg.wti.change)}% hoy)` : null,
    '',
    '## PROBABILIDADES DE ESCENARIO',
    `- Recesión 12m: ${p.recesion||0}%`,
    `- Stagflación: ${p.stagflation||0}%`,
    `- Soft Landing: ${p.softLanding||0}%`,
    `- Expansión: ${p.expansion||0}%`,
  ].filter(Boolean).join('\n');

  return `Eres ETHAN, un sistema de análisis macroeconómico profesional para un inversor particular. 
Tienes acceso a los datos macro actualizados del sistema de scoring ETHAN (rango -17 a +17).

Aquí están los datos macro en tiempo real:

${dataBlock}

INSTRUCCIONES:
Genera un análisis ejecutivo en español de exactamente 5 párrafos. Estructura:
1. DIAGNÓSTICO DEL CICLO: dónde estamos y hacia dónde vamos, usando los indicadores adelantados (curvas, LEI)
2. LIQUIDEZ: si hay combustible para que el ciclo continúe o no, qué dice el M2, el crédito y las reservas
3. INFLACIÓN Y POLÍTICA MONETARIA: si la Fed puede actuar o está atrapada, riesgo de contagio estructural
4. SENTIMIENTO Y SEÑALES DE MERCADO: qué dice el Fear&Greed, el VIX y los spreads de crédito
5. CONCLUSIÓN ACCIONABLE: 2-3 frases concretas sobre posicionamiento para esta semana

Reglas de formato estrictas:
- NO uses #, ##, ---,  ni ningún símbolo markdown de encabezado o separador
- Empieza cada párrafo directamente con el título en MAYÚSCULAS seguido de un espacio y el texto, sin salto de línea entre título y contenido. Ejemplo: "DIAGNÓSTICO DEL CICLO El ciclo muestra..."
- Usa **negrita** solo para conceptos clave dentro del texto
- Sin bullet points, todo en prosa continua
- No repitas los números que ya aparecen en el dashboard — interprétalos
- Tono directo, técnico pero claro, sin rodeos`;
}

// ── Llamada a Claude vía proxy serverless ─────
async function callClaude(prompt) {
  const response = await fetch('/api/macro-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.text || '';
}

// ── Render principal ──────────────────────────
export async function render(container, { actionsSlot }) {
  actionsSlot.innerHTML = `
    <button class="btn" id="home-ai-btn">✦ Análisis ETHAN IA</button>
    <button class="btn btn-primary" id="home-refresh">↻ Actualizar</button>
  `;
  container.innerHTML = `<div id="home-wrap"><div class="empty"><div class="loader-ring"></div><div class="empty-title">Cargando dashboard...</div></div></div>`;

  let currentMacro = null;

  async function load(force = false) {
    try { const m = await getMacroData(force); currentMacro = m; paint(m); }
    catch(e) { document.getElementById('home-wrap').innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Error</div><div class="empty-desc">${e.message}</div></div>`; }
  }

  async function generateAI() {
    if (!currentMacro) return;
    const btn = document.getElementById('home-ai-btn');
    const box = document.getElementById('home-ai-box');
    if (!box) return;

    btn.disabled = true;
    btn.textContent = '✦ Generando...';
    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;">
        <div class="loader-ring"></div>
        <span style="font-size:11px;color:var(--text3);font-family:var(--mono);">Analizando ${Object.values(currentMacro.indicators||{}).filter(i=>i?.score!=null).length} indicadores macro...</span>
      </div>`;

    try {
      const prompt = buildPrompt(currentMacro);
      const text = await callClaude(prompt);

      // Limpiar y formatear el texto
      const cleaned = text
        .replace(/^#{1,3}\s.*$/gm, '')   // quitar líneas con # ## ###
        .replace(/^-{3,}$/gm, '')         // quitar separadores ---
        .replace(/^\*{3,}$/gm, '')         // quitar ***
        .trim();

      const formatted = cleaned
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .split(/\n\n+/)
        .filter(p => p.trim())
        .map(p => `<p style="margin-bottom:12px;line-height:1.75;">${p.trim()}</p>`)
        .join('');

      box.innerHTML = `
        <div style="font-family:var(--mono);font-size:8px;letter-spacing:0.16em;text-transform:uppercase;color:var(--teal);margin-bottom:10px;">
          ✦ Análisis ETHAN IA · ${new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})} · Score ${currentMacro.scoreTotal>=0?'+':''}${currentMacro.scoreTotal} / +17
        </div>
        <div style="font-size:12px;color:var(--text2);">${formatted}</div>
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);font-size:9px;color:var(--text3);font-family:var(--mono);">
          Generado automáticamente con Claude · No constituye asesoramiento financiero · ETHAN v11
        </div>`;
    } catch(e) {
      box.innerHTML = `<div style="font-size:11px;color:var(--red);font-family:var(--mono);">⚠ Error al generar análisis: ${e.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '✦ Análisis ETHAN IA';
    }
  }

  function paint(macro) {
    const el  = document.getElementById('home-wrap');
    const s   = macro.scoreTotal ?? 0;
    const z   = macro.zone || '—';
    const p   = macro.probabilities || {};
    const ind = macro.indicators || {};
    const seg = macro.seguimiento || {};
    const liq = macro.liquidez || {};
    const co  = macro.coyuntura || {};

    const mainCol  = s >= 4 ? 'var(--green)' : s >= 0 ? 'var(--amber)' : 'var(--red)';
    const bestScen = Object.entries(p).sort((a,b)=>b[1]-a[1])[0]?.[0];
    const scenLabel= { recesion:'Recesión 12m', stagflation:'Stagflación', softLanding:'Soft Landing', expansion:'Expansión' };

    const scores   = Object.values(ind).filter(i => i?.score != null);
    const mejoran  = scores.filter(i => i.score > 0).length;
    const empeoran = scores.filter(i => i.score < 0).length;
    const neutros  = scores.filter(i => i.score === 0).length;
    const difusion = scores.length ? Math.round(mejoran / scores.length * 100) : 0;

    const cicloScore = (co.curvaUSD?.score||0)+(co.curvaEUR?.score||0)+(ind.lei?.score||0);
    const liqScore   = (liq.m2?.score||0)+(liq.impulso?.score||0)+(liq.velM2?.score||0);
    const polScore   = (co.tipoReal?.score||0)+(liq.reservas?.score||0);
    const infScore   = ind.cpi?.score || 0;
    const sentScore  = ind.fearGreed?.score || 0;

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:220px 1fr 180px;gap:14px;margin-bottom:14px;">

        <!-- Score -->
        <div class="mac-card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px;">
          <div style="font-family:var(--mono);font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:var(--text3);margin-bottom:10px;">MACRO SCORE</div>
          <div style="font-family:var(--serif);font-size:60px;font-weight:600;font-style:italic;line-height:1;color:${mainCol}">${s>=0?'+':''}${s}</div>
          <div style="font-family:var(--serif);font-size:18px;font-style:italic;color:${mainCol};margin-top:6px;">${z}</div>
          <div style="height:4px;background:var(--surface2);border-radius:2px;width:100%;margin-top:12px;overflow:hidden;">
            <div style="height:100%;width:${Math.max(0,((s+17)/34)*100)}%;background:${mainCol};border-radius:2px;"></div>
          </div>
          <div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-top:5px;">${s>=0?'+':''}${s} de ±17</div>
        </div>

        <!-- Probabilidades + Semáforo -->
        <div class="mac-card">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div>
              <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:10px;">Escenarios</div>
              ${[{k:'recesion',l:'Recesión 12m',c:'var(--red)'},{k:'stagflation',l:'Stagflación',c:'var(--amber)'},{k:'softLanding',l:'Soft Landing',c:'var(--teal)'},{k:'expansion',l:'Expansión',c:'var(--green)'}].map(sc=>`
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;">
                  <span style="font-size:10px;color:var(--text2);width:90px;flex-shrink:0;">${sc.l}</span>
                  <div style="flex:1;height:5px;background:var(--surface2);border-radius:3px;overflow:hidden;">
                    <div style="height:100%;width:${p[sc.k]||0}%;background:${sc.c};border-radius:3px;"></div>
                  </div>
                  <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:${sc.c};width:32px;text-align:right;">${p[sc.k]||0}%</span>
                </div>`).join('')}
            </div>
            <div>
              <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:10px;">Semáforo</div>
              ${[
                {l:'Ciclo económico',   v:co.curvaUSD?.value!=null?(co.curvaUSD.value<0?'Curva invertida':'Curva positiva'):'—', s:cicloScore},
                {l:'Liquidez global',   v:liq.m2?.value!=null?(liq.m2.value>=0?'+':'')+f2(liq.m2.value)+'% M2':'—', s:liqScore},
                {l:'Política monetaria',v:co.tipoReal?.value!=null?'Tipo real '+(co.tipoReal.value>=0?'+':'')+f2(co.tipoReal.value)+'%':'—', s:polScore},
                {l:'Inflación',         v:co.cpi?.value!=null?'CPI '+f1(co.cpi.value)+'%':'—', s:infScore},
                {l:'Sentimiento',       v:seg.fearGreed?.value!=null?'F&G '+seg.fearGreed.value:'—', s:sentScore},
              ].map(row=>{
                const c=row.s>0?'green':row.s<0?'red':'amber';
                return `<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;border:1px solid var(--border);margin-bottom:5px;">
                  <div style="width:8px;height:8px;border-radius:50%;background:var(--${c});flex-shrink:0;"></div>
                  <span style="flex:1;font-size:10px;color:var(--text1);">${row.l}</span>
                  <span style="font-family:var(--mono);font-size:9px;color:var(--text3);">${row.v}</span>
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Delta -->
        <div class="mac-card" style="display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;text-align:center;">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:4px;">vs Mes Anterior</div>
          <div style="padding:10px 0;border-bottom:1px solid var(--border);width:100%;">
            <div style="font-size:28px;font-weight:700;color:var(--green);">↑ ${mejoran}</div>
            <div style="font-size:10px;color:var(--text3);">Mejoran</div>
          </div>
          <div style="padding:10px 0;border-bottom:1px solid var(--border);width:100%;">
            <div style="font-size:28px;font-weight:700;color:var(--red);">↓ ${empeoran}</div>
            <div style="font-size:10px;color:var(--text3);">Empeoran</div>
          </div>
          <div style="padding:10px 0;width:100%;">
            <div style="font-size:28px;font-weight:700;color:var(--text3);">= ${neutros}</div>
            <div style="font-size:10px;color:var(--text3);">Sin cambios</div>
          </div>
          <div style="padding-top:8px;border-top:1px solid var(--border);width:100%;">
            <div style="font-size:9px;color:var(--text3);font-family:var(--mono);">Índice difusión</div>
            <div style="font-family:var(--mono);font-size:18px;font-weight:700;margin-top:3px;color:${difusion>=50?'var(--green)':difusion>=30?'var(--amber)':'var(--red)'};">${difusion}%</div>
            <div style="font-size:9px;color:var(--text3);margin-top:2px;">${difusion>=50?'señal alcista':difusion>=30?'señal neutra':'señal bajista'}</div>
          </div>
        </div>
      </div>

      <!-- Frase ejecutiva automática -->
      <div class="mac-card" style="background:rgba(${s>=4?'74,222,128':s>=0?'251,191,36':'244,113,116'},0.04);border-color:rgba(${s>=4?'74,222,128':s>=0?'251,191,36':'244,113,116'},0.18);margin-bottom:14px;">
        <div style="font-family:var(--serif);font-size:15px;font-style:italic;color:var(--text1);line-height:1.8;" id="home-phrase">Cargando diagnóstico...</div>
      </div>

      <!-- Bloque análisis IA -->
      <div class="mac-card" style="border-color:rgba(64,217,192,0.25);margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div>
            <div style="font-family:var(--mono);font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:var(--teal);">✦ Análisis Inteligente ETHAN</div>
            <div style="font-size:10px;color:var(--text3);margin-top:3px;">Interpretación automática de los ${scores.length} indicadores activos con Claude</div>
          </div>
          <button id="home-ai-btn-inner" class="btn btn-primary" style="white-space:nowrap;">✦ Generar análisis</button>
        </div>
        <div id="home-ai-box" style="min-height:48px;display:flex;align-items:center;">
          <div style="font-size:11px;color:var(--text3);font-family:var(--mono);">Pulsa "Generar análisis" para obtener la interpretación IA de los datos actuales.</div>
        </div>
      </div>

      <!-- Footer -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="mac-card-sm"><div style="font-size:9px;color:var(--text3);font-family:var(--mono);margin-bottom:4px;">ÚLTIMA ACTUALIZACIÓN</div><div style="font-family:var(--mono);font-size:12px;color:var(--text1);">${macro.updatedAt?new Date(macro.updatedAt).toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—'}</div></div>
        <div class="mac-card-sm"><div style="font-size:9px;color:var(--text3);font-family:var(--mono);margin-bottom:4px;">ESCENARIO MÁS PROBABLE</div><div style="font-family:var(--mono);font-size:12px;color:${mainCol};">${scenLabel[bestScen]||'—'} · ${p[bestScen]||0}%</div></div>
      </div>
    `;

    // Frase dinámica simple
    const parts = [];
    if (co.curvaUSD?.value!=null) parts.push(co.curvaUSD.value<0?`La <strong>curva USD invertida</strong> (${f2(co.curvaUSD.value)}%) anticipa desaceleración`:`La curva USD positiva (+${f2(co.curvaUSD.value)}%) apoya el ciclo`);
    if (liq.m2?.value!=null) parts.push(liq.m2.score<0?`la <strong>liquidez es insuficiente</strong> (M2 ${f2(liq.m2.value)}%)`:`la liquidez global es expansiva (M2 +${f2(liq.m2.value)}%)`);
    if (co.cpi?.value!=null&&co.cpi?.cpiCore!=null) parts.push(`inflación Headline ${f1(co.cpi.value)}% vs Core ${f1(co.cpi.cpiCore)}%`);
    if (co.tipoReal?.value!=null) parts.push(`tipo real ${co.tipoReal.value>=0?'restrictivo +':'acomodaticio '}${f2(co.tipoReal.value)}%`);
    const phraseEl = document.getElementById('home-phrase');
    if (phraseEl) {
      const phrase = parts.join('. ')+(parts.length?'.':'Introduce los datos manuales para el diagnóstico completo.');
      phraseEl.innerHTML = phrase.charAt(0).toUpperCase()+phrase.slice(1);
    }

    // Bind botón IA interno
    document.getElementById('home-ai-btn-inner')?.addEventListener('click', generateAI);
  }

  document.getElementById('home-refresh')?.addEventListener('click', () => load(true));
  document.getElementById('home-ai-btn')?.addEventListener('click', generateAI);
  await load(false);
  return { destroy() {} };
}

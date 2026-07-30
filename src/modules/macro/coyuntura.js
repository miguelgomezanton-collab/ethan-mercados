import { getMacroData, getManuals, saveManuals } from './macro-data.js';

const f2    = v => v != null ? Number(v).toFixed(2) : '—';
const f1    = v => v != null ? Number(v).toFixed(1) : '—';
const fsign = v => v != null ? (v >= 0 ? '+' : '') + Number(v).toFixed(2) : '—';
const col   = s => s > 0 ? 'var(--green)' : s === 0 ? 'var(--amber)' : 'var(--red)';

function scoreColor(s) {
  if (s >= 4)  return 'var(--green)';
  if (s >= 0)  return 'var(--amber)';
  return 'var(--red)';
}

function buildPhrase(macro) {
  const co = macro.coyuntura || {};
  const parts = [];
  if (co.curvaUSD?.value != null)
    parts.push(co.curvaUSD.value < 0
      ? `La <strong>curva USD está invertida</strong> (${f2(co.curvaUSD.value)}%) — señal histórica de recesión`
      : co.curvaUSD.score > 0
      ? `La <strong>curva USD es positiva y amplia</strong> (+${f2(co.curvaUSD.value)}%) — optimismo de crecimiento`
      : `La curva USD está comprimiendo (+${f2(co.curvaUSD.value)}%) — señal de desaceleración`);
  if (co.lei?.value != null)
    parts.push(co.lei.value >= 0.3
      ? `el <strong>LEI anticipa expansión</strong> (+${f2(co.lei.value)}% m/m)`
      : co.lei.value >= -0.3
      ? `el LEI está en zona neutral (${fsign(co.lei.value)}% m/m)`
      : `el <strong>LEI anticipa contracción</strong> (${f2(co.lei.value)}% m/m)`);
  if (co.tipoReal?.value != null)
    parts.push(co.tipoReal.value >= 1.0
      ? `el <strong>tipo real es restrictivo</strong> (+${f2(co.tipoReal.value)}%) — frena la economía`
      : co.tipoReal.value >= 0.5
      ? `el tipo real está en zona neutral (+${f2(co.tipoReal.value)}%)`
      : `el tipo real es excesivamente restrictivo o la inflación está desbocada (${fsign(co.tipoReal.value)}%)`);
  if (co.cpi?.value != null)
    parts.push(`inflación Headline ${f1(co.cpi.value)}% vs Core ${f1(co.cpi.cpiCore)}% — ${
      macro.riesgoContagio?.tipo === 'coyuntural'
        ? 'presión coyuntural (energía/alimentos)'
        : 'inflación estructural — mayor riesgo de persistencia'}`);
  return parts.join('. ') + (parts.length ? '.' : 'Cargando diagnóstico del ciclo...');
}

function indRow(label, value, pct, c, signal, date, centered = false) {
  const bar = centered
    ? `<div style="position:relative;height:7px;background:var(--surface2);border-radius:4px;margin:5px 0 3px;">
        ${(parseFloat(value) || 0) >= 0
          ? `<div style="position:absolute;left:50%;width:${Math.min(pct,50)}%;height:100%;background:${c};border-radius:0 4px 4px 0;"></div>`
          : `<div style="position:absolute;right:50%;width:${Math.min(pct,50)}%;height:100%;background:${c};border-radius:4px 0 0 4px;"></div>`}
        <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:var(--border2);"></div>
       </div>`
    : `<div class="co-ind-bar-track"><div class="co-ind-bar-fill" style="width:${Math.min(Math.max(pct,0),100)}%;background:${c};"></div></div>`;
  return `<div class="co-ind-item">
    <div class="co-ind-row">
      <span class="co-ind-name">${label}</span>
      <span class="co-ind-val" style="color:${c}">${value}</span>
    </div>
    ${bar}
    <div class="co-ind-signal"><span class="co-ind-dot" style="background:${c}"></span>${signal}${date ? `<span class="co-ind-date">${date}</span>` : ''}</div>
  </div>`;
}

function manualInput(key, label, hint, currentVal, unit = '%') {
  return `<div class="co-manual-row">
    <div>
      <div style="font-size:11px;color:var(--text2);font-weight:600;">${label}</div>
      <div style="font-size:9px;color:var(--text3);">${hint}</div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;">
      <input type="number" class="co-manual-input" data-key="${key}" value="${currentVal ?? ''}" placeholder="—" step="0.1" style="width:72px;">
      <span style="font-size:10px;color:var(--text3);">${unit}</span>
    </div>
  </div>`;
}

export async function render(container, { actionsSlot }) {
  actionsSlot.innerHTML = `
    <button class="btn" id="co-edit-btn">✎ Editar manuales</button>
    <button class="btn btn-primary" id="co-refresh-btn">↻ Actualizar</button>
  `;
  container.innerHTML = `<div id="co-wrap"><div class="empty"><div class="loader-ring"></div><div class="empty-title">Cargando coyuntura...</div></div></div>`;

  async function load(force = false) {
    try {
      const macro = await getMacroData(force);
      paint(macro);
    } catch (e) {
      document.getElementById('co-wrap').innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Error al cargar</div><div class="empty-desc">${e.message}</div></div>`;
    }
  }

  function paint(macro) {
    const el  = document.getElementById('co-wrap');
    const co  = macro.coyuntura || {};
    const s   = macro.scoreTotal ?? 0;
    const mainCol = scoreColor(s);
    const prob = macro.probabilities || {};
    const rc   = macro.riesgoContagio;
    const bestScen = Object.entries(prob).sort((a, b) => b[1] - a[1])[0]?.[0];
    const scenLabel = { recesion: 'Recesión 12m', stagflation: 'Stagflación', softLanding: 'Soft Landing', expansion: 'Expansión' };
    const man = getManuals();

    el.innerHTML = `
      <!-- VEREDICTO -->
      <div class="co-verdict-block">
        <div class="co-score-wrap">
          <div class="co-score-num" style="color:${mainCol}">${s >= 0 ? '+' : ''}${s}</div>
          <div class="co-score-max">de ±17</div>
          <div class="co-score-gauge"><div class="co-score-gauge-fill" style="width:${Math.max(0,((s+17)/34)*100)}%;background:${mainCol};"></div></div>
        </div>
        <div class="co-verdict-center">
          <div class="co-verdict-label">Ciclo económico · ${macro.updatedAt ? new Date(macro.updatedAt).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) : '—'}</div>
          <div class="co-verdict-title" style="color:${mainCol}">${macro.zone || '—'}</div>
          <div class="co-verdict-phrase">${buildPhrase(macro)}</div>
        </div>
        <div class="co-verdict-right">
          ${co.tipoReal ? `<div class="co-verdict-mini"><div class="co-verdict-mini-label">Tipo Real</div><div class="co-verdict-mini-val" style="color:${col(co.tipoReal.score)}">${fsign(co.tipoReal.value)}%</div><div class="co-verdict-mini-sub">FFR − CPI</div></div>` : ''}
          ${co.cpi ? `<div class="co-verdict-mini"><div class="co-verdict-mini-label">CPI / Core</div><div class="co-verdict-mini-val" style="color:${rc?.nivel==='bajo'?'var(--green)':rc?.nivel==='moderado'?'var(--amber)':'var(--red)'}">${f1(co.cpi.value)}% / ${f1(co.cpi.cpiCore)}%</div><div class="co-verdict-mini-sub">${rc?.nivel?.toUpperCase()||'—'}</div></div>` : ''}
          <div class="co-verdict-mini"><div class="co-verdict-mini-label">Escenario probable</div><div class="co-verdict-mini-val" style="color:${mainCol};font-size:13px;">${scenLabel[bestScen] || '—'}</div><div class="co-verdict-mini-sub">${prob[bestScen] || 0}%</div></div>
        </div>
      </div>

      <!-- PROBABILIDADES -->
      <div class="co-prob-row">
        ${[{k:'recesion',l:'Recesión 12m',c:'var(--red)'},{k:'stagflation',l:'Stagflación',c:'var(--red)'},{k:'softLanding',l:'Soft Landing',c:'var(--teal)'},{k:'expansion',l:'Expansión',c:'var(--green)'}]
          .map(s => `<div class="co-prob-card ${s.k===bestScen?'highlight':''}"><div class="co-prob-pct" style="color:${s.c}">${prob[s.k]||0}%</div><div class="co-prob-name">${s.l}</div></div>`).join('')}
      </div>

      <!-- INDICADORES -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">

        <!-- Indicadores adelantados -->
        <div class="co-ind-group">
          <div class="co-ind-group-header">
            <span class="co-ind-group-title">🔮 Indicadores Adelantados</span>
            <span class="co-ind-group-score ${(co.curvaUSD?.score||0)+(co.curvaEUR?.score||0)+(co.lei?.score||0)>0?'co-score-pos':(co.curvaUSD?.score||0)+(co.curvaEUR?.score||0)+(co.lei?.score||0)<0?'co-score-neg':'co-score-neu'}">${((co.curvaUSD?.score||0)+(co.curvaEUR?.score||0)+(co.lei?.score||0))>=0?'+':''}${(co.curvaUSD?.score||0)+(co.curvaEUR?.score||0)+(co.lei?.score||0)} / +3</span>
          </div>
          ${co.curvaUSD ? indRow(
            'Curva USD (10Y−2Y)',
            fsign(co.curvaUSD.value)+'%',
            Math.abs(co.curvaUSD.value||0)*50,
            col(co.curvaUSD.score),
            co.curvaUSD.value < 0 ? 'Invertida — señal histórica de recesión' : co.curvaUSD.score > 0 ? '≥+0.90% — optimismo de crecimiento' : '+0.48% a +0.89% — neutral',
            co.curvaUSD.date, true) : ''}
          ${co.curvaEUR ? indRow(
            'Curva EUR (10Y−2Y)',
            fsign(co.curvaEUR.value)+'%',
            Math.abs(co.curvaEUR.value||0)*50,
            col(co.curvaEUR.score),
            co.curvaEUR.value < 0 ? 'Invertida — señal recesiva en Europa' : co.curvaEUR.score > 0 ? '≥+0.60% — ciclo expansivo' : 'Comprimiendo — vigilar',
            co.curvaEUR.date, true) : ''}
          ${co.lei ? indRow(
            'LEI USA ✎',
            co.lei.value != null ? fsign(co.lei.value)+'%' : '—',
            co.lei.value != null ? 50 + (co.lei.value||0)*60 : 50,
            co.lei.value != null ? col(co.lei.score) : 'var(--text3)',
            co.lei.score > 0 ? '≥+0.3% → expansión próximos 6-9 meses' : co.lei.score === 0 ? '−0.3% a +0.3% → neutral' : '<−0.3% → contracción anticipada',
            null, true) : ''}
        </div>

        <!-- Inflación + Tipo Real -->
        <div class="co-ind-group">
          <div class="co-ind-group-header">
            <span class="co-ind-group-title">🌡️ Inflación & Política Monetaria</span>
            <span class="co-ind-group-score ${co.tipoReal?.score>0?'co-score-pos':co.tipoReal?.score===0?'co-score-neu':'co-score-neg'}">${co.tipoReal?(co.tipoReal.score>0?'+1':co.tipoReal.score===0?'0':'-1'):'—'} / +1</span>
          </div>
          ${co.cpi ? indRow('CPI Headline YoY', f1(co.cpi.value)+'%',
            Math.min((co.cpi.value||0)/6*100,100),
            co.cpi.value<=2.5?'var(--green)':co.cpi.value<=4?'var(--amber)':'var(--red)',
            co.cpi.value<=2.5?'En objetivo Fed (≤2.5%)':co.cpi.value<=4?'Por encima del objetivo':'Muy elevada — riesgo de espiral',
            co.cpi?.date) : ''}
          ${co.cpi?.cpiCore != null ? indRow('CPI Core YoY', f1(co.cpi.cpiCore)+'%',
            Math.min((co.cpi.cpiCore||0)/6*100,100),
            co.cpi.cpiCore<=2.5?'var(--green)':co.cpi.cpiCore<=4?'var(--amber)':'var(--red)',
            'Subyacente — sin energía ni alimentos') : ''}
          ${co.tipoReal ? indRow('Tipo Real (FFR − CPI)', fsign(co.tipoReal.value)+'%',
            Math.abs(co.tipoReal.value||0)*20,
            col(co.tipoReal.score),
            co.tipoReal.score>0?'≥+1.0% — neutral-restrictivo':co.tipoReal.score===0?'+0.5% a +0.9% — neutral':'<+0.5% — excesivamente restrictivo o inflación desbocada',
            co.tipoReal.date, true) : ''}
        </div>
      </div>

      <!-- RIESGO DE CONTAGIO -->
      ${rc ? `<div class="co-ind-group" style="margin-bottom:16px;">
        <div class="co-ind-group-header">
          <span class="co-ind-group-title">⚡ Riesgo de Contagio (coyuntural → estructural)</span>
          <span class="co-ind-group-score ${rc.nivel==='bajo'?'co-score-pos':rc.nivel==='moderado'?'co-score-neu':'co-score-neg'}">${rc.nivel.toUpperCase()} · ${rc.pct}%</span>
        </div>
        <div style="font-size:11px;color:var(--text2);line-height:1.6;margin-bottom:14px;">${rc.label}</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
          <div style="background:var(--surface2);border-radius:6px;padding:8px;text-align:center;"><div style="font-size:9px;color:var(--text3);margin-bottom:3px;">Headline</div><div style="font-family:var(--mono);font-size:15px;font-weight:700;color:${rc.headline<=2.5?'var(--green)':rc.headline<=4?'var(--amber)':'var(--red)'};">${f1(rc.headline)}%</div></div>
          <div style="background:var(--surface2);border-radius:6px;padding:8px;text-align:center;"><div style="font-size:9px;color:var(--text3);margin-bottom:3px;">Core</div><div style="font-family:var(--mono);font-size:15px;font-weight:700;color:${rc.core<=2.5?'var(--green)':rc.core<=4?'var(--amber)':'var(--red)'};">${f1(rc.core)}%</div></div>
          <div style="background:var(--surface2);border-radius:6px;padding:8px;text-align:center;"><div style="font-size:9px;color:var(--text3);margin-bottom:3px;">Gap H-C</div><div style="font-family:var(--mono);font-size:15px;font-weight:700;color:${rc.gap<0.5?'var(--green)':rc.gap<1.5?'var(--amber)':'var(--red)'};">+${f2(rc.gap)}pp</div></div>
          <div style="background:var(--surface2);border-radius:6px;padding:8px;text-align:center;"><div style="font-size:9px;color:var(--text3);margin-bottom:3px;">Tipo</div><div style="font-family:var(--mono);font-size:13px;font-weight:700;color:${rc.tipo==='coyuntural'?'var(--amber)':'var(--red)'};">${rc.tipo.toUpperCase()}</div></div>
        </div>
      </div>` : ''}

      <!-- PANEL MANUALES (oculto por defecto) -->
      <div id="co-manual-panel" style="display:none;background:var(--surface);border:1px dashed var(--border2);border-radius:12px;padding:18px 20px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">✎ Inputs Manuales — Coyuntura</div>
        ${manualInput('lei', 'LEI USA (Conference Board)', 'Variación mensual · umbral: ≥+0.3% → +1, <−0.3% → −1', man.lei)}
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button class="btn btn-primary" id="co-save-manuals">Guardar y actualizar</button>
          <button class="btn" id="co-close-manuals">Cancelar</button>
        </div>
      </div>

      <div class="co-footer">Fuentes: FRED (DGS10, DGS2, DFF, CPIAUCSL, CPILFESL) · Conference Board LEI (manual) · ECB Data Portal</div>
    `;

    // Eventos
    document.getElementById('co-save-manuals')?.addEventListener('click', () => {
      const man = getManuals();
      document.querySelectorAll('.co-manual-input').forEach(inp => {
        const v = inp.value.trim();
        man[inp.dataset.key] = v !== '' ? parseFloat(v) : null;
      });
      saveManuals(man);
      document.getElementById('co-manual-panel').style.display = 'none';
      load(true);
    });
    document.getElementById('co-close-manuals')?.addEventListener('click', () => {
      document.getElementById('co-manual-panel').style.display = 'none';
    });
  }

  document.getElementById('co-refresh-btn')?.addEventListener('click', () => load(true));
  document.getElementById('co-edit-btn')?.addEventListener('click', () => {
    const p = document.getElementById('co-manual-panel');
    if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
  });

  await load(false);
  return { destroy() {} };
}

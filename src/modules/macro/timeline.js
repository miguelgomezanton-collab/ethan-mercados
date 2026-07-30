// timeline.js — usa /api/macro-history (sin key en frontend)
import { getMacroData } from './macro-data.js';

export async function render(container, { actionsSlot }) {
  actionsSlot.innerHTML = `<button class="btn btn-primary" id="tl-refresh">↻ Actualizar</button>`;
  container.innerHTML = `<div id="tl-wrap"><div class="empty"><div class="loader-ring"></div><div class="empty-title">Descargando datos históricos...</div></div></div>`;

  async function load() {
    const el = document.getElementById('tl-wrap');
    try {
      const [macro, hist] = await Promise.all([
        getMacroData(false),
        fetch('/api/macro-history?type=timeline').then(r => { if (!r.ok) throw new Error('macro-history: ' + r.status); return r.json(); })
      ]);
      paint(macro, hist);
    } catch(e) {
      document.getElementById('tl-wrap').innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Error</div><div class="empty-desc">${e.message}</div></div>`;
    }
  }

  function paint(macro, hist) {
    const el = document.getElementById('tl-wrap');
    const tl = hist.timeline || {};
    const s = macro.scoreTotal ?? 0;
    const mainCol = s >= 4 ? 'var(--green)' : s >= 0 ? 'var(--amber)' : 'var(--red)';

    const spNorm    = tl.spNorm    || [];
    const cpiYoY    = tl.cpiYoY   || [];
    const scoreHist = tl.scoreHistory || [];

    // Determinar rango de fechas desde los datos
    const allDates = [...spNorm, ...cpiYoY, ...scoreHist].map(p => new Date(p.date + '-01'));
    if (allDates.length === 0) {
      el.innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Sin datos históricos</div></div>`;
      return;
    }
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date();

    const W = 820, H = 180, PX = 8, PY = 12;

    // Todas las series necesitan el mismo rango de valores
    const allVals = [
      ...spNorm.map(p => p.value),
      ...cpiYoY.map(p => p.value),
      ...scoreHist.map(p => p.value * 15),
    ].filter(v => v != null && isFinite(v));
    const minVal = Math.min(...allVals, -10), maxVal = Math.max(...allVals, 10);

    function toX(dateStr) {
      const d = new Date(dateStr + '-01');
      return PX + (d - minDate) / (maxDate - minDate) * (W - 2 * PX);
    }
    function toY(val) {
      return PY + (1 - (val - minVal) / (maxVal - minVal)) * (H - 2 * PY);
    }
    function pts(series, scale = 1) {
      return series.filter(p => p.value != null)
        .map(p => `${toX(p.date).toFixed(1)},${toY(p.value * scale).toFixed(1)}`).join(' ');
    }

    // Línea de cero
    const zeroY = toY(0);

    // Labels de años
    const years = [];
    let y = new Date(minDate); y.setMonth(0); y.setDate(1);
    while (y <= maxDate) {
      years.push({ year: y.getFullYear(), x: toX(y.toISOString().slice(0, 7)) });
      y = new Date(y.getFullYear() + 1, 0, 1);
    }

    el.innerHTML = `
      <div class="mac-card" style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--text3);">
            SP500 normalizado · CPI YoY · Score Parcial (3 indicadores auto) · ${minDate.getFullYear()}–${maxDate.getFullYear()}
          </div>
          <div style="display:flex;gap:14px;">
            ${[['var(--green)','SP500 (norm.)'],['var(--red)','CPI YoY'],['var(--teal)','Score parcial ×15']].map(([c,l])=>
              `<div style="display:flex;align-items:center;gap:4px;font-size:9px;color:var(--text2);"><div style="width:8px;height:3px;background:${c};border-radius:2px;"></div>${l}</div>`).join('')}
          </div>
        </div>
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;background:var(--surface2);border-radius:8px;" preserveAspectRatio="none">
          <line x1="0" y1="${zeroY.toFixed(1)}" x2="${W}" y2="${zeroY.toFixed(1)}" stroke="var(--border2)" stroke-width="1" stroke-dasharray="4"/>
          ${years.map(y => `
            <line x1="${y.x.toFixed(1)}" y1="0" x2="${y.x.toFixed(1)}" y2="${H}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="3"/>
            <text x="${(y.x + 3).toFixed(1)}" y="${H - 3}" font-family="IBM Plex Mono" font-size="8" fill="var(--text3)">${y.year}</text>
          `).join('')}
          ${pts(cpiYoY)    ? `<polyline points="${pts(cpiYoY)}"     fill="none" stroke="var(--red)"   stroke-width="1.5" stroke-linejoin="round" opacity="0.75"/>` : ''}
          ${pts(spNorm)    ? `<polyline points="${pts(spNorm)}"     fill="none" stroke="var(--green)" stroke-width="2"   stroke-linejoin="round" opacity="0.8"/>` : ''}
          ${pts(scoreHist) ? `<polyline points="${pts(scoreHist, 15)}" fill="none" stroke="var(--teal)"  stroke-width="2" stroke-linejoin="round"/>` : ''}
          <circle cx="${(W - PX - 4).toFixed(1)}" cy="${(PY + 10).toFixed(1)}" r="4" fill="${mainCol}"/>
          <text x="${(W - PX - 30).toFixed(1)}" y="${(PY + 8).toFixed(1)}" font-family="IBM Plex Mono" font-size="8" fill="${mainCol}">${s >= 0 ? '+' : ''}${s}</text>
        </svg>
        <div style="font-size:9px;color:var(--text3);font-family:var(--mono);margin-top:8px;">
          Score parcial = Curva USD + Tipo Real + BBB Spread (×15 para visibilidad). Rango: −3 a +3. Score completo requiere M2 Global, LEI e Impulso (manuales).
          ${hist.errors?.length ? ' · ⚠ ' + hist.errors.slice(0, 2).join(', ') : ''}
        </div>
      </div>

      <div class="mac-card">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--text3);margin-bottom:12px;">Períodos Históricos con Configuración Similar</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead><tr style="background:var(--surface2);">
            <th style="padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">Período</th>
            <th style="padding:8px 12px;text-align:center;font-size:9px;color:var(--text3);border-bottom:1px solid var(--border);">Curva USD</th>
            <th style="padding:8px 12px;text-align:center;font-size:9px;color:var(--text3);border-bottom:1px solid var(--border);">CPI YoY</th>
            <th style="padding:8px 12px;text-align:center;font-size:9px;color:var(--text3);border-bottom:1px solid var(--border);">Tipo Real</th>
            <th style="padding:8px 12px;text-align:center;font-size:9px;color:var(--text3);border-bottom:1px solid var(--border);">SP500 +6m</th>
            <th style="padding:8px 12px;text-align:center;font-size:9px;color:var(--text3);border-bottom:1px solid var(--border);">SP500 +12m</th>
            <th style="padding:8px 12px;text-align:left;font-size:9px;color:var(--text3);border-bottom:1px solid var(--border);">Contexto</th>
          </tr></thead>
          <tbody>
            ${[
              {p:'Jun 2022', c:'-0.04%',cpi:'9.1%', tr:'-3.7%',s6:'-14%',s12:'-18%',ctx:'Pico inflación · Fed subiendo agresivamente',s6c:'var(--red)',  s12c:'var(--red)'},
              {p:'Oct 2019', c:'+0.15%',cpi:'1.8%', tr:'+3.5%',s6:'+8%', s12:'+19%',ctx:'Curva recuperando · Fed bajando tipos',    s6c:'var(--green)',s12c:'var(--green)'},
              {p:'Nov 2018', c:'+0.21%',cpi:'2.2%', tr:'+0.2%',s6:'-7%', s12:'+14%',ctx:'QT + trade war · luego Fed pivotó',        s6c:'var(--red)',  s12c:'var(--green)'},
              {p:'Dic 2007', c:'+0.74%',cpi:'4.1%', tr:'+1.1%',s6:'-12%',s12:'-38%',ctx:'Crisis subprime · spreads disparados',     s6c:'var(--red)',  s12c:'var(--red)'},
              {p:'Mar 2020', c:'+0.48%',cpi:'+1.5%',tr:'+3.5%',s6:'+39%',s12:'+53%',ctx:'COVID · Fed QE masivo → rebote brutal',   s6c:'var(--green)',s12c:'var(--green)'},
            ].map(r => `<tr>
              <td style="padding:9px 12px;border-bottom:1px solid var(--border);font-weight:600;">${r.p}</td>
              <td style="padding:9px 12px;text-align:center;border-bottom:1px solid var(--border);font-family:var(--mono);color:${r.c.startsWith('-')?'var(--red)':'var(--green)'};">${r.c}</td>
              <td style="padding:9px 12px;text-align:center;border-bottom:1px solid var(--border);font-family:var(--mono);color:var(--amber);">${r.cpi}</td>
              <td style="padding:9px 12px;text-align:center;border-bottom:1px solid var(--border);font-family:var(--mono);color:${parseFloat(r.tr)>0?'var(--green)':'var(--red)'};">${r.tr}</td>
              <td style="padding:9px 12px;text-align:center;border-bottom:1px solid var(--border);font-family:var(--mono);font-weight:700;color:${r.s6c};">${r.s6}</td>
              <td style="padding:9px 12px;text-align:center;border-bottom:1px solid var(--border);font-family:var(--mono);font-weight:700;color:${r.s12c};">${r.s12}</td>
              <td style="padding:9px 12px;border-bottom:1px solid var(--border);font-size:10px;color:var(--text2);">${r.ctx}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div style="font-size:9px;color:var(--text3);font-family:var(--mono);margin-top:10px;">Rendimientos históricos documentados. No constituyen garantía de rendimientos futuros.</div>
      </div>
      <div class="co-footer" style="margin-top:14px;">Calculado en servidor · Yahoo Finance (SP500) · FRED (CPIAUCSL, DGS10, DGS2, DFF, BAMLC0A4CBBB) · sin API key en frontend</div>
    `;
  }

  document.getElementById('tl-refresh')?.addEventListener('click', load);
  await load();
  return { destroy() {} };
}

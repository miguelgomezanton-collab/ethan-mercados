// ═══════════════════════════════════════════════
// MÓDULO: Coyuntura Macroeconómica (1.1)
// Conectado a FRED + CBOE + Conference Board + CNN Fear & Greed
// (todo vía /api/macro).
// ═══════════════════════════════════════════════

import { getMacroData, fearGreedLabel, fearGreedColor } from './macro-data.js';

export async function render(container, { actionsSlot }) {
  actionsSlot.innerHTML = `<button class="btn btn-primary" id="btn-refresh-macro">↻ Actualizar</button>`;

  container.innerHTML = `<div id="coyuntura-content"><div class="empty"><div class="loader-ring"></div></div></div>`;
  const el = document.getElementById('coyuntura-content');

  async function load(forceRefresh = false) {
    el.innerHTML = `<div class="empty"><div class="loader-ring"></div></div>`;
    try {
      const macro = await getMacroData(forceRefresh);
      paint(macro);
    } catch (err) {
      el.innerHTML = `
        <div class="empty">
          <div class="empty-icon">⚠</div>
          <div class="empty-title">No se pudo cargar el score macro</div>
          <div class="empty-desc">${err.message}</div>
        </div>
      `;
    }
  }

  function paint(macro) {
    const fgScore = macro.fearGreed?.score ?? null;
    const fgLabel = fgScore !== null ? fearGreedLabel(fgScore) : '—';
    const fgColor = fgScore !== null ? fearGreedColor(fgScore) : 'var(--text3)';

    const scoreColor = macro.scoreTotal >= 4 ? 'var(--green)' : macro.scoreTotal >= 0 ? 'var(--amber)' : 'var(--red)';

    const adelantadosKeys = ['curvaUSD', 'curvaEUR', 'lei'];
    const adelantadosRows = adelantadosKeys
      .map(k => macro.indicators[k])
      .filter(Boolean)
      .map(ind => indicatorRow(ind))
      .join('');

    el.innerHTML = `
      <div class="kpi-row">
        <div class="kpi-card" style="grid-column: span 2;">
          <div class="kpi-label">Score Macro Total</div>
          <div class="kpi-value" style="color:${scoreColor};font-size:28px;">${macro.scoreTotal >= 0 ? '+' : ''}${macro.scoreTotal}/${macro.maxTotal}</div>
          <div class="kpi-sub">${macro.zone.emoji} ${macro.zone.label}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Fear &amp; Greed (CNN)</div>
          <div class="kpi-value" style="color:${fgColor}">${fgScore ?? '—'}</div>
          <div class="kpi-sub">${fgLabel}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Riesgo Inflacionario</div>
          <div class="kpi-value" style="font-size:16px;color:${macro.riesgoContagio?.nivel === 'alto' ? 'var(--red)' : macro.riesgoContagio?.nivel === 'moderado' ? 'var(--amber)' : 'var(--green)'}">${macro.riesgoContagio?.label || '—'}</div>
          <div class="kpi-sub">CPI YoY: ${macro.riesgoContagio?.cpiYoY ?? '—'}%</div>
        </div>
      </div>

      <div class="section-title">Probabilidades de Escenario</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
        ${probCard('Recesión 12m', macro.probabilities.recesion12m, 'var(--red)')}
        ${probCard('Stagflation', macro.probabilities.stagflation, 'var(--red)')}
        ${probCard('Soft Landing', macro.probabilities.softLanding, 'var(--amber)')}
        ${probCard('Expansión', macro.probabilities.expansion, 'var(--green)')}
      </div>

      <div class="section-title">Indicadores Adelantados (${macro.scoreAdelantados >= 0 ? '+' : ''}${macro.scoreAdelantados}/${macro.maxAdelantados})</div>
      <table class="data-table">
        <thead><tr><th>Indicador</th><th>Valor</th><th>Fecha</th><th>Señal</th></tr></thead>
        <tbody>${adelantadosRows}</tbody>
      </table>

      ${macro.errors ? `
        <div class="section-title" style="margin-top:24px;color:var(--amber);">⚠ Avisos</div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--text3);line-height:1.8;">
          ${macro.errors.map(e => `<div>${e}</div>`).join('')}
        </div>
      ` : ''}

      <div style="margin-top:20px;font-family:var(--mono);font-size:9px;color:var(--text3);">
        Última actualización: ${new Date(macro.updatedAt).toLocaleString('es-ES')}
      </div>
    `;
  }

  function probCard(label, pct, color) {
    return `
      <div class="kpi-card">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value" style="color:${color};font-size:20px;">${pct}%</div>
      </div>
    `;
  }

  function indicatorRow(ind) {
    const signColor = ind.score > 0 ? 'good' : ind.score < 0 ? 'bad' : 'warn';
    const signLabel = ind.score > 0 ? `+${ind.score}` : ind.score;
    const valueStr = ind.value !== null && ind.value !== undefined
      ? `${ind.value > 0 && ind.unit !== '' ? '+' : ''}${ind.value}${ind.unit}`
      : '—';
    return `
      <tr>
        <td style="text-align:left">${ind.label}${ind.manual ? ' <span class="tag warn" style="margin-left:6px;">manual</span>' : ''}</td>
        <td>${valueStr}</td>
        <td>${ind.date || '—'}</td>
        <td><span class="tag ${signColor}">${signLabel}</span></td>
      </tr>
    `;
  }

  document.getElementById('btn-refresh-macro').addEventListener('click', () => load(true));
  await load(false);

  return {
    destroy() {}
  };
}

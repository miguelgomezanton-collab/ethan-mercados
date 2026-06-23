// ═══════════════════════════════════════════════
// MÓDULO: Indicadores de Seguimiento (1.2)
// Vigilancia de alta frecuencia: spreads de crédito, inflación
// esperada y mercado laboral. Son señales de alerta temprana para
// detectar cuándo la foto macro de 1.1 empieza a moverse — NO
// recalculan el score total (eso sigue viviendo en /api/macro,
// igual que siempre, sin importar en qué pestaña se muestre cada
// indicador).
// ═══════════════════════════════════════════════

import { getMacroData } from './macro-data.js';

// Indicadores "Monetarios" del backend que se muestran aquí porque son
// señales de seguimiento de ciclo crediticio (BBB ya vivía aquí; los
// otros dos siguen sin fuente automática y quedan en su propio bloque
// de pendientes, no se mueven a Liquidez ni se ocultan).
const SEGUIMIENTO_SCORED_KEYS = ['bbbSpread'];
const PENDIENTES_KEYS = ['creditoVsNominal', 'impulsoCrediticio', 'putCall'];

export async function render(container, { actionsSlot }) {
  actionsSlot.innerHTML = `
    <button class="btn" id="btn-edit-manual">✎ Editar pendientes</button>
    <button class="btn btn-primary" id="btn-refresh">↻ Actualizar</button>
  `;

  container.innerHTML = `<div id="indicadores-content"><div class="empty"><div class="loader-ring"></div></div></div>`;
  const el = document.getElementById('indicadores-content');

  let manualOverrides = {};
  try {
    manualOverrides = JSON.parse(sessionStorage.getItem('ethan_macro_manual') || '{}');
  } catch (e) {}

  async function load(forceRefresh = false) {
    el.innerHTML = `<div class="empty"><div class="loader-ring"></div></div>`;
    try {
      const macro = await getMacroDataWithOverrides(forceRefresh);
      paint(macro);
    } catch (err) {
      el.innerHTML = `
        <div class="empty">
          <div class="empty-icon">⚠</div>
          <div class="empty-title">Error al cargar indicadores</div>
          <div class="empty-desc">${err.message}</div>
        </div>
      `;
    }
  }

  // curvaEUR se preserva si ya había un override antiguo guardado, pero
  // ya no se pregunta desde este módulo (ver nota más abajo en el listener).
  async function getMacroDataWithOverrides(forceRefresh) {
    const params = new URLSearchParams();
    if (manualOverrides.creditoVsNominal !== undefined) params.set('creditoVsNominal', manualOverrides.creditoVsNominal);
    if (manualOverrides.impulsoCrediticio !== undefined) params.set('impulsoCrediticio', manualOverrides.impulsoCrediticio);
    if (manualOverrides.curvaEUR !== undefined) params.set('curvaEUR', manualOverrides.curvaEUR);
    if (manualOverrides.putCall !== undefined) params.set('putCall', manualOverrides.putCall);

    if (params.toString()) {
      const res = await fetch('/api/macro?' + params.toString());
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      return res.json();
    }
    return getMacroData(forceRefresh);
  }

  function fmtValue(ind, decimals = null) {
    if (ind?.value === null || ind?.value === undefined) return 'Sin dato';
    const v = decimals !== null ? ind.value.toFixed(decimals) : ind.value;
    return `${ind.value > 0 && ind.unit !== '' ? '+' : ''}${v}${ind.unit}`;
  }

  function paint(macro) {
    const seg = macro.seguimiento || {};
    const hy = seg.highYieldSpread;
    const inf1y = seg.inflacionEsperada1y;
    const inf5y = seg.inflacionEsperada5y;
    const claims = seg.paroSemanalUS;
    const claimsParo = seg.paroSemanalEUR;
    const bbb = macro.indicators.bbbSpread;

    // ── Tarjetas de alerta temprana ──
    const alertCards = `
      <div class="kpi-row" style="grid-template-columns:repeat(5,1fr);">
        <div class="kpi-card">
          <div class="kpi-label">High Yield Spread</div>
          <div class="kpi-value">${fmtValue(hy, 2)}</div>
          <div class="kpi-sub">${hy?.date || '—'} · primero en moverse en pánico</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">BBB Spread</div>
          <div class="kpi-value">${fmtValue(bbb)}</div>
          <div class="kpi-sub">${bbb?.date || '—'} · investment grade</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Inflación Esperada 1Y</div>
          <div class="kpi-value">${fmtValue(inf1y, 2)}</div>
          <div class="kpi-sub">${inf1y?.date || '—'} · shock inmediato (mensual)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Inflación Esperada 5Y</div>
          <div class="kpi-value">${fmtValue(inf5y, 2)}</div>
          <div class="kpi-sub">${inf5y?.date || '—'} · ¿se queda pegado o es transitorio?</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Paro Semanal (US)</div>
          <div class="kpi-value">${claims?.value !== null && claims?.value !== undefined ? Number(claims.value).toLocaleString('es-ES') : 'Sin dato'}</div>
          <div class="kpi-sub">${claims?.date || '—'} · initial claims</div>
        </div>
      </div>
    `;

    // ── Tabla de seguimiento (sin score, son informativos) ──
    const seguimientoRows = [hy, bbb, inf1y, inf5y, claims, claimsParo]
      .filter(Boolean)
      .map(ind => `
        <tr>
          <td style="text-align:left">
            ${ind.label}${ind.manual ? ' <span class="tag warn" style="margin-left:6px;">pendiente</span>' : ''}
            ${ind.detail ? `<div style="font-size:9px;color:var(--text3);margin-top:2px;">${ind.detail}</div>` : ''}
          </td>
          <td>${fmtValue(ind, ind === claims ? 0 : null)}</td>
          <td>${ind.date || '—'}</td>
        </tr>
      `).join('');

    el.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 18px;margin-bottom:20px;">
        <div style="font-size:11px;color:var(--text2);line-height:1.7;">
          Esta sección vigila el día a día para detectar pronto si la foto macro de 1.1 Coyuntura empieza a moverse.
          Los indicadores aquí mostrados son informativos y <strong style="color:var(--text1);">no participan en el score total</strong>.
        </div>
      </div>

      ${alertCards}

      <div class="section-title" style="margin-top:24px;">Seguimiento de Alta Frecuencia</div>
      <table class="data-table">
        <thead><tr><th>Indicador</th><th>Valor</th><th>Fecha</th></tr></thead>
        <tbody>${seguimientoRows}</tbody>
      </table>

      <div class="section-title" style="margin-top:24px;">Pendientes de Clasificar</div>
      <div style="background:var(--surface);border:1px dashed var(--border);border-radius:10px;padding:14px 18px;margin-bottom:8px;">
        <div style="font-size:11px;color:var(--text2);line-height:1.7;margin-bottom:10px;">
          Estos indicadores sí forman parte del score total (categoría Monetarios), pero aún no tienen fuente
          automática ni una ubicación visual definitiva entre Seguimiento y Liquidez.
        </div>
        ${PENDIENTES_KEYS.map(k => {
          const ind = macro.indicators[k];
          if (!ind) return '';
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid var(--border);font-size:11px;">
              <span>${ind.label}</span>
              <span style="font-family:var(--mono);color:${ind.value === null ? 'var(--text3)' : 'var(--text1)'}">${fmtValue(ind)}</span>
            </div>
          `;
        }).join('')}
      </div>

      ${macro.errors ? `
        <div class="section-title" style="margin-top:24px;color:var(--amber);">⚠ Avisos</div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--text3);line-height:1.8;">
          ${macro.errors.map(e => `<div>${e}</div>`).join('')}
        </div>
      ` : ''}
    `;
  }

  document.getElementById('btn-refresh').addEventListener('click', () => load(true));
  document.getElementById('btn-edit-manual').addEventListener('click', () => {
    const creditoVsNominal = prompt('Crédito vs Nominal GDP (%):', manualOverrides.creditoVsNominal ?? '');
    const impulsoCrediticio = prompt('Impulso Crediticio (valor numérico, positivo o negativo):', manualOverrides.impulsoCrediticio ?? '');
    const putCall = prompt('Put/Call Ratio (CBOE — consulta cboe.com/delayed_quotes o tu bróker):', manualOverrides.putCall ?? '');

    // Nota: Curva EUR (1.1) ya no se edita desde aquí — viene siempre
    // del ECB Data Portal automáticamente.
    if (creditoVsNominal !== null && creditoVsNominal !== '') manualOverrides.creditoVsNominal = parseFloat(creditoVsNominal);
    if (impulsoCrediticio !== null && impulsoCrediticio !== '') manualOverrides.impulsoCrediticio = parseFloat(impulsoCrediticio);
    if (putCall !== null && putCall !== '') manualOverrides.putCall = parseFloat(putCall);

    sessionStorage.setItem('ethan_macro_manual', JSON.stringify(manualOverrides));
    load(true);
  });

  await load(false);

  return {
    destroy() {}
  };
}

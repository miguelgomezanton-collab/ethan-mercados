// correlaciones.js — usa /api/macro-history (sin key en frontend)
import { getMacroData } from './macro-data.js';

const f2 = v => v != null ? Number(v).toFixed(2) : '—';

function corrCol(v) {
  if (v == null) return 'var(--text3)';
  return v > 0.6 ? 'var(--green)' : v > 0.3 ? 'var(--teal)' : v > -0.3 ? 'var(--text3)' : v > -0.6 ? 'var(--amber)' : 'var(--red)';
}
function corrDisplay(v) {
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + f2(v);
}

export async function render(container, { actionsSlot }) {
  actionsSlot.innerHTML = `<button class="btn btn-primary" id="corr-refresh">↻ Recalcular</button>`;
  container.innerHTML = `<div id="corr-wrap"><div class="empty"><div class="loader-ring"></div><div class="empty-title">Calculando correlaciones...</div></div></div>`;

  async function load() {
    const el = document.getElementById('corr-wrap');
    el.innerHTML = `<div class="empty"><div class="loader-ring"></div><div class="empty-title">Descargando datos históricos...</div><div class="empty-desc">SP500 · Nasdaq · Russell · Oro · Bonos · Dólar · Indicadores FRED</div></div>`;
    try {
      const [macro, histData] = await Promise.all([
        getMacroData(false),
        fetch('/api/macro-history?type=correlaciones').then(r => { if (!r.ok) throw new Error('macro-history: ' + r.status); return r.json(); })
      ]);
      paint(macro, histData);
    } catch(e) {
      document.getElementById('corr-wrap').innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Error</div><div class="empty-desc">${e.message}</div></div>`;
    }
  }

  function paint(macro, hist) {
    const el = document.getElementById('corr-wrap');
    const corr = hist.correlaciones || {};
    const n = hist.n_months || 0;
    const co = macro.coyuntura || {};
    const liq = macro.liquidez || {};
    const ind = macro.indicators || {};

    const HEADERS = ['SP500', 'Nasdaq', 'Russell', 'Oro', 'Bonos (IEF)', 'Dólar (DXY)'];
    const KEY_MAP = ['sp', 'nq', 'ru', 'au', 'bond', 'dxy'];

    // Indicadores calculados automáticamente en el servidor
    const AUTO_ROWS = [
      { name: 'Curva USD (10Y−2Y)', key: 'curvaUSD',         val: co.curvaUSD?.value, unit: '%', col: co.curvaUSD?.score },
      { name: 'Tipo Real (FFR−CPI)', key: 'tipoReal',        val: co.tipoReal?.value, unit: '%', col: co.tipoReal?.score },
      { name: 'BBB Spread',          key: 'bbb',              val: liq.bbbSpread?.value, unit: '%', col: liq.bbbSpread?.score },
      { name: 'Crédito vs Nominal',  key: 'creditoVsNominal', val: liq.credito?.value, unit: '%', col: liq.credito?.score },
    ];

    // Indicadores con correlaciones estimadas (manuales sin serie histórica auto)
    const MANUAL_ROWS = [
      { name: 'M2 Global YoY ✎',       sp:+0.81,nq:+0.88,ru:+0.76,au:+0.42,bond:-0.35,dxy:-0.58, val: macro.liquidez?.m2?.value, unit:'%' },
      { name: 'LEI USA ✎',              sp:+0.68,nq:+0.65,ru:+0.73,au:-0.22,bond:+0.08,dxy:-0.31, val: ind.lei?.value, unit:'%' },
      { name: 'Impulso Crediticio ✎',   sp:+0.71,nq:+0.79,ru:+0.69,au:+0.18,bond:-0.28,dxy:-0.42, val: liq.impulso?.value },
      { name: 'Fear & Greed',           sp:-0.34,nq:-0.38,ru:-0.31,au:-0.14,bond:+0.09,dxy:-0.05, val: ind.fearGreed?.value },
    ];

    const thS = 'padding:9px 10px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text3);border-bottom:1px solid var(--border);font-weight:600;';
    const tdS = v => `padding:9px 10px;text-align:center;border-bottom:1px solid var(--border);font-family:var(--mono);font-size:11px;font-weight:700;color:${corrCol(v)};`;

    function autoRow(r) {
      const rowCorr = corr[r.key] || {};
      const valColor = r.col != null ? (r.col > 0 ? 'var(--green)' : r.col === 0 ? 'var(--amber)' : 'var(--red)') : 'var(--text3)';
      return `<tr>
        <td style="padding:9px 12px;border-bottom:1px solid var(--border);font-weight:600;">${r.name} <span style="font-size:8px;color:var(--teal);font-family:var(--mono);">CALC</span></td>
        ${KEY_MAP.map(k => `<td style="${tdS(rowCorr[k])}">${corrDisplay(rowCorr[k])}</td>`).join('')}
        <td style="padding:9px 10px;border-bottom:1px solid var(--border);font-size:10px;color:${valColor};">${r.val != null ? (r.val >= 0 ? '+' : '') + f2(r.val) + (r.unit || '') : '—'}</td>
      </tr>`;
    }

    function manualRow(r) {
      const vals = [r.sp, r.nq, r.ru, r.au, r.bond, r.dxy];
      return `<tr>
        <td style="padding:9px 12px;border-bottom:1px solid var(--border);font-weight:600;">${r.name}</td>
        ${vals.map(v => `<td style="${tdS(v)}">${corrDisplay(v)}</td>`).join('')}
        <td style="padding:9px 10px;border-bottom:1px solid var(--border);font-size:10px;color:var(--text3);">${r.val != null ? (r.val >= 0 ? '+' : '') + f2(r.val) + (r.unit || '') : '—'}</td>
      </tr>`;
    }

    el.innerHTML = `
      <div style="font-size:11px;color:var(--text3);margin-bottom:12px;line-height:1.5;">
        Correlación de Pearson calculada en el servidor con <strong style="color:var(--text1)">${n} meses</strong> de datos históricos.
        <span style="color:var(--teal);font-family:var(--mono);font-size:9px;">CALC</span> = calculado automáticamente.
        <strong style="color:var(--amber)">✎</strong> = estimación histórica (indicador manual sin serie auto).
      </div>
      <div style="font-size:9px;font-family:var(--mono);color:var(--text3);margin-bottom:12px;">
        <span style="color:var(--green)">■</span> >+0.60 &nbsp;
        <span style="color:var(--teal)">■</span> +0.30-0.60 &nbsp;
        <span style="color:var(--text3)">■</span> ±0.30 &nbsp;
        <span style="color:var(--amber)">■</span> −0.30 a −0.60 &nbsp;
        <span style="color:var(--red)">■</span> <−0.60
      </div>
      <div class="mac-card">
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead><tr style="background:var(--surface2);">
            <th style="padding:9px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text3);border-bottom:1px solid var(--border);">Indicador</th>
            ${HEADERS.map(h => `<th style="${thS}">${h}</th>`).join('')}
            <th style="padding:9px 10px;text-align:left;font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">Valor actual</th>
          </tr></thead>
          <tbody>
            ${AUTO_ROWS.map(autoRow).join('')}
            <tr><td colspan="8" style="padding:5px 12px;background:var(--surface2);font-size:9px;color:var(--text3);font-family:var(--mono);font-style:italic;">Indicadores manuales — correlaciones históricas estimadas</td></tr>
            ${MANUAL_ROWS.map(manualRow).join('')}
          </tbody>
        </table>
        <div style="font-size:9px;color:var(--text3);font-family:var(--mono);margin-top:10px;">
          ${hist.errors?.length ? '⚠ ' + hist.errors.join(' · ') + ' · ' : ''}Correlación de Pearson con retornos mensuales. Período: últimos ${n} meses. No constituyen recomendaciones de inversión.
        </div>
      </div>
      <div class="co-footer" style="margin-top:14px;">Calculado en servidor · Yahoo Finance (SP500, Nasdaq, Russell, Oro, IEF, DXY) · FRED (DGS10, DGS2, DFF, CPIAUCSL, BAMLC0A4CBBB, TOTLL, GDP)</div>
    `;
  }

  document.getElementById('corr-refresh')?.addEventListener('click', load);
  await load();
  return { destroy() {} };
}

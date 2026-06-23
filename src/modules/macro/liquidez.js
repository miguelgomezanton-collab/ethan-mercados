// ═══════════════════════════════════════════════
// MÓDULO: Liquidez Global (1.3)
// Monitor de lo que mueve la bolsa por el lado de flujo de dinero:
// M2 (proxy US), Velocidad de M2 y Reservas Bancarias.
// ═══════════════════════════════════════════════

export async function render(container, { actionsSlot }) {
  actionsSlot.innerHTML = `<button class="btn btn-primary" id="btn-refresh-liq">↻ Actualizar</button>`;

  container.innerHTML = `<div id="liquidez-content"><div class="empty"><div class="loader-ring"></div></div></div>`;
  const el = document.getElementById('liquidez-content');

  async function load() {
    el.innerHTML = `<div class="empty"><div class="loader-ring"></div></div>`;
    try {
      const res = await fetch('/api/macro');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const macro = await res.json();
      paint(macro);
    } catch (err) {
      el.innerHTML = `
        <div class="empty">
          <div class="empty-icon">⚠</div>
          <div class="empty-title">Error al cargar datos de liquidez</div>
          <div class="empty-desc">${err.message}</div>
        </div>
      `;
    }
  }

  function paint(macro) {
    const m2 = macro.indicators.m2Global;
    const velocidad = macro.indicators.velocidadM2;
    const reservas = macro.indicators.reservasBancarias;

    el.innerHTML = `
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-label">M2 (proxy US)</div>
          <div class="kpi-value ${m2?.score >= 0 ? 'up' : 'down'}">${m2 ? (m2.value >= 0 ? '+' : '') + m2.value + '%' : '—'}</div>
          <div class="kpi-sub">YoY — ${m2?.date || '—'}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Velocidad M2</div>
          <div class="kpi-value ${velocidad?.score >= 0 ? 'up' : 'down'}">${velocidad ? (velocidad.value >= 0 ? '+' : '') + velocidad.value + '%' : '—'}</div>
          <div class="kpi-sub">${velocidad?.detail || ''}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Reservas Bancarias</div>
          <div class="kpi-value ${reservas?.score >= 0 ? 'up' : 'down'}">${reservas ? (reservas.value >= 0 ? '+' : '') + reservas.value + '%' : '—'}</div>
          <div class="kpi-sub">YoY — ${reservas?.detail || ''}</div>
        </div>
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:20px;">
        <div style="font-size:11px;color:var(--text2);line-height:1.7;">
          <strong style="color:var(--amber);">⚠ Nota:</strong> el valor de M2 mostrado es un proxy basado únicamente en M2 de Estados Unidos (FRED, serie M2SL).
          El "M2 Global" completo de tu sistema combina Fed + ECB + PBOC + BoJ — esa integración multi-banco-central
          está pendiente de construir. Mientras tanto, este proxy US sirve como referencia direccional.
        </div>
      </div>

      <div class="section-title">Evolución M2 (12 meses)</div>
      <div id="m2-chart" style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;height:280px;"></div>
    `;

    renderChart(macro);
  }

  async function renderChart(macro) {
    // El endpoint actual de /api/macro solo devuelve el valor YoY más
    // reciente, no la serie histórica completa. Graficar con un solo punto
    // no sería honesto, así que mostramos un aviso claro hasta ampliar el
    // endpoint con un histórico real de 12 meses de M2SL.
    const chartEl = document.getElementById('m2-chart');
    if (!chartEl) return;

    chartEl.innerHTML = `
      <div class="empty" style="height:100%;">
        <div class="empty-icon">📈</div>
        <div class="empty-title">Histórico pendiente</div>
        <div class="empty-desc">El endpoint actual solo devuelve el valor YoY más reciente. Para graficar la serie completa hace falta ampliar /api/macro con un endpoint de histórico (12 meses de M2SL).</div>
      </div>
    `;
  }

  document.getElementById('btn-refresh-liq').addEventListener('click', load);
  await load();

  return {
    destroy() {}
  };
}

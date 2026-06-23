// ═══════════════════════════════════════════════
// MÓDULO: Cartera (4.2)
// Primer módulo conectado de punta a punta a Firestore.
// ═══════════════════════════════════════════════

import { state, subscribe, addOperacion, deleteOperacion } from '../../state.js';

export async function render(container, { actionsSlot }) {
  actionsSlot.innerHTML = `
    <button class="btn" id="btn-historial">Historial</button>
    <button class="btn btn-primary" id="btn-nueva-op">+ Nueva operación</button>
  `;

  container.innerHTML = `<div id="cartera-content"></div>`;
  const contentEl = document.getElementById('cartera-content');

  function paint() {
    const ops = state.operaciones.alcista.filter(o => !o.fechaSalida); // abiertas
    const cerradas = state.operaciones.alcista.filter(o => o.fechaSalida);

    const totalPL = cerradas.reduce((sum, o) => sum + (o.plusvalia || 0), 0);
    const wins = cerradas.filter(o => (o.plusvalia || 0) > 0).length;
    const winRate = cerradas.length ? Math.round((wins / cerradas.length) * 100) : 0;

    if (!state.ready) {
      contentEl.innerHTML = `<div class="empty"><div class="loader-ring"></div></div>`;
      return;
    }

    if (ops.length === 0 && cerradas.length === 0) {
      contentEl.innerHTML = `
        <div class="empty">
          <div class="empty-icon">◫</div>
          <div class="empty-title">Cartera vacía</div>
          <div class="empty-desc">Registra tu primera operación para empezar a hacer seguimiento.</div>
        </div>
      `;
      return;
    }

    contentEl.innerHTML = `
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-label">P&amp;L Total (cerradas)</div>
          <div class="kpi-value ${totalPL >= 0 ? 'up' : 'down'}">${totalPL >= 0 ? '+' : ''}${totalPL.toFixed(2)} €</div>
          <div class="kpi-sub">${cerradas.length} operaciones cerradas</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Posiciones Abiertas</div>
          <div class="kpi-value">${ops.length}</div>
          <div class="kpi-sub">en seguimiento</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Win Rate</div>
          <div class="kpi-value ${winRate >= 50 ? 'up' : 'down'}">${winRate}%</div>
          <div class="kpi-sub">sobre cerradas</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total Operaciones</div>
          <div class="kpi-value">${state.operaciones.alcista.length}</div>
          <div class="kpi-sub">histórico</div>
        </div>
      </div>

      <div class="section-title">Posiciones Abiertas</div>
      <table class="data-table">
        <thead><tr><th>Valor</th><th>Ticker</th><th>Entrada</th><th>Capital</th><th>Fecha</th><th></th></tr></thead>
        <tbody>
          ${ops.length === 0 ? `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px;">Sin posiciones abiertas</td></tr>` : ''}
          ${ops.map(o => `
            <tr>
              <td style="text-align:left">${o.valor || '—'}</td>
              <td class="tick">${o.ticker || '—'}</td>
              <td>${o.precioEntrada ?? '—'}</td>
              <td>${o.capital ? o.capital.toFixed(0) + ' €' : '—'}</td>
              <td>${o.fechaEntrada || '—'}</td>
              <td><button class="btn" data-del="${o.id}" style="padding:3px 8px;font-size:9px;">✕</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${cerradas.length > 0 ? `
        <div class="section-title" style="margin-top:24px;">Últimas Cerradas</div>
        <table class="data-table">
          <thead><tr><th>Valor</th><th>Ticker</th><th>Rentabilidad</th><th>P&amp;L</th><th>Días</th></tr></thead>
          <tbody>
            ${cerradas.slice(0, 8).map(o => `
              <tr>
                <td style="text-align:left">${o.valor || '—'}</td>
                <td class="tick">${o.ticker || '—'}</td>
                <td class="${(o.rentabilidad||0) >= 0 ? 'up' : 'down'}">${o.rentabilidad ? (o.rentabilidad*100).toFixed(2)+'%' : '—'}</td>
                <td class="${(o.plusvalia||0) >= 0 ? 'up' : 'down'}">${o.plusvalia ? (o.plusvalia>=0?'+':'')+o.plusvalia.toFixed(2)+' €' : '—'}</td>
                <td>${o.dias ?? '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
    `;

    contentEl.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('¿Eliminar esta operación?')) {
          await deleteOperacion('alcista', btn.dataset.del);
        }
      });
    });
  }

  const unsub = subscribe(paint);
  paint();

  document.getElementById('btn-nueva-op').addEventListener('click', () => openNuevaOperacionModal());
  document.getElementById('btn-historial').addEventListener('click', () => {
    alert('Vista de historial completo — pendiente de diseño detallado.');
  });

  function openNuevaOperacionModal() {
    const valor = prompt('Nombre del valor (ej: APPLE):');
    if (!valor) return;
    const ticker = prompt('Ticker (ej: AAPL):');
    if (!ticker) return;
    const precioEntrada = parseFloat(prompt('Precio de entrada:'));
    const capital = parseFloat(prompt('Capital asignado (€):'));
    const fechaEntrada = new Date().toISOString().split('T')[0];

    addOperacion('alcista', {
      valor: valor.toUpperCase(),
      ticker: ticker.toUpperCase(),
      precioEntrada,
      capital,
      peso: 0,
      fechaEntrada
    }).catch(err => alert('Error al guardar: ' + err.message));
  }

  return {
    destroy() {
      unsub();
    }
  };
}

// ═══════════════════════════════════════════════
// MÓDULO: Vitácora (4.6)
// Conectado a Firestore — segundo módulo de validación end-to-end.
// ═══════════════════════════════════════════════

import { state, subscribe, addVitacoraEntry, deleteVitacoraEntry } from '../../state.js';

export async function render(container, { actionsSlot }) {
  actionsSlot.innerHTML = `<button class="btn btn-primary" id="btn-registrar">+ Registrar</button>`;

  container.innerHTML = `<div id="vitacora-content"></div>`;
  const contentEl = document.getElementById('vitacora-content');

  function paint() {
    if (!state.ready) {
      contentEl.innerHTML = `<div class="empty"><div class="loader-ring"></div></div>`;
      return;
    }

    if (state.vitacora.length === 0) {
      contentEl.innerHTML = `
        <div class="empty">
          <div class="empty-icon">📓</div>
          <div class="empty-title">Sin entradas registradas</div>
          <div class="empty-desc">Registra el estado emocional, condición M+S+D y notas de cada operación.</div>
        </div>
      `;
      return;
    }

    contentEl.innerHTML = `
      <div class="section-title">Entradas Recientes</div>
      <table class="data-table">
        <thead><tr><th>Fecha</th><th>Ticker</th><th>Estado</th><th>M+S+D</th><th>Nota</th><th></th></tr></thead>
        <tbody>
          ${state.vitacora.map(v => `
            <tr>
              <td style="text-align:left">${new Date(v.fecha).toLocaleDateString('es-ES')}</td>
              <td class="tick">${v.ticker || '—'}</td>
              <td><span class="tag ${v.estado === 'positivo' ? 'good' : v.estado === 'negativo' ? 'bad' : 'warn'}">${v.estado || '—'}</span></td>
              <td>${v.msd ? '✓' : '—'}</td>
              <td style="text-align:left;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${v.nota || ''}</td>
              <td><button class="btn" data-del="${v.id}" style="padding:3px 8px;font-size:9px;">✕</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    contentEl.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('¿Eliminar esta entrada?')) {
          await deleteVitacoraEntry(btn.dataset.del);
        }
      });
    });
  }

  const unsub = subscribe(paint);
  paint();

  document.getElementById('btn-registrar').addEventListener('click', async () => {
    const ticker = prompt('Ticker de la operación:');
    if (!ticker) return;
    const estado = prompt('Estado emocional (positivo / neutral / negativo):', 'neutral');
    const msd = confirm('¿Se cumplieron las condiciones M+S+D? (Aceptar = sí)');
    const nota = prompt('Nota / reflexión:') || '';

    addVitacoraEntry({
      ticker: ticker.toUpperCase(),
      estado,
      msd,
      nota,
      fecha: Date.now()
    }).catch(err => alert('Error al guardar: ' + err.message));
  });

  return {
    destroy() {
      unsub();
    }
  };
}

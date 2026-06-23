// ═══════════════════════════════════════════════
// MÓDULO: Backtesting
// Placeholder — pendiente de migrar contenido real.
// ═══════════════════════════════════════════════

export async function render(container) {
  container.innerHTML = `
    <div class="empty">
      <div class="empty-icon">⏱</div>
      <div class="empty-title">Backtesting</div>
      <div class="empty-desc">Prueba de estrategias EMA sobre histórico de precios.</div>
    </div>
  `;

  return {
    destroy() {}
  };
}

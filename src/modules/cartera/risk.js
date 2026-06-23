// ═══════════════════════════════════════════════
// MÓDULO: Risk Management
// Placeholder — pendiente de migrar contenido real.
// ═══════════════════════════════════════════════

export async function render(container) {
  container.innerHTML = `
    <div class="empty">
      <div class="empty-icon">🛡</div>
      <div class="empty-title">Risk Management</div>
      <div class="empty-desc">Niveles de stop, máximo drawdown y exposición por posición.</div>
    </div>
  `;

  return {
    destroy() {}
  };
}

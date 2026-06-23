// ═══════════════════════════════════════════════
// MÓDULO: Money Management
// Placeholder — pendiente de migrar contenido real.
// ═══════════════════════════════════════════════

export async function render(container) {
  container.innerHTML = `
    <div class="empty">
      <div class="empty-icon">💰</div>
      <div class="empty-title">Money Management</div>
      <div class="empty-desc">Sizing de posiciones, proyecciones de compounding y reglas de capital por operación.</div>
    </div>
  `;

  return {
    destroy() {}
  };
}

// ═══════════════════════════════════════════════
// MÓDULO: Watchlist · Bajista
// Placeholder — pendiente de migrar contenido real.
// ═══════════════════════════════════════════════

export async function render(container) {
  container.innerHTML = `
    <div class="empty">
      <div class="empty-icon">👁</div>
      <div class="empty-title">Watchlist · Bajista</div>
      <div class="empty-desc">Candidatos a cortos en seguimiento.</div>
    </div>
  `;

  return {
    destroy() {}
  };
}

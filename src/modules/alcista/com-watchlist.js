// ═══════════════════════════════════════════════
// MÓDULO: Watchlist · Commodities
// Placeholder — pendiente de migrar contenido real.
// ═══════════════════════════════════════════════

export async function render(container) {
  container.innerHTML = `
    <div class="empty">
      <div class="empty-icon">🪙</div>
      <div class="empty-title">Watchlist · Commodities</div>
      <div class="empty-desc">Commodities en seguimiento activo.</div>
    </div>
  `;

  return {
    destroy() {}
  };
}

// ═══════════════════════════════════════════════
// MÓDULO: Watchlist · Renta Fija
// Placeholder — pendiente de migrar contenido real.
// ═══════════════════════════════════════════════

export async function render(container) {
  container.innerHTML = `
    <div class="empty">
      <div class="empty-icon">📜</div>
      <div class="empty-title">Watchlist · Renta Fija</div>
      <div class="empty-desc">Bonos, ETFs de deuda y tickers de renta fija en seguimiento.</div>
    </div>
  `;

  return {
    destroy() {}
  };
}

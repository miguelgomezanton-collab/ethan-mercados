// ═══════════════════════════════════════════════
// MÓDULO: Screener SP500 / NYSE · Bajista
// Placeholder — pendiente de migrar contenido real.
// ═══════════════════════════════════════════════

export async function render(container) {
  container.innerHTML = `
    <div class="empty">
      <div class="empty-icon">🔍</div>
      <div class="empty-title">Screener SP500 / NYSE · Bajista</div>
      <div class="empty-desc">Valores del S&amp;P 500 y NYSE con señales bajistas.</div>
    </div>
  `;

  return {
    destroy() {}
  };
}

// ═══════════════════════════════════════════════
// MÓDULO: Screener de Sectores · Bajista
// Placeholder — pendiente de migrar contenido real.
// ═══════════════════════════════════════════════

export async function render(container) {
  container.innerHTML = `
    <div class="empty">
      <div class="empty-icon">🏭</div>
      <div class="empty-title">Screener de Sectores · Bajista</div>
      <div class="empty-desc">Sectores con debilidad relativa, candidatos a posiciones cortas.</div>
    </div>
  `;

  return {
    destroy() {}
  };
}

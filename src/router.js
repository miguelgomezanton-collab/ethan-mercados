// ═══════════════════════════════════════════════
// ROUTER — Navegación entre módulos (sin iframes)
// ═══════════════════════════════════════════════
// Cada módulo exporta una función `render(container)` que recibe el
// elemento DOM donde debe pintarse, y opcionalmente `destroy()` para
// limpiar listeners/intervals al salir de la página.

const registry = {};   // pageId -> { loader, crumb, title }
let currentPageId = null;
let currentDestroy = null;
let mainEl = null;

/**
 * Registra una página/módulo.
 * @param {string} pageId  ej: 'car-cartera'
 * @param {object} opts
 * @param {() => Promise<{render: Function, destroy?: Function}>} opts.loader  import() dinámico
 * @param {string} opts.crumb   breadcrumb a mostrar, ej: "4. Cartera › 4.2 Cartera"
 * @param {string} opts.title   título grande de la página
 */
export function registerPage(pageId, opts) {
  registry[pageId] = opts;
}

export function initRouter(mainContainer) {
  mainEl = mainContainer;
}

export async function navigateTo(pageId) {
  const entry = registry[pageId];
  if (!entry) {
    console.error(`ETHAN router: página "${pageId}" no registrada`);
    return;
  }

  // Limpieza del módulo anterior
  if (currentDestroy) {
    try { currentDestroy(); } catch (e) { console.warn('Error en destroy() del módulo anterior', e); }
    currentDestroy = null;
  }

  currentPageId = pageId;
  updateChrome(entry);
  updateActiveNav(pageId);

  mainEl.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-crumb">${entry.crumb}</div>
        <div class="page-title">${entry.title}</div>
      </div>
      <div class="page-actions" id="page-actions-slot"></div>
    </div>
    <div class="page-body" id="page-body-slot">
      <div class="module-loading">
        <div class="loader-ring"></div>
      </div>
    </div>
  `;

  const bodySlot = document.getElementById('page-body-slot');
  const actionsSlot = document.getElementById('page-actions-slot');

  try {
    const mod = await entry.loader();
    const result = await mod.render(bodySlot, { actionsSlot });
    if (result && typeof result.destroy === 'function') {
      currentDestroy = result.destroy;
    }
  } catch (err) {
    console.error(`Error al cargar el módulo "${pageId}":`, err);
    bodySlot.innerHTML = `
      <div class="empty">
        <div class="empty-icon">⚠</div>
        <div class="empty-title">Error al cargar el módulo</div>
        <div class="empty-desc">${err.message || err}</div>
      </div>
    `;
  }
}

export function getCurrentPage() {
  return currentPageId;
}

function updateChrome(entry) {
  const statusEl = document.getElementById('status-module');
  if (statusEl) statusEl.textContent = entry.crumb.replace(/›/g, '>').toUpperCase();
  // Reflejar en la URL para poder refrescar/compartir enlace
  if (currentPageId) {
    history.replaceState(null, '', `#${currentPageId}`);
  }
}

function updateActiveNav(pageId) {
  document.querySelectorAll('.mod[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageId);
  });
}

/** Lee el hash de la URL al cargar, para deep-linking */
export function getInitialPageFromHash(defaultPage) {
  const hash = location.hash.replace('#', '');
  return hash && registry[hash] ? hash : defaultPage;
}

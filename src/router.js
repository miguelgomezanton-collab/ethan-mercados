// ═══════════════════════════════════════════════
// ROUTER — Navegación entre módulos (sin iframes)
// ═══════════════════════════════════════════════
// Cache de estado: moduleState guarda el último estado de cada módulo
// (ticker analizado, filtros del screener, etc.) para restaurarlo al volver.
// Cada módulo puede leer router.getModuleState(pageId) al iniciar.

const registry = {};     // pageId -> { loader, crumb, title }
export const moduleState = {}; // pageId -> cualquier objeto que el módulo quiera guardar

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

  const bodySlot    = document.getElementById('page-body-slot');
  const actionsSlot = document.getElementById('page-actions-slot');

  try {
    const mod = await entry.loader();
    const hasSavedState = !!moduleState[pageId];
    console.log(`[Router] Cargando ${pageId}, savedState: ${hasSavedState}`);
    // Pasamos el estado guardado al módulo (puede ser undefined si es la primera vez)
    const result = await mod.render(bodySlot, { actionsSlot, savedState: moduleState[pageId] });
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

/** Los módulos llaman a esto para guardar su estado antes de que el usuario navegue */
export function saveModuleState(pageId, state) {
  moduleState[pageId] = state;
  console.log(`[Router] Estado guardado para ${pageId}:`, Object.keys(state || {}));
}

/** Invalida el estado de un módulo (forzar re-render limpio) */
export function clearModuleState(pageId) {
  delete moduleState[pageId];
}

export function getCurrentPage() {
  return currentPageId;
}

function updateChrome(entry) {
  const statusEl = document.getElementById('status-module');
  if (statusEl) statusEl.innerHTML = entry.crumb.replace(/›/g, '>').toUpperCase();
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

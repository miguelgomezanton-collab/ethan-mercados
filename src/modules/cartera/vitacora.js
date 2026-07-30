// ═══════════════════════════════════════════════
// MÓDULO: Bitácora (4.6)
// 3 pestañas: Diario, Registrar, Sesgos
// Persistencia en Firestore: ethan_bitacora_v1
// Estructura de entrada:
// { id, type, ticker, direction, msd:{M,S,D},
//   mood, notas, lesson, createdAt }
// ═══════════════════════════════════════════════

import { UserData } from '../../userdata.js';

const STORAGE_KEY = 'ethan_bitacora_v1';

const MOOD_EMOJI = {
  'euforia':'😄', 'positivo':'😊', 'neutro':'😐',
  'frustrado':'😤', 'ansioso':'😰'
};
const TYPE_LABEL = {
  entrada:'ENTRADA', salida:'SALIDA',
  reflexion:'REFLEXIÓN', error:'ERROR'
};
const fmtDate = ts => new Date(ts).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
const fmtTime = ts => new Date(ts).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});

// ── Helpers HTML ─────────────────────────────────
function msdTag(k, v) {
  const cls = v==='ok'?'ok':v==='fail'?'fail':'na';
  const lbl = v==='ok'?'✓':v==='fail'?'✗':'—';
  return `<span class="msd-tag ${cls}">${k} ${lbl}</span>`;
}

function entryCard(e) {
  const dirHtml = e.direction && e.direction!=='na'
    ? `<span class="bt-entry-dir ${e.direction}">${e.direction.toUpperCase()}</span>` : '';
  const lessonHtml = e.lesson
    ? `<div class="bt-entry-lesson">${e.lesson}</div>` : '';
  return `
    <div class="bt-entry" data-id="${e.id}">
      <div class="bt-entry-header">
        <div class="bt-entry-meta">
          <span class="bt-entry-ticker">${e.ticker||'—'}</span>
          ${dirHtml}
          <span class="bt-entry-type">${TYPE_LABEL[e.type]||e.type}</span>
          <span class="bt-entry-date">${fmtDate(e.createdAt)} · ${fmtTime(e.createdAt)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="bt-entry-mood">${MOOD_EMOJI[e.mood]||'—'}</span>
          <button class="bt-delete-btn" data-id="${e.id}" title="Eliminar">✕</button>
        </div>
      </div>
      <div class="bt-entry-msd">
        ${msdTag('M', e.msd?.M||'na')}
        ${msdTag('S', e.msd?.S||'na')}
        ${msdTag('D', e.msd?.D||'na')}
      </div>
      ${e.notas ? `<div class="bt-entry-text">${e.notas}</div>` : ''}
      ${lessonHtml}
    </div>`;
}

// ── Análisis de sesgos ───────────────────────────
function analyzeSesgos(entries) {
  const ops = entries.filter(e => e.type==='entrada'||e.type==='salida');
  if (ops.length < 3) return null;

  // 1. Recortar ganancias pronto: salidas con M ok pero S fail/na
  const salidasPrematuras = entries.filter(e =>
    e.type==='salida' && e.msd?.M==='ok' && e.msd?.S!=='ok'
  );

  // 2. Impaciencia: entradas con M+S ok pero D fail
  const entradasSinD = entries.filter(e =>
    e.type==='entrada' && e.msd?.M==='ok' && e.msd?.S==='ok' && e.msd?.D!=='ok'
  );

  // 3. Ops fuera de sistema: alguna condición en fail
  const fueraSistema = ops.filter(e =>
    e.msd?.M==='fail' || e.msd?.S==='fail' || e.msd?.D==='fail'
  );

  // 4. Consistencia: ops con M+S+D todas ok
  const dentraSistema = ops.filter(e =>
    e.msd?.M==='ok' && e.msd?.S==='ok' && e.msd?.D==='ok'
  );
  const pctConsistencia = ops.length ? Math.round(dentraSistema.length/ops.length*100) : 0;

  // 5. Mood vs resultado — aproximación por posición en el feed
  const moodStats = {};
  ops.forEach(e => {
    if (!e.mood) return;
    if (!moodStats[e.mood]) moodStats[e.mood] = { total:0, ok:0 };
    moodStats[e.mood].total++;
    if (e.msd?.M==='ok'&&e.msd?.S==='ok'&&e.msd?.D==='ok') moodStats[e.mood].ok++;
  });

  return {
    salidasPrematuras: salidasPrematuras.length,
    entradasSinD: entradasSinD.length,
    fueraSistema: fueraSistema.length,
    dentraSistema: dentraSistema.length,
    pctConsistencia,
    totalOps: ops.length,
    moodStats,
    mStats: { cumple: ops.filter(e=>e.msd?.M==='ok').length, total: ops.length },
    sStats: { cumple: ops.filter(e=>e.msd?.S==='ok').length, total: ops.length },
    dStats: { cumple: ops.filter(e=>e.msd?.D==='ok').length, total: ops.length },
  };
}

// ── RENDER PRINCIPAL ─────────────────────────────
export async function render(container, { actionsSlot }) {
  actionsSlot.innerHTML = '';
  let entries = (await UserData.get(STORAGE_KEY)) || [];

  async function saveEntries() {
    await UserData.set(STORAGE_KEY, entries);
  }

  // Estado del formulario
  const msdState = { M:'na', S:'na', D:'na' };
  let activeMood = 'positivo';
  let activeFilter = 'all';

  // ── HTML Principal ──────────────────────────────
  container.innerHTML = `
    <div class="bt-tabs">
      <button class="bt-tab active" data-tab="diario">📓 Diario</button>
      <button class="bt-tab" data-tab="registrar">✍️ Registrar</button>
      <button class="bt-tab" data-tab="sesgos">🧠 Sesgos</button>
    </div>

    <!-- DIARIO -->
    <div class="bt-panel active" id="panel-diario">
      <div class="bt-grid">
        <div class="bt-col">
          <div class="bt-filters">
            <span class="bt-filter-label">Ver:</span>
            <button class="bt-filter-btn active" data-filter="all">Todas</button>
            <button class="bt-filter-btn" data-filter="entrada">Entradas</button>
            <button class="bt-filter-btn" data-filter="salida">Salidas</button>
            <button class="bt-filter-btn" data-filter="reflexion">Reflexiones</button>
            <button class="bt-filter-btn" data-filter="error">Errores</button>
          </div>
          <div id="bt-feed"></div>
        </div>
        <div class="bt-col">
          <div class="bt-card" id="bt-stats-card">
            <div class="bt-card-title">Estadísticas</div>
            <div id="bt-stats-body"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- REGISTRAR -->
    <div class="bt-panel" id="panel-registrar">
      <div class="bt-grid">
        <div class="bt-col">
          <div class="bt-card">
            <div class="bt-card-title">Nueva Entrada</div>

            <div class="bt-form-row triple">
              <div class="bt-field"><label>Tipo</label>
                <select class="bt-select" id="reg-type">
                  <option value="entrada">📈 Entrada en posición</option>
                  <option value="salida">📉 Salida de posición</option>
                  <option value="reflexion">🤔 Reflexión libre</option>
                  <option value="error">⚠️ Error / aprendizaje</option>
                </select>
              </div>
              <div class="bt-field"><label>Ticker / Activo</label>
                <input type="text" class="bt-input" id="reg-ticker" placeholder="NVDA" style="text-transform:uppercase;">
              </div>
              <div class="bt-field"><label>Dirección</label>
                <select class="bt-select" id="reg-dir">
                  <option value="long">📈 Long</option>
                  <option value="short">📉 Short</option>
                  <option value="na">— N/A</option>
                </select>
              </div>
            </div>

            <div class="bt-field" style="margin-bottom:8px;"><label>Condiciones del sistema (M · S · D)</label></div>
            <div class="msd-row">
              ${['M','S','D'].map(k => `
                <div class="msd-pill">
                  <label>${k==='M'?'MENSUAL':k==='S'?'SEMANAL':'DIARIO'}</label>
                  <div class="msd-btn-group">
                    <button class="msd-btn" data-msd="${k}" data-val="ok">✓</button>
                    <button class="msd-btn" data-msd="${k}" data-val="fail">✗</button>
                    <button class="msd-btn active-na" data-msd="${k}" data-val="na">—</button>
                  </div>
                </div>`).join('')}
            </div>

            <div class="bt-field" style="margin-bottom:8px;"><label>Estado emocional</label></div>
            <div class="mood-row" style="margin-bottom:16px;">
              ${Object.entries(MOOD_EMOJI).map(([k,v]) =>
                `<button class="mood-btn ${k==='positivo'?'active':''}" data-mood="${k}">${v}<span class="mood-label">${k.charAt(0).toUpperCase()+k.slice(1)}</span></button>`
              ).join('')}
            </div>

            <div class="bt-form-row single" style="margin-bottom:12px;">
              <div class="bt-field"><label>Razonamiento / Contexto</label>
                <textarea class="bt-textarea" id="reg-notas" placeholder="¿Por qué entras/sales? ¿Qué ves en el gráfico? ¿Qué dice el macro?"></textarea>
              </div>
            </div>
            <div class="bt-form-row single">
              <div class="bt-field"><label>Aprendizaje / Lección (opcional)</label>
                <textarea class="bt-textarea" id="reg-lesson" placeholder="¿Qué aprendes? ¿Harías algo diferente?" style="min-height:60px;"></textarea>
              </div>
            </div>

            <button class="btn-save" id="btn-guardar" style="margin-top:16px;">Guardar en Bitácora</button>
          </div>
        </div>

        <!-- Preview -->
        <div class="bt-col">
          <div class="bt-card">
            <div class="bt-card-title">Vista Previa</div>
            <div id="bt-preview"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- SESGOS -->
    <div class="bt-panel" id="panel-sesgos">
      <div class="bt-grid">
        <div class="bt-col" id="sesgos-main"></div>
        <div class="bt-col" id="sesgos-sidebar"></div>
      </div>
    </div>
  `;

  // ── Tabs ──────────────────────────────────────
  container.querySelectorAll('.bt-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.bt-tab').forEach(t=>t.classList.remove('active'));
      container.querySelectorAll('.bt-panel').forEach(p=>p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-'+tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab==='sesgos') renderSesgos();
    });
  });

  // ── Filtros ────────────────────────────────────
  container.querySelectorAll('.bt-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.bt-filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderFeed();
    });
  });

  // ── M/S/D ──────────────────────────────────────
  container.querySelectorAll('.msd-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.msd, v = btn.dataset.val;
      msdState[k] = v;
      container.querySelectorAll(`[data-msd="${k}"]`).forEach(b => {
        b.classList.remove('active-ok','active-fail','active-na');
      });
      btn.classList.add(v==='ok'?'active-ok':v==='fail'?'active-fail':'active-na');
      renderPreview();
    });
  });

  // ── Mood ───────────────────────────────────────
  container.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.mood-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      activeMood = btn.dataset.mood;
      renderPreview();
    });
  });

  // Live preview
  ['reg-ticker','reg-type','reg-dir','reg-notas'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', renderPreview);
  });

  // ── Guardar ────────────────────────────────────
  document.getElementById('btn-guardar')?.addEventListener('click', async () => {
    const ticker = document.getElementById('reg-ticker').value.trim().toUpperCase();
    const type   = document.getElementById('reg-type').value;
    const notas  = document.getElementById('reg-notas').value.trim();
    if (!notas && type !== 'reflexion') {
      document.getElementById('reg-notas').focus(); return;
    }
    const entry = {
      id: Date.now().toString(),
      type, ticker,
      direction: document.getElementById('reg-dir').value,
      msd: { ...msdState },
      mood: activeMood,
      notas,
      lesson: document.getElementById('reg-lesson').value.trim(),
      createdAt: Date.now()
    };
    entries.unshift(entry);
    await saveEntries();
    // Reset form
    document.getElementById('reg-ticker').value = '';
    document.getElementById('reg-notas').value = '';
    document.getElementById('reg-lesson').value = '';
    msdState.M = msdState.S = msdState.D = 'na';
    container.querySelectorAll('.msd-btn').forEach(b => {
      b.classList.remove('active-ok','active-fail','active-na');
      if (b.dataset.val==='na') b.classList.add('active-na');
    });
    renderFeed();
    renderPreview();
    // Volver al diario
    container.querySelectorAll('.bt-tab').forEach(t=>t.classList.remove('active'));
    container.querySelectorAll('.bt-panel').forEach(p=>p.classList.remove('active'));
    container.querySelector('[data-tab="diario"]').classList.add('active');
    document.getElementById('panel-diario').classList.add('active');
  });

  // ── Render feed ────────────────────────────────
  function renderFeed() {
    const feed = document.getElementById('bt-feed');
    if (!feed) return;
    const filtered = activeFilter==='all' ? entries : entries.filter(e=>e.type===activeFilter);
    if (filtered.length === 0) {
      feed.innerHTML = `<div class="sc2-empty">${entries.length===0?'Aún no hay entradas — usa la pestaña Registrar para añadir la primera.':'Ninguna entrada coincide con el filtro.'}</div>`;
    } else {
      feed.innerHTML = filtered.map(entryCard).join('');
      feed.querySelectorAll('.bt-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          entries = entries.filter(e=>e.id!==btn.dataset.id);
          await saveEntries();
          renderFeed();
          renderStats();
        });
      });
    }
    renderStats();
  }

  // ── Render stats sidebar ───────────────────────
  function renderStats() {
    const el = document.getElementById('bt-stats-body');
    if (!el) return;
    const ops = entries.filter(e=>e.type==='entrada'||e.type==='salida');
    const msdOk = ops.filter(e=>e.msd?.M==='ok'&&e.msd?.S==='ok'&&e.msd?.D==='ok');
    const pct = ops.length ? Math.round(msdOk.length/ops.length*100) : 0;
    el.innerHTML = `
      <div class="bt-stat-row"><span class="bt-stat-label">Total entradas</span><span class="bt-stat-val">${entries.length}</span></div>
      <div class="bt-stat-row"><span class="bt-stat-label">M+S+D cumplidas</span><span class="bt-stat-val" style="color:${pct>=80?'var(--green)':pct>=60?'var(--amber)':'var(--red)'}">${msdOk.length} / ${ops.length}</span></div>
      <div class="bt-stat-row"><span class="bt-stat-label">Consistencia</span><span class="bt-stat-val" style="color:${pct>=80?'var(--green)':pct>=60?'var(--amber)':'var(--red)'}">${pct}%</span></div>
      <div class="bt-stat-row"><span class="bt-stat-label">Reflexiones</span><span class="bt-stat-val">${entries.filter(e=>e.type==='reflexion').length}</span></div>
      <div class="bt-stat-row"><span class="bt-stat-label">Errores registrados</span><span class="bt-stat-val">${entries.filter(e=>e.type==='error').length}</span></div>
    `;
  }

  // ── Preview ────────────────────────────────────
  function renderPreview() {
    const el = document.getElementById('bt-preview');
    if (!el) return;
    const ticker = document.getElementById('reg-ticker')?.value.toUpperCase() || '—';
    const type   = document.getElementById('reg-type')?.value || 'entrada';
    const dir    = document.getElementById('reg-dir')?.value || 'na';
    const notas  = document.getElementById('reg-notas')?.value || '';
    const dirHtml = dir!=='na' ? `<span class="bt-entry-dir ${dir}">${dir.toUpperCase()}</span>` : '';
    el.innerHTML = `
      <div class="bt-entry" style="margin-bottom:0;">
        <div class="bt-entry-header">
          <div class="bt-entry-meta">
            <span class="bt-entry-ticker">${ticker||'TICKER'}</span>
            ${dirHtml}
            <span class="bt-entry-type">${TYPE_LABEL[type]||type}</span>
            <span class="bt-entry-date">Ahora</span>
          </div>
          <span class="bt-entry-mood">${MOOD_EMOJI[activeMood]||'😊'}</span>
        </div>
        <div class="bt-entry-msd">
          ${['M','S','D'].map(k=>msdTag(k,msdState[k])).join('')}
        </div>
        <div class="bt-entry-text" style="color:${notas?'var(--text2)':'var(--text3)'};font-style:${notas?'normal':'italic'}">
          ${notas||'Tu razonamiento aparecerá aquí...'}
        </div>
      </div>`;
  }

  // ── Sesgos ─────────────────────────────────────
  function renderSesgos() {
    const main    = document.getElementById('sesgos-main');
    const sidebar = document.getElementById('sesgos-sidebar');
    if (!main || !sidebar) return;
    const s = analyzeSesgos(entries);

    if (!s) {
      main.innerHTML = `<div class="bt-card"><div class="sc2-empty" style="padding:40px;">Necesitas al menos 3 operaciones registradas para detectar sesgos.</div></div>`;
      sidebar.innerHTML = '';
      return;
    }

    const nivel = (n, total, limAlto, limMedio) => {
      const pct = total > 0 ? n/total : 0;
      return pct >= limAlto ? 'alto' : pct >= limMedio ? 'medio' : 'bajo';
    };
    const nRecorte  = nivel(s.salidasPrematuras, s.totalOps, 0.3, 0.15);
    const nImpa     = nivel(s.entradasSinD, s.totalOps, 0.3, 0.15);
    const nSistema  = s.pctConsistencia >= 80 ? 'bajo' : s.pctConsistencia >= 60 ? 'medio' : 'alto';

    main.innerHTML = `
      <div class="bt-card">
        <div class="bt-card-title">Sesgos Detectados</div>
        <p style="font-size:11px;color:var(--text3);margin-bottom:16px;line-height:1.6;">Basado en tus ${entries.length} entradas. Los sesgos se detectan analizando el patrón de tus decisiones vs el sistema M+S+D.</p>

        <div class="bt-sesgo-item ${nRecorte}">
          <span class="bt-sesgo-badge ${nRecorte}">${nRecorte.toUpperCase()}</span>
          <div class="bt-sesgo-name">✂️ Recortar ganancias pronto</div>
          <div class="bt-sesgo-desc">${s.salidasPrematuras} salida${s.salidasPrematuras!==1?'s':''} con M cumpliendo pero S sin confirmar. Si el mensual sigue alcista/bajista, la salida prematura puede costarte retorno adicional.</div>
        </div>

        <div class="bt-sesgo-item ${nImpa}">
          <span class="bt-sesgo-badge ${nImpa}">${nImpa.toUpperCase()}</span>
          <div class="bt-sesgo-name">⚡ Impaciencia en la entrada</div>
          <div class="bt-sesgo-desc">${s.entradasSinD} entrada${s.entradasSinD!==1?'s':''} con M+S cumpliendo pero D sin confirmar. Entrar antes de la señal diaria suele resultar en paradas prematuras por ruido.</div>
        </div>

        <div class="bt-sesgo-item ${nSistema}">
          <span class="bt-sesgo-badge ${nSistema}">${nSistema.toUpperCase()}</span>
          <div class="bt-sesgo-name">🔄 Consistencia del sistema</div>
          <div class="bt-sesgo-desc">${s.pctConsistencia}% de tus operaciones cumplen M+S+D completo. ${s.pctConsistencia>=80?'Excelente disciplina.':s.pctConsistencia>=60?'Hay margen de mejora — el objetivo es >80%.':'Por debajo del umbral mínimo. Revisa si estás saltándote el sistema con frecuencia.'}</div>
        </div>
      </div>`;

    const moodRows = Object.entries(MOOD_EMOJI).map(([k,v]) => {
      const stat = s.moodStats[k];
      if (!stat) return '';
      const wr = Math.round(stat.ok/stat.total*100);
      const col = wr>=70?'var(--green)':wr>=40?'var(--amber)':'var(--red)';
      return `<div class="bt-stat-row"><span class="bt-stat-label">${v} ${k.charAt(0).toUpperCase()+k.slice(1)}</span><span class="bt-stat-val" style="color:${col}">${stat.total} ops · ${wr}% sistema</span></div>`;
    }).join('');

    sidebar.innerHTML = `
      <div class="bt-card">
        <div class="bt-card-title">Consistencia M+S+D</div>
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:6px;">
            <span>Ops con M+S+D ✓</span><strong style="color:${s.pctConsistencia>=80?'var(--green)':s.pctConsistencia>=60?'var(--amber)':'var(--red)'}">${s.pctConsistencia}%</strong>
          </div>
          <div style="height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;">
            <div style="width:${s.pctConsistencia}%;height:100%;background:${s.pctConsistencia>=80?'var(--green)':s.pctConsistencia>=60?'var(--amber)':'var(--red)'};border-radius:4px;"></div>
          </div>
        </div>
        <div class="bt-stat-row"><span class="bt-stat-label">M cumple</span><span class="bt-stat-val">${s.mStats.cumple}/${s.mStats.total}</span></div>
        <div class="bt-stat-row"><span class="bt-stat-label">S cumple</span><span class="bt-stat-val">${s.sStats.cumple}/${s.sStats.total}</span></div>
        <div class="bt-stat-row"><span class="bt-stat-label">D cumple</span><span class="bt-stat-val">${s.dStats.cumple}/${s.dStats.total}</span></div>
      </div>
      ${moodRows ? `
      <div class="bt-card" style="margin-top:16px;">
        <div class="bt-card-title">Estado emocional vs Sistema</div>
        ${moodRows}
        <p style="font-size:10px;color:var(--text3);margin-top:12px;line-height:1.5;">% de operaciones que respetaron M+S+D según tu estado emocional al registrar.</p>
      </div>` : ''}
    `;
  }

  // ── Init ───────────────────────────────────────
  renderFeed();
  renderPreview();

  return { destroy() {} };
}

// ═══════════════════════════════════════════════
// MÓDULO: José Luis Cava · Análisis Diario
// ═══════════════════════════════════════════════

const CSS = `
.cava-wrap{font-family:var(--sans);}
.cava-header{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px 22px;margin-bottom:16px;display:flex;align-items:center;gap:16px;}
.cava-avatar{width:56px;height:56px;border-radius:50%;border:2px solid var(--teal);object-fit:cover;flex-shrink:0;}
.cava-info h2{font-family:var(--serif);font-size:22px;font-style:italic;font-weight:400;margin-bottom:3px;}
.cava-info p{font-size:11px;color:var(--text2);font-family:var(--mono);}
.cava-refresh{margin-left:auto;}
.cava-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}
.cava-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;transition:border-color 0.15s;}
.cava-card:hover{border-color:var(--border2);}
.cava-card.featured{grid-column:1/-1;border-color:rgba(64,217,192,0.3);background:rgba(64,217,192,0.03);}
.cava-thumb-wrap{position:relative;aspect-ratio:16/9;overflow:hidden;}
.cava-thumb{width:100%;height:100%;object-fit:cover;display:block;}
.cava-thumb-overlay{position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(4,14,14,0.8));display:flex;align-items:center;justify-content:center;}
.cava-play{width:44px;height:44px;border-radius:50%;background:rgba(64,217,192,0.9);display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;transition:transform 0.15s;}
.cava-play:hover{transform:scale(1.1);}
.cava-date{position:absolute;bottom:8px;right:10px;font-family:var(--mono);font-size:9px;color:rgba(255,255,255,0.7);}
.cava-body{padding:16px 18px;}
.cava-title{font-size:13px;font-weight:600;color:var(--text1);margin-bottom:8px;line-height:1.4;}
.cava-resumen{font-size:11px;color:var(--text2);margin-bottom:12px;line-height:1.5;font-style:italic;}
.cava-tips-title{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:var(--teal);margin-bottom:8px;}
.cava-tips{list-style:none;padding:0;margin:0;}
.cava-tips li{font-size:11px;color:var(--text1);padding:6px 0;border-bottom:1px solid var(--border);display:flex;gap:8px;line-height:1.5;}
.cava-tips li:last-child{border-bottom:none;}
.cava-tip-num{font-family:var(--mono);font-size:9px;color:var(--teal);font-weight:700;flex-shrink:0;margin-top:2px;}
.cava-no-tips{font-size:11px;color:var(--text3);font-family:var(--mono);padding:8px 0;}
.cava-link{display:inline-flex;align-items:center;gap:5px;font-size:10px;color:var(--teal);font-family:var(--mono);text-decoration:none;margin-top:10px;}
.cava-link:hover{color:var(--text1);}
.cava-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:14px;color:var(--text2);font-family:var(--mono);font-size:11px;}
.cava-small-card{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-bottom:1px solid var(--border);}
.cava-small-card:last-child{border-bottom:none;}
.cava-small-thumb{width:80px;height:45px;object-fit:cover;border-radius:4px;flex-shrink:0;}
`;

export async function render(container, { actionsSlot }) {
  if (!document.getElementById('cava-css')) {
    const s = document.createElement('style'); s.id = 'cava-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  actionsSlot.innerHTML = `<button class="btn btn-primary" id="cava-refresh-btn">↺ Actualizar</button>`;
  container.innerHTML = `<div class="cava-wrap" id="cava-wrap"></div>`;

  async function load() {
    const el = document.getElementById('cava-wrap');
    el.innerHTML = `
      <div class="cava-header">
        <img class="cava-avatar" src="https://yt3.googleusercontent.com/ytc/AIdro_mJLCavaOfficialAvatar=s176-c-k-c0x00ffffff-no-rj" 
             onerror="this.style.display='none'"
             alt="Cava">
        <div class="cava-info">
          <h2>José Luis Cava</h2>
          <p>Análisis técnico diario · Especulador profesional</p>
        </div>
        <a href="https://www.youtube.com/@JoseLuisCavatv/videos" target="_blank" rel="noopener" class="btn" style="margin-left:auto;font-size:10px;">Ver canal →</a>
      </div>
      <div class="cava-loader">
        <div class="loader-ring"></div>
        <div>Obteniendo últimos vídeos y generando resúmenes con IA...</div>
        <div style="color:var(--text3);">Esto puede tardar 20-30 segundos</div>
      </div>`;

    try {
      const r = await fetch('/api/cava', { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 60000); return c.signal; })() });
      const data = await r.json();
      if (data.error && !data.videos?.length) throw new Error(data.error);
      paintVideos(data.videos || []);
    } catch(e) {
      el.innerHTML = el.innerHTML.replace(
        /<div class="cava-loader">[\s\S]*<\/div>/,
        `<div style="background:var(--surface);border:1px solid var(--red);border-radius:12px;padding:30px;text-align:center;color:var(--red);font-family:var(--mono);">
          ⚠ ${e.message}<br><span style="color:var(--text3);font-size:10px;margin-top:8px;display:block;">Comprueba que la API de Anthropic tiene créditos y que el canal es accesible.</span>
        </div>`
      );
    }
  }

  function paintVideos(videos) {
    const el = document.getElementById('cava-wrap');
    if (!videos.length) {
      el.innerHTML += '<div class="empty-state">Sin vídeos disponibles</div>';
      return;
    }

    const featured = videos[0];
    const rest = videos.slice(1,3);
    const extras = videos.slice(3);

    const fmtDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}) : '';

    el.innerHTML = `
      <div class="cava-header">
        <div class="cava-info">
          <h2>José Luis Cava</h2>
          <p>Análisis técnico diario · ${videos.length} vídeos recientes · Actualizado ${new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</p>
        </div>
        <a href="https://www.youtube.com/@JoseLuisCavatv/videos" target="_blank" rel="noopener" class="btn" style="margin-left:auto;font-size:10px;">Ver canal →</a>
      </div>

      <div class="cava-grid">
        <!-- Vídeo destacado -->
        <div class="cava-card featured">
          <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:0;">
            <div class="cava-thumb-wrap" style="aspect-ratio:auto;height:100%;">
              <img class="cava-thumb" src="${featured.thumb}" alt="${featured.title}" loading="lazy">
              <div class="cava-thumb-overlay">
                <a href="${featured.url}" target="_blank" rel="noopener"><div class="cava-play">▶</div></a>
                <div class="cava-date">${fmtDate(featured.published)}</div>
              </div>
            </div>
            <div class="cava-body">
              <div style="font-family:var(--mono);font-size:9px;color:var(--teal);margin-bottom:6px;">ÚLTIMO VÍDEO</div>
              <div class="cava-title">${featured.title}</div>
              ${featured.resumen ? `<div class="cava-resumen">"${featured.resumen}"</div>` : ''}
              ${featured.tips?.length ? `
                <div class="cava-tips-title">Tips del análisis</div>
                <ul class="cava-tips">
                  ${featured.tips.map((tip,i) => `<li><span class="cava-tip-num">${i+1}</span>${tip}</li>`).join('')}
                </ul>` : `<div class="cava-no-tips">Resumen no disponible — ${featured.hasTranscript===false?'sin subtítulos':'sin créditos API'}</div>`}
              <a href="${featured.url}" target="_blank" rel="noopener" class="cava-link">▶ Ver vídeo completo →</a>
            </div>
          </div>
        </div>

        <!-- Vídeos recientes -->
        ${rest.map(v => `
        <div class="cava-card">
          <div class="cava-thumb-wrap">
            <img class="cava-thumb" src="${v.thumb}" alt="${v.title}" loading="lazy">
            <div class="cava-thumb-overlay">
              <a href="${v.url}" target="_blank" rel="noopener"><div class="cava-play">▶</div></a>
              <div class="cava-date">${fmtDate(v.published)}</div>
            </div>
          </div>
          <div class="cava-body">
            <div class="cava-title">${v.title}</div>
            ${v.resumen ? `<div class="cava-resumen">"${v.resumen}"</div>` : ''}
            ${v.tips?.length ? `
              <div class="cava-tips-title">Tips</div>
              <ul class="cava-tips">
                ${v.tips.map((tip,i) => `<li><span class="cava-tip-num">${i+1}</span>${tip}</li>`).join('')}
              </ul>` : '<div class="cava-no-tips">Resumen no disponible</div>'}
            <a href="${v.url}" target="_blank" rel="noopener" class="cava-link">▶ Ver vídeo →</a>
          </div>
        </div>`).join('')}
      </div>

      <!-- Vídeos adicionales sin resumen -->
      ${extras.length ? `
      <div class="cava-card" style="border-radius:12px;overflow:hidden;">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-family:var(--mono);font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em;">Más vídeos</div>
        ${extras.map(v => `
        <div class="cava-small-card">
          <img class="cava-small-thumb" src="${v.thumb}" alt="${v.title}" loading="lazy">
          <div>
            <div style="font-size:12px;font-weight:600;margin-bottom:4px;">${v.title}</div>
            <div style="font-size:10px;color:var(--text2);font-family:var(--mono);">${fmtDate(v.published)}</div>
            <a href="${v.url}" target="_blank" rel="noopener" class="cava-link" style="margin-top:4px;">▶ Ver →</a>
          </div>
        </div>`).join('')}
      </div>` : ''}
    `;
  }

  document.getElementById('cava-refresh-btn')?.addEventListener('click', load);
  load();

  return { destroy() { document.getElementById('cava-css')?.remove(); } };
}

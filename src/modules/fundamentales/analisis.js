// ═══════════════════════════════════════════════
// MÓDULO: Análisis Fundamental (5.1)
// 3 indicadores propios de ETHAN: Fundamental,
// Greenblatt y Lynch. Datos automáticos vía
// Financial Modeling Prep (FMP) → /api/fundamental.
// ═══════════════════════════════════════════════

export async function render(container, { actionsSlot }) {
  let lastResult = null;

  actionsSlot.innerHTML = `
    <div class="fund-search-bar">
      <input type="text" id="fund-ticker-input" placeholder="Ticker: AAPL, MSFT, ACS.MC..." autocomplete="off">
      <button class="btn btn-primary" id="fund-analyze-btn">Analizar</button>
    </div>
  `;

  container.innerHTML = `
    <div id="fund-content">
      <div class="empty">
        <div class="empty-icon">🧮</div>
        <div class="empty-title">Análisis Fundamental</div>
        <div class="empty-desc">Introduce un ticker para calcular los 3 indicadores ETHAN: Fundamental, Greenblatt y Lynch.</div>
      </div>
    </div>
  `;

  const contentEl = document.getElementById('fund-content');

  // ── Formatters ──────────────────────────────────
  const fmtM = v => v === null ? '—' : v >= 1000 ? `$${(v/1000).toFixed(1)}B` : `$${v.toFixed(0)}M`;
  const fmtPct = v => v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
  const fmtX = v => v === null ? '—' : `${v.toFixed(1)}x`;
  const fmtN = v => v === null ? '—' : v.toFixed(2);

  // ── Score ring SVG ──────────────────────────────
  function scoreRing(score, label, color, size = 90) {
    if (score === null) return `
      <div class="fund-ring" style="width:${size}px;height:${size}px;">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${size/2}" cy="${size/2}" r="${size/2-8}" fill="none" stroke="var(--surface2)" stroke-width="6"/>
        </svg>
        <div class="fund-ring-inner">
          <div class="fund-ring-num" style="color:var(--text3);font-size:16px;">—</div>
        </div>
      </div>`;

    const r = size/2 - 8;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 5) * circ;
    const fontSize = size >= 90 ? 24 : 18;

    return `
      <div class="fund-ring" style="width:${size}px;height:${size}px;">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--surface2)" stroke-width="6"/>
          <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}"
            stroke-width="6" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
            stroke-linecap="round" transform="rotate(-90 ${size/2} ${size/2})"/>
        </svg>
        <div class="fund-ring-inner">
          <div class="fund-ring-num" style="color:${color};font-size:${fontSize}px;">${score.toFixed(1)}</div>
        </div>
      </div>
    `;
  }

  function scoreColor(score) {
    if (score === null) return 'var(--text3)';
    if (score >= 4.5) return 'var(--green)';
    if (score >= 4)   return '#6ee7b7';
    if (score >= 3)   return 'var(--amber)';
    if (score >= 2)   return '#f97316';
    return 'var(--red)';
  }

  function miniBar(score, max = 5) {
    if (score === null) return `<div class="fund-mini-bar-wrap"><div class="fund-mini-bar-track"><div class="fund-mini-bar-fill" style="width:0%;background:var(--text3)"></div></div><span style="color:var(--text3)">—</span></div>`;
    const pct = (score / max) * 100;
    const color = scoreColor(score);
    return `<div class="fund-mini-bar-wrap"><div class="fund-mini-bar-track"><div class="fund-mini-bar-fill" style="width:${pct}%;background:${color}"></div></div><span style="color:${color};font-family:var(--mono);font-size:10px;">${score.toFixed(1)}</span></div>`;
  }

  // ── Render principal ────────────────────────────
  function paint(d) {
    const fc = d.scoresFundamental;
    const gc = d.scoresGreenblatt;
    const lc = d.scoresLynch;
    const finalColor = scoreColor(d.scoreFinal);

    contentEl.innerHTML = `
      <div class="fund-header-card">
        <div class="fund-company-info">
          <div class="fund-ticker-badge">${d.ticker}</div>
          <div>
            <div class="fund-company-name">${d.company}</div>
            <div class="fund-company-meta">${[d.sector, d.industry, d.exchange].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        <div class="fund-price-block">
          <div class="fund-price-value">${d.price ? '$' + d.price.toFixed(2) : '—'}</div>
          <div class="fund-price-cap">${d.marketCap ? fmtM(Math.round(d.marketCap / 1e6)) : '—'} cap</div>
        </div>
      </div>

      <!-- SCORE FINAL -->
      <div class="fund-final-card" style="border-color:${finalColor}30;">
        <div class="fund-final-left">
          ${scoreRing(d.scoreFinal, d.recomendacion, finalColor, 110)}
        </div>
        <div class="fund-final-right">
          <div class="fund-final-label">Puntuación Final ETHAN</div>
          <div class="fund-final-rec" style="color:${finalColor}">${d.recomendacion || '—'}</div>
          <div class="fund-final-formula">( Fundamental + Greenblatt + Lynch ) / 3</div>
        </div>
      </div>

      <!-- 3 INDICADORES -->
      <div class="fund-indicators-row">

        <!-- FUNDAMENTAL -->
        <div class="fund-ind-card">
          <div class="fund-ind-header">
            ${scoreRing(fc.total, fc.label, scoreColor(fc.total), 80)}
            <div>
              <div class="fund-ind-title">Fundamental</div>
              <div class="fund-ind-label" style="color:${scoreColor(fc.total)}">${fc.label || '—'}</div>
              <div class="fund-ind-formula">60% Solidez + 40% Momentum</div>
            </div>
          </div>
          <div class="fund-ind-rows">
            <div class="fund-ind-row"><span>Crec. Ingresos</span><span class="fund-ind-data">${fmtPct(d.datos.crecIngresos)}</span>${miniBar(fc.crecIngresos)}</div>
            <div class="fund-ind-row"><span>Crec. EBITDA</span><span class="fund-ind-data">${fmtPct(d.datos.crecEBITDA)}</span>${miniBar(fc.crecEBITDA)}</div>
            <div class="fund-ind-row"><span>Márgenes Op/Neto</span><span class="fund-ind-data">${d.datos.opMargin !== null ? d.datos.opMargin.toFixed(1) : '—'}% / ${d.datos.netMargin !== null ? d.datos.netMargin.toFixed(1) : '—'}%</span>${miniBar(fc.margenes)}</div>
            <div class="fund-ind-row"><span>FCF/Ingresos</span><span class="fund-ind-data">${fmtPct(d.datos.fcfPct)}</span>${miniBar(fc.fcfIngresos)}</div>
            <div class="fund-ind-row"><span>P/FCF</span><span class="fund-ind-data">${fmtX(d.datos.pfcf)}</span>${miniBar(fc.pfcf)}</div>
            <div class="fund-ind-row"><span>ROE / MOAT</span><span class="fund-ind-data">${fmtPct(d.datos.roe)}</span>${miniBar(fc.roe)}</div>
            <div class="fund-ind-row"><span>Deuda/Equity</span><span class="fund-ind-data">${fmtX(d.datos.deudaEquity)}</span>${miniBar(fc.deuda)}</div>
            <div class="fund-ind-row fund-ind-row-sep"><span>Solidez</span><span></span>${miniBar(fc.solidez)}</div>
            <div class="fund-ind-row"><span>Momentum</span><span class="fund-ind-data">fijo 4.0</span>${miniBar(fc.momentum)}</div>
          </div>
        </div>

        <!-- GREENBLATT -->
        <div class="fund-ind-card">
          <div class="fund-ind-header">
            ${scoreRing(gc.total, gc.label, scoreColor(gc.total), 80)}
            <div>
              <div class="fund-ind-title">Greenblatt</div>
              <div class="fund-ind-label" style="color:${scoreColor(gc.total)}">${gc.label || '—'}</div>
              <div class="fund-ind-formula">50% ROIC + 50% EV/EBITDA</div>
            </div>
          </div>
          <div class="fund-ind-rows">
            <div class="fund-ind-row"><span>EBIT</span><span class="fund-ind-data">${fmtM(d.datos.ebit)}</span><div class="fund-mini-bar-wrap"></div></div>
            <div class="fund-ind-row"><span>NOPAT (EBIT×0.75)</span><span class="fund-ind-data">${d.datos.ebit ? fmtM(Math.round(d.datos.ebit * 0.75)) : '—'}</span><div class="fund-mini-bar-wrap"></div></div>
            <div class="fund-ind-row"><span>Capital Invertido</span><span class="fund-ind-data">${fmtM((d.datos.equity||0) + (d.datos.totalDebt||0))}</span><div class="fund-mini-bar-wrap"></div></div>
            <div class="fund-ind-row fund-ind-row-sep"><span>ROIC</span><span class="fund-ind-data">${fmtPct(d.datos.roic)}</span>${miniBar(gc.roic)}</div>
            <div class="fund-ind-row"><span>Market Cap</span><span class="fund-ind-data">${fmtM(d.marketCap ? Math.round(d.marketCap/1e6) : null)}</span><div class="fund-mini-bar-wrap"></div></div>
            <div class="fund-ind-row"><span>Deuda</span><span class="fund-ind-data">${fmtM(d.datos.totalDebt)}</span><div class="fund-mini-bar-wrap"></div></div>
            <div class="fund-ind-row"><span>Cash</span><span class="fund-ind-data">${fmtM(d.datos.cash)}</span><div class="fund-mini-bar-wrap"></div></div>
            <div class="fund-ind-row"><span>EBITDA</span><span class="fund-ind-data">${fmtM(d.datos.ebitda)}</span><div class="fund-mini-bar-wrap"></div></div>
            <div class="fund-ind-row fund-ind-row-sep"><span>EV/EBITDA</span><span class="fund-ind-data">${fmtX(d.datos.evEbitda)}</span>${miniBar(gc.evEbitda)}</div>
          </div>
        </div>

        <!-- LYNCH -->
        <div class="fund-ind-card">
          <div class="fund-ind-header">
            ${scoreRing(lc.total, lc.label, scoreColor(lc.total), 80)}
            <div>
              <div class="fund-ind-title">Lynch</div>
              <div class="fund-ind-label" style="color:${scoreColor(lc.total)}">${lc.label || '—'}</div>
              <div class="fund-ind-formula">50% PER + 50% PEG</div>
            </div>
          </div>
          <div class="fund-ind-rows">
            <div class="fund-ind-row"><span>Precio</span><span class="fund-ind-data">${d.price ? '$' + d.price.toFixed(2) : '—'}</span><div class="fund-mini-bar-wrap"></div></div>
            <div class="fund-ind-row"><span>BPA (EPS)</span><span class="fund-ind-data">${d.datos.eps ? '$' + d.datos.eps.toFixed(2) : '—'}</span><div class="fund-mini-bar-wrap"></div></div>
            <div class="fund-ind-row fund-ind-row-sep"><span>PER</span><span class="fund-ind-data">${fmtX(d.datos.per)}</span>${miniBar(lc.per)}</div>
            <div class="fund-ind-row"><span>Crec. BPA</span><span class="fund-ind-data">${fmtPct(d.datos.crecBPA)}</span><div class="fund-mini-bar-wrap"></div></div>
            <div class="fund-ind-row fund-ind-row-sep"><span>PEG</span><span class="fund-ind-data">${fmtN(d.datos.peg)}</span>${miniBar(lc.peg)}</div>
          </div>
        </div>
      </div>

      <!-- DATOS FINANCIEROS RESUMEN -->
      <div class="section-title" style="margin-top:26px;">Datos Financieros <span class="count">último año fiscal · millones</span></div>
      <div class="fund-data-grid">
        ${[
          ['Ingresos', fmtM(d.datos.revenue)],
          ['EBITDA', fmtM(d.datos.ebitda)],
          ['EBIT', fmtM(d.datos.ebit)],
          ['Beneficio Neto', fmtM(d.datos.netIncome)],
          ['Free Cash Flow', fmtM(d.datos.fcf)],
          ['Equity (Book)', fmtM(d.datos.equity)],
          ['Deuda Total', fmtM(d.datos.totalDebt)],
          ['Cash', fmtM(d.datos.cash)],
          ['Beta', d.datos.beta !== null && d.datos.beta !== undefined ? d.datos.beta.toFixed(2) : '—'],
          ['Dividendo Yield', d.datos.divYield !== null && d.datos.divYield !== undefined ? d.datos.divYield.toFixed(2) + '%' : '—'],
          ['ROE', fmtPct(d.datos.roe)],
          ['Crec. Ingresos YoY', fmtPct(d.datos.crecIngresos)]
        ].map(([l,v]) => `
          <div class="fund-data-item">
            <div class="fund-data-label">${l}</div>
            <div class="fund-data-value">${v}</div>
          </div>
        `).join('')}
      </div>

      ${d.errors ? `
        <div style="margin-top:16px;font-family:var(--mono);font-size:9px;color:var(--amber);">
          ⚠ ${d.errors.join(' · ')}
        </div>
      ` : ''}
    `;
  }

  // ── Análisis ────────────────────────────────────
  async function analyze() {
    const ticker = document.getElementById('fund-ticker-input')?.value.trim().toUpperCase();
    if (!ticker) return;

    contentEl.innerHTML = `
      <div class="empty">
        <div class="loader-ring"></div>
        <div class="empty-title">Analizando ${ticker}</div>
        <div class="empty-desc">Trayendo datos de Financial Modeling Prep...</div>
      </div>
    `;

    try {
      const res = await fetch(`/api/fundamental?ticker=${encodeURIComponent(ticker)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      lastResult = data;
      paint(data);
    } catch (err) {
      contentEl.innerHTML = `
        <div class="empty">
          <div class="empty-icon">⚠</div>
          <div class="empty-title">Error al analizar ${ticker}</div>
          <div class="empty-desc">${err.message}</div>
        </div>
      `;
    }
  }

  // ── Listeners ───────────────────────────────────
  const analyzeBtn = document.getElementById('fund-analyze-btn');
  const tickerInput = document.getElementById('fund-ticker-input');
  if (analyzeBtn) analyzeBtn.addEventListener('click', analyze);
  if (tickerInput) tickerInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); analyze(); } });

  return { destroy() {} };
}

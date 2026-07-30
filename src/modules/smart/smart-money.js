// ═══════════════════════════════════════════════
// MÓDULO: Smart Money Intelligence
// Insider Trading · Short Interest · Institutional Ownership
// ═══════════════════════════════════════════════

const fmtPct = (n, d=1) => n != null && isFinite(n) ? (n*100).toFixed(d)+'%' : '—';
const fmtNum = n => n != null ? Math.abs(n).toLocaleString('es-ES') : '—';
const fmtDate = d => d && d.length >= 10 ? new Date(d+'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'}) : (d||'—');
const fmtM = n => n != null ? '$'+(n/1e6).toFixed(1)+'M' : '—';

const CSS = `
.sm-wrap{font-family:var(--sans);}
.sm-search{display:flex;gap:10px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px 22px;margin-bottom:16px;}
.sm-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px 22px;margin-bottom:14px;}
.sm-card-title{font-size:13px;font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:8px;}
.sm-card-desc{font-size:11px;color:var(--text2);margin-bottom:16px;}
.sm-table{width:100%;border-collapse:collapse;font-size:11px;}
.sm-table th{padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text2);border-bottom:1px solid var(--border);font-weight:600;background:var(--surface2);}
.sm-table th.r{text-align:right;}
.sm-table td{padding:9px 12px;border-bottom:1px solid var(--border);color:var(--text1);}
.sm-table td.r{text-align:right;font-family:var(--mono);}
.sm-table tbody tr:last-child td{border-bottom:none;}
.sm-table tbody tr:hover td{background:rgba(64,217,192,0.03);}
.sm-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1px;background:var(--border);border-radius:8px;overflow:hidden;margin-bottom:14px;}
.sm-kpi{background:var(--surface2);padding:14px 16px;}
.sm-kpi-lbl{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:var(--text2);margin-bottom:6px;}
.sm-kpi-val{font-family:var(--mono);font-size:20px;font-weight:700;}
.sm-kpi-sub{font-size:10px;color:var(--text2);margin-top:4px;}
.sm-badge{font-family:var(--mono);font-size:9px;padding:2px 8px;border-radius:3px;font-weight:700;}
.sm-badge.buy{background:rgba(74,222,128,0.12);color:var(--green);}
.sm-badge.sell{background:rgba(244,113,116,0.12);color:var(--red);}
.sm-badge.high{background:rgba(244,113,116,0.12);color:var(--red);}
.sm-badge.med{background:rgba(251,191,36,0.12);color:var(--amber);}
.sm-badge.low{background:rgba(74,222,128,0.12);color:var(--green);}
.sm-loader{display:flex;align-items:center;gap:10px;color:var(--text2);font-family:var(--mono);font-size:11px;padding:20px 0;}
.sm-empty{text-align:center;padding:30px;color:var(--text2);font-family:var(--mono);font-size:11px;}
.sm-insight{border-left:2px solid var(--teal);background:var(--teal-dim);padding:10px 14px;border-radius:0 8px 8px 0;font-size:11px;color:var(--text2);line-height:1.6;margin-top:12px;}
.sm-insight strong{color:var(--text1);}
.sm-section{font-family:var(--mono);font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text2);display:flex;align-items:center;gap:10px;margin:16px 0 10px;}
.sm-section::after{content:"";flex:1;height:1px;background:var(--border);}
`;

export async function render(container, { actionsSlot }) {
  if (!document.getElementById('sm-css')) {
    const s = document.createElement('style'); s.id = 'sm-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  actionsSlot.innerHTML = '';
  container.innerHTML = `<div class="sm-wrap" id="sm-wrap"></div>`;
  const el = document.getElementById('sm-wrap');

  el.innerHTML = `
    <div class="sm-search">
      <input type="text" id="sm-ticker" class="wl-input" placeholder="Ticker (ej. AAPL, NVDA...)" style="width:220px;text-transform:uppercase;">
      <button class="btn btn-primary" id="sm-search-btn">🔍 Analizar Smart Money</button>
      <span id="sm-status" style="font-family:var(--mono);font-size:11px;color:var(--text2);"></span>
    </div>
    <div id="sm-results">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:40px;text-align:center;">
        <div style="font-size:32px;margin-bottom:12px;">🏦</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:6px;">Smart Money Intelligence</div>
        <div style="font-size:11px;color:var(--text2);max-width:500px;margin:0 auto;line-height:1.6;">
          Introduce un ticker para ver las compras y ventas de insiders (SEC Form 4),
          el short interest institucional y los principales accionistas institucionales.
        </div>
      </div>
    </div>
  `;

  async function analyze() {
    const ticker = (document.getElementById('sm-ticker')?.value || '').trim().toUpperCase();
    if (!ticker) return;
    const btn = document.getElementById('sm-search-btn');
    const st  = document.getElementById('sm-status');
    const res = document.getElementById('sm-results');

    btn.disabled = true; btn.textContent = '⏳ Cargando...';
    if (st) st.textContent = `Consultando SEC, FINRA y Yahoo para ${ticker}...`;
    res.innerHTML = `<div class="sm-loader"><div class="loader-ring"></div>Obteniendo datos de Smart Money para ${ticker}...</div>`;

    try {
      // Dos llamadas en paralelo para evitar timeout
      btn.disabled = true; btn.textContent = '⏳ Buscando...';
      if (st) st.textContent = `Consultando insiders y mercado para ${ticker} en paralelo...`;
      res.innerHTML = `<div class="sm-loader"><div class="loader-ring"></div>Buscando datos de Smart Money para ${ticker}... (15-30s)</div>`;

      const [insidersRes, marketRes] = await Promise.allSettled([
        fetch(`/api/smart-money?ticker=${ticker}&section=insiders`, { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 58000); return c.signal; })() }).then(r => r.json()),
        fetch(`/api/smart-money?ticker=${ticker}&section=market`,   { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 58000); return c.signal; })() }).then(r => r.json()),
      ]);

      const insidersData = insidersRes.status === 'fulfilled' ? insidersRes.value : {};
      const marketData   = marketRes.status === 'fulfilled'   ? marketRes.value   : {};

      const data = {
        ticker,
        insiders:      insidersData.insiders      || [],
        shortInterest: marketData.shortInterest   || null,
        institutional: marketData.institutional   || null,
        errors: [
          ...(insidersData.error ? ['Insiders: ' + insidersData.error.slice(0,60)] : []),
          ...(marketData.error   ? ['Market: '   + marketData.error.slice(0,60)]   : []),
          ...(insidersRes.status === 'rejected' ? ['Insiders timeout'] : []),
          ...(marketRes.status   === 'rejected' ? ['Market timeout']   : []),
        ],
      };

      paintResults(data, ticker);
      if (st) st.textContent = '';
    } catch(e) {
      res.innerHTML = `<div class="sm-card"><div style="color:var(--red);font-family:var(--mono);">⚠ Error: ${e.message}</div></div>`;
      if (st) st.textContent = '';
    }
    btn.disabled = false; btn.textContent = '🔍 Analizar Smart Money';
  }

  function paintResults(data, ticker) {
    const res = document.getElementById('sm-results');
    const { insiders, shortInterest, institutional } = data;

    // ── Señal resumen ────────────────────────────
    const buyCount  = insiders.filter(i => i.type === 'Compra' || i.type?.toLowerCase().includes('purchase')).length;
    const sellCount = insiders.filter(i => i.type === 'Venta'  || i.type?.toLowerCase().includes('sale')).length;
    const siPct = shortInterest?.shortFloat;
    const instPct = institutional?.pctInstitutions;

    // Semáforo de señal
    let signal = 'neutral', signalText = 'Neutral', signalCol = 'var(--amber)';
    if (buyCount > sellCount && buyCount > 0 && (!siPct || siPct < 0.15)) {
      signal = 'alcista'; signalText = 'Alcista'; signalCol = 'var(--green)';
    } else if (sellCount > buyCount*2 || (siPct && siPct > 0.25)) {
      signal = 'bajista'; signalText = 'Bajista'; signalCol = 'var(--red)';
    }

    res.innerHTML = `
      <!-- Resumen Smart Money -->
      <div class="sm-card" style="border-color:${signalCol};border-left:4px solid ${signalCol};">
        <div class="sm-card-title">
          <span style="color:${signalCol};font-size:20px;">${signal==='alcista'?'↑':signal==='bajista'?'↓':'→'}</span>
          Señal Smart Money: <span style="color:${signalCol};">${signalText}</span>
          <span style="font-family:var(--mono);font-size:10px;color:var(--text2);font-weight:400;margin-left:auto;">${ticker} · ${new Date().toLocaleDateString('es-ES')}</span>
        </div>
        <div class="sm-kpi-grid">
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">Compras insiders</div>
            <div class="sm-kpi-val" style="color:var(--green);">${buyCount}</div>
            <div class="sm-kpi-sub">últimos 6 meses</div>
          </div>
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">Ventas insiders</div>
            <div class="sm-kpi-val" style="color:var(--red);">${sellCount}</div>
            <div class="sm-kpi-sub">últimos 6 meses</div>
          </div>
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">Short Interest</div>
            <div class="sm-kpi-val" style="color:${siPct>0.2?'var(--red)':siPct>0.1?'var(--amber)':'var(--green)'};">${fmtPct(siPct)}</div>
            <div class="sm-kpi-sub">% del float</div>
          </div>
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">Days to Cover</div>
            <div class="sm-kpi-val" style="color:${shortInterest?.daysTocover>5?'var(--red)':shortInterest?.daysTocover>3?'var(--amber)':'var(--green)'};">${shortInterest?.daysTocover?.toFixed(1)||'—'}d</div>
            <div class="sm-kpi-sub">presión bajista</div>
          </div>
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">% Institucional</div>
            <div class="sm-kpi-val">${fmtPct(instPct)}</div>
            <div class="sm-kpi-sub">del float</div>
          </div>
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">% Insiders</div>
            <div class="sm-kpi-val">${fmtPct(institutional?.pctInsiders)}</div>
            <div class="sm-kpi-sub">del float</div>
          </div>
        </div>
        ${generateInsight(buyCount, sellCount, siPct, shortInterest?.daysTocover, instPct, ticker)}
      </div>

      <!-- Insider Trading -->
      <div class="sm-card">
        <div class="sm-card-title">📋 Insider Trading — SEC Form 4</div>
        <div class="sm-card-desc">Compras y ventas declaradas por directivos, consejeros y accionistas >10% en los últimos 6 meses.</div>
        ${insiders.length ? `
        <table class="sm-table">
          <thead><tr>
            <th>Fecha</th><th>Insider</th><th>Cargo</th>
            <th class="r">Tipo</th><th class="r">Cantidad</th>
            <th class="r">Precio</th><th class="r">Valor total</th>
          </tr></thead>
          <tbody>
            ${insiders.map(ins => `<tr>
              <td style="color:var(--text2);font-family:var(--mono);font-size:10px;">${fmtDate(ins.date)}</td>
              <td style="font-weight:600;">${ins.insider||ins.filer||'—'}</td>
              <td style="font-size:10px;color:var(--text2);">${ins.title||'—'}</td>
              <td class="r"><span class="sm-badge ${ins.type==='Compra'||ins.type?.toLowerCase().includes('purchase')?'buy':'sell'}">${ins.type==='Compra'?'▲ COMPRA':ins.type==='Venta'?'▼ VENTA':ins.type||'—'}</span></td>
              <td class="r">${ins.qty?fmtNum(ins.qty):'—'}</td>
              <td class="r">${ins.price||'—'}</td>
              <td class="r">${ins.value||'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div style="font-size:10px;color:var(--text2);margin-top:10px;font-family:var(--mono);">Fuente: OpenInsider / SEC EDGAR</div>` :
        `<div class="sm-empty">Sin transacciones de insiders en los últimos 6 meses</div>`}
      </div>

      <!-- Short Interest -->
      <div class="sm-card">
        <div class="sm-card-title">📉 Short Interest</div>
        <div class="sm-card-desc">Porcentaje del float vendido en corto. Alto short interest puede significar presión bajista o potencial short squeeze.</div>
        ${shortInterest ? `
        <div class="sm-kpi-grid">
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">Short Float</div>
            <div class="sm-kpi-val" style="color:${siPct>0.2?'var(--red)':siPct>0.1?'var(--amber)':'var(--green)'};">${fmtPct(siPct)}</div>
            <div class="sm-kpi-sub"><span class="sm-badge ${siPct>0.2?'high':siPct>0.1?'med':'low'}">${siPct>0.2?'Alto':siPct>0.1?'Moderado':'Bajo'}</span></div>
          </div>
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">Days to Cover</div>
            <div class="sm-kpi-val">${shortInterest.daysTocover?.toFixed(1)||'—'}</div>
            <div class="sm-kpi-sub">días para cubrir</div>
          </div>
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">Acciones en corto</div>
            <div class="sm-kpi-val" style="font-size:16px;">${fmtNum(shortInterest.shortVolume)}</div>
            <div class="sm-kpi-sub">${shortInterest.date}</div>
          </div>
        </div>
        <div class="sm-insight">
          <strong>Interpretación:</strong> Short float ${fmtPct(siPct)} —
          ${siPct > 0.2 ? `⚠ <strong>Short interest muy alto.</strong> Alto riesgo de presión bajista pero también potencial de <strong>short squeeze</strong> si hay catalizador positivo.` :
            siPct > 0.1 ? `Moderado. El mercado tiene cierta posición bajista en este valor — vigilar.` :
            siPct != null ? `✓ Bajo short interest. El mercado no está especialmente posicionado bajista.` : 'Sin datos suficientes.'}
          ${shortInterest.daysTocover > 5 ? ` Days to Cover elevado (${shortInterest.daysTocover?.toFixed(1)}d) — si el precio sube, la presión de recompra podría ser significativa.` : ''}
        </div>` :
        `<div class="sm-empty">Sin datos de short interest disponibles</div>`}
      </div>

      <!-- Institutional Ownership -->
      <div class="sm-card">
        <div class="sm-card-title">🏛️ Ownership Institucional</div>
        <div class="sm-card-desc">Fondos, ETFs y grandes gestoras con posiciones declaradas. Alto % institucional = validación del mercado profesional.</div>
        ${institutional ? `
        <div class="sm-kpi-grid" style="margin-bottom:16px;">
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">% Institucional</div>
            <div class="sm-kpi-val" style="color:${instPct>0.7?'var(--green)':instPct>0.4?'var(--amber)':'var(--text2)'};">${fmtPct(instPct)}</div>
            <div class="sm-kpi-sub">del float</div>
          </div>
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">% Insiders</div>
            <div class="sm-kpi-val">${fmtPct(institutional.pctInsiders)}</div>
            <div class="sm-kpi-sub">directivos y fundadores</div>
          </div>
          <div class="sm-kpi">
            <div class="sm-kpi-lbl">% Público</div>
            <div class="sm-kpi-val">${fmtPct(1-(instPct||0)-(institutional.pctInsiders||0))}</div>
            <div class="sm-kpi-sub">retail y otros</div>
          </div>
        </div>
        ${institutional.topHolders?.length ? `
        <div class="sm-section">Top accionistas institucionales</div>
        <table class="sm-table">
          <thead><tr>
            <th>Institución</th><th class="r">% Float</th>
            <th class="r">Acciones</th><th class="r">Valor</th><th class="r">Cambio</th>
          </tr></thead>
          <tbody>
            ${institutional.topHolders.map(h => `<tr>
              <td style="font-weight:600;">${h.name||'—'}</td>
              <td class="r">${fmtPct(h.pct)}</td>
              <td class="r">${fmtNum(h.shares)}</td>
              <td class="r">${fmtM(h.value)}</td>
              <td class="r" style="color:${h.change>0?'var(--green)':h.change<0?'var(--red)':'var(--text2)'};">${h.change!=null?(h.change>=0?'+':'')+fmtPct(h.change):'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : ''}` :
        `<div class="sm-empty">Sin datos de ownership institucional</div>`}
      </div>

      ${data.errors?.length ? `
      <div style="font-size:10px;color:var(--text3);font-family:var(--mono);padding:8px 0;">
        ⚠ Datos parciales: ${data.errors.join(' · ')}
      </div>` : ''}
    `;
  }

  function generateInsight(buyCount, sellCount, siPct, dtc, instPct, ticker) {
    const signals = [];
    if (buyCount > 0 && buyCount > sellCount) signals.push(`<strong>${buyCount} compras de insiders</strong> vs ${sellCount} ventas — los que mejor conocen la empresa están comprando`);
    if (sellCount > buyCount*2) signals.push(`⚠ <strong>${sellCount} ventas de insiders</strong> — presión de distribución interna`);
    if (siPct > 0.2) signals.push(`<strong>Short interest elevado (${(siPct*100).toFixed(1)}%)</strong> — posible combustible para short squeeze`);
    if (siPct < 0.05 && siPct != null) signals.push(`Short interest bajo (${(siPct*100).toFixed(1)}%) — mercado no apuesta contra el valor`);
    if (instPct > 0.7) signals.push(`<strong>${(instPct*100).toFixed(0)}% en manos institucionales</strong> — alta validación profesional`);
    if (!signals.length) return '';
    return `<div class="sm-insight">${signals.join(' · ')}</div>`;
  }

  document.getElementById('sm-search-btn')?.addEventListener('click', analyze);
  document.getElementById('sm-ticker')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') analyze();
    setTimeout(() => { if(e.target) e.target.value = e.target.value.toUpperCase(); }, 0);
  });

  return { destroy() { document.getElementById('sm-css')?.remove(); } };
}

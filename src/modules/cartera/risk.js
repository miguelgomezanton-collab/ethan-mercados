// ═══════════════════════════════════════════════
// MÓDULO: Risk Management (4.4)
// 5 pestañas: Overview, Stops Activos,
// Exposición, Escenarios, Mis Reglas
// Datos reales de Firestore:
// - ethan_positions (posiciones + entryStop)
// - ethan_capital_alcista/bajista
// - ethan_risk_limits (límites configurables)
// ═══════════════════════════════════════════════

import { UserData } from '../../userdata.js';

const LIMITS_KEY = 'ethan_risk_limits';

const DEFAULT_LIMITS = {
  maxRiskPerOp: 1.5,    // % riesgo máximo por operación
  maxExposure: 90,       // % exposición total máxima
  maxPosition: 25,       // % máximo por posición individual
  maxSector: 50,         // % máximo por sector
  maxDrawdown: 10,       // % drawdown máximo tolerable
  maxLosStreak: 3,       // rachas perdedoras antes de reducir sizing
};

const PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://soft-field-156f.miguel-gomez-anton.workers.dev/?url=${encodeURIComponent(u)}`,
];

async function fetchPrice(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`;
  for (const fn of PROXIES) {
    try {
      const r = await fetch(fn(url), { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 6000); return c.signal; })() });
      if (!r.ok) continue;
      const j = JSON.parse(await r.text());
      return j?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
    } catch {}
  }
  return null;
}

const fmtE  = v => v != null ? '€'+Math.abs(v).toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:0}) : '—';
const fmtPct = (v, d=1) => v != null ? (v>=0?'+':'')+v.toFixed(d)+'%' : '—';
const fmt2   = v => v != null ? v.toFixed(2) : '—';

function semItem(status, label, val) {
  return `<div class="rm-semaforo-item ${status}">
    <div class="rm-semaforo-dot"></div>
    <span class="rm-semaforo-label">${label}</span>
    <span class="rm-semaforo-val">${val}</span>
  </div>`;
}

function barRow(label, value, max, pct) {
  const fill = Math.min(pct, 100);
  const color = fill > 90 ? 'var(--red)' : fill > 75 ? 'var(--amber)' : 'var(--teal)';
  return `<div class="rm-bar-row">
    <div class="rm-bar-header">
      <span>${label}</span>
      <div><strong>${value}</strong> <span class="limit">/ ${max}</span></div>
    </div>
    <div class="rm-bar-track">
      <div class="rm-bar-fill" style="width:${fill}%;background:${color};"></div>
      <div class="rm-bar-limit" style="left:89%"></div>
    </div>
  </div>`;
}

function chip(status, label) {
  return `<span class="chip chip-${status}">${label}</span>`;
}

export async function render(container, { actionsSlot }) {
  actionsSlot.innerHTML = `<button class="btn btn-primary" id="risk-refresh-btn">↻ Actualizar</button>`;
  container.innerHTML = `<div id="risk-content"><div class="empty"><div class="loader-ring"></div><div class="empty-title">Cargando Risk Management...</div></div></div>`;

  async function load() {
    const el = document.getElementById('risk-content');
    el.innerHTML = `<div class="empty"><div class="loader-ring"></div><div class="empty-title">Descargando precios actuales...</div></div>`;

    const [positions, history, capA, capB, limits] = await Promise.all([
      UserData.get('ethan_positions').then(v=>v||[]),
      UserData.get('ethan_positions_history').then(v=>v||[]),
      UserData.get('ethan_capital_alcista'),
      UserData.get('ethan_capital_bajista'),
      UserData.get(LIMITS_KEY).then(v=>v||DEFAULT_LIMITS),
    ]);

    const totalCapital = (capA||0) + (capB||0);

    // Precios actuales
    const prices = {};
    await Promise.all(positions.map(async p => {
      prices[p.ticker] = await fetchPrice(p.ticker);
    }));

    // Calcular valor actual y riesgo por posición
    const posData = positions.map(p => {
      const price   = prices[p.ticker] ?? p.entry;
      const shares  = p.shares || (p.cost && p.entry ? p.cost/p.entry : 0);
      const value   = shares * price;
      const costPct = totalCapital > 0 ? (p.cost||0)/totalCapital*100 : 0;
      const valuePct= totalCapital > 0 ? value/totalCapital*100 : 0;
      const pnl     = p.cost ? value - p.cost : null;
      const pnlPct  = p.cost ? (value-p.cost)/p.cost*100 : null;

      // Riesgo real si salta el stop
      let maxLoss = null, riskPct = null;
      if (p.entryStop && shares > 0) {
        const dist = p.direction === 'bajista'
          ? (p.entryStop - price) * shares
          : (price - p.entryStop) * shares;
        maxLoss = dist < 0 ? dist : 0; // negativo = pérdida
        riskPct = totalCapital > 0 ? maxLoss/totalCapital*100 : null;
      }

      // Distancia al stop
      const stopDist = p.entryStop && price
        ? ((price - p.entryStop) / price * 100)
        : null;
      const stopStatus = !p.entryStop ? 'bad'
        : Math.abs(stopDist) < 2 ? 'warn' : 'ok';

      return { ...p, price, shares, value, costPct, valuePct, pnl, pnlPct,
               maxLoss, riskPct, stopDist, stopStatus };
    });

    // Totales
    const totalValue    = posData.reduce((s,p)=>s+p.value,0);
    const totalExposure = totalCapital > 0 ? totalValue/totalCapital*100 : 0;
    const totalRisk     = posData.reduce((s,p)=>s+(p.riskPct||0),0);
    const totalMaxLoss  = posData.reduce((s,p)=>s+(p.maxLoss||0),0);
    const biggestPos    = posData.length ? posData.reduce((a,b)=>a.valuePct>b.valuePct?a:b) : null;

    // Sectores
    const sectorMap = {};
    posData.forEach(p => {
      const s = p.sector || 'Sin sector';
      sectorMap[s] = (sectorMap[s]||0) + p.valuePct;
    });
    const biggestSector = Object.entries(sectorMap).reduce((a,b)=>b[1]>a[1]?b:a, ['—',0]);

    // Sin stops
    const noStop = posData.filter(p=>!p.entryStop);

    // Rachas perdedoras recientes
    let streak=0, maxStreak=0;
    [...history].sort((a,b)=>a.closedAt-b.closedAt).forEach(h=>{
      if(h.pnlPct<=0){streak++;maxStreak=Math.max(maxStreak,streak);}else streak=0;
    });

    // Estado semáforos
    const s_risk    = totalRisk > limits.maxRiskPerOp*posData.length ? 'bad' : totalRisk > limits.maxRiskPerOp*posData.length*0.8 ? 'warn' : 'ok';
    const s_exp     = totalExposure > limits.maxExposure ? 'bad' : totalExposure > limits.maxExposure*0.85 ? 'warn' : 'ok';
    const s_pos     = biggestPos?.valuePct > limits.maxPosition ? 'bad' : biggestPos?.valuePct > limits.maxPosition*0.85 ? 'warn' : 'ok';
    const s_sector  = biggestSector[1] > limits.maxSector ? 'bad' : biggestSector[1] > limits.maxSector*0.85 ? 'warn' : 'ok';
    const s_streak  = streak >= limits.maxLosStreak ? 'bad' : streak >= limits.maxLosStreak-1 ? 'warn' : 'ok';
    const s_stops   = noStop.length > 0 ? 'bad' : 'ok';

    // ── Render ──────────────────────────────────
    el.innerHTML = `
      <div class="rm-tabs">
        <button class="rm-tab active" data-tab="overview">🚦 Overview</button>
        <button class="rm-tab" data-tab="stops">🛑 Stops Activos</button>
        <button class="rm-tab" data-tab="exposicion">📊 Exposición</button>
        <button class="rm-tab" data-tab="escenarios">⚡ Escenarios</button>
        <button class="rm-tab" data-tab="reglas">📋 Mis Reglas</button>
        <button class="rm-tab" data-tab="opciones">⚙️ Opciones</button>
      </div>

      <!-- OVERVIEW -->
      <div class="rm-panel active" id="panel-overview">
        <div class="rm-grid4" style="margin-bottom:16px;">
          <div class="rm-tile">
            <div class="rm-tile-label">Riesgo Total en Cartera</div>
            <div class="rm-tile-val ${totalRisk<0?'down':''}">${Math.abs(totalRisk).toFixed(1)}%</div>
            <div class="rm-tile-sub">${fmtE(totalMaxLoss)} si saltan todos los stops · límite ${limits.maxRiskPerOp}% por op</div>
            <span class="rm-tile-badge badge-${s_risk==='ok'?'ok':s_risk==='warn'?'warn':'bad'}">${s_risk==='ok'?'✓ OK':s_risk==='warn'?'⚠ CERCA':'✗ EXCEDE'}</span>
          </div>
          <div class="rm-tile">
            <div class="rm-tile-label">Exposición Bruta</div>
            <div class="rm-tile-val">${totalExposure.toFixed(1)}%</div>
            <div class="rm-tile-sub">${fmtE(totalValue)} en mercado · límite ${limits.maxExposure}%</div>
            <span class="rm-tile-badge badge-${s_exp==='ok'?'ok':s_exp==='warn'?'warn':'bad'}">${s_exp==='ok'?'✓ OK':s_exp==='warn'?'⚠ CERCA':'✗ EXCEDE'}</span>
          </div>
          <div class="rm-tile">
            <div class="rm-tile-label">Posición Mayor</div>
            <div class="rm-tile-val ${s_pos==='warn'?'warn':''}">${biggestPos?biggestPos.valuePct.toFixed(1)+'%':'—'}</div>
            <div class="rm-tile-sub">${biggestPos?.ticker||'—'} · límite ${limits.maxPosition}%</div>
            <span class="rm-tile-badge badge-${s_pos==='ok'?'ok':s_pos==='warn'?'warn':'bad'}">${s_pos==='ok'?'✓ OK':s_pos==='warn'?'⚠ CERCA':'✗ EXCEDE'}</span>
          </div>
          <div class="rm-tile">
            <div class="rm-tile-label">Stops sin configurar</div>
            <div class="rm-tile-val ${noStop.length>0?'down':''}">${noStop.length}</div>
            <div class="rm-tile-sub">${noStop.length>0?noStop.map(p=>p.ticker).join(', '):'Todas las posiciones tienen stop'}</div>
            <span class="rm-tile-badge badge-${noStop.length>0?'bad':'ok'}">${noStop.length>0?'✗ ALERTA':'✓ OK'}</span>
          </div>
        </div>
        <div class="rm-grid2">
          <div class="rm-card">
            <div class="rm-card-title">Semáforo de Riesgo</div>
            <div class="rm-semaforo">
              ${semItem(s_risk,   'Riesgo total por stops', `${Math.abs(totalRisk).toFixed(1)}% / ${limits.maxRiskPerOp}% por op`)}
              ${semItem(s_exp,    'Exposición total', `${totalExposure.toFixed(1)}% / ${limits.maxExposure}%`)}
              ${semItem(s_pos,    `Concentración — ${biggestPos?.ticker||'—'}`, `${biggestPos?.valuePct.toFixed(1)||'0'}% / ${limits.maxPosition}%`)}
              ${semItem(s_sector, `Sector — ${biggestSector[0]}`, `${biggestSector[1].toFixed(1)}% / ${limits.maxSector}%`)}
              ${semItem(s_streak, 'Rachas perdedoras activas', `${streak} / ${limits.maxLosStreak}`)}
              ${semItem(s_stops,  'Posiciones sin stop', noStop.length > 0 ? noStop.map(p=>p.ticker).join(', ') : 'Ninguna')}
            </div>
          </div>
          <div class="rm-card">
            <div class="rm-card-title">Uso de Límites</div>
            ${barRow('Riesgo por operaciones', Math.abs(totalRisk).toFixed(1)+'%', limits.maxRiskPerOp+'% por op', Math.abs(totalRisk)/limits.maxRiskPerOp*100)}
            ${barRow('Exposición total', totalExposure.toFixed(1)+'%', limits.maxExposure+'%', totalExposure/limits.maxExposure*100)}
            ${biggestPos ? barRow(`Posición mayor (${biggestPos.ticker})`, biggestPos.valuePct.toFixed(1)+'%', limits.maxPosition+'%', biggestPos.valuePct/limits.maxPosition*100) : ''}
            ${biggestSector[1] > 0 ? barRow(`Sector (${biggestSector[0]})`, biggestSector[1].toFixed(1)+'%', limits.maxSector+'%', biggestSector[1]/limits.maxSector*100) : ''}
          </div>
        </div>
      </div>

      <!-- STOPS ACTIVOS -->
      <div class="rm-panel" id="panel-stops">
        <div class="rm-card">
          <div class="rm-card-title">Stops Activos por Posición</div>
          <div class="rm-card-desc">Precio actual vs stop de entrada de cada posición. Los stops dinámicos (EMA10) debes actualizarlos semanalmente en Cartera.</div>
          ${posData.length === 0
            ? `<div class="sc2-empty">Sin posiciones abiertas</div>`
            : posData.map(p => `
            <div class="rm-stop-card">
              <div class="rm-stop-header">
                <div style="display:flex;gap:8px;align-items:center;">
                  <span class="rm-stop-ticker">${p.ticker}</span>
                  <span class="rm-stop-dir ${p.direction==='bajista'?'short':'long'}">${p.direction==='bajista'?'SHORT':'LONG'}</span>
                </div>
                ${p.stopStatus==='ok' ? chip('ok','✓ Por encima del stop')
                  : p.stopStatus==='warn' ? chip('warn','⚠ Cerca del stop')
                  : chip('bad','✗ Sin stop configurado')}
              </div>
              <div class="rm-stop-grid">
                <div class="rm-stop-item"><span class="rm-stop-item-label">Precio entrada</span><span class="rm-stop-item-val">${p.entry?.toFixed(2)||'—'}</span></div>
                <div class="rm-stop-item"><span class="rm-stop-item-label">Precio actual</span><span class="rm-stop-item-val ${p.pnlPct>=0?'up':'down'}">${p.price?.toFixed(2)||'—'}</span></div>
                <div class="rm-stop-item"><span class="rm-stop-item-label">Stop de entrada</span><span class="rm-stop-item-val" style="color:var(--red)">${p.entryStop?.toFixed(2)||'—'}</span></div>
                <div class="rm-stop-item"><span class="rm-stop-item-label">Distancia al stop</span><span class="rm-stop-item-val ${p.stopDist!=null&&p.stopDist<2?'warn':''}">${p.stopDist!=null?p.stopDist.toFixed(1)+'%':'—'}</span></div>
              </div>
              ${p.stopStatus==='ok' ? `<div class="rm-stop-alert ok">✓ Stop seguro · Pérdida máx si salta: ${p.maxLoss!=null?fmtE(p.maxLoss)+' ('+Math.abs(p.riskPct||0).toFixed(2)+'% capital)':'—'}</div>`
                : p.stopStatus==='warn' ? `<div class="rm-stop-alert warn">⚠ Precio muy cerca del stop (${p.stopDist?.toFixed(1)}%). Monitorear de cerca.</div>`
                : `<div class="rm-stop-alert warn">⚠ Sin stop configurado — añádelo en el módulo Cartera.</div>`}
            </div>`).join('')}
        </div>
      </div>

      <!-- EXPOSICIÓN -->
      <div class="rm-panel" id="panel-exposicion">
        <div class="rm-grid2">
          <div class="rm-card" style="margin-bottom:0;">
            <div class="rm-card-title">Por Posición</div>
            <table class="rm-table">
              <thead><tr><th>TICKER</th><th>DIR.</th><th class="r">VALOR</th><th class="r">% CAPITAL</th><th class="r">P&L</th><th class="r">ESTADO</th></tr></thead>
              <tbody>
                ${posData.map(p => `<tr>
                  <td style="font-family:var(--mono);font-weight:700;">${p.ticker}</td>
                  <td>${chip(p.direction==='bajista'?'bad':'ok', p.direction==='bajista'?'S':'L')}</td>
                  <td class="r">${fmtE(p.value)}</td>
                  <td class="r ${p.valuePct>limits.maxPosition*0.9?'warn':''}">${p.valuePct.toFixed(1)}%</td>
                  <td class="r ${p.pnlPct>=0?'up':'down'}">${p.pnl!=null?(p.pnl>=0?'+':'')+fmtE(p.pnl):'—'}</td>
                  <td class="r">${chip(p.valuePct>limits.maxPosition?'bad':p.valuePct>limits.maxPosition*0.9?'warn':'ok', p.valuePct>limits.maxPosition?'EXCEDE':p.valuePct>limits.maxPosition*0.9?'CERCA':'OK')}</td>
                </tr>`).join('')}
                <tr style="border-top:1px solid var(--border2);">
                  <td colspan="2" style="color:var(--text3);font-size:11px;">TOTAL</td>
                  <td class="r" style="font-weight:700;">${fmtE(totalValue)}</td>
                  <td class="r" style="font-weight:700;">${totalExposure.toFixed(1)}%</td>
                  <td class="r ${posData.reduce((s,p)=>s+(p.pnl||0),0)>=0?'up':'down'}" style="font-weight:700;">${fmtE(posData.reduce((s,p)=>s+(p.pnl||0),0))}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="rm-card" style="margin-bottom:0;">
            <div class="rm-card-title">Pérdida Máxima Real (si saltan todos los stops)</div>
            <table class="rm-table">
              <thead><tr><th>TICKER</th><th class="r">STOP</th><th class="r">PÉRDIDA MÁX.</th><th class="r">% CAPITAL</th></tr></thead>
              <tbody>
                ${posData.map(p => `<tr>
                  <td style="font-family:var(--mono);">${p.ticker}</td>
                  <td class="r">${p.entryStop?.toFixed(2)||'—'}</td>
                  <td class="r ${p.maxLoss!=null?'down':''}">${p.maxLoss!=null?'−'+fmtE(Math.abs(p.maxLoss)):'Sin stop'}</td>
                  <td class="r ${p.riskPct!=null?'down':''}">${p.riskPct!=null?Math.abs(p.riskPct).toFixed(2)+'%':'—'}</td>
                </tr>`).join('')}
                <tr style="border-top:1px solid var(--border2);">
                  <td colspan="2" style="color:var(--text3);font-size:11px;">RIESGO TOTAL</td>
                  <td class="r down" style="font-weight:700;">−${fmtE(Math.abs(totalMaxLoss))}</td>
                  <td class="r down" style="font-weight:700;">${Math.abs(totalRisk).toFixed(2)}%</td>
                </tr>
              </tbody>
            </table>
            ${noStop.length > 0 ? `<div style="margin-top:12px;font-size:10px;color:var(--amber);font-family:var(--mono);">⚠ ${noStop.map(p=>p.ticker).join(', ')} sin stop — riesgo real no calculable para ${noStop.length===1?'esta posición':'estas posiciones'}.</div>` : ''}
          </div>
        </div>
      </div>

      <!-- ESCENARIOS -->
      <div class="rm-panel" id="panel-escenarios">
        <div class="rm-card">
          <div class="rm-card-title">Simulador de Escenarios</div>
          <div class="rm-card-desc">¿Qué pasaría si el mercado cayera un X%? La exposición y el capital se toman de tu cartera real. La beta la introduces manualmente (pendiente de automatizar desde Métricas).</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
            <div class="rm-field"><label>Capital Total (€)</label>
              <input type="number" id="sc-capital" class="rm-sim-input" value="${totalCapital||10000}">
            </div>
            <div class="rm-field"><label>Beta de cartera <span style="color:var(--text3);text-transform:none;">(manual)</span></label>
              <input type="number" id="sc-beta" class="rm-sim-input" value="1.10" step="0.01">
            </div>
            <div class="rm-field"><label>Exposición actual (%)</label>
              <input type="number" id="sc-exp" class="rm-sim-input" value="${totalExposure.toFixed(1)}" step="0.1">
            </div>
          </div>
          <button class="btn btn-primary" id="sc-calc-btn">Calcular Escenarios</button>
          <div id="sc-results" style="margin-top:16px;"></div>
        </div>
      </div>

      <!-- MIS REGLAS -->
      <div class="rm-panel" id="panel-reglas">
        <div class="rm-grid2">
          <div class="rm-card" style="margin-bottom:0;">
            <div class="rm-card-title">Mis Reglas de Risk Management</div>
            <div class="rm-card-desc">Edita tus límites. Se guardan en Firestore y se usan en todo el módulo.</div>
            ${[
              ['maxRiskPerOp',  'Riesgo máximo por operación (%)',   'Nunca arriesgar más de este % en una sola posición (entrada - stop × acciones / capital).'],
              ['maxExposure',   'Exposición máxima total (%)',        'Porcentaje máximo del capital que puede estar invertido simultáneamente.'],
              ['maxPosition',   'Límite por posición individual (%)', 'Ninguna posición puede superar este % del capital.'],
              ['maxSector',     'Límite por sector (%)',              'Concentración máxima en un mismo sector.'],
              ['maxDrawdown',   'Drawdown máximo tolerable (%)',      'Si la cartera cae este % desde su máximo, parar y revisar.'],
              ['maxLosStreak',  'Rachas perdedoras (nº ops)',         'Tras este número de pérdidas consecutivas, reducir sizing a la mitad.'],
            ].map(([key, label, desc]) => `
              <div class="rm-rule">
                <div class="rm-rule-body">
                  <div class="rm-rule-title">${label}</div>
                  <div class="rm-rule-desc">${desc}</div>
                </div>
                <input type="number" class="rm-rule-input" data-key="${key}" value="${limits[key]}" step="0.5" style="width:70px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:6px 8px;color:var(--teal);font-family:var(--mono);font-size:13px;text-align:right;">
              </div>`).join('')}
            <button class="btn btn-primary" id="save-limits-btn" style="margin-top:16px;width:100%;">Guardar límites</button>
            <div id="limits-saved" style="font-size:10px;color:var(--green);font-family:var(--mono);margin-top:8px;text-align:center;display:none;">✓ Límites guardados</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:16px;">
            <div class="rm-card" style="margin-bottom:0;">
              <div class="rm-card-title">Cumplimiento Actual</div>
              <div class="rm-semaforo">
                ${semItem(s_risk,   'Riesgo por operaciones', Math.abs(totalRisk).toFixed(1)+'% / '+limits.maxRiskPerOp+'%')}
                ${semItem(s_exp,    'Exposición total', totalExposure.toFixed(1)+'% / '+limits.maxExposure+'%')}
                ${semItem(s_pos,    'Posición individual', (biggestPos?.valuePct||0).toFixed(1)+'% / '+limits.maxPosition+'%')}
                ${semItem(s_sector, 'Sector', biggestSector[1].toFixed(1)+'% / '+limits.maxSector+'%')}
                ${semItem(s_streak, 'Rachas perdedoras', streak+' / '+limits.maxLosStreak)}
                ${semItem(s_stops,  'Stops configurados', noStop.length===0?'✓ Todas':'✗ Faltan: '+noStop.map(p=>p.ticker).join(', '))}
              </div>
            </div>
            ${[...noStop.map(p=>({level:'bad', msg:`<strong style="color:var(--red)">${p.ticker}</strong> — Sin stop configurado. Añádelo en Cartera.`})),
               ...(biggestPos?.valuePct > limits.maxPosition*0.9 ? [{level: biggestPos.valuePct > limits.maxPosition ? 'bad':'warn', msg:`<strong style="color:${biggestPos.valuePct > limits.maxPosition ? 'var(--red)':'var(--amber)'}">${biggestPos.ticker}</strong> — Al ${biggestPos.valuePct.toFixed(1)}% del capital, ${biggestPos.valuePct > limits.maxPosition ? 'excede' : 'cerca de'} el límite del ${limits.maxPosition}%.`}] : []),
               ...(streak >= limits.maxLosStreak-1 ? [{level:'warn', msg:`Racha de ${streak} pérdidas consecutivas. Considera reducir el sizing.`}] : [])
              ].length > 0 ? `
            <div class="rm-card" style="margin-bottom:0;">
              <div class="rm-card-title">Acciones Recomendadas</div>
              <div style="display:flex;flex-direction:column;gap:8px;">
                ${[...noStop.map(p=>({level:'bad', msg:`<strong style="color:var(--red)">${p.ticker}</strong> — Sin stop configurado. Añádelo en Cartera.`})),
                   ...(biggestPos?.valuePct > limits.maxPosition*0.9 ? [{level: biggestPos.valuePct > limits.maxPosition ? 'bad':'warn', msg:`<strong style="color:${biggestPos.valuePct > limits.maxPosition ? 'var(--red)':'var(--amber)'}">${biggestPos.ticker}</strong> — Al ${biggestPos.valuePct.toFixed(1)}% del capital, ${biggestPos.valuePct > limits.maxPosition ? 'excede' : 'cerca de'} el límite del ${limits.maxPosition}%.`}] : []),
                   ...(streak >= limits.maxLosStreak-1 ? [{level:'warn', msg:`Racha de ${streak} pérdidas consecutivas. Considera reducir el sizing.`}] : [])
                  ].map(a=>`<div style="padding:10px 12px;background:rgba(${a.level==='bad'?'244,113,116':'251,191,36'},0.07);border:1px solid rgba(${a.level==='bad'?'244,113,116':'251,191,36'},0.2);border-radius:8px;font-size:11px;color:var(--text2);line-height:1.5;">${a.level==='bad'?'🔴':'⚠️'} ${a.msg}</div>`).join('')}
              </div>
            </div>` : ''}
          </div>
        </div>
      </div>

      <!-- PANEL OPCIONES -->
      <div class="rm-panel" id="panel-opciones">
        <style>
          .opt-label{font-family:var(--mono);font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:5px;}
          .opt-input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--text1);font-family:var(--mono);font-size:13px;outline:none;transition:border-color 0.15s;}
          .opt-input:focus{border-color:var(--teal);}
          .opt-select{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--text1);font-family:var(--mono);font-size:12px;outline:none;cursor:pointer;}
          .opt-field{display:flex;flex-direction:column;gap:5px;}
        </style>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
          <div class="rm-card">
            <div class="rm-card-title">⚙️ Calculadora Black-Scholes</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
              <div><label class="opt-label">Tipo</label>
                <select id="opt-type" class="opt-input" style="width:100%;"><option value="call">CALL (alcista)</option><option value="put">PUT (bajista)</option></select></div>
              <div><label class="opt-label">Precio actual (S)</label>
                <input type="number" id="opt-spot" class="opt-input" value="185" step="0.01" style="width:100%;"></div>
              <div><label class="opt-label">Strike (K)</label>
                <input type="number" id="opt-strike" class="opt-input" value="185" step="0.01" style="width:100%;"></div>
              <div><label class="opt-label">Días al vencimiento</label>
                <input type="number" id="opt-days" class="opt-input" value="45" min="1" max="365" style="width:100%;"></div>
              <div><label class="opt-label">Volatilidad implícita (%)</label>
                <input type="number" id="opt-iv" class="opt-input" value="30" step="0.5" style="width:100%;"></div>
              <div><label class="opt-label">Tipo libre de riesgo (%)</label>
                <input type="number" id="opt-rf" class="opt-input" value="5" step="0.25" style="width:100%;"></div>
            </div>
            <button class="btn btn-primary" id="opt-calc-btn" style="width:100%;margin-bottom:16px;">Calcular</button>
            <div id="opt-results"></div>
          </div>
          <div class="rm-card">
            <div class="rm-card-title">🛡️ Cobertura de Posición con Put</div>
            <div style="font-size:11px;color:var(--text2);margin-bottom:14px;line-height:1.5;">Calcula la put óptima para cubrir una posición. La put actúa como stop garantizado incluso ante gaps bajistas.</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
              <div><label class="opt-label">Capital total (€)</label>
                <input type="number" id="cob-capital" class="opt-input" value="84000" style="width:100%;"></div>
              <div><label class="opt-label">% capital en posición</label>
                <input type="number" id="cob-pct-pos" class="opt-input" value="10" step="1" style="width:100%;"></div>
              <div><label class="opt-label">Precio actual</label>
                <input type="number" id="cob-spot" class="opt-input" value="185" step="0.01" style="width:100%;"></div>
              <div><label class="opt-label">Stop / nivel de protección</label>
                <input type="number" id="cob-stop" class="opt-input" value="165" step="0.01" style="width:100%;"></div>
              <div><label class="opt-label">Volatilidad implícita (%)</label>
                <input type="number" id="cob-iv" class="opt-input" value="30" step="0.5" style="width:100%;"></div>
              <div><label class="opt-label">Días de cobertura</label>
                <input type="number" id="cob-days" class="opt-input" value="45" style="width:100%;"></div>
            </div>
            <button class="btn btn-primary" id="cob-calc-btn" style="width:100%;margin-bottom:16px;">Calcular cobertura</button>
            <div id="cob-results"></div>
          </div>
        </div>

        <!-- Cobertura óptima conectada al Money Management -->
        <div class="rm-card">
          <div class="rm-card-title">🎯 Cobertura Óptima — Put como Stop Garantizado</div>
          <div style="font-size:11px;color:var(--text2);margin-bottom:16px;line-height:1.6;">
            Quiero entrar con más capital del habitual pero arriesgar solo el mismo % de siempre. La put actúa como stop perfecto — incluso ante gaps. El sistema calcula qué put comprar para que el coste de la prima sea exactamente tu riesgo máximo.
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
            <div class="opt-field"><label class="opt-label">Capital total (€)</label><input type="number" id="sim-capital" class="opt-input" value="84000"></div>
            <div class="opt-field"><label class="opt-label">% capital en posición</label><input type="number" id="sim-pos-pct" class="opt-input" value="10" step="1"></div>
            <div class="opt-field"><label class="opt-label">% riesgo objetivo</label><input type="number" id="sim-risk-pct" class="opt-input" value="2" step="0.25"></div>
            <div class="opt-field"><label class="opt-label">Precio actual</label><input type="number" id="sim-spot" class="opt-input" value="185" step="0.01"></div>
            <div class="opt-field"><label class="opt-label">Volatilidad implícita (%)</label><input type="number" id="sim-iv" class="opt-input" value="30" step="0.5"></div>
            <div class="opt-field"><label class="opt-label">Días al vencimiento</label><input type="number" id="sim-days" class="opt-input" value="45"></div>
            <div class="opt-field"><label class="opt-label">Tipo libre de riesgo (%)</label><input type="number" id="sim-rf" class="opt-input" value="5" step="0.25"></div>
            <div class="opt-field" style="align-self:end;"><button class="btn btn-primary" id="sim-calc-btn" style="width:100%;">Calcular</button></div>
          </div>
          <div id="sim-results"></div>
        </div>

        <div class="rm-card">
          <div class="rm-card-title">📚 Guía de las Griegas</div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;">
            <div style="background:var(--surface2);border-radius:6px;padding:12px 14px;"><div style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--teal);margin-bottom:6px;">Delta (Δ)</div><div style="font-size:10px;color:var(--text2);line-height:1.5;">Sensibilidad al precio del subyacente. Calls: 0 a 1. Puts: −1 a 0. ATM ≈ 0.5.</div></div>
            <div style="background:var(--surface2);border-radius:6px;padding:12px 14px;"><div style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--teal);margin-bottom:6px;">Gamma (Γ)</div><div style="font-size:10px;color:var(--text2);line-height:1.5;">Velocidad de cambio del Delta. Alta en opciones ATM y cerca del vencimiento.</div></div>
            <div style="background:var(--surface2);border-radius:6px;padding:12px 14px;"><div style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--teal);margin-bottom:6px;">Theta (Θ)</div><div style="font-size:10px;color:var(--text2);line-height:1.5;">Pérdida diaria por paso del tiempo. Siempre negativa para el comprador. El mayor enemigo.</div></div>
            <div style="background:var(--surface2);border-radius:6px;padding:12px 14px;"><div style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--teal);margin-bottom:6px;">Vega (V)</div><div style="font-size:10px;color:var(--text2);line-height:1.5;">Sensibilidad a la volatilidad implícita. Alta IV = opciones caras. Compra cuando IV es baja.</div></div>
            <div style="background:var(--surface2);border-radius:6px;padding:12px 14px;"><div style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--teal);margin-bottom:6px;">Rho (ρ)</div><div style="font-size:10px;color:var(--text2);line-height:1.5;">Sensibilidad al tipo de interés. Poco relevante para opciones a corto plazo.</div></div>
          </div>
        </div>
      </div>
    `;

    // ── Tabs ──────────────────────────────────────
    el.querySelectorAll('.rm-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        el.querySelectorAll('.rm-tab').forEach(t=>t.classList.remove('active'));
        el.querySelectorAll('.rm-panel').forEach(p=>p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('panel-'+tab.dataset.tab).classList.add('active');
      });
    });

    // ── Simulador ─────────────────────────────────
    document.getElementById('sc-calc-btn')?.addEventListener('click', () => {
      const cap  = parseFloat(document.getElementById('sc-capital').value)||totalCapital||10000;
      const beta = parseFloat(document.getElementById('sc-beta').value)||1.1;
      const exp  = (parseFloat(document.getElementById('sc-exp').value)||totalExposure)/100;
      const scenarios = [
        { name:'Corrección leve',    pct:-0.05 },
        { name:'Corrección moderada',pct:-0.10 },
        { name:'Corrección fuerte',  pct:-0.20 },
        { name:'Bear market',        pct:-0.35 },
        { name:'Crash severo',       pct:-0.50 },
      ];
      const statusFor = impact => {
        if (impact > -0.05) return ['ok','TOLERABLE'];
        if (impact > -0.10) return ['warn','MONITOREAR'];
        if (impact > -0.20) return ['warn','REVISAR'];
        return ['bad','CRÍTICO'];
      };
      const rows = scenarios.map(s => {
        const impact = s.pct * beta * exp;
        const pl = cap * impact;
        const [cls, lbl] = statusFor(impact);
        return `<tr>
          <td>${s.name}</td>
          <td style="color:${s.pct<-0.15?'var(--red)':'var(--amber)'};">${(s.pct*100).toFixed(0)}%</td>
          <td class="r down">${(impact*100).toFixed(1)}%</td>
          <td class="r down">−${fmtE(Math.abs(pl))}</td>
          <td class="r">${fmtE(cap+pl)}</td>
          <td class="r">${chip(cls, lbl)}</td>
        </tr>`;
      }).join('');
      document.getElementById('sc-results').innerHTML = `
        <table class="rm-table">
          <thead><tr><th>ESCENARIO</th><th>CAÍDA</th><th class="r">IMPACTO</th><th class="r">P&L</th><th class="r">CAPITAL RESTANTE</th><th class="r">ESTADO</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="font-size:10px;color:var(--text3);margin-top:8px;">Exposición ${(exp*100).toFixed(1)}% · Beta ${beta} · Capital ${fmtE(cap)} · Los stops limitan la pérdida real a ${fmtE(Math.abs(totalMaxLoss))}.</p>`;
    });

    // ── Guardar límites ────────────────────────────
    document.getElementById('save-limits-btn')?.addEventListener('click', async () => {
      const newLimits = { ...limits };
      document.querySelectorAll('.rm-rule-input').forEach(inp => {
        newLimits[inp.dataset.key] = parseFloat(inp.value)||0;
      });
      await UserData.set(LIMITS_KEY, newLimits);
      const saved = document.getElementById('limits-saved');
      if (saved) { saved.style.display='block'; setTimeout(()=>saved.style.display='none', 2000); }
    });

    // ── Listeners opciones (dentro de load porque el HTML ya está pintado) ──
    document.getElementById('opt-calc-btn')?.addEventListener('click', calcOptions);
    document.getElementById('cob-calc-btn')?.addEventListener('click', calcCobertura);
    document.getElementById('sim-calc-btn')?.addEventListener('click', calcSimulacion);
    ['opt-type','opt-spot','opt-strike','opt-days','opt-iv','opt-rf'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', calcOptions);
    });
    calcOptions();
    calcCobertura();
    calcSimulacion();
  }

  document.getElementById('risk-refresh-btn')?.addEventListener('click', load);
  load();

  // ── Black-Scholes ─────────────────────────────────────────────
  function norm(x) {
    // Aproximación de la distribución normal acumulada
    const a = [0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429];
    const k = 1 / (1 + 0.2316419 * Math.abs(x));
    let poly = 0;
    for (let i = 4; i >= 0; i--) poly = poly * k + a[i];
    poly *= k;
    const n = Math.exp(-x*x/2) / Math.sqrt(2*Math.PI) * poly;
    return x >= 0 ? 1 - n : n;
  }
  function normPDF(x) { return Math.exp(-x*x/2) / Math.sqrt(2*Math.PI); }

  function blackScholes(S, K, T, r, sigma, type) {
    if (T <= 0) return { price: Math.max(0, type==='call'?S-K:K-S), delta:0, gamma:0, theta:0, vega:0, rho:0 };
    const d1 = (Math.log(S/K) + (r + sigma*sigma/2)*T) / (sigma*Math.sqrt(T));
    const d2 = d1 - sigma*Math.sqrt(T);
    const Nd1 = norm(d1), Nd2 = norm(d2);
    const Nd1n = norm(-d1), Nd2n = norm(-d2);
    const nd1 = normPDF(d1);
    let price, delta, theta;
    if (type === 'call') {
      price = S*Nd1 - K*Math.exp(-r*T)*Nd2;
      delta = Nd1;
      theta = (-S*nd1*sigma/(2*Math.sqrt(T)) - r*K*Math.exp(-r*T)*Nd2) / 365;
    } else {
      price = K*Math.exp(-r*T)*Nd2n - S*Nd1n;
      delta = Nd1 - 1;
      theta = (-S*nd1*sigma/(2*Math.sqrt(T)) + r*K*Math.exp(-r*T)*Nd2n) / 365;
    }
    const gamma = nd1 / (S*sigma*Math.sqrt(T));
    const vega  = S*nd1*Math.sqrt(T) / 100;
    const rho   = type==='call' ? K*T*Math.exp(-r*T)*Nd2/100 : -K*T*Math.exp(-r*T)*Nd2n/100;
    return { price, delta, gamma, theta, vega, rho };
  }

  function calcOptions() {
    const S     = parseFloat(document.getElementById('opt-spot')?.value) || 0;
    const K     = parseFloat(document.getElementById('opt-strike')?.value) || 0;
    const days  = parseFloat(document.getElementById('opt-days')?.value) || 30;
    const iv    = parseFloat(document.getElementById('opt-iv')?.value) || 30;
    const rf    = parseFloat(document.getElementById('opt-rf')?.value) || 5;
    const type  = document.getElementById('opt-type')?.value || 'call';
    if (!S || !K) return;
    const T = days / 365;
    const sigma = iv / 100;
    const r = rf / 100;
    const bs = blackScholes(S, K, T, r, sigma, type);
    const breakeven = type === 'call' ? K + bs.price : K - bs.price;
    const intrinsic = Math.max(0, type === 'call' ? S - K : K - S);
    const timeValue = bs.price - intrinsic;

    const fmtG = (n, d=4) => n != null ? (n >= 0 ? '' : '') + n.toFixed(d) : '—';
    const col = n => n > 0 ? 'var(--green)' : n < 0 ? 'var(--red)' : 'var(--text2)';

    document.getElementById('opt-results').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border);border-radius:8px;overflow:hidden;margin-bottom:16px;">
        <div style="background:var(--surface2);padding:16px 18px;">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Prima teórica</div>
          <div style="font-family:var(--serif);font-size:32px;font-style:italic;font-weight:600;color:var(--teal);">$${bs.price.toFixed(2)}</div>
          <div style="font-family:var(--mono);font-size:10px;color:var(--text2);margin-top:4px;">Intrínseco $${intrinsic.toFixed(2)} · Temporal $${timeValue.toFixed(2)}</div>
        </div>
        <div style="background:var(--surface2);padding:16px 18px;">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Breakeven</div>
          <div style="font-family:var(--serif);font-size:32px;font-style:italic;font-weight:600;">$${breakeven.toFixed(2)}</div>
          <div style="font-family:var(--mono);font-size:10px;color:var(--text2);margin-top:4px;">${type==='call'?'Necesita subir':'Necesita bajar'} $${Math.abs(breakeven-S).toFixed(2)}</div>
        </div>
        <div style="background:var(--surface2);padding:16px 18px;">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Delta</div>
          <div style="font-family:var(--serif);font-size:32px;font-style:italic;font-weight:600;color:${col(bs.delta)};">${fmtG(bs.delta,3)}</div>
          <div style="font-family:var(--mono);font-size:10px;color:var(--text2);margin-top:4px;">Por cada $1 de movimiento</div>
        </div>
        <div style="background:var(--surface2);padding:16px 18px;">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Theta (día)</div>
          <div style="font-family:var(--serif);font-size:32px;font-style:italic;font-weight:600;color:var(--red);">${fmtG(bs.theta,3)}</div>
          <div style="font-family:var(--mono);font-size:10px;color:var(--text2);margin-top:4px;">Pérdida diaria por tiempo</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border);border-radius:8px;overflow:hidden;margin-bottom:20px;">
        <div style="background:var(--surface);padding:14px 16px;">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-bottom:5px;">Gamma</div>
          <div style="font-family:var(--mono);font-size:16px;font-weight:600;">${fmtG(bs.gamma,4)}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px;">Cambio en Delta por $1</div>
        </div>
        <div style="background:var(--surface);padding:14px 16px;">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-bottom:5px;">Vega</div>
          <div style="font-family:var(--mono);font-size:16px;font-weight:600;">${fmtG(bs.vega,4)}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px;">Por cada 1% de IV</div>
        </div>
        <div style="background:var(--surface);padding:14px 16px;">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-bottom:5px;">Rho</div>
          <div style="font-family:var(--mono);font-size:16px;font-weight:600;">${fmtG(bs.rho,4)}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px;">Por cada 1% de tipo</div>
        </div>
        <div style="background:var(--surface);padding:14px 16px;">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-bottom:5px;">Coste 1 contrato</div>
          <div style="font-family:var(--mono);font-size:16px;font-weight:600;color:var(--amber);">$${(bs.price*100).toFixed(0)}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px;">× 100 acciones</div>
        </div>
      </div>

      <!-- P&L Chart SVG -->
      ${renderPLChart(S, K, bs.price, type)}
    `;
  }

  function renderPLChart(S, K, premium, type) {
    const W = 680, H = 140;
    const range = S * 0.3;
    const minP = S - range, maxP = S + range;
    const steps = 60;
    const prices = Array.from({length: steps+1}, (_,i) => minP + (maxP-minP)*i/steps);
    const pls = prices.map(p => {
      const intrinsic = Math.max(0, type==='call' ? p-K : K-p);
      return (intrinsic - premium) * 100; // por contrato
    });
    const maxPL = Math.max(...pls, premium*100);
    const minPL = Math.min(...pls, -premium*100);
    const rangeY = maxPL - minPL || 1;
    const toX = i => (i/steps*W).toFixed(1);
    const toY = v => (H - (v-minPL)/rangeY*H).toFixed(1);
    const zero = toY(0);
    const pts = pls.map((v,i) => `${toX(i)},${toY(v)}`).join(' ');
    // Línea de precio actual
    const spotX = ((S-minP)/(maxP-minP)*W).toFixed(1);
    const breakX = type==='call' ? ((K+premium-minP)/(maxP-minP)*W).toFixed(1) : ((K-premium-minP)/(maxP-minP)*W).toFixed(1);
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px 16px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">Perfil P&L al vencimiento · 1 contrato (100 acciones)</div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block;">
        <line x1="0" y1="${zero}" x2="${W}" y2="${zero}" stroke="var(--border2)" stroke-width="1" stroke-dasharray="4,4"/>
        <polyline points="${pts}" fill="none" stroke="var(--teal)" stroke-width="2" stroke-linejoin="round"/>
        <line x1="${spotX}" y1="0" x2="${spotX}" y2="${H}" stroke="var(--amber)" stroke-width="1.5" stroke-dasharray="4,3"/>
        <line x1="${breakX}" y1="0" x2="${breakX}" y2="${H}" stroke="var(--green)" stroke-width="1" stroke-dasharray="3,3"/>
        <text x="${parseFloat(spotX)+4}" y="14" font-family="IBM Plex Mono" font-size="9" fill="var(--amber)">Spot</text>
        <text x="${parseFloat(breakX)+4}" y="26" font-family="IBM Plex Mono" font-size="9" fill="var(--green)">BE</text>
      </svg>
      <div style="display:flex;gap:20px;margin-top:8px;font-family:var(--mono);font-size:10px;color:var(--text3);">
        <span style="color:var(--amber);">— Precio actual</span>
        <span style="color:var(--green);">— Breakeven</span>
        <span style="color:var(--teal);">— P&L</span>
        <span style="margin-left:auto;">Pérdida máxima: $${(premium*100).toFixed(0)} · Beneficio: ilimitado${type==='call'?'':' hasta $'+((K-premium)*100).toFixed(0)}</span>
      </div>
    </div>`;
  }

  function calcSimulacion() {
    const capital  = parseFloat(document.getElementById('sim-capital')?.value) || 84000;
    const posPct   = parseFloat(document.getElementById('sim-pos-pct')?.value) || 10;
    const riskPct  = parseFloat(document.getElementById('sim-risk-pct')?.value) || 2;
    const spot     = parseFloat(document.getElementById('sim-spot')?.value) || 185;
    const iv       = parseFloat(document.getElementById('sim-iv')?.value) || 30;
    const days     = parseFloat(document.getElementById('sim-days')?.value) || 45;
    const rf       = parseFloat(document.getElementById('sim-rf')?.value) || 5;
    if (!capital || !spot) return;

    const posValue   = capital * posPct / 100;
    const shares     = Math.floor(posValue / spot);
    const contracts  = Math.ceil(shares / 100);
    const riskEur    = capital * riskPct / 100; // máximo a perder

    // Strike ATM — protección inmediata desde el primer día
    // Redondeamos al múltiplo de 5 más cercano al precio actual
    const strikeATM = Math.round(spot / 5) * 5;
    const bsATM = blackScholes(spot, strikeATM, days/365, rf/100, iv/100, 'put');
    const costATM = bsATM.price * 100 * contracts;

    // También calculamos cuántas acciones podemos comprar si la prima viene del capital
    const optima = { k: strikeATM, cost: costATM, prima: bsATM.price, delta: bsATM.delta, theta: bsATM.theta, pct: 0 };
    const fmtP = (n,d=1) => (n>=0?'+':'')+n.toFixed(d)+'%';
    const fmtE = n => (n>=0?'+':'')+'€'+Math.abs(n).toFixed(0);
    const col  = n => n>=0?'var(--green)':'var(--red)';

    // Tabla de escenarios −10% a +10%
    const moves = [-10,-8,-6,-4,-2,0,2,4,6,8,10];
    const rows = moves.map(pct => {
      const newPrice = spot * (1 + pct/100);
      const putPayoff = Math.max(0, optima.k - newPrice) * 100 * contracts;
      const stockPnl  = shares * (newPrice - spot);
      const pnlTotal  = stockPnl + putPayoff - optima.cost;
      const pnlPct    = pnlTotal / capital * 100;
      // Sistema tradicional comparativa (solo 2% capital)
      const sharesT = Math.floor(riskEur / (spot * 0.1)); // stop 10% OTM
      const pnlT    = sharesT * (newPrice - spot);
      const pnlPctT = pnlT / capital * 100;
      return { pct, newPrice, pnlTotal, pnlPct, pnlT, pnlPctT };
    });

    // SVG
    const W=720, H=160;
    const allV = [...rows.map(r=>r.pnlPct), ...rows.map(r=>r.pnlPctT)];
    const minV = Math.min(...allV)*1.15, maxV = Math.max(...allV)*1.15;
    const rangeV = maxV-minV||1;
    const toX = i => (i/(moves.length-1)*W).toFixed(1);
    const toY = v => (H-(v-minV)/rangeV*H).toFixed(1);
    const zero = toY(0);
    const pts1 = rows.map((r,i)=>`${toX(i)},${toY(r.pnlPct)}`).join(' ');
    const pts2 = rows.map((r,i)=>`${toX(i)},${toY(r.pnlPctT)}`).join(' ');

    document.getElementById('sim-results').innerHTML = `
      <!-- Resultado put óptima -->
      <div style="background:rgba(64,217,192,0.06);border:1px solid rgba(64,217,192,0.3);border-left:4px solid var(--teal);border-radius:8px;padding:16px 20px;margin-bottom:16px;">
        <div style="font-family:var(--mono);font-size:9px;color:var(--teal);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">Put óptima para ${riskPct}% de riesgo máximo</div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;">
          <div>
            <div style="font-size:10px;color:var(--text2);margin-bottom:4px;">Strike</div>
            <div style="font-family:var(--mono);font-size:20px;font-weight:700;color:var(--text1);">$${optima.k}</div>
            <div style="font-size:10px;color:var(--text3);">ATM — protección inmediata</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text2);margin-bottom:4px;">Prima por acción</div>
            <div style="font-family:var(--mono);font-size:20px;font-weight:700;">$${optima.prima.toFixed(2)}</div>
            <div style="font-size:10px;color:var(--text3);">${contracts} contrato${contracts>1?'s':''}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text2);margin-bottom:4px;">Coste total</div>
            <div style="font-family:var(--mono);font-size:20px;font-weight:700;color:${optima.cost<=riskEur?'var(--green)':'var(--red)'};">€${optima.cost.toFixed(0)}</div>
            <div style="font-size:10px;color:var(--text3);">presupuesto €${riskEur.toFixed(0)}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text2);margin-bottom:4px;">Acciones</div>
            <div style="font-family:var(--mono);font-size:20px;font-weight:700;color:var(--teal);">${shares}</div>
            <div style="font-size:10px;color:var(--text3);">€${posValue.toFixed(0)} invertido</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text2);margin-bottom:4px;">Theta/día</div>
            <div style="font-family:var(--mono);font-size:20px;font-weight:700;color:var(--red);">€${Math.abs(optima.theta*100*contracts).toFixed(1)}</div>
            <div style="font-size:10px;color:var(--text3);">coste diario tiempo</div>
          </div>
        </div>
        <div style="margin-top:12px;font-size:11px;color:var(--text2);line-height:1.6;">
          ${optima.cost <= riskEur
            ? `✅ Put ATM strike $${optima.k} — protección inmediata desde el primer día. Coste €${optima.cost.toFixed(0)} dentro de tu presupuesto de riesgo (€${riskEur.toFixed(0)}). La pérdida máxima es el coste de la prima.`
            : `⚠ La put ATM strike $${optima.k} cuesta €${optima.cost.toFixed(0)}, superior a tu presupuesto de €${riskEur.toFixed(0)} (${riskPct}% del capital). Opciones: aumentar el % de riesgo, reducir la posición, o usar menos días de vencimiento.`}
        </div>
      </div>

      <!-- Gráfico -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:0.1em;">P&L sobre capital total — escenarios de precio</div>
          <div style="display:flex;gap:16px;font-family:var(--mono);font-size:10px;">
            <span style="color:var(--teal);">— Con put (${posPct}% capital)</span>
            <span style="color:var(--text3);">- - Stop tradicional (${riskPct}% riesgo)</span>
          </div>
        </div>
        <svg viewBox="0 0 ${W} ${H+20}" style="width:100%;height:${H+20}px;display:block;">
          <line x1="0" y1="${zero}" x2="${W}" y2="${zero}" stroke="var(--border2)" stroke-width="1" stroke-dasharray="4,4"/>
          ${moves.map((m,i) => `<text x="${toX(i)}" y="${H+18}" font-family="IBM Plex Mono" font-size="9" fill="var(--text3)" text-anchor="middle">${m>0?'+':''}${m}%</text>`).join('')}
          <polyline points="${pts2}" fill="none" stroke="var(--text3)" stroke-width="1.5" stroke-dasharray="5,4"/>
          <polyline points="${pts1}" fill="none" stroke="var(--teal)" stroke-width="2.5" stroke-linejoin="round"/>
          ${rows.map((r,i) => `<circle cx="${toX(i)}" cy="${toY(r.pnlPct)}" r="3" fill="var(--teal)"/>`).join('')}
        </svg>
      </div>

      <!-- Tabla escenarios -->
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead><tr style="background:var(--surface2);">
          <th style="padding:9px 12px;text-align:left;font-family:var(--mono);font-size:9px;text-transform:uppercase;color:var(--text2);border-bottom:1px solid var(--border);">Movimiento</th>
          <th style="padding:9px 12px;text-align:right;font-family:var(--mono);font-size:9px;text-transform:uppercase;color:var(--text2);border-bottom:1px solid var(--border);">Precio</th>
          <th style="padding:9px 12px;text-align:right;font-family:var(--mono);font-size:9px;text-transform:uppercase;color:var(--teal);border-bottom:1px solid var(--border);">P&L con put</th>
          <th style="padding:9px 12px;text-align:right;font-family:var(--mono);font-size:9px;text-transform:uppercase;color:var(--teal);border-bottom:1px solid var(--border);">% capital</th>
          <th style="padding:9px 12px;text-align:right;font-family:var(--mono);font-size:9px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);">% capital (stop trad.)</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr style="border-bottom:1px solid var(--border);${r.pct===0?'background:var(--teal-dim);':''}">
            <td style="padding:9px 12px;color:${r.pct===0?'var(--text1)':'var(--text2)'};">${r.pct>0?'+':''}${r.pct}%</td>
            <td style="padding:9px 12px;text-align:right;font-family:var(--mono);">$${r.newPrice.toFixed(2)}</td>
            <td style="padding:9px 12px;text-align:right;font-family:var(--mono);font-weight:700;color:${col(r.pnlTotal)};">${fmtE(r.pnlTotal)}</td>
            <td style="padding:9px 12px;text-align:right;font-family:var(--mono);color:${col(r.pnlPct)};">${fmtP(r.pnlPct)}</td>
            <td style="padding:9px 12px;text-align:right;font-family:var(--mono);color:var(--text3);">${fmtP(r.pnlPctT)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  function calcCobertura() {
    const capital = parseFloat(document.getElementById('cob-capital')?.value) || 0;
    const pctPos  = parseFloat(document.getElementById('cob-pct-pos')?.value) || 10;
    const spot    = parseFloat(document.getElementById('cob-spot')?.value) || 0;
    const stop    = parseFloat(document.getElementById('cob-stop')?.value) || 0;
    const iv      = parseFloat(document.getElementById('cob-iv')?.value) || 30;
    const days    = parseFloat(document.getElementById('cob-days')?.value) || 45;
    const rf      = 5;
    if (!capital || !spot || !stop) return;

    const posValue   = capital * pctPos / 100;
    const shares     = Math.floor(posValue / spot);
    const contracts  = Math.ceil(shares / 100);
    const riesgoMax  = shares * (spot - stop); // sin cobertura
    const pctRiesgo  = riesgoMax / capital * 100;

    // Strike óptimo = stop o ligeramente por debajo
    const strikeOpt = Math.round(stop * 0.98 / 5) * 5; // redondeo a múltiplo de 5
    const bs = blackScholes(spot, strikeOpt, days/365, rf/100, iv/100, 'put');
    const costeCob = bs.price * 100 * contracts;
    const riesgoConCob = costeCob;
    const ahorro = riesgoMax - costeCob;
    const eficiencia = (ahorro / riesgoMax * 100);

    document.getElementById('cob-results').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:16px;">
        <div style="background:var(--surface2);border-radius:8px;padding:16px 18px;">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">Sin cobertura</div>
          <div style="font-family:var(--serif);font-size:28px;font-style:italic;color:var(--red);">−$${riesgoMax.toFixed(0)}</div>
          <div style="font-family:var(--mono);font-size:10px;color:var(--text2);margin-top:4px;">${pctRiesgo.toFixed(1)}% del capital · ${shares} acciones</div>
          <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:3px;">Si toca el stop en $${stop}</div>
        </div>
        <div style="background:var(--surface2);border-radius:8px;padding:16px 18px;">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">Con cobertura put</div>
          <div style="font-family:var(--serif);font-size:28px;font-style:italic;color:var(--amber);">−$${costeCob.toFixed(0)}</div>
          <div style="font-family:var(--mono);font-size:10px;color:var(--text2);margin-top:4px;">${(costeCob/capital*100).toFixed(1)}% del capital · ${contracts} contratos</div>
          <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:3px;">Strike $${strikeOpt} · prima $${bs.price.toFixed(2)}/acción</div>
        </div>
      </div>
      <div style="background:rgba(64,217,192,0.06);border:1px solid rgba(64,217,192,0.2);border-radius:8px;padding:14px 18px;margin-bottom:14px;">
        <div style="font-family:var(--mono);font-size:9px;color:var(--teal);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Análisis de la cobertura</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
          <div>
            <div style="font-size:10px;color:var(--text2);margin-bottom:4px;">Riesgo eliminado</div>
            <div style="font-family:var(--mono);font-size:16px;font-weight:700;color:var(--green);">$${ahorro.toFixed(0)}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text2);margin-bottom:4px;">Eficiencia</div>
            <div style="font-family:var(--mono);font-size:16px;font-weight:700;color:${eficiencia>70?'var(--green)':eficiencia>40?'var(--amber)':'var(--red)'};">${eficiencia.toFixed(0)}%</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text2);margin-bottom:4px;">Theta diario</div>
            <div style="font-family:var(--mono);font-size:16px;font-weight:700;color:var(--red);">−$${Math.abs(bs.theta*100*contracts).toFixed(1)}</div>
          </div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text2);line-height:1.6;padding:12px 14px;background:var(--surface2);border-radius:6px;">
        ${eficiencia > 70
          ? `✅ Cobertura eficiente. Por $${costeCob.toFixed(0)} eliminas $${riesgoMax.toFixed(0)} de riesgo. El coste de la prima (${(costeCob/capital*100).toFixed(1)}% del capital) está justificado.`
          : eficiencia > 40
          ? `🟡 Cobertura moderada. La prima es relativamente cara para el riesgo que eliminas. Considera si el escenario bajista es muy probable.`
          : `🔴 Cobertura poco eficiente. La prima cuesta casi tanto como el riesgo que elimina. Con tu gestión de stops puede no ser necesaria.`
        }
        ${pctRiesgo < 2.5 ? ` Con solo ${pctRiesgo.toFixed(1)}% de riesgo sobre capital, tu gestión de posición ya es conservadora — la cobertura es opcional.` : ''}
      </div>
    `;
  }

  return { destroy() {} };
}

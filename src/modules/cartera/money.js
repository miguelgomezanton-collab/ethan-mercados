// ═══════════════════════════════════════════════
// MÓDULO: Money Management
// 4 pestañas: Position Sizing, Kelly Criterion,
// Backtest de Sizing, Límites de Exposición.
// Todo conectado a datos reales de Firestore:
// ethan_positions, ethan_positions_history,
// ethan_capital_alcista/bajista.
// ═══════════════════════════════════════════════

import { UserData } from '../../userdata.js';

const SECTOR_NAMES = {
  XLK:'Tech', XLF:'Financials', XLV:'Health', XLE:'Energy', XLY:'Consumer D',
  XLP:'Consumer S', XLI:'Industrials', XLB:'Materials', XLU:'Utilities',
  XLRE:'Real Estate', XLC:'Comm'
};

const fmtE  = v => v!=null && !isNaN(v) ? '€'+v.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
const fmtE0 = v => v!=null && !isNaN(v) ? '€'+v.toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:0}) : '—';

function calcRatiosFromHistory(ops) {
  if (!ops || !ops.length) return null;
  const winners = ops.filter(o=>o.pnlPct>0), losers = ops.filter(o=>o.pnlPct<=0);
  const winRate = winners.length/ops.length;
  const avgWinPct = winners.length ? winners.reduce((s,o)=>s+o.pnlPct,0)/winners.length : 0;

  // Pérdida media real (de operaciones cerradas en negativo)
  let avgLossPct = losers.length
    ? Math.abs(losers.reduce((s,o)=>s+o.pnlPct,0)/losers.length) : 0;

  // Si no hay pérdidas reales, estimar desde entryStop registrado al abrir
  // pérdida potencial = (entry - entryStop) / entry * 100
  // Esto da el ratio R real aunque todas las ops hayan sido ganadoras.
  let fromStop = false;
  if (avgLossPct < 0.001) {
    const withStop = ops.filter(o => o.entry && o.entryStop && o.entryStop < o.entry);
    if (withStop.length > 0) {
      avgLossPct = withStop.reduce((s,o) => s + (o.entry-o.entryStop)/o.entry*100, 0) / withStop.length;
      fromStop = true;
    }
  }

  const R = avgLossPct > 0.001 ? avgWinPct/avgLossPct : null;
  const kelly = R != null ? Math.max(0, winRate-(1-winRate)/R) : null;
  return { winRate:winRate*100, avgWinPct, avgLossPct, kelly, n:ops.length,
    hasLosses: losers.length > 0, fromStop };
}

export async function render(container, { actionsSlot }) {
  actionsSlot.innerHTML = '';

  // ── Carga inicial de datos reales ──────────
  const [positions, history, capitalAlcista, capitalBajista] = await Promise.all([
    UserData.get('ethan_positions').then(v=>v||[]),
    UserData.get('ethan_positions_history').then(v=>v||[]),
    UserData.get('ethan_capital_alcista'),
    UserData.get('ethan_capital_bajista'),
  ]);

  const DEMO_CAPITAL = { alcista: capitalAlcista||0, bajista: capitalBajista||0 };

  container.innerHTML = `
    <div class="mm-tabs">
      <button class="mm-tab active" data-tab="sizing">📐 Position Sizing</button>
      <button class="mm-tab" data-tab="kelly">🎯 Kelly Criterion</button>
      <button class="mm-tab" data-tab="backtest">🔁 Backtest de Sizing</button>
      <button class="mm-tab" data-tab="limits">🛡️ Límites de Exposición</button>
    </div>

    <!-- TAB 1: Position Sizing -->
    <div class="mm-panel active" id="panel-sizing">
      <div class="mm-card">
        <div class="mm-card-title">📐 Calculadora de Tamaño de Posición</div>
        <div class="mm-card-desc">Calcula cuántas acciones comprar y cuánto capital invertir para cada operación que quieras abrir.</div>

        <div class="mm-grid">
          <div class="mm-field"><label>Dirección</label>
            <select id="sz-direction" class="mm-select">
              <option value="alcista">📈 LONG (Alcista)</option>
              <option value="bajista">📉 SHORT (Bajista)</option>
            </select>
          </div>
          <div class="mm-field"><label>Ticker / Valor</label><input type="text" id="sz-ticker" class="mm-input" value="AAPL" style="text-transform:uppercase;"></div>
          <div class="mm-field"><label>Precio de Entrada (€)</label><input type="number" id="sz-entry" class="mm-input" value="150" step="0.01"></div>
          <div class="mm-field"><label>Stop Loss (€)</label><input type="number" id="sz-stop" class="mm-input" value="145" step="0.01"></div>
        </div>
        <div class="mm-grid" style="margin-top:10px;">
          <div class="mm-field"><label>Take Profit (€) <span style="color:var(--text3);text-transform:none;">(opcional)</span></label><input type="number" id="sz-tp" class="mm-input" placeholder="165.00" step="0.01"></div>
          <div class="mm-field"><label>Capital Asignado <span style="color:var(--text3);text-transform:none;">(editable)</span></label><input type="number" id="sz-capital" class="mm-input" value="${DEMO_CAPITAL.alcista}" step="100"></div>
          <div class="mm-field"><label>Riesgo por Operación (%)</label><input type="number" id="sz-risk" class="mm-input" value="1.5" step="0.25"></div>
          <div class="mm-field" style="justify-content:flex-end;"><div id="sz-capital-source" style="font-size:9px;color:var(--text3);font-family:var(--mono);padding-bottom:9px;"></div></div>
        </div>

        <div class="mm-grid" style="grid-template-columns:1fr 1fr;margin-top:18px;">
          <div class="mm-result-panel">
            <div class="mm-result-panel-title" id="sz-res-title">Resultado para AAPL</div>
            <div class="mm-result-row"><span>Dirección:</span> <strong id="sz-out-dir">📈 LONG</strong></div>
            <div class="mm-result-row"><span>Precio:</span> <strong id="sz-out-price">—</strong></div>
            <div class="mm-result-row"><span>Stop Loss:</span> <strong id="sz-out-stop" style="color:var(--red)">—</strong> <span id="sz-out-stop-dist" class="mm-result-sub-inline"></span></div>
            <div class="mm-result-row" id="sz-out-tp-row" style="display:none;"><span>Take Profit:</span> <strong id="sz-out-tp" style="color:var(--green)">—</strong> <span id="sz-out-tp-dist" class="mm-result-sub-inline"></span></div>
            <div class="mm-result-row"><span>Riesgo permitido:</span> <strong id="sz-out-risk" style="color:var(--amber)">—</strong> <span id="sz-out-risk-pct" class="mm-result-sub-inline"></span></div>
          </div>
          <div class="mm-result-panel highlight">
            <div class="mm-result-panel-title" style="color:var(--teal);">Tamaño de Posición</div>
            <div class="mm-result-row"><span>Acciones:</span> <strong id="sz-out-shares" style="font-size:18px;color:var(--teal);">—</strong></div>
            <div class="mm-result-row"><span>Capital a invertir:</span> <strong id="sz-out-invested">—</strong> <span id="sz-out-invested-pct" class="mm-result-sub-inline"></span></div>
            <div class="mm-result-row"><span>Pérdida máxima:</span> <strong id="sz-out-maxloss" style="color:var(--red)">—</strong> <span id="sz-out-maxloss-pct" class="mm-result-sub-inline"></span></div>
            <div class="mm-result-row" id="sz-out-rr-row" style="display:none;"><span>Ratio R:R:</span> <strong id="sz-out-rr" style="color:var(--green)">—</strong></div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: Kelly -->
    <div class="mm-panel" id="panel-kelly">
      <div class="mm-card">
        <div class="mm-card-title">🎯 Calculadora de Kelly Criterion</div>
        <div class="mm-card-desc">El Kelly Criterion calcula el % óptimo de capital a arriesgar por operación, maximizando el crecimiento compuesto a largo plazo.</div>

        <div class="mm-subtabs">
          <button class="mm-subtab active" data-kdir="alcista">📈 Alcista</button>
          <button class="mm-subtab" data-kdir="bajista">📉 Bajista</button>
        </div>
        <div id="kl-source-badge"></div>

        <div class="mm-grid">
          <div class="mm-field"><label>Win Rate (%)</label><input type="number" id="kl-winrate" class="mm-input" value="55"></div>
          <div class="mm-field"><label>Ganancia Media (%)</label><input type="number" id="kl-avgwin" class="mm-input" value="8"></div>
          <div class="mm-field"><label>Pérdida Media (%)</label><input type="number" id="kl-avgloss" class="mm-input" value="5"></div>
          <div class="mm-field"><label>Fracción de Kelly a usar</label>
            <select id="kl-fraction" class="mm-select">
              <option value="1">Kelly Completo (100%)</option>
              <option value="0.5" selected>Medio Kelly (50%) — recomendado</option>
              <option value="0.25">Cuarto Kelly (25%) — conservador</option>
            </select>
          </div>
        </div>
        <div class="mm-result-hero">
          <div class="mm-result-card">
            <div class="mm-result-label">Kelly Óptimo (f*)</div>
            <div class="mm-result-val" id="kl-optimal">—</div>
          </div>
          <div class="mm-result-card">
            <div class="mm-result-label">Kelly Ajustado (recomendado)</div>
            <div class="mm-result-val" id="kl-adjusted" style="color:var(--teal)">—</div>
            <div class="mm-result-sub" id="kl-fraction-label"></div>
          </div>
          <div class="mm-result-card">
            <div class="mm-result-label">Tu Sizing Actual</div>
            <div class="mm-result-val" id="kl-current" style="color:var(--amber)">—</div>
            <div class="mm-result-sub">según Riesgo% configurado</div>
          </div>
          <div class="mm-result-card">
            <div class="mm-result-label">Veredicto</div>
            <div class="mm-result-val" id="kl-verdict" style="font-size:14px;">—</div>
          </div>
        </div>
        <div style="margin-top:16px;font-size:11px;color:var(--text3);background:var(--surface2);padding:12px 14px;border-radius:8px;line-height:1.6;">
          ⚠ El Kelly completo maximiza el crecimiento teórico pero implica drawdowns muy violentos. La mayoría de gestores profesionales usan <strong style="color:var(--text2)">Medio Kelly o menos</strong>.
        </div>
      </div>
    </div>

    <!-- TAB 3: Backtest de Sizing -->
    <div class="mm-panel" id="panel-backtest">
      <div class="mm-card">
        <div class="mm-card-title">🔁 Backtest de Sizing — ¿Qué habría pasado con otro método?</div>
        <div class="mm-card-desc">Aplica retroactivamente distintos métodos de sizing a cada una de tus operaciones cerradas reales, y compara el resultado final: capital, rentabilidad, drawdown y volatilidad.</div>

        <div class="mm-subtabs">
          <button class="mm-subtab" data-btdir="alcista">📈 Alcista</button>
          <button class="mm-subtab" data-btdir="bajista">📉 Bajista</button>
          <button class="mm-subtab active" data-btdir="total">🌐 Total</button>
        </div>
        <div id="bt-source-badge"></div>

        <div class="mm-grid">
          <div class="mm-field"><label>Capital Inicial (€)</label><input type="number" id="bt-capital" class="mm-input" value="${(capitalAlcista||0)+(capitalBajista||0) || 10000}"></div>
          <div class="mm-field"><label>Riesgo % <span style="color:var(--text3);text-transform:none;">(para Kelly y Fijo 10%)</span></label><input type="number" id="bt-risk" class="mm-input" value="1.5" step="0.25" style="opacity:0.6;"></div>
          <div class="mm-field" style="grid-column:span 2;display:flex;align-items:flex-end;">
            <button class="btn btn-primary" id="bt-run-btn" style="width:100%;">▶ Ejecutar Backtest</button>
          </div>
        </div>
        <div id="bt-status" style="margin-top:10px;font-family:var(--mono);font-size:10px;color:var(--text3);"></div>
        <div id="bt-results" style="margin-top:18px;"></div>
      </div>
    </div>

    <!-- TAB 4: Límites -->
    <div class="mm-panel" id="panel-limits">
      <div class="mm-card">
        <div class="mm-card-title">🛡️ Límites y Reglas de Exposición</div>
        <div class="mm-card-desc">Define tus reglas de gestión de riesgo y compáralas con tu cartera actual real.</div>
        <div class="mm-grid">
          <div class="mm-field"><label>Capital Total (€)</label><input type="number" id="lim-capital" class="mm-input" value="${(capitalAlcista||0)+(capitalBajista||0) || 10000}"></div>
          <div class="mm-field"><label>Máx. % por Posición</label><input type="number" id="lim-maxpos" class="mm-input" value="20"></div>
          <div class="mm-field"><label>Máx. % por Sector</label><input type="number" id="lim-maxsector" class="mm-input" value="35"></div>
          <div class="mm-field"><label>Máx. Exposición Total</label><input type="number" id="lim-maxtotal" class="mm-input" value="90"></div>
        </div>
        <button class="btn btn-primary" id="lim-check-btn" style="margin-top:14px;">Comprobar contra mi cartera actual</button>
        <div id="lim-results" style="margin-top:18px;"></div>
      </div>
    </div>
  `;

  // ════════════════════════════════════════════
  // TAB 1: Position Sizing
  // ════════════════════════════════════════════
  function onDirectionChange() {
    const dir = document.getElementById('sz-direction').value;
    const cap = DEMO_CAPITAL[dir] || 0;
    document.getElementById('sz-capital').value = cap;
    document.getElementById('sz-capital-source').textContent = cap>0
      ? `Capital Asignado a ${dir==='bajista'?'Bajista':'Alcista'} en Cartera`
      : `Sin Capital Asignado a ${dir==='bajista'?'Bajista':'Alcista'} — configúralo en Cartera`;
    calcSizing();
  }
  function calcSizing() {
    const dir     = document.getElementById('sz-direction').value;
    const ticker  = document.getElementById('sz-ticker').value.trim().toUpperCase() || '—';
    const capital = parseFloat(document.getElementById('sz-capital').value)||0;
    const riskPct = parseFloat(document.getElementById('sz-risk').value)||0;
    const entry   = parseFloat(document.getElementById('sz-entry').value)||0;
    const stop    = parseFloat(document.getElementById('sz-stop').value)||0;
    const tp      = parseFloat(document.getElementById('sz-tp').value)||null;

    const riskEur = capital * (riskPct/100);
    const distAbs = Math.abs(entry - stop);
    const shares  = distAbs>0 ? Math.floor(riskEur/distAbs) : 0;
    const invested = shares*entry;
    const pctCapital = capital>0 ? (invested/capital)*100 : 0;
    const maxLoss = shares*distAbs;
    const maxLossPct = capital>0 ? (maxLoss/capital)*100 : 0;

    const isLong = dir === 'alcista';
    document.getElementById('sz-res-title').textContent = `Resultado para ${ticker}`;
    document.getElementById('sz-out-dir').innerHTML = isLong ? '📈 LONG' : '📉 SHORT';
    document.getElementById('sz-out-dir').style.color = isLong ? 'var(--green)' : 'var(--red)';
    document.getElementById('sz-out-price').textContent = fmtE(entry);
    document.getElementById('sz-out-stop').textContent = fmtE(stop);
    document.getElementById('sz-out-stop-dist').textContent = `(-${fmtE(distAbs)}/acc)`;
    document.getElementById('sz-out-risk').textContent = fmtE(riskEur);
    document.getElementById('sz-out-risk-pct').textContent = `(${riskPct.toFixed(2)}% de ${fmtE0(capital)})`;

    if (tp && tp > 0) {
      const tpDistAbs = Math.abs(tp-entry);
      const rr = distAbs>0 ? (tpDistAbs/distAbs).toFixed(2) : '—';
      document.getElementById('sz-out-tp-row').style.display = 'flex';
      document.getElementById('sz-out-tp').textContent = fmtE(tp);
      document.getElementById('sz-out-tp-dist').textContent = `(+${fmtE(tpDistAbs)}/acc)`;
      document.getElementById('sz-out-rr-row').style.display = 'flex';
      document.getElementById('sz-out-rr').textContent = `1 : ${rr}`;
    } else {
      document.getElementById('sz-out-tp-row').style.display = 'none';
      document.getElementById('sz-out-rr-row').style.display = 'none';
    }

    document.getElementById('sz-out-shares').textContent = shares.toLocaleString('es-ES');
    document.getElementById('sz-out-invested').textContent = fmtE0(invested);
    document.getElementById('sz-out-invested-pct').textContent = `(${pctCapital.toFixed(1)}% del total)`;
    document.getElementById('sz-out-maxloss').textContent = fmtE0(maxLoss);
    document.getElementById('sz-out-maxloss-pct').textContent = `(${maxLossPct.toFixed(2)}% del capital)`;
  }
  ['sz-capital','sz-risk','sz-entry','sz-stop','sz-tp','sz-ticker'].forEach(id => {
    document.getElementById(id).addEventListener('input', calcSizing);
  });
  document.getElementById('sz-direction').addEventListener('change', onDirectionChange);
  onDirectionChange();

  // ════════════════════════════════════════════
  // TAB 2: Kelly — con datos reales por dirección
  // ════════════════════════════════════════════
  let klActiveDir = 'alcista';

  function loadKellyFromHistory(dir) {
    const ops = history.filter(h => (h.direction||'alcista') === dir);
    const r = calcRatiosFromHistory(ops);
    const badge = document.getElementById('kl-source-badge');
    if (r) {
      const sourceNote = r.fromStop
        ? ` · <span style="color:var(--amber)">pérdida estimada desde stop de entrada (sin pérdidas reales aún)</span>`
        : '';
      badge.innerHTML = `<span class="mm-source-badge real">✓ ${r.n} operaciones reales (${dir})${sourceNote}</span>`;
      document.getElementById('kl-winrate').value = r.winRate.toFixed(1);
      document.getElementById('kl-avgwin').value = r.avgWinPct.toFixed(1);
      document.getElementById('kl-avgloss').value = r.avgLossPct.toFixed(1);
    } else {
      badge.innerHTML = `<span class="mm-source-badge">⚠ Sin operaciones cerradas en ${dir} — introduce datos manualmente para simular</span>`;
    }
    calcKelly();
  }

  document.querySelectorAll('.mm-subtab[data-kdir]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mm-subtab[data-kdir]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      klActiveDir = btn.dataset.kdir;
      loadKellyFromHistory(klActiveDir);
    });
  });

  function calcKelly() {
    const winRate = (parseFloat(document.getElementById('kl-winrate').value)||0)/100;
    const avgWin  = parseFloat(document.getElementById('kl-avgwin').value)||0;
    const avgLoss = parseFloat(document.getElementById('kl-avgloss').value)||0;
    const fraction = parseFloat(document.getElementById('kl-fraction').value);
    const currentRisk = parseFloat(document.getElementById('sz-risk')?.value) || 1.5;

    if (avgLoss <= 0) return;
    const R = avgWin/avgLoss;
    const kellyFull = winRate - (1-winRate)/R;
    const kellyAdj = kellyFull*fraction;

    document.getElementById('kl-optimal').textContent = (kellyFull*100).toFixed(1)+'%';
    document.getElementById('kl-optimal').style.color = kellyFull>0?'var(--green)':'var(--red)';
    document.getElementById('kl-adjusted').textContent = (kellyAdj*100).toFixed(1)+'%';
    document.getElementById('kl-fraction-label').textContent = `×${fraction} del Kelly completo`;
    document.getElementById('kl-current').textContent = currentRisk.toFixed(2)+'%';

    const verdictEl = document.getElementById('kl-verdict');
    if (kellyFull <= 0) {
      verdictEl.textContent = '🔴 Sin Edge';
      verdictEl.style.color = 'var(--red)';
    } else if (currentRisk > kellyFull*100) {
      verdictEl.textContent = '⚠️ Sobre-apalancado';
      verdictEl.style.color = 'var(--amber)';
    } else if (kellyFull > 0.25) {
      verdictEl.textContent = '⚠️ Edge muy alto, revisa';
      verdictEl.style.color = 'var(--amber)';
    } else if (kellyFull > 0.05) {
      verdictEl.textContent = '✅ Edge saludable';
      verdictEl.style.color = 'var(--green)';
    } else {
      verdictEl.textContent = '🟡 Edge marginal';
      verdictEl.style.color = 'var(--amber)';
    }
  }
  ['kl-winrate','kl-avgwin','kl-avgloss','kl-fraction'].forEach(id => {
    document.getElementById(id).addEventListener('input', calcKelly);
  });
  loadKellyFromHistory('alcista');

  // ════════════════════════════════════════════
  // TAB 3: Backtest de Sizing
  // ════════════════════════════════════════════
  let btActiveDir = 'total';

  function getHistoryForDir(dir) {
    const ops = dir==='total' ? history : history.filter(h=>(h.direction||'alcista')===dir);
    return [...ops].sort((a,b)=>(a.closedAt||0)-(b.closedAt||0));
  }

  function updateBtSourceBadge() {
    const ops = getHistoryForDir(btActiveDir);
    const badge = document.getElementById('bt-source-badge');
    const label = btActiveDir==='total' ? 'Total (Alcista + Bajista)' : btActiveDir==='alcista' ? 'Alcista' : 'Bajista';
    if (ops.length > 0) {
      badge.innerHTML = `<span class="mm-source-badge real">✓ ${ops.length} operaciones reales cerradas · ${label}</span>`;
    } else {
      badge.innerHTML = `<span class="mm-source-badge">⚠ Sin operaciones cerradas en ${label}</span>`;
    }
  }

  document.querySelectorAll('[data-btdir]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-btdir]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      btActiveDir = btn.dataset.btdir;
      updateBtSourceBadge();
      document.getElementById('bt-results').innerHTML = '';
      document.getElementById('bt-status').textContent = '';
    });
  });
  updateBtSourceBadge();

  function simulateMethod(ops, capital0, methodFn) {
    let capital = capital0;
    let peak = capital0, maxDD = 0;
    const curve = [capital0];
    const returns = [];
    ops.forEach(op => {
      const sizePct = methodFn(op, capital);
      const sizeEur = capital*sizePct;
      const pnlEur = sizeEur*(op.pnlPct/100);
      capital += pnlEur;
      curve.push(capital);
      returns.push(pnlEur/Math.max(capital-pnlEur,1));
      peak = Math.max(peak, capital);
      const dd = peak>0 ? (peak-capital)/peak*100 : 0;
      if (dd > maxDD) maxDD = dd;
    });
    const totalReturn = ((capital-capital0)/capital0)*100;
    const mean = returns.length ? returns.reduce((s,r)=>s+r,0)/returns.length : 0;
    const std = returns.length ? Math.sqrt(returns.reduce((s,r)=>s+(r-mean)**2,0)/returns.length) : 0;
    return { finalCapital: capital, totalReturn, maxDD, volatility: std*100, curve };
  }

  document.getElementById('bt-run-btn').addEventListener('click', () => {
    const capital0 = parseFloat(document.getElementById('bt-capital').value)||10000;
    const riskPct  = (parseFloat(document.getElementById('bt-risk').value)||1.5)/100;
    const ops = getHistoryForDir(btActiveDir);
    const st = document.getElementById('bt-status');

    if (ops.length === 0) {
      st.textContent = 'Sin operaciones cerradas en esta categoría — no se puede simular';
      document.getElementById('bt-results').innerHTML = '';
      return;
    }
    st.textContent = `Simulando ${ops.length} operaciones con 4 métodos distintos...`;

    const ratios = calcRatiosFromHistory(ops);
    const kellyFull = ratios?.kelly ?? null;
    const kellyHalf = kellyFull != null ? Math.max(0, kellyFull*0.5) : null;

    // Si Kelly no es calculable, informar con claridad
    const kellyNote = kellyFull == null
      ? ` · <span style="color:var(--amber)">⚠ Kelly no calculable — registra el stop de entrada en tus operaciones para activarlo</span>`
      : ratios?.fromStop ? ` · <span style="color:var(--amber)">pérdida estimada desde stop</span>` : '';
    st.innerHTML = `Backtest sobre ${ops.length} operaciones${kellyNote}`;
    if (kellyFull == null) st.innerHTML += ` — <span style="color:var(--text3)">Kelly se muestra como 0%</span>`;

    const kellyFullVal  = kellyFull  ?? 0;
    const kellyHalfVal  = kellyHalf  ?? 0;

    const methods = [
      {
        name: 'Tu Sizing Real',
        desc: 'Coste real de cada op / capital en ese momento',
        // Para cada operación, el sizing es el % que representó su coste real
        // sobre el capital disponible en ese instante (compuesto desde capital0).
        // Si la operación no tiene coste registrado, fallback a riskPct.
        fn: (op, capital) => op.cost && capital > 0 ? Math.min(op.cost/capital, 1) : riskPct,
        color: 'var(--blue)'
      },
      { name:'Kelly Completo', desc:`f* = ${(kellyFullVal*100).toFixed(1)}%${kellyFull==null?' (sin datos)':''}`, fn: () => kellyFullVal, color:'var(--red)' },
      { name:'Medio Kelly',    desc:`½ × f* = ${(kellyHalfVal*100).toFixed(1)}%${kellyFull==null?' (sin datos)':''}`, fn: () => kellyHalfVal, color:'var(--teal)' },
      { name:'Tamaño Fijo 10%',desc:'10% capital siempre', fn: () => 0.10, color:'var(--amber)' },
    ];

    const results = methods.map(m => ({ ...m, ...simulateMethod(ops, capital0, m.fn) }));
    const best = results.reduce((a,b) => a.totalReturn > b.totalReturn ? a : b);
    const safest = results.reduce((a,b) => a.maxDD < b.maxDD ? a : b);

    const label = btActiveDir==='total' ? 'Total (Alcista + Bajista)' : btActiveDir==='alcista' ? 'Alcista' : 'Bajista';
    st.textContent = `Backtest completado sobre ${ops.length} operaciones reales cerradas · ${label}`;

    const el = document.getElementById('bt-results');
    el.innerHTML = `
      <div class="mm-bt-grid">
        ${results.map(r => `
          <div class="mm-bt-card ${r===best?'best':''}">
            <div class="mm-bt-card-name">
              <span style="color:${r.color}">${r.name}</span>
              ${r===best?'<span class="method-badge recommended">MEJOR RENT.</span>':''}
            </div>
            <div style="font-size:9px;color:var(--text3);margin-bottom:10px;font-family:var(--mono);">${r.desc}</div>
            <div class="mm-bt-metric"><span>Capital Final</span><strong>${fmtE0(r.finalCapital)}</strong></div>
            <div class="mm-bt-metric"><span>Rentabilidad</span><strong style="color:${r.totalReturn>=0?'var(--green)':'var(--red)'}">${r.totalReturn>=0?'+':''}${r.totalReturn.toFixed(1)}%</strong></div>
            <div class="mm-bt-metric"><span>Máx Drawdown</span><strong style="color:var(--red)">-${r.maxDD.toFixed(1)}%</strong></div>
            <div class="mm-bt-metric"><span>Volatilidad</span><strong>${r.volatility.toFixed(1)}%</strong></div>
          </div>`).join('')}
      </div>
      <div style="margin-top:14px;font-size:11px;color:var(--text2);background:var(--surface2);padding:12px 14px;border-radius:8px;line-height:1.6;">
        💡 <strong style="color:var(--teal)">${best.name}</strong> habría dado la mayor rentabilidad (${best.totalReturn.toFixed(1)}%), pero
        <strong style="color:var(--text1)">${safest.name}</strong> habría sido el más seguro (drawdown máx. ${safest.maxDD.toFixed(1)}%).
        Esto ilustra el trade-off clásico: más sizing = más rentabilidad potencial pero también más riesgo de ruina.
      </div>
    `;
  });

  // ════════════════════════════════════════════
  // TAB 4: Límites — con posiciones reales
  // ════════════════════════════════════════════
  document.getElementById('lim-check-btn').addEventListener('click', () => {
    const capital = parseFloat(document.getElementById('lim-capital').value)||10000;
    const maxPos = parseFloat(document.getElementById('lim-maxpos').value)||20;
    const maxSector = parseFloat(document.getElementById('lim-maxsector').value)||35;
    const maxTotal = parseFloat(document.getElementById('lim-maxtotal').value)||90;

    const el = document.getElementById('lim-results');

    if (positions.length === 0) {
      el.innerHTML = `<div class="sc2-empty">Sin posiciones abiertas — añade alguna en el módulo Cartera</div>`;
      return;
    }

    const posValues = positions.map(p => ({
      ticker: p.ticker,
      sector: p.sector || null,
      value: (p.shares && p.entry) ? p.shares*p.entry : (p.cost || 0)
    }));

    const totalExposure = posValues.reduce((s,p)=>s+p.value,0);
    const totalPct = (totalExposure/capital)*100;
    const sectorTotals = {};
    posValues.forEach(p => {
      const key = p.sector || 'Sin sector';
      sectorTotals[key] = (sectorTotals[key]||0)+p.value;
    });

    const statusFor = (val, limit) => val>limit?'bad':val>limit*0.8?'warn':'ok';
    const labelFor = s => s==='ok'?'✓ OK':s==='warn'?'⚠ Cerca':'✗ Excede';

    el.innerHTML = `
      <div class="mm-source-badge real" style="margin-bottom:14px;">✓ Conectado a tus ${positions.length} posiciones abiertas reales</div>
      <div class="mm-limits-grid">
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:10px;">Por Posición</div>
          ${posValues.map(p => {
            const pct = (p.value/capital)*100;
            const st = statusFor(pct, maxPos);
            return `<div class="mm-limit-row"><span>${p.ticker}</span><span style="font-family:var(--mono);">${pct.toFixed(1)}% / ${maxPos}%</span><span class="mm-limit-status ${st}">${labelFor(st)}</span></div>`;
          }).join('')}
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:10px;">Por Sector</div>
          ${Object.entries(sectorTotals).map(([sector,val]) => {
            const pct = (val/capital)*100;
            const st = statusFor(pct, maxSector);
            const label = SECTOR_NAMES[sector] || sector;
            return `<div class="mm-limit-row"><span>${label}</span><span style="font-family:var(--mono);">${pct.toFixed(1)}% / ${maxSector}%</span><span class="mm-limit-status ${st}">${labelFor(st)}</span></div>`;
          }).join('')}
          <div class="mm-limit-row" style="margin-top:8px;border-top:1px solid var(--border);padding-top:14px;">
            <span style="font-weight:700;">Exposición Total</span>
            <span style="font-family:var(--mono);">${totalPct.toFixed(1)}% / ${maxTotal}%</span>
            <span class="mm-limit-status ${statusFor(totalPct,maxTotal)}">${labelFor(statusFor(totalPct,maxTotal))}</span>
          </div>
        </div>
      </div>
    `;
  });

  // ── Tabs principales ─────────────────────────
  container.querySelectorAll('.mm-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.mm-tab').forEach(t=>t.classList.remove('active'));
      container.querySelectorAll('.mm-panel').forEach(p=>p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-'+tab.dataset.tab).classList.add('active');
    });
  });

  return { destroy() {} };
}

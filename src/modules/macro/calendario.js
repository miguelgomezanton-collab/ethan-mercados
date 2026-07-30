import { getMacroData } from './macro-data.js';

// ── Calculadores de fechas ────────────────────
function nthWeekday(year, month, n, weekday) {
  // n-ésimo día de la semana (0=Dom,1=Lun,...,5=Vie) del mes
  let d = new Date(year, month, 1), count = 0;
  while (true) {
    if (d.getDay() === weekday) { count++; if (count === n) return new Date(d); }
    d.setDate(d.getDate() + 1);
  }
}
function lastWeekday(year, month, weekday) {
  let d = new Date(year, month + 1, 0); // último día del mes
  while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
  return d;
}
function fmtDate(d) {
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}
function daysFrom(d) {
  const diff = Math.round((d - new Date()) / 86400000);
  if (diff < 0) return `hace ${-diff}d`;
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  return `en ${diff} días`;
}
function isPast(d) { return d < new Date(); }

function buildCalendar() {
  const now = new Date();
  const events = [];

  // Genera eventos para los próximos 3 meses
  for (let offset = -1; offset <= 3; offset++) {
    const m = (now.getMonth() + offset + 12) % 12;
    const y = now.getFullYear() + Math.floor((now.getMonth() + offset) / 12);

    // CPI USA — segundo miércoles de cada mes a las 14:30 CET (08:30 ET)
    const cpi = nthWeekday(y, m, 2, 3);
    cpi.setHours(14, 30);
    events.push({ date: cpi, name: `CPI USA (${cpi.toLocaleDateString('es-ES',{month:'short',year:'numeric'})})`, stars: 5, cat: 'inflacion', detail: 'Dato de inflación mensual. Mayor driver de mercado junto con Payrolls. Sorpresa ±0.2% → RV ±2%.', impact: 'RV ±2% · Bonos ±1%' });

    // Core PCE — último viernes del mes
    const pce = lastWeekday(y, m, 5);
    pce.setHours(14, 30);
    events.push({ date: pce, name: `Core PCE (${pce.toLocaleDateString('es-ES',{month:'short',year:'numeric'})})`, stars: 4, cat: 'inflacion', detail: 'Indicador de inflación preferido de la Fed. Suele ir alineado con Core CPI.', impact: 'RV ±1% · Fed expectativas' });

    // Payrolls USA — primer viernes del mes
    const nfp = nthWeekday(y, m, 1, 5);
    nfp.setHours(14, 30);
    events.push({ date: nfp, name: `Payrolls USA (${nfp.toLocaleDateString('es-ES',{month:'short',year:'numeric'})})`, stars: 5, cat: 'empleo', detail: 'Creación de empleo no agrícola. Si >250k → Fed más restrictiva. Si <100k → señal de enfriamiento.', impact: 'RV ±1.5% · USD ±0.5%' });

    // PPI — tercer martes del mes
    const ppi = nthWeekday(y, m, 2, 2);
    ppi.setHours(14, 30);
    events.push({ date: ppi, name: `PPI USA (${ppi.toLocaleDateString('es-ES',{month:'short',year:'numeric'})})`, stars: 3, cat: 'inflacion', detail: 'Precios al productor — adelanta presiones en el CPI con 1-2 meses.', impact: 'Moderado' });

    // ISM Manufacturero — primer día hábil del mes
    const ismMfg = new Date(y, m, 2);
    ismMfg.setHours(16, 0);
    events.push({ date: ismMfg, name: `ISM Manufacturero (${ismMfg.toLocaleDateString('es-ES',{month:'short'})})`, stars: 3, cat: 'ciclo', detail: '50 = expansión/contracción. Por debajo de 48 durante 3+ meses = señal de recesión industrial.', impact: 'RV ±0.5%' });

    // FOMC — enero, marzo, mayo, junio, julio, septiembre, noviembre, diciembre
    // Simplificado: 3er miércoles de los meses de reunión
    const fomcMonths = [0, 2, 4, 5, 6, 8, 10, 11];
    if (fomcMonths.includes(m)) {
      const fomc = nthWeekday(y, m, 3, 3);
      fomc.setHours(20, 0); // 14:00 ET = 20:00 CET
      events.push({ date: fomc, name: `FOMC Decision (${fomc.toLocaleDateString('es-ES',{month:'short',year:'numeric'})})`, stars: 5, cat: 'polmon', detail: 'Decisión de tipos + dot plot + rueda de prensa Powell. El mayor catalizador de mercado de forma recurrente.', impact: 'RV ±2-3% · Bonos ±2%' });

      // FOMC Minutes — 3 semanas después
      const minutes = new Date(fomc);
      minutes.setDate(minutes.getDate() + 21);
      events.push({ date: minutes, name: `FOMC Minutes (${minutes.toLocaleDateString('es-ES',{month:'short'})})`, stars: 3, cat: 'polmon', detail: 'Actas de la reunión FOMC. Matices sobre el tono hawkish/dovish del comité.', impact: 'Moderado' });
    }

    // GDP Advance — último día hábil del mes siguiente al trimestre
    if ([0, 3, 6, 9].includes(m)) { // enero, abril, julio, octubre
      const gdp = new Date(y, m, 30);
      gdp.setHours(14, 30);
      events.push({ date: gdp, name: `GDP USA Avance Q${Math.ceil((m)/3)} (${gdp.toLocaleDateString('es-ES',{month:'short'})})`, stars: 4, cat: 'ciclo', detail: 'Primera estimación del PIB. Si < 0 dos trimestres consecutivos → recesión técnica.', impact: 'RV ±1.5%' });
    }
  }

  // Ordenar y filtrar: desde hace 2 semanas hasta 3 meses
  const cutoffPast = new Date(now.getTime() - 14 * 86400000);
  const cutoffFuture = new Date(now.getTime() + 90 * 86400000);
  return events
    .filter(e => e.date >= cutoffPast && e.date <= cutoffFuture)
    .sort((a, b) => a.date - b.date);
}

// ── Colores por categoría ─────────────────────
const CAT_COL = { inflacion: 'var(--red)', empleo: 'var(--green)', polmon: 'var(--teal)', ciclo: 'var(--amber)' };
const CAT_LBL = { inflacion: 'Inflación', empleo: 'Empleo', polmon: 'Pol. Monetaria', ciclo: 'Ciclo' };

function stars(n) { return '★'.repeat(n) + '☆'.repeat(5-n); }

export async function render(container, { actionsSlot }) {
  actionsSlot.innerHTML = `<button class="btn btn-primary" id="cal-refresh">↻ Actualizar</button>`;
  container.innerHTML = `<div id="cal-wrap"><div class="empty"><div class="loader-ring"></div></div></div>`;

  async function load(force = false) {
    try {
      const macro = await getMacroData(force);
      paint(macro);
    } catch(e) {
      document.getElementById('cal-wrap').innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Error</div><div class="empty-desc">${e.message}</div></div>`;
    }
  }

  function paint(macro) {
    const el = document.getElementById('cal-wrap');
    const events = buildCalendar();
    const now = new Date();

    // Próximo evento crítico (★★★★★ en el futuro)
    const nextCritical = events.find(e => e.stars === 5 && !isPast(e.date));
    const nextAny = events.find(e => !isPast(e.date));

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 240px;gap:14px;">
        <div>
          ${events.map(ev => {
            const past = isPast(ev.date);
            const isNext = nextAny && ev.date.getTime() === nextAny.date.getTime();
            const catCol = CAT_COL[ev.cat] || 'var(--text3)';
            return `<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border-radius:8px;border:1px solid ${isNext?'rgba(64,217,192,0.35)':past?'var(--border)':'var(--border)'};background:${isNext?'var(--teal-dim)':past?'transparent':'var(--surface)'};margin-bottom:8px;opacity:${past?'0.45':'1'};">
              <div style="flex-shrink:0;width:90px;">
                <div style="font-family:var(--mono);font-size:9px;color:${isNext?'var(--teal)':past?'var(--text3)':'var(--text2)'};">${fmtDate(ev.date)}</div>
                <div style="font-family:var(--mono);font-size:10px;font-weight:700;color:${isNext?'var(--teal)':past?'var(--text3)':'var(--text1)'};margin-top:2px;">${daysFrom(ev.date)}</div>
              </div>
              <div style="flex:1;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
                  <span style="font-size:12px;font-weight:600;color:${isNext?'var(--teal)':past?'var(--text3)':'var(--text1)'};">${ev.name}</span>
                  <span style="font-size:8px;font-family:var(--mono);font-weight:700;padding:1px 6px;border-radius:8px;background:rgba(${ev.cat==='inflacion'?'244,113,116':ev.cat==='empleo'?'74,222,128':ev.cat==='polmon'?'64,217,192':'251,191,36'},0.1);color:${catCol};">${CAT_LBL[ev.cat]}</span>
                </div>
                <div style="font-size:10px;color:var(--text2);margin-bottom:3px;">${ev.detail}</div>
                <div style="font-size:9px;color:var(--text3);font-family:var(--mono);">Impacto: ${ev.impact}</div>
              </div>
              <div style="flex-shrink:0;text-align:right;">
                <div style="color:var(--amber);letter-spacing:1px;font-size:12px;">${stars(ev.stars)}</div>
                ${isNext?`<div style="font-size:8px;font-family:var(--mono);color:var(--teal);margin-top:3px;">PRÓXIMO</div>`:''}
              </div>
            </div>`;
          }).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;">
          ${nextCritical ? `<div class="mac-card" style="background:var(--teal-dim);border-color:rgba(64,217,192,0.3);text-align:center;">
            <div style="font-family:var(--mono);font-size:9px;color:var(--teal);letter-spacing:0.14em;text-transform:uppercase;margin-bottom:8px;">Próximo Crítico ★★★★★</div>
            <div style="font-family:var(--serif);font-size:18px;font-weight:600;font-style:italic;color:var(--text1);margin-bottom:6px;">${nextCritical.name.split('(')[0].trim()}</div>
            <div style="font-family:var(--mono);font-size:28px;font-weight:700;color:var(--teal);margin:8px 0;">${daysFrom(nextCritical.date)}</div>
            <div style="font-size:10px;color:var(--text2);line-height:1.5;">${fmtDate(nextCritical.date)}</div>
            <div style="font-size:9px;color:var(--text3);margin-top:6px;">${nextCritical.impact}</div>
          </div>` : ''}

          <div class="mac-card">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:10px;">Leyenda</div>
            ${Object.entries(CAT_LBL).map(([k,l])=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:10px;"><div style="width:8px;height:8px;border-radius:50%;background:${CAT_COL[k]};flex-shrink:0;"></div>${l}</div>`).join('')}
            <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">
              <div style="font-size:9px;color:var(--text3);font-family:var(--mono);margin-bottom:4px;">Horas en CET</div>
              <div style="font-size:10px;color:var(--text2);">CPI/PPI/NFP: 14:30<br>FOMC: 20:00<br>ISM: 16:00</div>
            </div>
          </div>

          <div class="mac-card" style="background:var(--surface2);">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:8px;">Score Macro Actual</div>
            <div style="font-family:var(--serif);font-size:36px;font-weight:600;font-style:italic;color:${(macro.scoreTotal??0)>=4?'var(--green)':(macro.scoreTotal??0)>=0?'var(--amber)':'var(--red)'};">${(macro.scoreTotal??0)>=0?'+':''}${macro.scoreTotal??'—'}</div>
            <div style="font-size:11px;color:var(--text2);margin-top:4px;">${macro.zone||'—'}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:6px;line-height:1.5;">Un CPI al alza con score ya negativo = protocolo defensivo inmediato.</div>
          </div>
        </div>
      </div>
      <div class="co-footer" style="margin-top:14px;">Fechas calculadas automáticamente · FOMC, CPI y NFP según calendario oficial aproximado · verificar con fuente oficial antes de operar</div>
    `;
  }

  document.getElementById('cal-refresh')?.addEventListener('click', () => load(true));
  await load(false);
  return { destroy() {} };
}

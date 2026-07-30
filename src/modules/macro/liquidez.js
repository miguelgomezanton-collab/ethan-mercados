import { getMacroData, getManuals, saveManuals } from './macro-data.js';

const f2    = v => v != null ? Number(v).toFixed(2) : '—';
const fsign = v => v != null ? (v>=0?'+':'')+Number(v).toFixed(2) : '—';
const col   = s => s > 0 ? 'var(--green)' : s === 0 ? 'var(--amber)' : 'var(--red)';

function regime(liq) {
  const total = Object.values(liq)
    .filter(i => i?.score != null)
    .reduce((s, i) => s + i.score, 0);
  if (total >= 4)  return { title: 'Liquidez Expansiva',   c: 'var(--green)', sub: 'Combustible para el ciclo', score: total };
  if (total >= 0)  return { title: 'Liquidez Neutral',     c: 'var(--amber)', sub: 'Mixto — selectividad clave', score: total };
  if (total >= -4) return { title: 'Liquidez Contractiva', c: 'var(--red)',   sub: 'El dinero se retira del sistema', score: total };
  return             { title: 'Drenaje Severo',           c: 'var(--red)',   sub: 'Riesgo sistémico — reducir exposición', score: total };
}

function buildPhrase(liq) {
  const parts = [];
  if (liq.m2?.value != null)
    parts.push(liq.m2.value >= 5 ? `El <strong>M2 crece fuerte</strong> (+${f2(liq.m2.value)}% YoY) — combustible para el ciclo` :
      liq.m2.value >= 3 ? `El <strong>M2 crece moderadamente</strong> (+${f2(liq.m2.value)}% YoY)` :
      `El <strong>M2 está por debajo del umbral</strong> (${fsign(liq.m2.value)}% YoY) — presión sobre activos de riesgo`);
  if (liq.impulso?.value != null)
    parts.push(liq.impulso.value >= 1 ? `el <strong>impulso crediticio es fuerte</strong> (+${f2(liq.impulso.value)})` :
      liq.impulso.value >= 0.5 ? `el impulso crediticio es positivo (+${f2(liq.impulso.value)})` :
      `el <strong>impulso crediticio es negativo</strong> (${f2(liq.impulso.value)}) — frena el gasto con 6-9 meses de retardo`);
  if (liq.reservas?.value != null)
    parts.push(liq.reservas.value >= 3.5 ? `las reservas bancarias son abundantes ($${f2(liq.reservas.value)}T)` :
      liq.reservas.value >= 2.5 ? `las reservas están en nivel bajo ($${f2(liq.reservas.value)}T) — QT activo de la Fed` :
      `las <strong>reservas son insuficientes</strong> ($${f2(liq.reservas.value)}T) — riesgo de credit crunch`);
  return parts.join('. ') + (parts.length ? '.' : 'Introduce los datos manuales para obtener el diagnóstico de liquidez.');
}

function centeredBar(value, maxAbs, cPos = 'var(--green)', cNeg = 'var(--red)') {
  const pct = Math.min(Math.abs(value || 0) / maxAbs * 50, 50);
  const isPos = (value || 0) >= 0;
  return `<div style="position:relative;height:8px;background:var(--surface2);border-radius:4px;margin:8px 0 4px;">
    ${isPos ? `<div style="position:absolute;left:50%;width:${pct}%;height:100%;background:${cPos};border-radius:0 4px 4px 0;"></div>`
            : `<div style="position:absolute;right:50%;width:${pct}%;height:100%;background:${cNeg};border-radius:4px 0 0 4px;"></div>`}
    <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:var(--border2);"></div>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:8px;color:var(--text3);font-family:var(--mono);">
    <span style="color:${cNeg}">Contractivo</span><span>0</span><span style="color:${cPos}">Expansivo</span>
  </div>`;
}

function liqCard(icon, title, ind, subtitle, thresholds, signal) {
  if (!ind) return '';
  const c = col(ind.score);
  const displayVal = ind.label === 'Reservas Bancarias Fed'
    ? (ind.value != null ? '$' + f2(ind.value) + 'T' : '—')
    : (ind.value != null ? fsign(ind.value) + '%' : '—');
  const maxAbs = title.includes('Reservas') ? 2 : title.includes('M2') ? 10 : title.includes('Crédito vs') ? 8 : 5;
  const barVal = title.includes('Reservas') ? (ind.value != null ? ind.value - 3 : null) : ind.value;
  return `<div class="co-liq-card">
    <div class="co-liq-card-header">
      <span class="co-liq-card-title">${icon} ${title}</span>
      <span style="font-size:9px;color:var(--text3);font-family:var(--mono);">${ind.date||'—'}${ind.manual?' · ✎':''}</span>
    </div>
    <div style="font-family:var(--serif);font-size:32px;font-weight:600;font-style:italic;color:${c};">${displayVal}</div>
    <div style="font-size:10px;color:var(--text2);font-family:var(--mono);margin-bottom:2px;">${subtitle}</div>
    <div style="font-size:9px;color:var(--text3);font-family:var(--mono);margin-bottom:4px;">${thresholds}</div>
    ${ind.value != null && barVal != null ? centeredBar(barVal, maxAbs) : '<div style="height:8px;background:var(--surface2);border-radius:4px;margin:8px 0 4px;"></div>'}
    <div style="font-size:10px;color:var(--text2);line-height:1.5;margin-top:8px;">${signal(ind.score, ind.value)}</div>
  </div>`;
}

function manualInput(key, label, hint, unit, val) {
  return `<div class="co-manual-row">
    <div><div style="font-size:11px;color:var(--text2);font-weight:600;">${label}</div><div style="font-size:9px;color:var(--text3);">${hint}</div></div>
    <div style="display:flex;align-items:center;gap:6px;">
      <input type="number" class="liq-manual-input" data-key="${key}" value="${val ?? ''}" placeholder="—" step="0.1" style="width:72px;">
      <span style="font-size:10px;color:var(--text3);">${unit}</span>
    </div>
  </div>`;
}

export async function render(container, { actionsSlot }) {
  actionsSlot.innerHTML = `
    <button class="btn" id="liq-edit">✎ Editar manuales</button>
    <button class="btn btn-primary" id="liq-refresh">↻ Actualizar</button>
  `;
  container.innerHTML = `<div id="liq-wrap"><div class="empty"><div class="loader-ring"></div></div></div>`;

  async function load(force = false) {
    try { const m = await getMacroData(force); paint(m); }
    catch(e) { document.getElementById('liq-wrap').innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Error</div><div class="empty-desc">${e.message}</div></div>`; }
  }

  function paint(macro) {
    const el  = document.getElementById('liq-wrap');
    const liq = macro.liquidez || {};
    const reg = regime(liq);
    const man = getManuals();

    el.innerHTML = `
      <!-- HERO -->
      <div class="co-verdict-block" style="margin-bottom:16px;">
        <div class="co-score-wrap">
          <div class="co-score-num" style="color:${reg.c}">${reg.score>=0?'+':''}${reg.score}</div>
          <div class="co-score-max">puntos liq.</div>
          <div class="co-score-gauge"><div class="co-score-gauge-fill" style="width:${Math.max(0,((reg.score+13)/26)*100)}%;background:${reg.c};"></div></div>
        </div>
        <div class="co-verdict-center">
          <div class="co-verdict-label">Régimen de liquidez · ${macro.updatedAt?new Date(macro.updatedAt).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):'—'}</div>
          <div class="co-verdict-title" style="color:${reg.c}">${reg.title}</div>
          <div class="co-verdict-phrase">${buildPhrase(liq)}</div>
        </div>
        <div class="co-verdict-right">
          ${liq.m2?.value!=null?`<div class="co-verdict-mini"><div class="co-verdict-mini-label">M2 Global</div><div class="co-verdict-mini-val" style="color:${col(liq.m2.score)}">${fsign(liq.m2.value)}%</div><div class="co-verdict-mini-sub">YoY · ×3</div></div>`:''}
          ${liq.reservas?.value!=null?`<div class="co-verdict-mini"><div class="co-verdict-mini-label">Reservas Fed</div><div class="co-verdict-mini-val" style="color:${col(liq.reservas.score)}">$${f2(liq.reservas.value)}T</div><div class="co-verdict-mini-sub">${liq.reservas.score>0?'>$3.5T':liq.reservas.score===-1?'$2.5-3.4T':'<$2.5T'}</div></div>`:''}
        </div>
      </div>

      <!-- PANEL MANUALES -->
      <div id="liq-manual-panel" style="display:none;background:var(--surface);border:1px dashed var(--border2);border-radius:12px;padding:18px 20px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">✎ Input Manual — China M2</div>
        <div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-bottom:14px;">
          USA (FRED), Eurozona (ECB) y Japón (BOJ) son ahora <strong style="color:var(--teal)">100% automáticos</strong>.
          Solo China M2 YoY requiere input manual — el PBoC no tiene API pública gratuita estable.
          Sin este dato, el M2 Global se calcula con 3 regiones (~70% del total).
        </div>
        ${manualInput('chinaM2', 'China M2 YoY (%)', 'Fuente: PBoC · publicación mensual · peso ~30% del M2 Global', '%', man.chinaM2)}
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button class="btn btn-primary" id="liq-save-manuals">Guardar y actualizar</button>
          <button class="btn" id="liq-close-manuals">Cancelar</button>
        </div>
      </div>

      <!-- GRID 6 CARDS -->
      <div class="co-liq-grid3">
        ${liqCard('💵','M2 Global (USA+EUR+JPN)', liq.m2,
          liq.m2?.auto
            ? `${liq.m2.coverage||''} · USA: ${liq.m2.components?.usYoY!=null?(liq.m2.components.usYoY>=0?'+':'')+f2(liq.m2.components.usYoY)+'%':'—'} · EUR: ${liq.m2.components?.eurYoY!=null?(liq.m2.components.eurYoY>=0?'+':'')+f2(liq.m2.components.eurYoY)+'%':'—'} · JPN: ${liq.m2.components?.jpYoY!=null?(liq.m2.components.jpYoY>=0?'+':'')+f2(liq.m2.components.jpYoY)+'%':'—'}`
            : 'YoY — estimado global (Fed+ECB+PBOC+BoJ)',
          '≥+5.0%→+3  ·  +3.0-4.9%→+1  ·  <+3.0%→−3  ·  peso ×3',
          (s, v) => s > 0 ? `<strong style="color:var(--green)">+${s} pts.</strong> M2 creciendo — combustible para el ciclo y expansión de múltiplos.` :
            s === 0 ? `<strong style="color:var(--amber)">0 pts.</strong> M2 entre +3% y +5% — ciclo sostenido pero sin exceso monetario.` :
            v != null ? `<strong style="color:var(--red)">${s} pts.</strong> M2 bajo umbral — presión sobre activos de riesgo con 6-12m de retardo.` :
            `Sin datos automáticos aún. Introduce China M2 YoY% con "Editar manuales" para completar el cálculo.`)}

        ${liqCard('📈','Crédito vs Nominal GDP', liq.credito,
          liq.credito?.auto
            ? `Crédito YoY: ${liq.credito.creditYoY!=null?(liq.credito.creditYoY>=0?'+':'')+f2(liq.credito.creditYoY)+'%':'—'} · GDP YoY: ${liq.credito.gdpYoY!=null?'+'+f2(liq.credito.gdpYoY)+'%':'—'} · FRED TOTLL vs GDP`
            : 'Crecimiento crédito − Crecimiento nominal GDP',
          '≥+3.0%→+3  ·  +1.5-2.9%→0  ·  <+1.5%→−3  ·  peso ×3',
          (s, v) => s > 0 ? `<strong style="color:var(--green)">+${s} pts.</strong> Crédito crece más que el nominal — expansión financiera saludable.` :
            s === 0 ? `<strong style="color:var(--amber)">0 pts.</strong> Crédito alineado con el nominal — ciclo estable.` :
            `<strong style="color:var(--red)">${s} pts.</strong> Crédito crece menos que el nominal — desapalancamiento en curso.`)}

        ${liqCard('⚡','Impulso Crediticio', liq.impulso,
          liq.impulso?.auto
            ? `Aceleración TOTLL: YoY ahora ${liq.impulso.yoyNow!=null?(liq.impulso.yoyNow>=0?'+':'')+f2(liq.impulso.yoyNow)+'%':'—'} vs hace 3m ${liq.impulso.yoy3mAgo!=null?(liq.impulso.yoy3mAgo>=0?'+':'')+f2(liq.impulso.yoy3mAgo)+'%':'—'} · FRED TOTLL`
            : 'Aceleración del crédito — anticipa gasto con 6-9 meses',
          '≥+1.0→+2  ·  +0.5-0.9→+1  ·  <+0.5→−2  ·  peso ×2',
          (s, v) => s >= 2 ? `<strong style="color:var(--green)">+2 pts.</strong> Impulso fuerte — expansión de demanda en 6-9 meses.` :
            s === 1 ? `<strong style="color:var(--green)">+1 pt.</strong> Impulso positivo moderado.` :
            `<strong style="color:var(--red)">${s} pts.</strong> Impulso negativo — contracción del gasto con retardo.`)}

        ${liqCard('🔄','Velocidad M2', liq.velM2, 'YoY · FRED M2V (trimestral) · automático',
          '≥0%→+2  ·  −1.5 a −0.1%→−1  ·  <−1.5%→−2  ·  peso ×2',
          (s, v) => s >= 2 ? `<strong style="color:var(--green)">+2 pts.</strong> ≥0% — el dinero circula activamente. El M2 se traduce en actividad económica real.` :
            s === -1 ? `<strong style="color:var(--amber)">−1 pt.</strong> Entre −1.5% y −0.1% — velocidad cayendo ligeramente. El dinero se acumula en vez de circular.` :
            `<strong style="color:var(--red)">−2 pts.</strong> <−1.5% — velocidad muy baja. Bancos no prestan, empresas no invierten, consumidores no gastan. Señal de estancamiento aunque haya mucho M2.`)}

        ${liqCard('🏦','Reservas Bancarias Fed', liq.reservas, 'Valor absoluto en $T · FRED WRESBAL (semanal) · automático',
          '≥$3.5T→+1  ·  $2.5-3.4T→−1  ·  <$2.5T→−2  ·  peso ×1',
          (s, v) => s > 0 ? `<strong style="color:var(--green)">+1 pt.</strong> ≥$3.5T — liquidez abundante. Los bancos tienen amplia capacidad prestadora.` :
            s === -1 ? `<strong style="color:var(--amber)">−1 pt.</strong> $2.5-3.4T — reservas en zona baja. QT activo de la Fed — menos liquidez en el sistema.` :
            `<strong style="color:var(--red)">−2 pts.</strong> <$2.5T — reservas insuficientes. La Fed está drenando agresivamente. Riesgo de contracción crediticia sistémica.`)}

        ${liq.bbb ? `<div class="co-liq-card">
          <div class="co-liq-card-header"><span class="co-liq-card-title">📊 BBB Spread</span><span style="font-size:9px;color:var(--text3);font-family:var(--mono);">${liq.bbb.date||'—'}</span></div>
          <div style="font-family:var(--serif);font-size:32px;font-weight:600;font-style:italic;color:${col(liq.bbb.score)};">${f2(liq.bbb.value)}%</div>
          <div style="font-size:10px;color:var(--text2);font-family:var(--mono);margin-bottom:2px;">OAS · FRED BAMLC0A4CBBB</div>
          <div style="font-size:9px;color:var(--text3);font-family:var(--mono);margin-bottom:4px;">≤1.00%→+1  ·  1.00-1.50%→0  ·  >1.50%→−1  ·  peso ×1</div>
          <div class="co-ind-bar-track" style="margin:8px 0 4px;"><div class="co-ind-bar-fill" style="width:${Math.min(liq.bbb.value/4*100,100)}%;background:${col(liq.bbb.score)};"></div></div>
          <div style="font-size:10px;color:var(--text2);line-height:1.5;margin-top:8px;">
            ${liq.bbb.score>0?'<strong style="color:var(--green)">+1 pt.</strong> ≤1.00% — mercado tranquilo, acceso barato al crédito corporativo.':
              liq.bbb.score===0?'<strong style="color:var(--amber)">0 pts.</strong> 1.00-1.50% — neutral, coste de crédito moderado.':
              '<strong style="color:var(--red)">−1 pt.</strong> >1.50% — estrés crediticio, prima de riesgo corporativo elevada.'}
          </div>
        </div>` : ''}
      </div>

      <!-- IMPLICACIONES -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px 22px;margin-top:16px;">
        <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">💡 Implicaciones para la estrategia</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">
          <div style="background:var(--surface2);border-radius:8px;padding:12px 14px;"><div style="font-size:10px;font-weight:700;color:${reg.c};margin-bottom:6px;text-transform:uppercase;">Renta Variable</div><div style="font-size:11px;color:var(--text2);line-height:1.5;">${reg.score>=4?'Liquidez expansiva favorece expansión de múltiplos. Entorno propicio para posiciones largas.':reg.score>=0?'Liquidez mixta. Selectividad: calidad sobre momentum.':'Liquidez contractiva presiona valoraciones. Preferir FCF alto y calidad sobre growth.'}</div></div>
          <div style="background:var(--surface2);border-radius:8px;padding:12px 14px;"><div style="font-size:10px;font-weight:700;color:var(--amber);margin-bottom:6px;text-transform:uppercase;">Renta Fija</div><div style="font-size:11px;color:var(--text2);line-height:1.5;">${reg.score>=0?'Spreads contenidos favorecen IG. Duration media acceptable.':'QT + spreads ampliando. Duration corta o flotantes. IG estricto sobre HY.'}</div></div>
          <div style="background:var(--surface2);border-radius:8px;padding:12px 14px;"><div style="font-size:10px;font-weight:700;color:var(--blue);margin-bottom:6px;text-transform:uppercase;">Sizing</div><div style="font-size:11px;color:var(--text2);line-height:1.5;">${reg.score>=4?'Liquidez favorable. Sizing normal, stops amplios.':reg.score>=0?'Sizing moderado. Stops ajustados.':'Sizing conservador. Esperar M2>+3% para aumentar exposición.'}</div></div>
        </div>
      </div>

      <div class="co-footer" style="margin-top:16px;">Fuentes: FRED (M2SL, M2V, WRESBAL, BAMLC0A4CBBB, TOTLL, GDP, USSLIND) · ECB (M2 EUR, Curva EUR) · BOJ API (M2 JPN) · China M2: input manual mensual (PBoC)</div>
    `;

    // Eventos manuales
    document.getElementById('liq-save-manuals')?.addEventListener('click', () => {
      const man = getManuals();
      document.querySelectorAll('.liq-manual-input').forEach(inp => {
        const v = inp.value.trim();
        man[inp.dataset.key] = v !== '' ? parseFloat(v) : null;
      });
      saveManuals(man);
      document.getElementById('liq-manual-panel').style.display = 'none';
      load(true);
    });
    document.getElementById('liq-close-manuals')?.addEventListener('click', () => {
      document.getElementById('liq-manual-panel').style.display = 'none';
    });
  }

  document.getElementById('liq-refresh')?.addEventListener('click', () => load(true));
  document.getElementById('liq-edit')?.addEventListener('click', () => {
    const p = document.getElementById('liq-manual-panel');
    if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
  });

  await load(false);
  return { destroy() {} };
}

import { getMacroData } from './macro-data.js';

const f2 = v => v != null ? Number(v).toFixed(2) : '—';
const f1 = v => v != null ? Number(v).toFixed(1) : '—';
const fsign = v => v != null ? (v>=0?'+':'')+Number(v).toFixed(2) : '—';
function fgCol(v) { return v>75?'var(--green)':v>55?'var(--amber)':v>45?'var(--text2)':v>25?'var(--amber)':'var(--red)'; }

function indRow(label, value, pct, c, signal, date) {
  return `<div class="co-ind-item">
    <div class="co-ind-row"><span class="co-ind-name">${label}</span><span class="co-ind-val" style="color:${c}">${value}</span></div>
    <div class="co-ind-bar-track"><div class="co-ind-bar-fill" style="width:${Math.min(Math.max(pct,0),100)}%;background:${c};"></div></div>
    <div class="co-ind-signal"><span class="co-ind-dot" style="background:${c}"></span>${signal}<span class="co-ind-date">${date||''}</span></div>
  </div>`;
}
function centeredRow(label, value, pct, c, signal, date) {
  const isPos = (value || 0) >= 0;
  return `<div class="co-ind-item">
    <div class="co-ind-row"><span class="co-ind-name">${label}</span><span class="co-ind-val" style="color:${c}">${fsign(value)}%</span></div>
    <div style="position:relative;height:7px;background:var(--surface2);border-radius:4px;margin:5px 0 3px;">
      ${isPos?`<div style="position:absolute;left:50%;width:${Math.min(pct,50)}%;height:100%;background:${c};border-radius:0 4px 4px 0;"></div>`:`<div style="position:absolute;right:50%;width:${Math.min(pct,50)}%;height:100%;background:${c};border-radius:4px 0 0 4px;"></div>`}
      <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:var(--border2);"></div>
    </div>
    <div class="co-ind-signal"><span class="co-ind-dot" style="background:${c}"></span>${signal}<span class="co-ind-date">${date||''}</span></div>
  </div>`;
}

export async function render(container, { actionsSlot }) {
  actionsSlot.innerHTML = `<button class="btn btn-primary" id="seg-refresh">↻ Actualizar</button>`;
  container.innerHTML = `<div id="seg-wrap"><div class="empty"><div class="loader-ring"></div></div></div>`;

  async function load(force = false) {
    try { const m = await getMacroData(force); paint(m); }
    catch(e) { document.getElementById('seg-wrap').innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Error</div><div class="empty-desc">${e.message}</div></div>`; }
  }

  function paint(macro) {
    const el  = document.getElementById('seg-wrap');
    const seg = macro.seguimiento || {};
    const fg  = macro.indicators?.fearGreed;
    const vix = seg.vix;
    const wti = seg.wti, brent = seg.brent;
    const t10 = seg.t10y, t2 = seg.t2y, ffr = seg.ffr;
    const bbb = seg.bbb, hy = seg.hySpread, spr = seg.t10y2y;
    const be1 = seg.breakeven1y, be5 = seg.breakeven5y;

    const fgVal  = fg?.value ?? 50;
    const fgC    = fgCol(fgVal);
    const fgA    = (fgVal / 100) * Math.PI;
    const fgX    = 100 + 72 * Math.cos(Math.PI - fgA);
    const fgY    = 100 - 72 * Math.sin(fgA);

    // VIX con SMA200
    const vixFull = vix;
    const vixAbove = vixFull?.aboveSMA200;

    el.innerHTML = `
      <!-- HERO: Fear & Greed + snapshots rápidos -->
      <div class="co-alert-hero" style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
          <div style="flex-shrink:0;">
            <svg viewBox="0 0 200 115" style="width:185px;">
              <path d="M 28 100 A 72 72 0 0 1 172 100" fill="none" stroke="var(--surface2)" stroke-width="14" stroke-linecap="round"/>
              <path d="M 28 100 A 72 72 0 0 1 172 100" fill="none" stroke="url(#fgG2)" stroke-width="14" stroke-linecap="round"
                stroke-dasharray="${(Math.PI*72).toFixed(1)}" stroke-dashoffset="${(Math.PI*72*(1-fgVal/100)).toFixed(1)}"/>
              <defs><linearGradient id="fgG2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="var(--red)"/><stop offset="50%" stop-color="var(--amber)"/><stop offset="100%" stop-color="var(--green)"/>
              </linearGradient></defs>
              <line x1="100" y1="100" x2="${fgX.toFixed(1)}" y2="${fgY.toFixed(1)}" stroke="var(--teal)" stroke-width="2.5" stroke-linecap="round"/>
              <circle cx="100" cy="100" r="5" fill="var(--teal)"/>
              <text x="100" y="82" text-anchor="middle" font-family="IBM Plex Mono" font-size="22" font-weight="700" fill="${fgC}">${fgVal}</text>
              <text x="100" y="100" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="var(--text2)">${fg?.label_text||fg?.label||'—'}</text>
              <text x="28" y="114" text-anchor="middle" font-family="IBM Plex Mono" font-size="8" fill="var(--red)">Fear</text>
              <text x="172" y="114" text-anchor="middle" font-family="IBM Plex Mono" font-size="8" fill="var(--green)">Greed</text>
            </svg>
            ${fg ? `<div style="display:flex;gap:5px;justify-content:center;font-size:9px;font-family:var(--mono);color:var(--text3);margin-top:3px;">
              <span>1d: ${fg.previousClose??'—'}</span><span>·</span><span>1s: ${fg.previousWeek??'—'}</span><span>·</span><span>1m: ${fg.previousMonth??'—'}</span>
            </div>` : ''}
            <div style="font-size:9px;text-align:center;color:var(--text3);font-family:var(--mono);margin-top:4px;">
              ${fg?.score!=null&&fg.score<40?'Score<40 → +1 (miedo=oportunidad)':fg?.score!=null&&fg.score>54?'Score>54 → −1 (euforia=riesgo)':'Score 40-54 → 0 (neutral)'}
            </div>
          </div>
          <div style="flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;min-width:240px;">
            ${vixFull?`<div class="co-verdict-mini ${vixAbove?'':''}">
              <div class="co-verdict-mini-label">VIX ${vixAbove?'⚠ SOBRE':'↓ BAJO'} SMA200</div>
              <div class="co-verdict-mini-val" style="color:${vixAbove?'var(--red)':'var(--green)'}">${f1(vixFull.value)}</div>
              <div class="co-verdict-mini-sub">SMA200: ${f1(vixFull.sma200)}</div>
            </div>`:''}
            ${wti?`<div class="co-verdict-mini"><div class="co-verdict-mini-label">WTI</div><div class="co-verdict-mini-val" style="color:${wti.change>=0?'var(--green)':'var(--red)'}">$${f1(wti.value)}</div><div class="co-verdict-mini-sub">${(wti.change>=0?'+':'')+f1(wti.change)}%</div></div>`:''}
            ${brent?`<div class="co-verdict-mini"><div class="co-verdict-mini-label">Brent</div><div class="co-verdict-mini-val" style="color:${brent.change>=0?'var(--green)':'var(--red)'}">$${f1(brent.value)}</div><div class="co-verdict-mini-sub">${(brent.change>=0?'+':'')+f1(brent.change)}%</div></div>`:''}
          </div>
        </div>
        ${vixFull?.aboveSMA200 ? `<div style="margin-top:12px;padding:8px 14px;background:rgba(244,113,116,0.08);border:1px solid rgba(244,113,116,0.25);border-radius:8px;font-size:11px;color:var(--red);font-family:var(--mono);">⚠ ALERTA VOLATILIDAD — VIX (${f1(vixFull.value)}) por encima de su SMA200 (${f1(vixFull.sma200)}) → señal bajista</div>` : ''}
      </div>

      <!-- GRID 2 COLUMNAS -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">

        <!-- Tipos de Interés -->
        <div class="co-ind-group">
          <div class="co-ind-group-header"><span class="co-ind-group-title">💵 Tipos de Interés</span><span class="co-ind-group-score co-score-neu">FRED · diario</span></div>
          ${t10?indRow('10Y Treasury',f2(t10.value)+'%',Math.min(t10.value/8*100,100),t10.value>4.5?'var(--red)':t10.value>3.5?'var(--amber)':'var(--green)',t10.value>4.5?'>4.50% — stress financiero, vigilar':'Zona de normalidad',t10.date):''}
          ${t2?indRow('2Y Treasury',f2(t2.value)+'%',Math.min(t2.value/8*100,100),'var(--amber)','Refleja expectativas de Fed a 2 años',t2.date):''}
          ${ffr?indRow('Fed Funds Rate',f2(ffr.value)+'%',Math.min(ffr.value/8*100,100),ffr.value>4?'var(--amber)':'var(--green)',ffr.value>4?'Política restrictiva':'Política acomodaticia',ffr.date):''}
          ${spr?centeredRow('T10Y−2Y Spread',spr.value,Math.abs(spr.value)*50,spr.value<0?'var(--red)':spr.value>=0.48?'var(--green)':'var(--amber)',spr.value<0?'Curva invertida — alerta recesión':spr.value>=0.9?'≥+0.90% — optimismo de crecimiento':'Neutral (+0.48% a +0.89%)',spr.date):''}
        </div>

        <!-- Spreads de Crédito -->
        <div class="co-ind-group">
          <div class="co-ind-group-header"><span class="co-ind-group-title">📊 Spreads de Crédito</span><span class="co-ind-group-score co-score-neu">FRED · diario</span></div>
          ${bbb?indRow('BBB Corporate Spread',f2(bbb.value)+'%',Math.min(bbb.value/4*100,100),bbb.value<=1?'var(--green)':bbb.value<=1.5?'var(--amber)':'var(--red)',bbb.value<=1?'≤1.00% → +1 (mercado tranquilo)':bbb.value<=1.5?'1.00-1.50% → 0 (neutral)':'>1.50% → −1 (estrés crediticio)',bbb.date):''}
          ${hy?indRow('High Yield Spread',f2(hy.value)+'%',Math.min(hy.value/12*100,100),hy.value<3.5?'var(--green)':hy.value<5?'var(--amber)':'var(--red)',hy.value<3.5?'Sin estrés':hy.value<5?'Alerta incipiente':'Estrés severo — vigilar RV',hy.date):''}
        </div>

        <!-- Inflación Esperada (breakevens) -->
        <div class="co-ind-group">
          <div class="co-ind-group-header"><span class="co-ind-group-title">🌡️ Inflación Esperada (Breakevens)</span><span class="co-ind-group-score co-score-neu">FRED · diario</span></div>
          ${be1?indRow('Breakeven 1Y (T1YIE)',f2(be1.value)+'%',Math.min(be1.value/6*100,100),be1.value>3?'var(--red)':be1.value>2.5?'var(--amber)':'var(--green)',be1.value>3?'Inflación persistente esperada — alerta':be1.value>2?'Por encima del objetivo':'Anclada cerca del 2%',be1.date):'<div class="co-ind-item" style="color:var(--text3);font-size:11px;">Sin datos T1YIE</div>'}
          ${be5?indRow('Breakeven 5Y (T5YIE)',f2(be5.value)+'%',Math.min(be5.value/5*100,100),be5.value>2.8?'var(--red)':be5.value>2.3?'var(--amber)':'var(--green)',be5.value<=2.3?'Anclada — inflación transitoria según mercado':'Desanclaje de expectativas a largo plazo',be5.date):''}
          <div style="font-size:10px;color:var(--text3);margin-top:8px;line-height:1.5;border-top:1px solid var(--border);padding-top:8px;">
            <strong style="color:var(--text2)">Interpretación:</strong> 1Y capta el shock inmediato. 5Y indica si el mercado cree que el shock es transitorio o estructural. Si ambas suben = inflación estructural.
          </div>
        </div>

        <!-- VIX + Energía -->
        <div class="co-ind-group">
          <div class="co-ind-group-header"><span class="co-ind-group-title">📉 Volatilidad & Energía</span><span class="co-ind-group-score co-score-neu">Yahoo Finance · tiempo real</span></div>
          ${vixFull?`<div class="co-ind-item">
            <div class="co-ind-row"><span class="co-ind-name">VIX vs SMA200</span><span class="co-ind-val" style="color:${vixFull.aboveSMA200?'var(--red)':'var(--green)'}">${f1(vixFull.value)}</span></div>
            <div class="co-ind-bar-track"><div class="co-ind-bar-fill" style="width:${Math.min(vixFull.value/60*100,100)}%;background:${vixFull.aboveSMA200?'var(--red)':'var(--green)'};"></div></div>
            <div class="co-ind-signal"><span class="co-ind-dot" style="background:${vixFull.aboveSMA200?'var(--red)':'var(--green)'}"></span>${vixFull.signal}</div>
          </div>`:''}
          ${wti?indRow('WTI (CL=F)','$'+f1(wti.value),Math.min(wti.value/150*100,100),wti.value<60?'var(--green)':wti.value<90?'var(--amber)':'var(--red)',wti.value<60?'Precio bajo — deflacionario':wti.value<90?'Moderado':'Alto — inflacionario',null):''}
          ${brent?indRow('Brent (BZ=F)','$'+f1(brent.value),Math.min(brent.value/150*100,100),brent.value<65?'var(--green)':brent.value<95?'var(--amber)':'var(--red)',brent.value<65?'Precio bajo':'Brent moderado-alto',null):''}
        </div>
      </div>

      <div class="co-footer">Fuentes: FRED (DGS10, DGS2, DFF, BAMLC0A4CBBB, BAMLH0A0HYM2, T1YIE, T5YIE) · CNN Fear & Greed · Yahoo Finance (VIX 200 sesiones, WTI, Brent)</div>
    `;
  }

  document.getElementById('seg-refresh')?.addEventListener('click', () => load(true));
  await load(false);
  return { destroy() {} };
}

import { getMacroData } from './macro-data.js';
const f2=v=>v!=null?Number(v).toFixed(2):'—';

export async function render(container,{actionsSlot}){
  actionsSlot.innerHTML=`<button class="btn btn-primary" id="pm-refresh">↻ Actualizar</button>`;
  container.innerHTML=`<div id="pm-wrap"><div class="empty"><div class="loader-ring"></div></div></div>`;
  async function load(force=false){
    try{const m=await getMacroData(force);paint(m);}
    catch(e){document.getElementById('pm-wrap').innerHTML=`<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Error</div><div class="empty-desc">${e.message}</div></div>`;}
  }
  function paint(macro){
    const el=document.getElementById('pm-wrap');
    const co=macro.coyuntura||{};
    const seg=macro.seguimiento||{};
    const liq=macro.liquidez||{};
    const ind=macro.indicators||{};
    const tr=co.tipoReal,ffr=seg.ffr,res=liq.reservas,bbb=liq.bbbSpread;
    // Stance 0-100
    const stance=tr?.value!=null?Math.min(100,Math.max(0,((tr.value+3)/6)*100)):50;
    const stanceLabel=stance>70?'Muy Restrictiva':stance>55?'Restrictiva':stance>45?'Neutral':stance>30?'Acomodaticia':'Muy Acomodaticia';
    const stanceCol=stance>70?'var(--red)':stance>55?'var(--amber)':stance>45?'var(--text2)':'var(--green)';

    el.innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 260px;gap:14px;margin-bottom:14px;">
        <div>
          <!-- Stance bar -->
          <div class="mac-card" style="margin-bottom:12px;">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:10px;">Stance de Política Monetaria</div>
            <div style="font-family:var(--serif);font-size:24px;font-style:italic;color:${stanceCol};margin-bottom:10px;">${stanceLabel}</div>
            <div style="height:14px;background:var(--surface2);border-radius:7px;overflow:hidden;position:relative;margin-bottom:6px;">
              <div style="height:100%;width:100%;background:linear-gradient(90deg,var(--green),var(--amber) 40%,var(--red));border-radius:7px;"></div>
              <div style="position:absolute;top:50%;left:${stance}%;transform:translate(-50%,-50%);width:4px;height:18px;background:var(--text1);border-radius:2px;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text3);font-family:var(--mono);margin-bottom:12px;"><span>Muy Acomodaticia</span><span>Neutral</span><span>Muy Restrictiva</span></div>
            <div style="font-size:11px;color:var(--text2);line-height:1.7;">${tr?.value!=null?`El <strong style="color:var(--text1)">tipo real de ${tr.value>=0?'+':''}${f2(tr.value)}%</strong> indica política ${tr.value>=1?'muy restrictiva':tr.value>=0.5?'restrictiva':'acomodaticia'}. Históricamente, tipos reales >+1.5% durante >6 meses han precedido recesión en el 78% de los casos.`:'Sin datos de tipo real disponibles.'}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <!-- FFR -->
            <div class="mac-card">
              <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:8px;">Fed Funds Rate <span style="float:right;color:var(--teal)">AUTO</span></div>
              <div style="font-family:var(--serif);font-size:32px;font-weight:600;font-style:italic;color:var(--amber);">${ffr?.value!=null?f2(ffr.value)+'%':'—'}</div>
              <div style="height:5px;background:var(--surface2);border-radius:3px;overflow:hidden;margin:8px 0 4px;"><div style="height:100%;width:${ffr?.value!=null?Math.min(ffr.value/8*100,100):0}%;background:var(--amber);border-radius:3px;"></div></div>
              <div style="font-size:9px;color:var(--text3);font-family:var(--mono);">${ffr?.date||'—'}</div>
              <div style="font-size:10px;color:var(--text2);margin-top:6px;line-height:1.5;">${ffr?.value!=null&&ffr.value>4?'Tipos restrictivos — presiona consumo e inversión':'Tipos en zona acomodaticia'}</div>
            </div>
            <!-- Tipo Real -->
            <div class="mac-card">
              <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:8px;">Tipo Real (FFR − CPI) <span style="float:right;color:var(--teal)">AUTO</span></div>
              <div style="font-family:var(--serif);font-size:32px;font-weight:600;font-style:italic;color:${tr?.score>0?'var(--green)':tr?.score===0?'var(--amber)':'var(--red)'};">${tr?.value!=null?(tr.value>=0?'+':'')+f2(tr.value)+'%':'—'}</div>
              <div style="position:relative;height:5px;background:var(--surface2);border-radius:3px;margin:8px 0 4px;">
                ${tr?.value!=null&&tr.value>=0?`<div style="position:absolute;left:50%;width:${Math.min(tr.value*20,50)}%;height:100%;background:${tr.score>0?'var(--green)':'var(--amber)'};border-radius:0 3px 3px 0;"></div>`:''}
                ${tr?.value!=null&&tr.value<0?`<div style="position:absolute;right:50%;width:${Math.min(Math.abs(tr.value)*20,50)}%;height:100%;background:var(--red);border-radius:3px 0 0 3px;"></div>`:''}
                <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:var(--border2);"></div>
              </div>
              <div style="font-size:9px;color:var(--text3);font-family:var(--mono);margin-bottom:4px;">≥+1.0%→+1 · +0.5-0.9%→0 · <+0.5%→−1 · peso ×1</div>
              <div style="font-size:10px;color:var(--text2);line-height:1.5;">${tr?.score>0?'Política neutral-restrictiva — no estimula la economía':tr?.score===0?'Zona neutral':tr?.value!=null?'< +0.5% → excesivamente restrictivo o inflación desbocada':'Sin datos'}</div>
            </div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;">
          <!-- Reservas -->
          <div class="mac-card">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:8px;">Reservas Bancarias Fed <span style="float:right;color:var(--teal)">AUTO</span></div>
            <div style="font-family:var(--serif);font-size:28px;font-weight:600;font-style:italic;color:${res?.score>0?'var(--green)':res?.score===0?'var(--amber)':'var(--red)'};">${res?.value!=null?'$'+f2(res.value)+'T':'—'}</div>
            <div style="height:5px;background:var(--surface2);border-radius:3px;overflow:hidden;margin:8px 0 4px;"><div style="height:100%;width:${res?.value!=null?Math.min(res.value/5*100,100):0}%;background:${res?.score>0?'var(--green)':res?.score===0?'var(--amber)':'var(--red)'};border-radius:3px;"></div></div>
            <div style="font-size:9px;color:var(--text3);font-family:var(--mono);margin-bottom:6px;">≥$3.5T→+1 · $2.5-3.4T→−1 · <$2.5T→−2</div>
            <div style="font-size:10px;color:var(--text2);line-height:1.5;">${res?.score>0?'Liquidez bancaria abundante':res?.score===-1?'QT activo — capacidad prestadora reducida':'Reservas insuficientes — riesgo credit crunch'}</div>
          </div>
          <!-- BBB Spread -->
          <div class="mac-card">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:8px;">BBB Corporate Spread <span style="float:right;color:var(--teal)">AUTO</span></div>
            <div style="font-family:var(--serif);font-size:28px;font-weight:600;font-style:italic;color:${bbb?.score>0?'var(--green)':bbb?.score===0?'var(--amber)':'var(--red)'};">${bbb?.value!=null?f2(bbb.value)+'%':'—'}</div>
            <div style="height:5px;background:var(--surface2);border-radius:3px;overflow:hidden;margin:8px 0 4px;"><div style="height:100%;width:${bbb?.value!=null?Math.min(bbb.value/4*100,100):0}%;background:${bbb?.score>0?'var(--green)':bbb?.score===0?'var(--amber)':'var(--red)'};border-radius:3px;"></div></div>
            <div style="font-size:9px;color:var(--text3);font-family:var(--mono);margin-bottom:6px;">≤1.00%→+1 · 1.00-1.50%→0 · >1.50%→−1</div>
            <div style="font-size:10px;color:var(--text2);line-height:1.5;">${bbb?.score>0?'Mercado tranquilo — coste de crédito bajo':bbb?.score===0?'Neutral':'Estrés crediticio — prime de riesgo elevada'}</div>
          </div>
          <!-- Ventana contagio -->
          <div class="mac-card" style="background:var(--surface2);">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:8px;">Ventana de Contagio Inflacionario</div>
            <div style="display:flex;gap:4px;">
              <div style="flex:1;background:rgba(74,222,128,0.1);border-radius:4px;padding:6px;text-align:center;font-size:8px;font-family:var(--mono);"><div style="color:var(--green)">0-3m</div><div style="color:var(--text3);margin-top:2px;">Seguro</div></div>
              <div style="flex:1;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.3);border-radius:4px;padding:6px;text-align:center;font-size:8px;font-family:var(--mono);"><div style="color:var(--amber)">3-6m</div><div style="color:var(--text3);margin-top:2px;">⚠ Riesgo</div></div>
              <div style="flex:1;background:rgba(244,113,116,0.1);border-radius:4px;padding:6px;text-align:center;font-size:8px;font-family:var(--mono);"><div style="color:var(--red)">6m+</div><div style="color:var(--text3);margin-top:2px;">Estructural</div></div>
            </div>
          </div>
        </div>
      </div>
      <div class="co-footer">Fuentes: FRED (DFF, DGS10, DGS2, CPIAUCSL, WRESBAL, BAMLC0A4CBBB)</div>
    `;
  }
  document.getElementById('pm-refresh')?.addEventListener('click',()=>load(true));
  await load(false);
  return{destroy(){}};
}

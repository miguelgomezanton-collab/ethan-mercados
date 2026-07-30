import { getMacroData, getManuals, saveManuals } from './macro-data.js';
const f2=v=>v!=null?Number(v).toFixed(2):'—';
const fsign=v=>v!=null?(v>=0?'+':'')+Number(v).toFixed(2):'—';
const col=s=>s>0?'var(--green)':s===0?'var(--amber)':'var(--red)';

function manualInput(key,label,hint,val){
  return `<div class="co-manual-row"><div><div style="font-size:11px;color:var(--text2);font-weight:600;">${label}</div><div style="font-size:9px;color:var(--text3);">${hint}</div></div><div style="display:flex;align-items:center;gap:6px;"><input type="number" class="co-manual-input" data-key="${key}" value="${val??''}" placeholder="—" step="0.1" style="width:72px;"><span style="font-size:10px;color:var(--text3);">%</span></div></div>`;
}

export async function render(container,{actionsSlot}){
  actionsSlot.innerHTML=`<button class="btn" id="ciclo-edit">✎ Editar manuales</button><button class="btn btn-primary" id="ciclo-refresh">↻ Actualizar</button>`;
  container.innerHTML=`<div id="ciclo-wrap"><div class="empty"><div class="loader-ring"></div></div></div>`;
  async function load(force=false){
    try{const m=await getMacroData(force);paint(m);}
    catch(e){document.getElementById('ciclo-wrap').innerHTML=`<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Error</div><div class="empty-desc">${e.message}</div></div>`;}
  }
  function paint(macro){
    const el=document.getElementById('ciclo-wrap');
    const co=macro.coyuntura||{};
    const ind=macro.indicators||{};
    const s=macro.scoreTotal??0;
    const man=getManuals();
    // Ciclo position: map score a fase
    const fase=s>=10?'BOOM':s>=4?'EXPANSIÓN':s>=0?'DESACEL.':s>=-4?'RECESIÓN LEVE':'RECESIÓN SEVERA';
    const faseCol=s>=10?'var(--green)':s>=4?'var(--green)':s>=0?'var(--amber)':s>=-4?'var(--red)':'var(--red)';

    el.innerHTML=`
      <div style="display:grid;grid-template-columns:260px 1fr;gap:16px;margin-bottom:14px;">
        <!-- Wheel -->
        <div class="mac-card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <svg viewBox="0 0 240 240" style="width:210px;height:210px;">
            <circle cx="120" cy="120" r="90" fill="none" stroke="var(--border)" stroke-width="2"/>
            <!-- 6 sectores -->
            <path d="M120,120 L120,30 A90,90 0 0,1 198,75 Z" fill="${s>=4&&s<10?'rgba(74,222,128,0.18)':'rgba(74,222,128,0.06)'}" stroke="var(--border)" stroke-width="1"/>
            <path d="M120,120 L198,75 A90,90 0 0,1 198,165 Z" fill="${s>=10?'rgba(74,222,128,0.22)':'rgba(74,222,128,0.05)'}" stroke="var(--border)" stroke-width="1"/>
            <path d="M120,120 L198,165 A90,90 0 0,1 120,210 Z" fill="rgba(251,191,36,0.06)" stroke="var(--border)" stroke-width="1"/>
            <path d="M120,120 L120,210 A90,90 0 0,1 42,165 Z" fill="${s>=0&&s<4?'rgba(251,191,36,0.22)':'rgba(251,191,36,0.06)'}" stroke="${s>=0&&s<4?'var(--amber)':'var(--border)'}" stroke-width="${s>=0&&s<4?'2':'1'}"/>
            <path d="M120,120 L42,165 A90,90 0 0,1 42,75 Z" fill="${s<0&&s>=-4?'rgba(244,113,116,0.20)':'rgba(244,113,116,0.06)'}" stroke="${s<0&&s>=-4?'var(--red)':'var(--border)'}" stroke-width="${s<0&&s>=-4?'2':'1'}"/>
            <path d="M120,120 L42,75 A90,90 0 0,1 120,30 Z" fill="${s<-4?'rgba(244,113,116,0.25)':'rgba(64,217,192,0.06)'}" stroke="${s<-4?'var(--red)':'var(--border)'}" stroke-width="${s<-4?'2':'1'}"/>
            <!-- Labels -->
            <text x="120" y="40" text-anchor="middle" font-family="IBM Plex Mono" font-size="8" fill="var(--green)">EXPANSIÓN</text>
            <text x="196" y="108" text-anchor="end" font-family="IBM Plex Mono" font-size="8" fill="var(--green)">BOOM</text>
            <text x="196" y="155" text-anchor="end" font-family="IBM Plex Mono" font-size="8" fill="var(--amber)">DESACEL.</text>
            <text x="120" y="204" text-anchor="middle" font-family="IBM Plex Mono" font-size="8" fill="var(--red)">REC. LEVE</text>
            <text x="44" y="155" text-anchor="start" font-family="IBM Plex Mono" font-size="8" fill="var(--red)">REC. SEVERA</text>
            <text x="44" y="85" text-anchor="start" font-family="IBM Plex Mono" font-size="8" fill="var(--teal)">RECUPER.</text>
            <!-- Centro -->
            <circle cx="120" cy="120" r="40" fill="var(--surface)"/>
            <text x="120" y="116" text-anchor="middle" font-family="Cormorant Garamond" font-size="12" font-style="italic" fill="${faseCol}">${fase}</text>
            <text x="120" y="132" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="var(--text3)">${s>=0?'+':''}${s} / 17</text>
          </svg>
        </div>

        <!-- Indicadores adelantados -->
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${['curvaUSD','curvaEUR','lei'].map(k=>{
            const i=co[k]||(k==='lei'?ind.lei:null);
            if(!i) return `<div class="mac-card" style="background:var(--surface2);"><div style="font-size:10px;color:var(--text3);">${k==='curvaUSD'?'Curva USD':k==='curvaEUR'?'Curva EUR':'LEI USA'} — sin datos</div></div>`;
            const c=col(i.score);
            const thresholds=k==='curvaUSD'?'≥+0.90%→+1 · +0.48-0.89%→0 · <+0.48%→−1':k==='curvaEUR'?'≥+0.60%→+1 · +0.40-0.59%→0 · <+0.40%→−1':'≥+0.3%→+1 · ±0.3%→0 · <−0.3%→−1';
            const label=k==='curvaUSD'?'Curva USD (10Y−2Y)':k==='curvaEUR'?'Curva EUR (10Y−2Y)'+( i.manual?' ✎':''):'LEI USA ✎';
            const signal=k==='curvaUSD'?(i.value<0?'Invertida — señal histórica de recesión':i.score>0?'≥+0.90% — optimismo de crecimiento':'Comprimiendo — neutral'):k==='curvaEUR'?(i.value<0?'Invertida — señal recesiva en Europa':i.score>0?'≥+0.60% — ciclo expansivo':'Neutral'):(i.value==null?'Sin dato — introduce el valor mensualmente':i.score>0?'≥+0.3% → expansión próximos 6-9 meses':i.score===0?'±0.3% → neutral':'<−0.3% → contracción anticipada');
            const trend=i.score>0?'↑ Mejorando':i.score===0?'→ Estable':'↓ Empeorando';
            return `<div class="mac-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:10px;font-weight:700;color:var(--text2);">${label}</div>
                <div style="display:flex;gap:6px;align-items:center;">
                  <span style="font-size:10px;font-family:var(--mono);color:${c};">${trend}</span>
                  <span style="font-size:9px;padding:2px 7px;border-radius:10px;font-family:var(--mono);font-weight:700;background:rgba(${i.score>0?'74,222,128':i.score===0?'251,191,36':'244,113,116'},0.12);color:${c};">Score ${i.score>0?'+':''}${i.score??'—'}</span>
                </div>
              </div>
              <div style="font-family:var(--serif);font-size:28px;font-weight:600;font-style:italic;color:${c};">${i.value!=null?fsign(i.value)+'%':'—'}</div>
              <div style="position:relative;height:5px;background:var(--surface2);border-radius:3px;margin:8px 0 4px;">
                ${i.value!=null&&i.value>=0?`<div style="position:absolute;left:50%;width:${Math.min(Math.abs(i.value||0)*50,50)}%;height:100%;background:${c};border-radius:0 3px 3px 0;"></div>`:''}
                ${i.value!=null&&i.value<0?`<div style="position:absolute;right:50%;width:${Math.min(Math.abs(i.value||0)*50,50)}%;height:100%;background:${c};border-radius:3px 0 0 3px;"></div>`:''}
                <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:var(--border2);"></div>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:8px;color:var(--text3);font-family:var(--mono);margin-bottom:6px;"><span style="color:var(--red)">Negativo</span><span>0</span><span style="color:var(--green)">Positivo</span></div>
              <div style="font-size:9px;color:var(--text3);font-family:var(--mono);margin-bottom:3px;">${thresholds}</div>
              <div style="font-size:10px;color:var(--text2);border-top:1px solid var(--border);padding-top:6px;margin-top:6px;">${signal}</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Cuadrante régimen 2x2 -->
      <div class="mac-card" style="margin-bottom:14px;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--text3);margin-bottom:12px;">Mapa de Régimen Macro (Crecimiento × Liquidez)</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
          ${[
            {l:'BOOM',c:'var(--green)',desc:'Crecimiento alto + Liquidez alta · RV agresiva, small caps, commodities',active:s>=10},
            {l:'GOLDILOCKS',c:'var(--teal)',desc:'Crecimiento moderado + Liquidez alta · RV quality, bonos IG, oro',active:s>=4&&s<10},
            {l:'DESACELERACIÓN',c:'var(--amber)',desc:'Crecimiento moderado + Liquidez baja · Defensivo, cash, bonos cortos',active:s>=0&&s<4},
            {l:'RECESIÓN',c:'var(--red)',desc:'Crecimiento negativo + Liquidez baja · Cash, treasuries, oro',active:s<0},
          ].map(q=>`<div style="padding:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:100px;${q.active?'background:rgba(64,217,192,0.08);border:2px solid var(--teal);':'background:var(--surface2);'}">
            <div style="font-size:11px;font-weight:700;color:${q.c};margin-bottom:6px;">${q.l}</div>
            <div style="font-size:9px;color:var(--text3);line-height:1.4;">${q.desc}</div>
            ${q.active?`<div style="font-size:8px;font-family:var(--mono);color:var(--teal);margin-top:6px;font-weight:700;">◆ POSICIÓN ACTUAL</div>`:''}
          </div>`).join('')}
        </div>
      </div>

      <!-- Panel manuales -->
      <div id="ciclo-manual-panel" style="display:none;background:var(--surface);border:1px dashed var(--border2);border-radius:12px;padding:18px 20px;">
        <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">✎ Override Manual — Ciclo</div>
        <div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-bottom:14px;">LEI, Crédito vs Nominal e Impulso Crediticio son ahora automáticos vía FRED (USSLIND, TOTLL, GDP). Solo introduce un override si consideras que el dato de FRED no es representativo.</div>
        ${manualInput('lei','Override LEI (% m/m)','Deja vacío para usar FRED USSLIND automático · ≥+0.3%→+1 · ±0.3%→0 · <−0.3%→−1',man.lei)}
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button class="btn btn-primary" id="ciclo-save-man">Guardar y actualizar</button>
          <button class="btn" id="ciclo-close-man">Cancelar</button>
        </div>
      </div>
      <div class="co-footer">Fuentes: FRED (DGS10, DGS2) · ECB Data Portal (Curva EUR) · Conference Board LEI (manual)</div>
    `;
    document.getElementById('ciclo-save-man')?.addEventListener('click',()=>{
      const man=getManuals();
      document.querySelectorAll('.co-manual-input').forEach(inp=>{const v=inp.value.trim();man[inp.dataset.key]=v!==''?parseFloat(v):null;});
      saveManuals(man);document.getElementById('ciclo-manual-panel').style.display='none';load(true);
    });
    document.getElementById('ciclo-close-man')?.addEventListener('click',()=>{document.getElementById('ciclo-manual-panel').style.display='none';});
  }
  document.getElementById('ciclo-refresh')?.addEventListener('click',()=>load(true));
  document.getElementById('ciclo-edit')?.addEventListener('click',()=>{const p=document.getElementById('ciclo-manual-panel');if(p)p.style.display=p.style.display==='none'?'block':'none';});
  await load(false);
  return{destroy(){}};
}

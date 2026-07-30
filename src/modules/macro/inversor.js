import { getMacroData } from './macro-data.js';
const f1=v=>v!=null?Number(v).toFixed(1):'—';
const f2=v=>v!=null?Number(v).toFixed(2):'—';

export async function render(container,{actionsSlot}){
  actionsSlot.innerHTML=`<button class="btn btn-primary" id="inv-refresh">↻ Actualizar</button>`;
  container.innerHTML=`<div id="inv-wrap"><div class="empty"><div class="loader-ring"></div></div></div>`;
  async function load(force=false){
    try{const m=await getMacroData(force);paint(m);}
    catch(e){document.getElementById('inv-wrap').innerHTML=`<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Error</div><div class="empty-desc">${e.message}</div></div>`;}
  }
  function paint(macro){
    const el=document.getElementById('inv-wrap');
    const s=macro.scoreTotal??0;
    const co=macro.coyuntura||{};
    const liq=macro.liquidez||{};
    const ind=macro.indicators||{};
    const seg=macro.seguimiento||{};
    const mainCol=s>=4?'var(--green)':s>=0?'var(--amber)':'var(--red)';

    // Veredicto dinámico
    const veredicto=s>=10?'Agresivo. El ciclo y la liquidez acompañan.':s>=4?'Moderado. Oportunidad selectiva.':s>=0?'Defensivo. No es momento de agresividad.':'Muy defensivo. Proteger capital primero.';

    // Recomendaciones por score
    const recRV=s>=10?'SOBREPONDERAR':s>=4?'NEUTRAL+':s>=0?'NEUTRAL':'INFRAPONDERAR';
    const recBonos=s>=10?'INFRAPONDERAR':s>=4?'NEUTRAL':s>=0?'NEUTRAL+':'SOBREPONDERAR CORTOS';
    const recCash=s>=10?'MÍNIMO':s>=4?'10-20%':s>=0?'30-50%':'40-60%';
    const recOro=s>=4?'NEUTRO':s>=0?'POSITIVO':'SOBREPONDERAR';
    const rvPct=s>=10?'75-90%':s>=4?'55-70%':s>=0?'35-55%':'15-35%';

    const accionesSi=s>=4?[
      'Mantener posiciones largas existentes con stops en EMA20 semanal',
      'Favorecer sectores con alta liquidez: Tecnología, Industriales',
      'Considerar small caps si el score supera +10',
      'Oro como cobertura parcial ante riesgo de inflación',
    ]:[
      'Reducir exposición en RV si ya supera el '+(s>=0?'55%':'35%')+' del capital',
      'Favorecer sectores defensivos: Healthcare, Consumo Básico, Utilities',
      'Mantener oro como cobertura de inflación persistente',
      'Cash y bonos cortos (< 2Y) para el resto de la cartera',
    ];
    const accionesNo=s>=4?[
      'No aumentar posiciones en sectores muy sensibles a tipos (REITS, Utilities)',
      'Evitar High Yield hasta que los spreads bajen de 3.5%',
    ]:[
      'No ampliar posiciones en growth o tecnología hasta que la curva se normalice',
      'Evitar High Yield y bonos largos (sensibles a tipos altos)',
      'No aumentar sizing total hasta que el score macro supere +'+(s>=0?'9':'4'),
    ];

    // Señales críticas
    const alertaRoja=s<0&&co.curvaUSD?.value<0&&liq.m2?.score<0;
    const señalCambio=co.curvaUSD?.value>0.9&&liq.m2?.score>=0&&liq.impulso?.score>0;

    el.innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 300px;gap:14px;">
        <div>
          <!-- Veredicto -->
          <div class="mac-card" style="background:rgba(${s>=4?'74,222,128':s>=0?'251,191,36':'244,113,116'},0.04);border-color:rgba(${s>=4?'74,222,128':s>=0?'251,191,36':'244,113,116'},0.2);margin-bottom:12px;">
            <div style="font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:0.16em;text-transform:uppercase;margin-bottom:10px;">Diagnóstico · ${new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'})}</div>
            <div style="font-family:var(--serif);font-size:34px;font-weight:600;font-style:italic;color:${mainCol};line-height:1.15;margin-bottom:14px;">${veredicto}</div>
            <div style="font-size:12px;color:var(--text2);line-height:1.8;">${
              s>=4
              ?`El ciclo muestra <strong style="color:var(--text1)">señales expansivas</strong>. La liquidez acompaña y los spreads de crédito no muestran estrés sistémico. Entorno favorable para posiciones largas con gestión de riesgo activa.`
              :s>=0
              ?`El ciclo muestra <strong style="color:var(--text1)">señales mixtas</strong>: algunos indicadores adelantados se deterioran mientras la liquidez se mantiene. No es el momento de ampliar exposición agresivamente, pero tampoco de salir del mercado.`
              :`El ciclo muestra <strong style="color:var(--text1)">señales claras de desaceleración</strong>: curva${co.curvaUSD?.value<0?' invertida':'comprimiendo'}, LEI ${ind.lei?.score<0?'negativo':'débil'}, liquidez insuficiente. El único soporte puede ser el sentimiento o el mercado laboral — pero no eliminan el riesgo, solo lo retrasan.`
            }</div>
          </div>

          <!-- Acciones -->
          <div class="mac-card">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:12px;">Acciones Recomendadas</div>
            ${accionesSi.map(a=>`<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--surface2);border-radius:6px;margin-bottom:6px;font-size:11px;color:var(--text1);"><div style="width:18px;height:18px;border-radius:50%;background:rgba(74,222,128,0.15);color:var(--green);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;">✓</div>${a}</div>`).join('')}
            ${accionesNo.map(a=>`<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--surface2);border-radius:6px;margin-bottom:6px;font-size:11px;color:var(--text1);"><div style="width:18px;height:18px;border-radius:50%;background:rgba(244,113,116,0.15);color:var(--red);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;">✗</div>${a}</div>`).join('')}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;">
          <!-- Resumen factores -->
          <div class="mac-card">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:12px;">Resumen de Factores</div>
            ${[
              ['Macro Score', (s>=0?'+':'')+s+' / +17', mainCol],
              ['Liquidez', liq.m2?.score>=0?'Positiva':'Contractiva', liq.m2?.score>=0?'var(--green)':'var(--red)'],
              ['Política monetaria', co.tipoReal?.value!=null?(co.tipoReal.value>=1?'Muy restrictiva':co.tipoReal.value>=0.5?'Restrictiva':'Acomodaticia'):'—', co.tipoReal?.score>0?'var(--green)':'var(--red)'],
              ['Crédito', liq.bbbSpread?.score>0?'Tranquilo':liq.bbbSpread?.score===0?'Bajo tensión':'Estrés', liq.bbbSpread?.score>0?'var(--green)':liq.bbbSpread?.score===0?'var(--amber)':'var(--red)'],
              ['Sentimiento', ind.fearGreed?.value!=null?(ind.fearGreed.value>55?'Codicioso':ind.fearGreed.value<40?'Miedo':'Neutral'):'—', ind.fearGreed?.score>0?'var(--green)':ind.fearGreed?.score===0?'var(--amber)':'var(--red)'],
              ['Inflación', macro.riesgoContagio?.nivel?macro.riesgoContagio.nivel.charAt(0).toUpperCase()+macro.riesgoContagio.nivel.slice(1):'—', macro.riesgoContagio?.nivel==='bajo'?'var(--green)':macro.riesgoContagio?.nivel==='moderado'?'var(--amber)':'var(--red)'],
            ].map(([l,v,c])=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);"><span style="font-size:11px;color:var(--text2);">${l}</span><span style="font-family:var(--mono);font-size:11px;font-weight:700;color:${c};">${v}</span></div>`).join('')}
            <div style="margin-top:10px;">
              <div style="font-size:9px;color:var(--text3);margin-bottom:4px;">Exposición RV recomendada</div>
              <div style="font-family:var(--mono);font-size:18px;font-weight:700;color:${mainCol};">${rvPct}</div>
            </div>
          </div>

          <!-- Alertas -->
          ${alertaRoja?`<div class="mac-card" style="background:rgba(244,113,116,0.06);border-color:rgba(244,113,116,0.25);">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:var(--red);margin-bottom:8px;">🚨 Alerta Máxima Activa</div>
            <div style="font-size:11px;color:var(--text2);line-height:1.6;">Curva invertida + M2 contractivo + score negativo simultáneamente. Activar protocolo defensivo completo: reducir RV al 20-30% y aumentar cash.</div>
          </div>`:''}
          ${señalCambio?`<div class="mac-card" style="background:rgba(74,222,128,0.06);border-color:rgba(74,222,128,0.25);">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:var(--green);margin-bottom:8px;">✅ Señal de Cambio Positivo</div>
            <div style="font-size:11px;color:var(--text2);line-height:1.6;">Curva positiva + impulso crediticio positivo + M2 expansivo. Score superaría +10. Aumentar RV al 75-85% con agresividad.</div>
          </div>`:`<div class="mac-card" style="background:var(--surface2);">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:var(--text3);margin-bottom:8px;">Señal de Cambio Positivo</div>
            <div style="font-size:11px;color:var(--text3);line-height:1.5;">Curva USD ≥+0.90% + Impulso crediticio ≥+1.0 + M2 ≥+5% simultáneamente → score superaría +10. Aumentar RV al 75-85%.</div>
          </div>`}
        </div>
      </div>
      <div class="co-footer" style="margin-top:14px;">Modo Inversor · síntesis automática del sistema macro ETHAN · no constituye asesoramiento financiero</div>
    `;
  }
  document.getElementById('inv-refresh')?.addEventListener('click',()=>load(true));
  await load(false);
  return{destroy(){}};
}

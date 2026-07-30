import { getMacroData } from './macro-data.js';
const f1=v=>v!=null?Number(v).toFixed(1):'—';
const f2=v=>v!=null?Number(v).toFixed(2):'—';

export async function render(container,{actionsSlot}){
  actionsSlot.innerHTML=`<button class="btn btn-primary" id="radar-refresh">↻ Actualizar</button>`;
  container.innerHTML=`<div id="radar-wrap"><div class="empty"><div class="loader-ring"></div></div></div>`;
  async function load(force=false){
    try{const m=await getMacroData(force);paint(m);}
    catch(e){document.getElementById('radar-wrap').innerHTML=`<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Error</div><div class="empty-desc">${e.message}</div></div>`;}
  }
  function paint(macro){
    const el=document.getElementById('radar-wrap');
    const co=macro.coyuntura||{};
    const ind=macro.indicators||{};
    const liq=macro.liquidez||{};
    const seg=macro.seguimiento||{};
    const s=macro.scoreTotal??0;
    const mainCol=s>=4?'var(--green)':s>=0?'var(--amber)':'var(--red)';

    const cicloScore=(co.curvaUSD?.score||0)+(co.curvaEUR?.score||0)+(ind.lei?.score||0);
    const liqScore=(liq.m2?.score||0)+(liq.impulso?.score||0)+(liq.velM2?.score||0)+(liq.credito?.score||0);
    const creditoScore=(liq.bbbSpread?.score||0)+(seg.hySpread?.value!=null?(seg.hySpread.value<3.5?1:seg.hySpread.value<5?0:-1):0);
    const sentScore=(ind.fearGreed?.score||0)+(seg.vix?.aboveSMA200!=null?(seg.vix.aboveSMA200?-1:1):0);
    const polScore=(co.tipoReal?.score||0)+(liq.reservas?.score||0);
    const infScore=(ind.cpi?.score||0);

    function dotCol(sc){ return sc>0?'var(--green)':sc===0?'var(--amber)':'var(--red)'; }
    function dotLabel(sc){ return sc>0?'🟢':sc===0?'🟡':'🔴'; }

    const blocks=[
      {icon:'🔄',l:'Ciclo Económico',sc:cicloScore,detail:`Curva USD ${co.curvaUSD?.value!=null?f2(co.curvaUSD.value)+'%':'—'} · Curva EUR ${co.curvaEUR?.value!=null?f2(co.curvaEUR.value)+'%':'—'} · LEI ${ind.lei?.value!=null?f2(ind.lei.value)+'%':'—'}`},
      {icon:'💧',l:'Liquidez Global',sc:liqScore,detail:`M2 ${liq.m2?.value!=null?f2(liq.m2.value)+'%':'—'} · Impulso ${liq.impulso?.value!=null?f2(liq.impulso.value):'—'} · Vel.M2 ${liq.velM2?.value!=null?f2(liq.velM2.value)+'%':'—'}`},
      {icon:'📊',l:'Crédito',sc:creditoScore,detail:`BBB ${liq.bbbSpread?.value!=null?f2(liq.bbbSpread.value)+'%':'—'} · HY ${seg.hySpread?.value!=null?f2(seg.hySpread.value)+'%':'—'}`},
      {icon:'🧠',l:'Sentimiento',sc:sentScore,detail:`F&G ${ind.fearGreed?.value??'—'} · VIX ${seg.vix?.value!=null?f1(seg.vix.value):'—'}${seg.vix?.aboveSMA200?' ⚠ sobre SMA200':''}`},
      {icon:'🏦',l:'Política Monetaria',sc:polScore,detail:`Tipo real ${co.tipoReal?.value!=null?(co.tipoReal.value>=0?'+':'')+f2(co.tipoReal.value)+'%':'—'} · Reservas ${liq.reservas?.value!=null?'$'+f2(liq.reservas.value)+'T':'—'}`},
      {icon:'🌡️',l:'Inflación',sc:infScore,detail:`CPI ${co.cpi?.value!=null?f1(co.cpi.value)+'%':'—'} · Core ${co.cpi?.cpiCore!=null?f1(co.cpi.cpiCore)+'%':'—'} · Riesgo: ${macro.riesgoContagio?.pct??'—'}%`},
    ];

    // Riesgo principal
    const worstBlock=blocks.reduce((a,b)=>a.sc<b.sc?a:b,blocks[0]);
    const bestBlock=blocks.reduce((a,b)=>a.sc>b.sc?a:b,blocks[0]);

    el.innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 300px;gap:14px;">
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${blocks.map(b=>`<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--surface2);border-radius:8px;">
            <div style="font-size:20px;width:30px;text-align:center;flex-shrink:0;">${b.icon}</div>
            <div style="flex:1;">
              <div style="font-size:12px;font-weight:600;color:var(--text1);margin-bottom:2px;">${b.l}</div>
              <div style="font-size:10px;color:var(--text3);font-family:var(--mono);">${b.detail}</div>
            </div>
            <div style="font-size:18px;">${dotLabel(b.sc)}</div>
          </div>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;">
          <!-- Riesgo principal -->
          <div class="mac-card" style="background:rgba(244,113,116,0.04);border-color:rgba(244,113,116,0.22);">
            <div style="font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:0.14em;text-transform:uppercase;margin-bottom:10px;">Riesgo Principal</div>
            <div style="font-size:14px;font-weight:700;color:var(--red);margin-bottom:8px;">${worstBlock.l}</div>
            <div style="font-size:11px;color:var(--text2);line-height:1.6;">${
              worstBlock.l==='Ciclo Económico'?'Curva invertida + LEI negativo anticipan desaceleración o recesión en 6-9 meses. Es el indicador adelantado más fiable históricamente.':
              worstBlock.l==='Liquidez Global'?'El dinero se retira del sistema. Históricamente esto precede presión en activos de riesgo con 6-12 meses de retardo.':
              worstBlock.l==='Inflación'?'Inflación Core elevada impide que la Fed baje tipos, manteniendo condiciones restrictivas más tiempo del esperado.':
              worstBlock.l==='Crédito'?'Los spreads de crédito ampliando señalan estrés en el sistema financiero y riesgo de contagio a la economía real.':
              worstBlock.l==='Política Monetaria'?'Política muy restrictiva — el coste del dinero está frenando inversión y consumo de forma significativa.':
              'Sentimiento codicioso con macro deteriorándose — señal de complacencia que históricamente precede correcciones.'
            }</div>
          </div>

          <!-- Factor mitigante -->
          <div class="mac-card" style="background:rgba(74,222,128,0.04);border-color:rgba(74,222,128,0.2);">
            <div style="font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:0.14em;text-transform:uppercase;margin-bottom:8px;">Factor Mitigante</div>
            <div style="font-size:14px;font-weight:700;color:var(--green);margin-bottom:6px;">${bestBlock.l}</div>
            <div style="font-size:11px;color:var(--text2);line-height:1.5;">${
              bestBlock.l==='Sentimiento'&&ind.fearGreed?.value<40?'El miedo extremo de mercado actúa como señal contrarian alcista si el macro se estabiliza.':
              bestBlock.l==='Liquidez Global'?'M2 positivo inyecta combustible que puede sostener el ciclo más tiempo del que sugieren los adelantados.':
              'El bloque más sólido del sistema actúa como amortiguador frente al riesgo principal.'
            }</div>
          </div>

          <!-- Score total -->
          <div class="mac-card" style="text-align:center;">
            <div style="font-size:9px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;margin-bottom:8px;">Score Total</div>
            <div style="font-family:var(--serif);font-size:48px;font-weight:600;font-style:italic;color:${mainCol};">${s>=0?'+':''}${s}</div>
            <div style="font-family:var(--serif);font-size:16px;font-style:italic;color:${mainCol};margin-top:4px;">${macro.zone||'—'}</div>
          </div>
        </div>
      </div>
      <div class="co-footer" style="margin-top:14px;">Radar de riesgos · actualización automática</div>
    `;
  }
  document.getElementById('radar-refresh')?.addEventListener('click',()=>load(true));
  await load(false);
  return{destroy(){}};
}

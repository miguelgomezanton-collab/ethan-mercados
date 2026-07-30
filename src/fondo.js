// ═══════════════════════════════════════════════
// FONDO ETHAN — Contabilidad por participaciones
// VL inicial = 100. Un solo fondo unificado.
// Estructura en Firestore: ethan_fondo_v1
// {
//   vlInicial: 100,
//   participaciones: number,   // total actual
//   creadoEn: ISO,
//   movimientos: [             // log completo
//     { date, tipo, importe, vl, participaciones, participacionesTotal, nota }
//   ]
// }
// ═══════════════════════════════════════════════

import { UserData } from './userdata.js';

const FONDO_KEY = 'ethan_fondo_v1';
const VL_INICIAL = 100;

// ── Leer fondo ────────────────────────────────
export async function getFondo() {
  return await UserData.get(FONDO_KEY);
}

// ── Inicializar fondo (primera aportación) ────
// importe: capital inicial en €
// date: fecha de inicio (YYYY-MM-DD)
export async function inicializarFondo(importe, date) {
  const participaciones = importe / VL_INICIAL;
  const fondo = {
    vlInicial: VL_INICIAL,
    participaciones,
    creadoEn: date || new Date().toISOString().slice(0, 10),
    movimientos: [{
      date: date || new Date().toISOString().slice(0, 10),
      tipo: 'inicio',
      importe,
      vl: VL_INICIAL,
      participacionesEmitidas: participaciones,
      participacionesTotal: participaciones,
      nota: 'Capital inicial',
    }],
  };
  await UserData.set(FONDO_KEY, fondo);
  return fondo;
}

// ── Calcular VL actual ────────────────────────
// valorCartera: valor total actual de la cartera en €
// (capitalInicial + P&L realizado + P&L no realizado)
export function calcVL(fondo, valorCartera) {
  if (!fondo || !fondo.participaciones) return VL_INICIAL;
  return valorCartera / fondo.participaciones;
}

// ── Aportación ────────────────────────────────
export async function aportarCapital(importe, valorCarteraActual, nota = '') {
  let fondo = await getFondo();
  const date = new Date().toISOString().slice(0, 10);

  if (!fondo) {
    // Primera aportación — inicializar el fondo
    return await inicializarFondo(importe, date);
  }

  const vlActual = calcVL(fondo, valorCarteraActual);
  const nuevasParticipaciones = importe / vlActual;
  const totalParticipaciones = fondo.participaciones + nuevasParticipaciones;

  const mov = {
    date,
    tipo: 'aportacion',
    importe,
    vl: vlActual,
    participacionesEmitidas: nuevasParticipaciones,
    participacionesTotal: totalParticipaciones,
    nota,
  };

  fondo.participaciones = totalParticipaciones;
  fondo.movimientos = [...(fondo.movimientos || []), mov];
  await UserData.set(FONDO_KEY, fondo);
  return fondo;
}

// ── Retirada ──────────────────────────────────
export async function retirarCapital(importe, valorCarteraActual, nota = '') {
  let fondo = await getFondo();
  if (!fondo) throw new Error('El fondo no está inicializado');

  const date = new Date().toISOString().slice(0, 10);
  const vlActual = calcVL(fondo, valorCarteraActual);
  const participacionesReembolsadas = importe / vlActual;

  if (participacionesReembolsadas > fondo.participaciones) {
    throw new Error('No hay suficientes participaciones para reembolsar ese importe');
  }

  const totalParticipaciones = fondo.participaciones - participacionesReembolsadas;

  const mov = {
    date,
    tipo: 'retirada',
    importe: -importe,
    vl: vlActual,
    participacionesReembolsadas,
    participacionesTotal: totalParticipaciones,
    nota,
  };

  fondo.participaciones = totalParticipaciones;
  fondo.movimientos = [...(fondo.movimientos || []), mov];
  await UserData.set(FONDO_KEY, fondo);
  return fondo;
}

// ── Métricas desde VL ─────────────────────────
// valorCarteraActual: capitalInicial + P&L realizado + P&L no realizado
export function calcMetricasFondo(fondo, valorCarteraActual) {
  if (!fondo || !fondo.participaciones) return null;

  const vlActual = calcVL(fondo, valorCarteraActual);
  const vlInicial = fondo.vlInicial || VL_INICIAL;
  const totalReturn = (vlActual - vlInicial) / vlInicial;

  // Serie histórica de VL desde movimientos
  // Añadir el punto actual
  const movimientos = fondo.movimientos || [];
  const seriePuntos = [
    ...movimientos.map(m => ({ date: m.date, vl: m.vl })),
    { date: new Date().toISOString().slice(0, 10), vl: vlActual },
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Serie base 100 para el gráfico
  const serieBase100 = seriePuntos.map(p => ({
    date: p.date,
    val: (p.vl / vlInicial) * 100,
  }));

  const startDate = movimientos[0]?.date || new Date().toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const nDays = Math.round((new Date(today) - new Date(startDate)) / 86400000);
  const tradingDays = Math.round(nDays * 252 / 365);

  // CAGR — solo anualizar si hay suficientes días
  const annReturn = tradingDays > 10
    ? Math.pow(Math.max(1 + totalReturn, 0.001), 252 / tradingDays) - 1
    : totalReturn;

  // Max Drawdown sobre serie VL
  let peak = vlInicial, maxDD = 0;
  seriePuntos.forEach(p => {
    if (p.vl > peak) peak = p.vl;
    const dd = (peak - p.vl) / peak;
    if (dd > maxDD) maxDD = dd;
  });

  const maxHistorico = peak;
  const drawdownActual = (vlActual - maxHistorico) / maxHistorico;
  const calmar = maxDD > 0 ? annReturn / maxDD : null;

  return {
    vlActual,
    vlInicial,
    totalReturn,
    annReturn,
    nDays,
    tradingDays,
    startDate,
    participaciones: fondo.participaciones,
    valorCartera: valorCarteraActual,
    maxHistoricoVL: maxHistorico,
    maxHistoricoEur: maxHistorico * fondo.participaciones,
    drawdownActual,
    desdeMaximoEur: (vlActual - maxHistorico) * fondo.participaciones,
    maxDD,
    calmar,
    serieBase100,
  };
}

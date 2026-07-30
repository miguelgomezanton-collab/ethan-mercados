// ── macro-data.js ─────────────────────────────
// Cache + proxy hacia /api/macro
// Los manuales se guardan en sessionStorage y se
// pasan como query params a la API.
const CACHE_KEY = 'ethan_macro_cache';
const CACHE_TTL = 15 * 60 * 1000; // 15 min

const MANUAL_KEY = 'ethan_macro_manuals';

export function getManuals() {
  try { return JSON.parse(sessionStorage.getItem(MANUAL_KEY) || '{}'); } catch { return {}; }
}
export function saveManuals(obj) {
  sessionStorage.setItem(MANUAL_KEY, JSON.stringify(obj));
}

export async function getMacroData(force = false) {
  if (!force) {
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (c && Date.now() - c.ts < CACHE_TTL) return c.data;
    } catch {}
  }
  const man = getManuals();
  const p = new URLSearchParams();
  const fields = ['chinaM2']; // Solo China M2 YoY% sigue siendo manual
  fields.forEach(k => { if (man[k] != null) p.set(k, man[k]); });
  const url = '/api/macro' + (p.toString() ? '?' + p.toString() : '');
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API macro: ${r.status}`);
  const data = await r.json();
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
  return data;
}

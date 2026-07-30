// ═══════════════════════════════════════════════
// USERDATA — Persistencia en Firestore
// ═══════════════════════════════════════════════
// Centraliza toda la persistencia de datos de usuario
// que antes estaba en localStorage. Ahora se guarda en
// Firestore bajo users/{uid}/preferences/{key}
// y en users/{uid}/watchlists/{key}
//
// API pública:
//   await UserData.get(key)           → valor o null
//   await UserData.set(key, value)    → guarda en Firestore
//   UserData.listen(key, callback)    → suscripción en tiempo real
//   UserData.unlisten(key)            → desuscribe

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.js';
import { getCurrentUser } from './auth.js';

// Cache local para evitar lecturas redundantes
const cache = {};
const listeners = {};

function docRef(key) {
  const user = getCurrentUser();
  if (!user) throw new Error('No autenticado');
  return doc(db, 'users', user.uid, 'userdata', key);
}

export const UserData = {

  /** Lee un valor de Firestore (con fallback a localStorage para migración) */
  async get(key) {
    // Si ya está en caché, devolver directamente
    if (key in cache) return cache[key];

    try {
      const snap = await getDoc(docRef(key));
      if (snap.exists()) {
        cache[key] = snap.data().value ?? null;
        return cache[key];
      }
      // Fallback: migrar desde localStorage si existe
      const local = localStorage.getItem(key);
      if (local !== null) {
        try {
          const parsed = JSON.parse(local);
          // Migrar a Firestore automáticamente
          await this.set(key, parsed);
          return parsed;
        } catch {
          return null;
        }
      }
      return null;
    } catch (err) {
      // Si Firestore falla (offline, sin auth), usar localStorage como fallback
      const local = localStorage.getItem(key);
      if (local !== null) {
        try { return JSON.parse(local); } catch { return null; }
      }
      return null;
    }
  },

  /** Guarda un valor en Firestore (y también en localStorage como backup offline) */
  async set(key, value) {
    cache[key] = value;
    // Siempre guardar en localStorage como backup offline
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    // Intentar guardar en Firestore
    try {
      await setDoc(docRef(key), { value, updatedAt: Date.now() });
    } catch (err) {
      console.warn(`UserData.set(${key}): Firestore no disponible, solo localStorage`, err.message);
    }
  },

  /** Suscripción en tiempo real — el callback recibe el valor cada vez que cambia */
  listen(key, callback) {
    // Cancelar listener previo si existe
    if (listeners[key]) {
      listeners[key]();
      delete listeners[key];
    }
    try {
      const ref = docRef(key);
      listeners[key] = onSnapshot(ref, snap => {
        if (snap.exists()) {
          const value = snap.data().value ?? null;
          cache[key] = value;
          callback(value);
        } else {
          callback(null);
        }
      }, err => {
        console.warn(`UserData.listen(${key}): ${err.message}`);
      });
    } catch (err) {
      console.warn(`UserData.listen(${key}): ${err.message}`);
    }
  },

  /** Cancela una suscripción */
  unlisten(key) {
    if (listeners[key]) {
      listeners[key]();
      delete listeners[key];
    }
  },

  /** Limpia la caché (llamar al hacer logout) */
  clearCache() {
    Object.keys(cache).forEach(k => delete cache[k]);
    Object.keys(listeners).forEach(k => {
      if (listeners[k]) listeners[k]();
      delete listeners[k];
    });
  }
};

// Limpiar caché al hacer logout
import { auth } from './firebase.js';
auth.onAuthStateChanged(user => {
  if (!user) UserData.clearCache();
});

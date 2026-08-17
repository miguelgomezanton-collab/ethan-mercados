// ═══════════════════════════════════════════════
// USERDATA — Persistencia en Firestore
// ═══════════════════════════════════════════════

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.js';
import { getCurrentUser } from './auth.js';

const cache = {};
const listeners = {};

function docRef(key) {
  const user = getCurrentUser();
  if (!user) throw new Error('No autenticado');
  return doc(db, 'users', user.uid, 'userdata', key);
}

// Prefijo con UID para aislar datos por cuenta en localStorage
function lsKey(key) {
  const user = getCurrentUser();
  return user ? `ethan_${user.uid}_${key}` : `ethan_${key}`;
}

export const UserData = {

  async get(key) {
    if (key in cache) return cache[key];
    try {
      const snap = await getDoc(docRef(key));
      if (snap.exists()) {
        cache[key] = snap.data().value ?? null;
        return cache[key];
      }
      // Fallback offline: localStorage con prefijo de UID
      const local = localStorage.getItem(lsKey(key));
      if (local !== null) {
        try { return JSON.parse(local); } catch { return null; }
      }
      return null;
    } catch {
      const local = localStorage.getItem(lsKey(key));
      if (local !== null) {
        try { return JSON.parse(local); } catch { return null; }
      }
      return null;
    }
  },

  async set(key, value) {
    cache[key] = value;
    try { localStorage.setItem(lsKey(key), JSON.stringify(value)); } catch {}
    try {
      await setDoc(docRef(key), { value, updatedAt: Date.now() });
    } catch(err) {
      console.warn(`UserData.set(${key}): Firestore no disponible`, err.message);
    }
  },

  listen(key, callback) {
    if (listeners[key]) { listeners[key](); delete listeners[key]; }
    try {
      const ref = docRef(key);
      listeners[key] = onSnapshot(ref, snap => {
        const value = snap.exists() ? (snap.data().value ?? null) : null;
        cache[key] = value;
        callback(value);
      }, err => console.warn(`UserData.listen(${key}): ${err.message}`));
    } catch(err) {
      console.warn(`UserData.listen(${key}): ${err.message}`);
    }
  },

  unlisten(key) {
    if (listeners[key]) { listeners[key](); delete listeners[key]; }
  },

  clearCache() {
    Object.keys(cache).forEach(k => delete cache[k]);
    Object.keys(listeners).forEach(k => {
      if (listeners[k]) listeners[k]();
      delete listeners[k];
    });
  }
};

import { auth } from './firebase.js';
auth.onAuthStateChanged(user => {
  if (!user) UserData.clearCache();
});

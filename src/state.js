// ═══════════════════════════════════════════════
// STATE — Estado global compartido entre módulos
// ═══════════════════════════════════════════════
// Cualquier módulo (Cartera, Vitácora, Risk Management...) puede leer
// y escribir aquí. Los cambios se persisten en Firestore por colección.

import {
  collection, doc, onSnapshot, setDoc, addDoc,
  updateDoc, deleteDoc, query, orderBy
} from 'firebase/firestore';
import { db } from './firebase.js';
import { getCurrentUser } from './auth.js';

// Estado en memoria — los módulos leen de aquí directamente
export const state = {
  operaciones: {
    alcista: [],
    bajista: []
  },
  vitacora: [],
  watchlists: {
    alcistaRV: [],
    alcistaRF: [],
    alcistaCommodities: [],
    bajista: []
  },
  macro: null,
  ready: false
};

const subscribers = new Set();
const unsubscribers = [];

/** Cualquier módulo puede suscribirse a "algo cambió en el state" */
export function subscribe(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

function notify() {
  subscribers.forEach(cb => cb(state));
}

function userPath(...segments) {
  const user = getCurrentUser();
  if (!user) throw new Error('No hay usuario autenticado');
  return ['users', user.uid, ...segments];
}

/**
 * Arranca las suscripciones en tiempo real a Firestore.
 * Llamar una vez tras el login.
 */
export function initState() {
  cleanupState();
  const user = getCurrentUser();
  if (!user) return;

  // operaciones/alcista (subcolección)
  const opsAlcistaQ = query(
    collection(db, ...userPath('operaciones_alcista')),
    orderBy('fechaEntrada', 'desc')
  );
  unsubscribers.push(onSnapshot(opsAlcistaQ, snap => {
    state.operaciones.alcista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    notify();
  }));

  const opsBajistaQ = query(
    collection(db, ...userPath('operaciones_bajista')),
    orderBy('fecha', 'desc')
  );
  unsubscribers.push(onSnapshot(opsBajistaQ, snap => {
    state.operaciones.bajista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    notify();
  }));

  // vitácora
  const vitacoraQ = query(
    collection(db, ...userPath('vitacora')),
    orderBy('fecha', 'desc')
  );
  unsubscribers.push(onSnapshot(vitacoraQ, snap => {
    state.vitacora = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    notify();
  }));

  state.ready = true;
  notify();
}

export function cleanupState() {
  unsubscribers.forEach(unsub => unsub());
  unsubscribers.length = 0;
  state.operaciones.alcista = [];
  state.operaciones.bajista = [];
  state.vitacora = [];
  state.ready = false;
}

// ── Escritura — operaciones ─────────────────────

export async function addOperacion(tipo, data) {
  const coll = tipo === 'alcista' ? 'operaciones_alcista' : 'operaciones_bajista';
  await addDoc(collection(db, ...userPath(coll)), {
    ...data,
    createdAt: Date.now()
  });
}

export async function updateOperacion(tipo, id, data) {
  const coll = tipo === 'alcista' ? 'operaciones_alcista' : 'operaciones_bajista';
  await updateDoc(doc(db, ...userPath(coll), id), data);
}

export async function deleteOperacion(tipo, id) {
  const coll = tipo === 'alcista' ? 'operaciones_alcista' : 'operaciones_bajista';
  await deleteDoc(doc(db, ...userPath(coll), id));
}

// ── Escritura — vitácora ────────────────────────

export async function addVitacoraEntry(entry) {
  await addDoc(collection(db, ...userPath('vitacora')), {
    ...entry,
    fecha: entry.fecha || Date.now()
  });
}

export async function deleteVitacoraEntry(id) {
  await deleteDoc(doc(db, ...userPath('vitacora'), id));
}

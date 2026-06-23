// ═══════════════════════════════════════════════
// AUTH — Login / Logout / Estado de sesión
// ═══════════════════════════════════════════════

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from './firebase.js';

let currentUser = null;
const listeners = [];

/**
 * Suscribirse a cambios de estado de autenticación.
 * @param {(user: import('firebase/auth').User|null) => void} cb
 */
export function onAuthChange(cb) {
  listeners.push(cb);
  // Si ya sabemos el estado, lo notificamos inmediatamente
  if (currentUser !== undefined) cb(currentUser);
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  listeners.forEach(cb => cb(user));
});

export function getCurrentUser() {
  return currentUser;
}

/**
 * Login con email y contraseña.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function login(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapAuthError(err.code) };
  }
}

export async function logout() {
  await signOut(auth);
}

function mapAuthError(code) {
  const map = {
    'auth/invalid-email': 'Email inválido.',
    'auth/user-disabled': 'Usuario deshabilitado.',
    'auth/user-not-found': 'Usuario o contraseña incorrectos.',
    'auth/wrong-password': 'Usuario o contraseña incorrectos.',
    'auth/invalid-credential': 'Usuario o contraseña incorrectos.',
    'auth/too-many-requests': 'Demasiados intentos. Inténtalo más tarde.',
    'auth/network-request-failed': 'Error de red. Comprueba tu conexión.'
  };
  return map[code] || 'Error al iniciar sesión.';
}

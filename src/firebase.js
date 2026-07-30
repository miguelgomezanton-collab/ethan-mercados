// ═══════════════════════════════════════════════
// FIREBASE — Inicialización
// ═══════════════════════════════════════════════
// Sustituye el objeto de abajo por el que te da la consola de Firebase
// (Project settings → General → Your apps → SDK setup and configuration)

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAzrfzTKENoU034Y-OfBtywu9jmzFFmfZo",
  authDomain: "ethan-mercados.firebaseapp.com",
  projectId: "ethan-mercados",
  storageBucket: "ethan-mercados.firebasestorage.app",
  messagingSenderId: "404598567416",
  appId: "1:404598567416:web:3443fd5af436b9489d660d"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

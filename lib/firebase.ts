import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBGtns8qDchrGGMqRnlCceo8x5w85Fe2kA',
  authDomain: 'hammer-radio-395cb.firebaseapp.com',
  projectId: 'hammer-radio-395cb',
  storageBucket: 'hammer-radio-395cb.firebasestorage.app',
  messagingSenderId: '621020120834',
  appId: '1:621020120834:web:d7cc3726c4efdf74e3641b',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
signInAnonymously(auth).catch(e => console.warn('[Firebase anon auth]', e.message));
export default app;

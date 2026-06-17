import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyC2GmOONKDB7O0x8awGuJr4JV3y1taONpA',
  authDomain: 'helpmkp-11de7.firebaseapp.com',
  projectId: 'helpmkp-11de7',
  storageBucket: 'helpmkp-11de7.firebasestorage.app',
  messagingSenderId: '903002127782',
  appId: '1:903002127782:web:3ae5d1ad55563369076367',
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta as ferramentas que vamos usar nas outras telas
export const auth = getAuth(app);
export const db = getFirestore(app);

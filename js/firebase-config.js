// firebase-config.js
// Configuração compartilhada do Firebase.
// A apiKey do Firebase NÃO é um segredo — só identifica o projeto.
// A segurança de verdade vem do Firebase Authentication (login) + Firestore Rules (firestore.rules).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDOcArv9AXmCV2_UWKGc7ElLkjIri8cK5Q",
  authDomain: "meucontrolefinanceiro-85d6e.firebaseapp.com",
  projectId: "meucontrolefinanceiro-85d6e",
  storageBucket: "meucontrolefinanceiro-85d6e.firebasestorage.app",
  messagingSenderId: "260712769903",
  appId: "1:260712769903:web:a7ddbe3cc527b585be209a",
  measurementId: "G-BS5WZ6YBG9"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

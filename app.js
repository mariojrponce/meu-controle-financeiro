import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ⚠️ COLE A SUA CHAVE DE CONEXÃO AQUI
const firebaseConfig = {
  apiKey: "AIzaSyDOcArv9AXmCV2_UWKGc7ElLkjIri8cK5Q",
  authDomain: "meucontrolefinanceiro-85d6e.firebaseapp.com",
  projectId: "meucontrolefinanceiro-85d6e",
  storageBucket: "meucontrolefinanceiro-85d6e.firebasestorage.app",
  messagingSenderId: "260712769903",
  appId: "1:260712769903:web:a7ddbe3cc527b585be209a",
  measurementId: "G-BS5WZ6YBG9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const formulario = document.getElementById("form-transacao");

formulario.addEventListener("submit", async function(evento) {
    evento.preventDefault();
    
    const botaoSalvar = formulario.querySelector("button");
    botaoSalvar.innerText = "Salvando...";

    // Capturando os dados
    const valor = parseFloat(document.getElementById("valor").value);
    const data = document.getElementById("data").value;
    const saida = document.getElementById("saida").value.toUpperCase(); // NOVO CAMPO
    const descricao = document.getElementById("descricao").value.toUpperCase();
    const banco = document.getElementById("banco").value.toUpperCase();
    const tipo = document.getElementById("tipo").value;
    const tipo_mov = document.getElementById("tipo_mov").value;
    const classificacao_saida = document.getElementById("classificacao_saida").value.toUpperCase();

    try {
        await addDoc(collection(db, "transacoes"), {
            valor: valor,
            data: data,
            saida: saida, // SALVANDO O NOVO CAMPO AQUI
            descricao: descricao,
            banco: banco,
            tipo: tipo,
            tipo_mov: tipo_mov,
            classificacao_saida: classificacao_saida
        });

        alert("Transação salva!");
        formulario.reset();
        botaoSalvar.innerText = "Salvar Transação";
        
    } catch (erro) {
        console.error("Erro ao salvar: ", erro);
        alert("Erro ao salvar.");
        botaoSalvar.innerText = "Salvar Transação";
    }
});
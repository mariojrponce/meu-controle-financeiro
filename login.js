import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase-config.js";

// Se já estiver logado, pula direto para o app
onAuthStateChanged(auth, (usuario) => {
    if (usuario) window.location.href = "index.html";
});

const formulario = document.getElementById("form-login");
const divErro = document.getElementById("erro");

formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    divErro.textContent = "";

    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("senha").value;

    const botao = formulario.querySelector("button");
    botao.disabled = true;
    botao.textContent = "Entrando...";

    try {
        await signInWithEmailAndPassword(auth, email, senha);
        window.location.href = "index.html";
    } catch (erro) {
        console.error("Erro de login:", erro.code);
        divErro.textContent = "E-mail ou senha inválidos.";
        botao.disabled = false;
        botao.textContent = "Entrar";
    }
});

import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase-config.js";

// Se já estiver logado, pula direto para o app
onAuthStateChanged(auth, (usuario) => {
    if (usuario) window.location.href = "index.html";
});

const formulario = document.getElementById("form-login");
const divErro = document.getElementById("erro");
const campoEmail = document.getElementById("email");
const campoSenha = document.getElementById("senha");
const botaoMostrarSenha = document.getElementById("btn-mostrar-senha");

// Mostrar/ocultar senha (prevenção de erro de digitação)
botaoMostrarSenha?.addEventListener("click", () => {
    const mostrando = campoSenha.type === "text";
    campoSenha.type = mostrando ? "password" : "text";
    const rotulo = mostrando ? "Mostrar senha" : "Ocultar senha";
    botaoMostrarSenha.setAttribute("aria-label", rotulo);
    botaoMostrarSenha.setAttribute("aria-pressed", String(!mostrando));
    botaoMostrarSenha.title = rotulo;
    botaoMostrarSenha.querySelector("use")?.setAttribute("href", `assets/icones.svg#i-${mostrando ? "olho" : "olho-fechado"}`);
    campoSenha.focus();
});

function mostrarErro(texto, campo) {
    divErro.textContent = texto;
    [campoEmail, campoSenha].forEach((c) => c.classList.toggle("campo-invalido", c === campo || (campo === "ambos")));
    if (campo && campo !== "ambos") campo.focus();
}

[campoEmail, campoSenha].forEach((c) => c.addEventListener("input", () => {
    c.classList.remove("campo-invalido");
    if (divErro.textContent) divErro.textContent = "";
}));

formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    divErro.textContent = "";

    const email = campoEmail.value.trim();
    const senha = campoSenha.value;
    if (!email || !campoEmail.checkValidity()) return mostrarErro("Digite um e-mail válido (ex.: voce@email.com).", campoEmail);
    if (!senha) return mostrarErro("Digite a sua senha.", campoSenha);

    const botao = formulario.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Entrando...";

    try {
        await signInWithEmailAndPassword(auth, email, senha);
        window.location.href = "index.html";
    } catch (erro) {
        console.error("Erro de login:", erro.code);
        const semInternet = erro.code === "auth/network-request-failed";
        const muitasTentativas = erro.code === "auth/too-many-requests";
        mostrarErro(semInternet
            ? "Sem conexão com a internet. Confira a rede e tente de novo."
            : muitasTentativas
                ? "Muitas tentativas seguidas. Espere alguns minutos e tente de novo."
                : "E-mail ou senha não conferem. Confira e tente de novo.", semInternet || muitasTentativas ? null : "ambos");
        botao.disabled = false;
        botao.textContent = "Entrar";
    }
});

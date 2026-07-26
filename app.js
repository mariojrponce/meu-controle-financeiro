import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { exigirLogin, ligarBotaoSair } from "./auth-guard.js";

// Bloqueia a página até confirmar que há um usuário logado
const usuario = await exigirLogin();
ligarBotaoSair();

const formulario = document.getElementById("form-transacao");

formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    const botaoSalvar = formulario.querySelector("button");
    botaoSalvar.disabled = true;
    botaoSalvar.innerText = "Salvando...";

    const valor = parseFloat(document.getElementById("valor").value);
    const data = document.getElementById("data").value;
    const descricao = document.getElementById("descricao").value.trim().toUpperCase();
    const banco = document.getElementById("banco").value.trim().toUpperCase();
    const tipo = document.getElementById("tipo").value;
    const tipo_mov = document.getElementById("tipo_mov").value;
    const classificacao_saida = document.getElementById("classificacao_saida").value.trim().toUpperCase();

    // Validação básica no cliente (a validação que realmente protege está nas Firestore Rules)
    if (!valor || valor <= 0 || !descricao || !banco || !classificacao_saida) {
        alert("Preencha todos os campos corretamente.");
        botaoSalvar.disabled = false;
        botaoSalvar.innerText = "Salvar Transação";
        return;
    }

    try {
        await addDoc(collection(db, "transacoes"), {
            userId: usuario.uid,        // 🔑 cada lançamento pertence a este usuário
            valor: valor,
            data: data,
            descricao: descricao,
            banco: banco,
            tipo: tipo,
            tipo_mov: tipo_mov,
            classificacao_saida: classificacao_saida,
            criadoEm: serverTimestamp()
        });

        alert("Transação salva!");
        formulario.reset();
    } catch (erro) {
        console.error("Erro ao salvar: ", erro);
        alert("Erro ao salvar. Tente novamente.");
    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.innerText = "Salvar Transação";
    }
});

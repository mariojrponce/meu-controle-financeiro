import { collection, addDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import { mostrarToast } from "./ui.js";
import { BANCOS_SUGERIDOS, CLASSIFICACOES_SUGERIDAS, mesclarSugestoes, preencherDatalist } from "./dados-comuns.js";
import { brParaISO, normalizarDataDigitada, ligarCampoDataInteligente } from "./utils.js";

const NOME_COLECAO = "carteira";

const usuario = await exigirLogin();
renderizarNav("lancar", usuario.email);

const campoData = document.getElementById("data");
ligarCampoDataInteligente(campoData);

// Busca as transações já cadastradas por este usuário só para extrair
// os bancos e classificações que ele já usou, e sugeri-los de novo.
async function carregarSugestoes() {
    try {
        const consulta = query(collection(db, NOME_COLECAO), where("userId", "==", usuario.uid));
        const snapshot = await getDocs(consulta);

        const bancosUsados = [];
        const classificacoesUsadas = [];
        snapshot.forEach((doc) => {
            const dado = doc.data();
            if (dado.banco) bancosUsados.push(dado.banco);
            if (dado.classificacao_saida) classificacoesUsadas.push(dado.classificacao_saida);
        });

        preencherDatalist("lista-bancos", mesclarSugestoes(BANCOS_SUGERIDOS, bancosUsados));
        preencherDatalist("lista-classificacoes", mesclarSugestoes(CLASSIFICACOES_SUGERIDAS, classificacoesUsadas));
    } catch (erro) {
        console.error("Não foi possível carregar sugestões:", erro);
        preencherDatalist("lista-bancos", BANCOS_SUGERIDOS);
        preencherDatalist("lista-classificacoes", CLASSIFICACOES_SUGERIDAS);
    }
}
carregarSugestoes();

const formulario = document.getElementById("form-transacao");

formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    // Garante que a data foi reconhecida antes de tentar salvar
    const dataNormalizada = normalizarDataDigitada(campoData.value);
    if (dataNormalizada) campoData.value = dataNormalizada;

    const botaoSalvar = formulario.querySelector("button");

    const valor = parseFloat(document.getElementById("valor").value);
    const dataISO = brParaISO(campoData.value);
    const descricao = document.getElementById("descricao").value.trim().toUpperCase();
    const saida = document.getElementById("saida").value.trim().toUpperCase();
    const banco = document.getElementById("banco").value.trim().toUpperCase();
    const tipo = document.getElementById("tipo").value;
    const tipo_mov = document.getElementById("tipo_mov").value;
    const classificacao_saida = document.getElementById("classificacao_saida").value.trim().toUpperCase();

    if (!valor || valor <= 0 || !descricao || !banco || !classificacao_saida) {
        mostrarToast("Preencha todos os campos obrigatórios.", "erro");
        return;
    }
    if (!dataISO) {
        campoData.classList.add("campo-invalido");
        mostrarToast("Data inválida. Use dd/mm/aaaa.", "erro");
        return;
    }

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    try {
        await addDoc(collection(db, NOME_COLECAO), {
            userId: usuario.uid,
            valor,
            data: dataISO,
            descricao,
            saida,
            banco,
            tipo,
            tipo_mov,
            classificacao_saida,
            criadoEm: serverTimestamp()
        });

        mostrarToast("Salvo!", "sucesso");
        formulario.reset();
        carregarSugestoes();
    } catch (erro) {
        console.error("Erro ao salvar: ", erro);
        mostrarToast("Erro ao salvar. Tente novamente.", "erro");
    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar transação";
    }
});

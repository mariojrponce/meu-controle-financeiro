import { collection, addDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import { BANCOS_SUGERIDOS, CLASSIFICACOES_SUGERIDAS, mesclarSugestoes, preencherDatalist } from "./dados-comuns.js";
import { brParaISO, ligarCampoDataInteligente } from "./utils.js";

const usuario = await exigirLogin();
renderizarNav("lancar", usuario.email);

const campoData = document.getElementById("data");
ligarCampoDataInteligente(campoData);

// Busca as transações já cadastradas por este usuário só para extrair
// os bancos e classificações que ele já usou, e sugeri-los de novo.
async function carregarSugestoes() {
    try {
        const consulta = query(collection(db, "transacoes"), where("userId", "==", usuario.uid));
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
        // Mesmo se falhar, deixa pelo menos as sugestões fixas disponíveis
        preencherDatalist("lista-bancos", BANCOS_SUGERIDOS);
        preencherDatalist("lista-classificacoes", CLASSIFICACOES_SUGERIDAS);
    }
}
carregarSugestoes();

const formulario = document.getElementById("form-transacao");

formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    const botaoSalvar = formulario.querySelector("button");
    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    const valor = parseFloat(document.getElementById("valor").value);
    const dataISO = brParaISO(campoData.value);
    const descricao = document.getElementById("descricao").value.trim().toUpperCase();
    const banco = document.getElementById("banco").value.trim().toUpperCase();
    const tipo = document.getElementById("tipo").value;
    const tipo_mov = document.getElementById("tipo_mov").value;
    const classificacao_saida = document.getElementById("classificacao_saida").value.trim().toUpperCase();

    if (!valor || valor <= 0 || !dataISO || !descricao || !banco || !classificacao_saida) {
        alert("Preencha todos os campos corretamente. A data deve estar no formato dd/mm/aaaa.");
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar transação";
        return;
    }

    try {
        await addDoc(collection(db, "transacoes"), {
            userId: usuario.uid,
            valor,
            data: dataISO,
            descricao,
            banco,
            tipo,
            tipo_mov,
            classificacao_saida,
            criadoEm: serverTimestamp()
        });

        alert("Transação salva!");
        formulario.reset();
        carregarSugestoes(); // atualiza sugestões com o que acabou de digitar, se for novo
    } catch (erro) {
        console.error("Erro ao salvar: ", erro);
        alert("Erro ao salvar. Tente novamente.");
    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar transação";
    }
});

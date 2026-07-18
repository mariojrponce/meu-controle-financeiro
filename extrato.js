import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// Variável para guardar TODAS as transações baixadas do banco
let todasTransacoes = []; 

// Função que apenas desenha a tabela na tela baseada em uma lista que enviarmos para ela
function renderizarTabela(listaDeTransacoes) {
    const corpoTabela = document.querySelector("#tabela-transacoes tbody");
    corpoTabela.innerHTML = ""; // Limpa a tabela

    if (listaDeTransacoes.length === 0) {
        corpoTabela.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Nenhuma transação encontrada.</td></tr>";
        return;
    }

    listaDeTransacoes.forEach((transacao) => {
        // 🛡️ BLINDAGEM: Se a transação não tiver data ou valor, ignora ela e pula pra próxima!
        if (!transacao.data || transacao.valor === undefined) {
            return; 
        }

        // --- CONVERSÃO DA DATA ---
        const partesData = transacao.data.split('-'); 
        const dataBR = `${partesData[2]}/${partesData[1]}/${partesData[0]}`; 

        const classeCor = transacao.tipo === "SAIDA" ? "saida" : "entrada";
        const sinal = transacao.tipo === "SAIDA" ? "-" : "+";

        const linha = document.createElement("tr");
        linha.innerHTML = `
            <td>${dataBR}</td>
            <td>${transacao.descricao}</td>
            <td>${transacao.tipo_mov}</td>
            <td>${transacao.banco}</td>
            <td>${transacao.classificacao_saida}</td>
            <td class="${classeCor}"><b>${sinal} R$ ${transacao.valor.toFixed(2)}</b></td>
        `;
        corpoTabela.appendChild(linha);
    });
}

// Função para buscar os dados no Firebase quando a página abre
async function carregarTransacoesDoBanco() {
    const corpoTabela = document.querySelector("#tabela-transacoes tbody");
    corpoTabela.innerHTML = "<tr><td colspan='5' style='text-align:center;'>Carregando dados...</td></tr>";

    try {
        const consulta = query(collection(db, "transacoes"), orderBy("data", "desc"));
        const snapshot = await getDocs(consulta);
        
        todasTransacoes = []; // Limpa a lista local
        
        snapshot.forEach((doc) => {
            todasTransacoes.push(doc.data()); // Guarda cada transação na nossa lista local
        });

        // Desenha a tabela usando todas as transações
        renderizarTabela(todasTransacoes);

    } catch (erro) {
        console.error("Erro ao buscar transações: ", erro);
        corpoTabela.innerHTML = "<tr><td colspan='5'>Erro ao carregar dados. Verifique o console.</td></tr>";
    }
}

// --- LÓGICA DOS FILTROS ---
document.getElementById("btn-filtrar").addEventListener("click", () => {
    // Pegando os valores que você digitou/selecionou nos filtros
    const dataInicio = document.getElementById("filtro-data-inicio").value;
    const dataFim = document.getElementById("filtro-data-fim").value;
    const bancoFiltro = document.getElementById("filtro-banco").value.toUpperCase(); // Tudo maiúsculo
    const movFiltro = document.getElementById("filtro-movimentacao").value;

    // Criando uma cópia da lista completa para podermos filtrar sem perder a original
    let listaFiltrada = todasTransacoes;

    // Se preencheu data início, pega só as datas maiores ou iguais
    if (dataInicio !== "") {
        listaFiltrada = listaFiltrada.filter(t => t.data >= dataInicio);
    }

    // Se preencheu data fim, pega só as datas menores ou iguais
    if (dataFim !== "") {
        listaFiltrada = listaFiltrada.filter(t => t.data <= dataFim);
    }

    // Se digitou algo no banco, verifica se o nome do banco contém o que foi digitado
    if (bancoFiltro !== "") {
        listaFiltrada = listaFiltrada.filter(t => t.banco.includes(bancoFiltro));
    }

    // Se escolheu Interno ou Externo
    if (movFiltro !== "") {
        listaFiltrada = listaFiltrada.filter(t => t.tipo_mov === movFiltro);
    }

    // Manda desenhar a tabela novamente, mas agora só com a lista filtrada!
    renderizarTabela(listaFiltrada);
});

// Botão de Limpar Filtros
document.getElementById("btn-limpar").addEventListener("click", () => {
    document.getElementById("filtro-data-inicio").value = "";
    document.getElementById("filtro-data-fim").value = "";
    document.getElementById("filtro-banco").value = "";
    document.getElementById("filtro-movimentacao").value = "";
    
    // Devolve a tabela ao estado original
    renderizarTabela(todasTransacoes);
});

// Executa a busca inicial ao abrir a página
carregarTransacoesDoBanco();
import { collection, doc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { exigirLogin } from "./auth-guard.js";
import { renderizarNav } from "./nav.js";
import { mostrarToast, confirmarAcao } from "./ui.js";
import { mapearCabecalhos, processarLinha, CAMPOS_OBRIGATORIOS } from "./importacao.js";
import { formatarMoeda, isoParaBR } from "./utils.js";

const NOME_COLECAO = "carteira";
const TAMANHO_LOTE = 400; // Firestore aceita até 500 operações por lote; deixamos margem

const usuario = await exigirLogin();
renderizarNav("importar", usuario.email);

let linhasProcessadas = [];

const inputArquivo = document.getElementById("input-arquivo");
const areaPreview = document.getElementById("area-preview");
const resumoImportacao = document.getElementById("resumo-importacao");
const botaoImportar = document.getElementById("btn-importar");

inputArquivo.addEventListener("change", async (evento) => {
    const arquivo = evento.target.files[0];
    if (!arquivo) return;

    linhasProcessadas = [];
    botaoImportar.style.display = "none";
    resumoImportacao.innerHTML = "";
    areaPreview.innerHTML = "<p class='vazio'>Lendo arquivo...</p>";

    try {
        const linhasBrutas = await lerArquivo(arquivo);

        if (linhasBrutas.length === 0) {
            areaPreview.innerHTML = "<p class='vazio'>O arquivo não tem nenhuma linha de dados.</p>";
            return;
        }

        const mapaColunas = mapearCabecalhos(linhasBrutas[0]);
        const faltando = CAMPOS_OBRIGATORIOS.filter((campo) => mapaColunas[campo] === undefined);

        if (faltando.length > 0) {
            areaPreview.innerHTML = "";
            mostrarToast(`Não encontrei as colunas: ${faltando.join(", ")}`, "erro");
            return;
        }

        linhasProcessadas = linhasBrutas.map((linha) => processarLinha(linha, mapaColunas));
        renderizarResumoEPreview(linhasProcessadas);

    } catch (erro) {
        console.error("Erro ao ler arquivo:", erro);
        areaPreview.innerHTML = "";
        mostrarToast("Não foi possível ler esse arquivo.", "erro");
    }
});

function lerArquivo(arquivo) {
    return new Promise((resolve, reject) => {
        const nome = arquivo.name.toLowerCase();
        const ehTexto = nome.endsWith(".csv") || nome.endsWith(".txt");
        const leitor = new FileReader();

        leitor.onerror = () => reject(new Error("Falha ao ler o arquivo"));
        leitor.onload = () => {
            try {
                const workbook = ehTexto
                    ? XLSX.read(leitor.result, { type: "string", cellDates: true })
                    : XLSX.read(leitor.result, { type: "array", cellDates: true });

                const primeiraAba = workbook.Sheets[workbook.SheetNames[0]];
                const linhas = XLSX.utils.sheet_to_json(primeiraAba, { defval: "" });
                resolve(linhas);
            } catch (erroLeitura) {
                reject(erroLeitura);
            }
        };

        if (ehTexto) leitor.readAsText(arquivo, "UTF-8");
        else leitor.readAsArrayBuffer(arquivo);
    });
}

function renderizarResumoEPreview(linhas) {
    const validas = linhas.filter((l) => l.valido);
    const invalidas = linhas.length - validas.length;

    resumoImportacao.innerHTML = "";
    const container = document.createElement("div");
    container.className = "resumo-linhas";

    const pilulaOk = document.createElement("span");
    pilulaOk.className = "pilula pilula-ok";
    pilulaOk.textContent = `✅ ${validas.length} prontas para importar`;
    container.appendChild(pilulaOk);

    if (invalidas > 0) {
        const pilulaErro = document.createElement("span");
        pilulaErro.className = "pilula pilula-erro";
        pilulaErro.textContent = `⚠️ ${invalidas} com erro (não serão importadas)`;
        container.appendChild(pilulaErro);
    }
    resumoImportacao.appendChild(container);

    areaPreview.innerHTML = "";
    const wrapperTabela = document.createElement("div");
    wrapperTabela.className = "tabela-scroll";

    const tabela = document.createElement("table");
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>#</th><th>Data</th><th>Descrição</th><th>Banco</th><th>Tipo</th><th>Valor</th><th>Status</th></tr>";
    tabela.appendChild(thead);

    const tbody = document.createElement("tbody");
    linhas.forEach((linha, indice) => {
        const tr = document.createElement("tr");

        const celulaTexto = (texto) => {
            const td = document.createElement("td");
            td.textContent = texto;
            return td;
        };

        tr.appendChild(celulaTexto(String(indice + 1)));
        tr.appendChild(celulaTexto(linha.dados.data ? isoParaBR(linha.dados.data) : "—"));
        tr.appendChild(celulaTexto(linha.dados.descricao || "—"));
        tr.appendChild(celulaTexto(linha.dados.banco || "—"));
        tr.appendChild(celulaTexto(linha.dados.tipo || "—"));
        tr.appendChild(celulaTexto(Number.isFinite(linha.dados.valor) ? `R$ ${formatarMoeda(linha.dados.valor)}` : "—"));

        const tdStatus = document.createElement("td");
        if (linha.valido) {
            tdStatus.className = "status-ok";
            tdStatus.textContent = "✅ Válida";
        } else {
            tdStatus.className = "status-erro";
            tdStatus.textContent = "❌ Erro";
            tdStatus.title = linha.erros.join(", ");
        }
        tr.appendChild(tdStatus);

        tbody.appendChild(tr);
    });
    tabela.appendChild(tbody);
    wrapperTabela.appendChild(tabela);
    areaPreview.appendChild(wrapperTabela);

    botaoImportar.style.display = validas.length > 0 ? "inline-flex" : "none";
    botaoImportar.textContent = `Importar ${validas.length} lançamento${validas.length === 1 ? "" : "s"} válido${validas.length === 1 ? "" : "s"}`;
}

botaoImportar.addEventListener("click", async () => {
    const validas = linhasProcessadas.filter((l) => l.valido);
    if (validas.length === 0) return;

    const confirmou = await confirmarAcao({
        titulo: `Importar ${validas.length} lançamentos?`,
        mensagem: `Isso vai criar ${validas.length} novo(s) lançamento(s) na sua carteira. As linhas com erro não serão importadas.`,
        textoConfirmar: "Importar",
        textoCancelar: "Cancelar"
    });
    if (!confirmou) return;

    botaoImportar.disabled = true;

    try {
        await importarEmLotes(validas, (feitos, total) => {
            botaoImportar.textContent = `Importando... ${feitos}/${total}`;
        });

        mostrarToast(`${validas.length} lançamento(s) importado(s)!`, "sucesso");
        linhasProcessadas = [];
        areaPreview.innerHTML = "";
        resumoImportacao.innerHTML = "";
        botaoImportar.style.display = "none";
        inputArquivo.value = "";

    } catch (erro) {
        console.error("Erro ao importar:", erro);
        mostrarToast("Erro durante a importação. Confira o extrato — parte pode já ter sido salva.", "erro");
    } finally {
        botaoImportar.disabled = false;
    }
});

async function importarEmLotes(linhasValidas, aoProgredir) {
    let feitos = 0;
    for (let i = 0; i < linhasValidas.length; i += TAMANHO_LOTE) {
        const fatia = linhasValidas.slice(i, i + TAMANHO_LOTE);
        const lote = writeBatch(db);

        fatia.forEach((linha) => {
            const referencia = doc(collection(db, NOME_COLECAO));
            lote.set(referencia, {
                userId: usuario.uid,
                ...linha.dados,
                criadoEm: serverTimestamp()
            });
        });

        await lote.commit();
        feitos += fatia.length;
        aoProgredir(feitos, linhasValidas.length);
    }
}

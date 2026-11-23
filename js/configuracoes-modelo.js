// configuracoes-modelo.js
// O que cada usuário pode ajustar na tela Configurações — sem DOM e sem
// Firebase, testável no Node:
//   - bancos e classificações sugeridos ao lançar;
//   - bancos que são vale (alimentação/refeição);
//   - regras de equiparação de categorias (finalidade.js).
// Quem nunca salvou nada usa o padrão do sistema.
import { BANCOS_SUGERIDOS_PADRAO, CLASSIFICACOES_SUGERIDAS_PADRAO, definirSugestoes } from "./dados-comuns.js";
import { BANCOS_VALE_PADRAO, definirBancosVale } from "./vale.js";
import { REGRAS_PADRAO, definirRegrasDeFinalidade, limparRegra } from "./finalidade.js";

export const LIMITE_ITENS = 300;      // por lista (igual ao limite das regras do Firestore)
export const TAMANHO_MAXIMO_NOME = 60; // mesmo maxlength dos campos de banco/classificação

export function configuracoesPadrao() {
  return {
    bancos: [...BANCOS_SUGERIDOS_PADRAO],
    classificacoes: [...CLASSIFICACOES_SUGERIDAS_PADRAO],
    bancosVale: [...BANCOS_VALE_PADRAO],
    regras: REGRAS_PADRAO.map((r) => ({ ...r, de: [...r.de] })),
    recorrencias: []
  };
}

// Nome de banco/classificação como é gravado nos lançamentos: aparado e em maiúsculas.
export function limparNome(texto) {
  return String(texto ?? "").replace(/\s+/g, " ").trim().toUpperCase().slice(0, TAMANHO_MAXIMO_NOME);
}

function limparLista(lista, padrao) {
  if (!Array.isArray(lista)) return [...padrao];
  return [...new Set(lista.map(limparNome).filter(Boolean))].slice(0, LIMITE_ITENS);
}

// Devolve as configurações completas e limpas a partir do que veio do banco/da
// tela. Lista que não veio (ou veio estragada) fica com o padrão; lista vazia
// é respeitada (o usuário pode não querer nenhuma sugestão/regra).
export function limparConfiguracoes(bruto) {
  const padrao = configuracoesPadrao();
  return {
    bancos: limparLista(bruto?.bancos, padrao.bancos),
    classificacoes: limparLista(bruto?.classificacoes, padrao.classificacoes),
    bancosVale: limparLista(bruto?.bancosVale, padrao.bancosVale),
    regras: Array.isArray(bruto?.regras) ? bruto.regras.map(limparRegra).filter(Boolean).slice(0, LIMITE_ITENS) : padrao.regras,
    recorrencias: Array.isArray(bruto?.recorrencias) ? bruto.recorrencias.map((r) => {
      if (!r || typeof r.id !== "string" || typeof r.valor !== "number" || r.valor <= 0 || !Number.isInteger(r.dia) || r.dia < 1 || r.dia > 31) return null;
      const texto = (v, n) => String(v ?? "").trim().slice(0, n);
      const tipo = r.tipo === "ENTRADA" ? "ENTRADA" : "SAIDA";
      return { id: r.id.slice(0, 80), ativo: r.ativo !== false, valor: r.valor, dia: r.dia, tipo,
        descricao: texto(r.descricao, 120), saida: texto(r.saida, 120), banco: texto(r.banco, 60),
        classificacao_saida: texto(r.classificacao_saida, 60), tipo_mov: r.tipo_mov === "INTERNO" ? "INTERNO" : "EXTERNO" };
    }).filter(r => r && r.descricao && r.banco && r.classificacao_saida).slice(0, 100) : []
  };
}

// Põe as configurações em uso nesta página (sugestões, vale e equiparação).
export function aplicarConfiguracoes(config) {
  const limpa = limparConfiguracoes(config);
  definirSugestoes({ bancos: limpa.bancos, classificacoes: limpa.classificacoes });
  definirBancosVale(limpa.bancosVale);
  definirRegrasDeFinalidade(limpa.regras);
  return limpa;
}

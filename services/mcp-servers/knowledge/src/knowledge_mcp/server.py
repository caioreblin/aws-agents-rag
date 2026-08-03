"""Servidor MCP de conhecimento (transporte stdio).

Expõe as ferramentas do agente atrás do Model Context Protocol. O núcleo do
agente conecta como cliente MCP e **descobre/invoca** estas tools sem conhecer a
implementação — trocar o conjunto de ferramentas é reconfigurar este servidor,
sem tocar no loop do agente.

As tools são declaradas com o decorator `@mcp.tool()`: a assinatura tipada vira
o schema de entrada e a docstring vira a descrição que o modelo enxerga.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone as dt_timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from mcp.server.fastmcp import FastMCP

from knowledge_mcp.calculator import CalculatorError, evaluate_expression
from knowledge_mcp.retrieval import MAX_TOP_K, RetrievalError, format_passages, retrieve

mcp = FastMCP("knowledge")


@mcp.tool()
def get_current_time(timezone_name: str = "UTC") -> str:
    """Retorna a data/hora atual em ISO 8601.

    timezone_name: nome IANA do fuso (ex.: 'America/Sao_Paulo'). Padrão: 'UTC'.
    """
    if timezone_name.strip().upper() == "UTC":
        tz = dt_timezone.utc
    else:
        try:
            tz = ZoneInfo(timezone_name)
        except (ZoneInfoNotFoundError, ValueError):
            return (
                f"Timezone desconhecido: {timezone_name!r}. "
                "Use um nome IANA como 'America/Sao_Paulo'."
            )
    return datetime.now(tz).isoformat()


@mcp.tool()
def calculator(expression: str) -> str:
    """Avalia uma expressão aritmética simples de forma segura.

    Suporta + - * / // % ** e parênteses. Ex.: '12 * (3 + 4)'.
    """
    try:
        return str(evaluate_expression(expression))
    except CalculatorError as exc:
        return f"Expressão inválida: {exc}"


@mcp.tool()
def echo_note(note: str) -> str:
    """Registra uma nota curta (placeholder de 'ação') e devolve confirmação."""
    text = note.strip()
    if not text:
        return "Nota vazia — nada registrado."
    return f"Nota registrada: {text}"


@mcp.tool()
def word_count(text: str) -> str:
    """Conta quantas palavras há no texto informado."""
    return f"{len(text.split())} palavra(s)."


@mcp.tool()
def search_knowledge_base(query: str, top_k: int = 5) -> str:
    """Busca trechos relevantes na base de conhecimento (RAG) do projeto.

    Use para responder perguntas sobre o projeto/documentação com base em fatos
    recuperados, em vez de adivinhar. Retorna trechos numerados, cada um com a
    fonte (arquivo/URI) — cite a fonte na resposta. Se nada for encontrado, diga
    que não há informação na base; não invente.

    query: pergunta ou termos de busca em linguagem natural.
    top_k: quantos trechos retornar (1-10). Padrão: 5.
    """
    kb_id = os.environ.get("KNOWLEDGE_BASE_ID", "").strip()
    if not kb_id:
        # Degradação graciosa: sem KB configurada, a tool não quebra o loop.
        return "RAG indisponível: KNOWLEDGE_BASE_ID não configurado."
    text = query.strip()
    if not text:
        return "Consulta vazia — informe uma pergunta ou termos de busca."
    top_k = max(1, min(int(top_k), MAX_TOP_K))
    region = os.environ.get("AWS_REGION", "us-east-1")
    try:
        passages = retrieve(text, top_k, kb_id, region)
    except RetrievalError as exc:
        return f"Falha ao consultar a base de conhecimento: {exc}"
    return format_passages(passages)


def main() -> None:
    """Entrypoint: roda o servidor MCP no transporte stdio."""
    mcp.run()


if __name__ == "__main__":
    main()

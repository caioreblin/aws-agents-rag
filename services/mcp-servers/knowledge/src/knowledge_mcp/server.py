"""Servidor MCP de conhecimento (transporte stdio).

Expõe as ferramentas do agente atrás do Model Context Protocol. O núcleo do
agente conecta como cliente MCP e **descobre/invoca** estas tools sem conhecer a
implementação — trocar o conjunto de ferramentas é reconfigurar este servidor,
sem tocar no loop do agente.

As tools são declaradas com o decorator `@mcp.tool()`: a assinatura tipada vira
o schema de entrada e a docstring vira a descrição que o modelo enxerga.
"""

from __future__ import annotations

from datetime import datetime, timezone as dt_timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from mcp.server.fastmcp import FastMCP

from knowledge_mcp.calculator import CalculatorError, evaluate_expression

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


def main() -> None:
    """Entrypoint: roda o servidor MCP no transporte stdio."""
    mcp.run()


if __name__ == "__main__":
    main()

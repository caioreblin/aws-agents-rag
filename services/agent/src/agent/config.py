"""Configuração do agente, vinda de variáveis de ambiente (validadas).

Mantém literais fora do código e permite trocar modelo, caps de segurança e o
comando do servidor MCP sem alterar a lógica. A flag `bedrock_mock` permite
desenvolver o loop sem depender do Bedrock (útil enquanto a cota de conta nova
não é liberada — ver spec da Fase 1).
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field


def _as_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class AgentConfig:
    """Configuração imutável do agente."""

    model_id: str
    region: str
    max_tokens: int
    max_iterations: int
    temperature: float
    bedrock_mock: bool
    mcp_command: str
    mcp_args: list[str] = field(default_factory=list)


def load_config() -> AgentConfig:
    """Lê a configuração do ambiente, aplicando defaults sensatos."""
    return AgentConfig(
        # Haiku 4.5 exige inference profile em us-east-1 (ver design da Fase 1).
        model_id=os.getenv("BEDROCK_MODEL_ID", "us.anthropic.claude-haiku-4-5-20251001-v1:0"),
        region=os.getenv("AWS_REGION", "us-east-1"),
        max_tokens=int(os.getenv("AGENT_MAX_TOKENS", "1024")),
        # Cap de iterações do loop agêntico — evita loop infinito de tool calls.
        max_iterations=int(os.getenv("AGENT_MAX_ITERATIONS", "6")),
        temperature=float(os.getenv("AGENT_TEMPERATURE", "0.2")),
        bedrock_mock=_as_bool(os.getenv("BEDROCK_MOCK", "false")),
        # Como subir o servidor MCP de conhecimento (subprocesso stdio).
        mcp_command=os.getenv("MCP_SERVER_COMMAND", sys.executable),
        mcp_args=os.getenv("MCP_SERVER_ARGS", "-m knowledge_mcp.server").split(),
    )

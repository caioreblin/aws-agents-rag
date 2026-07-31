"""Loop agêntico do agente (Strands + Bedrock), com modo mock.

Fluxo:
1. sobe o servidor MCP e descobre as tools (via `mcp_client`);
2. monta o `Agent` do Strands com o `BedrockModel` (Claude Haiku 4.5) e caps de
   segurança, OU — quando `BEDROCK_MOCK=true` — usa um responder mock que já
   exercita a chamada de tool via MCP (para desenvolver sem depender da cota).

Caps de segurança (R4): `max_tokens` no modelo, `MaxToolCalls` (limite de
iterações de tool no loop) e o timeout da Lambda (definido na infra).
"""

from __future__ import annotations

import re
from typing import Any

from strands import Agent
from strands.hooks import (
    BeforeInvocationEvent,
    BeforeToolCallEvent,
    HookProvider,
    HookRegistry,
)
from strands.models import BedrockModel

from agent.config import AgentConfig, load_config
from agent.mcp_client import build_knowledge_mcp_client
from agent.prompts import SYSTEM_PROMPT


class MaxToolCalls(HookProvider):
    """Cancela chamadas de tool após um teto por invocação (cap de iterações).

    Evita loop agêntico infinito: quando o agente excede `max_calls` chamadas de
    ferramenta numa mesma invocação, as próximas são canceladas com uma mensagem
    que instrui o modelo a concluir com o que já tem.
    """

    def __init__(self, max_calls: int) -> None:
        self.max_calls = max_calls
        self._count = 0

    def register_hooks(self, registry: HookRegistry) -> None:
        registry.add_callback(BeforeInvocationEvent, self._reset)
        registry.add_callback(BeforeToolCallEvent, self._intercept)

    def _reset(self, event: BeforeInvocationEvent) -> None:
        self._count = 0

    def _intercept(self, event: BeforeToolCallEvent) -> None:
        self._count += 1
        if self._count > self.max_calls:
            event.cancel_tool = (
                "Limite de chamadas de ferramenta atingido. "
                "Responda agora com as informações que já obteve."
            )


def run_agent(message: str, correlation_id: str, config: AgentConfig | None = None) -> str:
    """Executa o agente para uma mensagem e retorna a resposta em texto.

    Descobre as tools via MCP e roda o loop (real ou mock). O `correlation_id` é
    propagado para os logs pelo handler (Fase 1, 1.5).
    """
    config = config or load_config()
    mcp_client = build_knowledge_mcp_client(config)
    with mcp_client:
        tools = mcp_client.list_tools_sync()
        if config.bedrock_mock:
            return _run_mock(message, mcp_client, tools)
        return _run_bedrock(message, tools, config)


def _run_bedrock(message: str, tools: list[Any], config: AgentConfig) -> str:
    """Caminho de produção: Strands Agent + BedrockModel (Claude Haiku 4.5)."""
    model = BedrockModel(
        model_id=config.model_id,
        region_name=config.region,
        max_tokens=config.max_tokens,
        temperature=config.temperature,
    )
    agent = Agent(
        model=model,
        tools=tools,
        system_prompt=SYSTEM_PROMPT,
        hooks=[MaxToolCalls(config.max_iterations)],
    )
    return str(agent(message))


def _run_mock(message: str, mcp_client: Any, tools: list[Any]) -> str:
    """Caminho mock: sem Bedrock, mas exercita a chamada de tool via MCP.

    Heurística simples escolhe uma ferramenta a partir da mensagem, invoca-a por
    MCP (`call_tool_sync`) e devolve uma resposta rotulada como mock. Serve para
    desenvolver/demonstrar o fluxo enquanto a cota do Bedrock não é liberada.
    """
    available = {getattr(t, "tool_name", getattr(t, "name", "")) for t in tools}
    name, arguments = _pick_tool(message)
    if name not in available:
        name, arguments = "echo_note", {"note": message}

    result = mcp_client.call_tool_sync(
        tool_use_id="mock-1", name=name, arguments=arguments
    )
    tool_output = _extract_text(result)
    return (
        f"[MOCK] Usei a ferramenta `{name}` (Bedrock desativado). "
        f"Resultado: {tool_output}"
    )


def _pick_tool(message: str) -> tuple[str, dict[str, Any]]:
    """Heurística do modo mock para escolher uma tool a partir da mensagem."""
    lowered = message.lower()
    if re.search(r"\d\s*[-+*/]\s*\d", message):
        expression = re.sub(r"[^0-9+\-*/().%\s]", "", message).strip()
        return "calculator", {"expression": expression}
    if any(word in lowered for word in ("hora", "horas", "time", "que dia")):
        return "get_current_time", {}
    return "echo_note", {"note": message}


def _extract_text(result: Any) -> str:
    """Extrai o texto de um resultado de tool MCP (formato ToolResult do Strands)."""
    if isinstance(result, dict):
        content = result.get("content")
        if isinstance(content, list):
            parts = [
                item.get("text")
                for item in content
                if isinstance(item, dict) and item.get("text")
            ]
            if parts:
                return "\n".join(parts)
    return str(result)

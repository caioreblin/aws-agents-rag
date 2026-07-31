"""Cliente MCP do núcleo do agente.

O núcleo **só conhece o protocolo**: conecta a um servidor MCP, descobre as tools
(`list_tools_sync`) e as entrega ao agente. Ele não importa a implementação de
nenhuma ferramenta — trocar o conjunto de tools é reconfigurar qual servidor MCP
subir (env `MCP_SERVER_COMMAND`/`MCP_SERVER_ARGS`), sem tocar no loop. É o que
destrava, no futuro, migrar de tools de conhecimento para tools de Ops.
"""

from __future__ import annotations

import os

from mcp import StdioServerParameters, stdio_client
from strands.tools.mcp import MCPClient

from agent.config import AgentConfig


def _subprocess_env() -> dict[str, str]:
    """Ambiente do subprocesso MCP, garantindo que `knowledge_mcp` seja encontrado.

    Na Lambda o pacote é vendorizado em `LAMBDA_TASK_ROOT` (/var/task), fora do
    site-packages — então incluímos essa raiz (e o cwd) no `PYTHONPATH`.
    """
    env = dict(os.environ)
    roots = [os.environ.get("LAMBDA_TASK_ROOT"), os.getcwd()]
    existing = env.get("PYTHONPATH", "")
    parts = [p for p in roots if p]
    if existing:
        parts.append(existing)
    if parts:
        env["PYTHONPATH"] = os.pathsep.join(parts)
    return env


def build_knowledge_mcp_client(config: AgentConfig) -> MCPClient:
    """Constrói o cliente MCP (transporte stdio) para o servidor de conhecimento.

    Retorna um :class:`MCPClient` que deve ser usado como context manager; dentro
    do `with`, use `list_tools_sync()` para obter as tools ou passe o próprio
    client em `Agent(tools=[client])` para gestão automática do ciclo de vida.
    """
    return MCPClient(
        lambda: stdio_client(
            StdioServerParameters(
                command=config.mcp_command,
                args=config.mcp_args,
                env=_subprocess_env(),
            )
        )
    )


def list_tool_names(config: AgentConfig) -> list[str]:
    """Sobe o servidor MCP, lista as tools e retorna seus nomes (para validação)."""
    client = build_knowledge_mcp_client(config)
    with client:
        tools = client.list_tools_sync()
    names: list[str] = []
    for tool in tools:
        name = getattr(tool, "tool_name", None) or getattr(tool, "name", None)
        names.append(str(name))
    return names

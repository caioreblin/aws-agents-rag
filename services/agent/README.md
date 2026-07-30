# services/agent/ — Núcleo do agente (Python)

Lambda Python com o **loop agêntico** (framework: **Strands Agents**). Consome
ferramentas **exclusivamente via MCP** — nunca conhece a implementação concreta
de uma tool, para permitir troca plug-and-play do conjunto de ferramentas.

**Vazio por enquanto** — implementado a partir da Fase 1.

## Layout planejado

```
src/agent/
  handler.py     # entrypoint Lambda (fino)
  loop.py        # loop agêntico (Strands)
  mcp_client.py  # conexão/descoberta/invocação de tools via MCP
  memory/        # repositório DynamoDB (single-table, TTL) — Fase 2
  prompts/
tests/
pyproject.toml   # gerenciado com uv; runtime alvo Python 3.12
```

## Princípios

- Handler fino: valida entrada, delega ao loop, traduz resposta/erro.
- Cap de segurança: máximo de iterações do loop + `max_tokens` no Bedrock.
- Logs estruturados JSON com `correlationId`.
- Sem permissões de Ops — o núcleo só fala MCP.

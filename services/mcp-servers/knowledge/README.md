# services/mcp-servers/knowledge/ — Servidor MCP de conhecimento (Python)

Expõe as **tools** de conhecimento/ação do agente atrás do **Model Context
Protocol (MCP)**. Começa como servidor in-process/stdio (Fases 1–3) e pode virar
um deployable próprio com IAM role restrita na Fase 4.

**Vazio por enquanto** — implementado a partir da Fase 1 (2–3 tools simples) e
expandido na Fase 2 (`search_knowledge_base` com citações).

## Por que MCP desde a v1

O núcleo do agente só conhece "conectar → listar tools → invocar". Trocar o
conjunto de tools (ex.: futuramente, tools read-only de Ops da AWS na v2) vira
**apontar para outro servidor MCP com role própria**, sem tocar no loop do agente.

> A pasta irmã `ops/` (v2, Ops read-only sobre a conta AWS) **não existe ainda** —
> está fora do escopo atual. A arquitetura MCP é o que destrava essa migração.

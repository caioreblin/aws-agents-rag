# ADR 0007 — Ferramentas atrás de MCP (stdio in-process) desde a v1

**Status:** Aceito · **Data:** 2026-07-31 · **Fase:** 1

## Contexto
Requisito central do projeto: a troca do conjunto de ferramentas deve ser
plug-and-play, sem refatorar o núcleo do agente (para, no futuro, migrar de tools
de conhecimento para tools read-only de Ops da AWS).

## Decisão
Expor as tools por um **servidor MCP** (`services/mcp-servers/knowledge/`) e o
núcleo consumi-las como **cliente MCP**. Na Fase 1, o servidor roda como
**subprocesso stdio** dentro da própria Lambda do agente; o núcleo só faz
`list_tools`/`call_tool` e **nunca importa a implementação** das ferramentas.

No empacotamento, ambos os pacotes (`agent` e `knowledge_mcp`) são vendorizados na
Lambda; o subprocesso encontra `knowledge_mcp` via `PYTHONPATH` incluindo
`LAMBDA_TASK_ROOT` (ver `mcp_client.py`).

## Consequências
- **Positivo:** provado que adicionar uma tool (ex.: `word_count`) só toca o
  servidor MCP — o núcleo passa a descobri-la/usá-la sem alteração.
- **Custo:** subir o subprocesso adiciona latência de cold start — aceitável para
  estudo.
- **Evolução:** na Fase 4, o servidor MCP pode virar um deployable próprio com IAM
  role restrita; o núcleo não muda (só a config de qual servidor subir).

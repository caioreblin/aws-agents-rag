# services/mcp-servers/knowledge/ — Servidor MCP de conhecimento (Python)

Expõe as **tools** de conhecimento/ação do agente atrás do **Model Context
Protocol (MCP)**. Começa como servidor in-process/stdio (Fases 1–3) e pode virar
um deployable próprio com IAM role restrita na Fase 4.

## Tools expostas

| Tool | O que faz |
|---|---|
| `get_current_time` | Data/hora atual em ISO 8601 (fuso IANA opcional). |
| `calculator` | Avalia expressão aritmética simples de forma segura. |
| `echo_note` | Registra uma nota curta (placeholder de "ação"). |
| `word_count` | Conta palavras de um texto. |
| `search_knowledge_base` | **RAG** — busca trechos na Bedrock Knowledge Base (`bedrock-agent-runtime.retrieve`) e devolve trechos numerados **com a fonte (arquivo/URI)** para citação. |

`search_knowledge_base` (Fase 2.7) lê `KNOWLEDGE_BASE_ID` e `AWS_REGION` do
ambiente (o subprocesso MCP herda o env da Lambda do agente; a KB id é injetada
pelo cross-stack no item 2.8). Sem `KNOWLEDGE_BASE_ID`, a tool degrada de forma
graciosa (não quebra o loop). A integração vive em `retrieval.py`; o `server.py`
só declara a tool. Usa `retrieve` puro (não `retrieve_and_generate`): **quem
compõe a resposta e cita é o agente (Claude)** no loop.

## Por que MCP desde a v1

O núcleo do agente só conhece "conectar → listar tools → invocar". Trocar o
conjunto de tools (ex.: futuramente, tools read-only de Ops da AWS na v2) vira
**apontar para outro servidor MCP com role própria**, sem tocar no loop do agente.

> A pasta irmã `ops/` (v2, Ops read-only sobre a conta AWS) **não existe ainda** —
> está fora do escopo atual. A arquitetura MCP é o que destrava essa migração.

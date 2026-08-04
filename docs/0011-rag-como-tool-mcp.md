# ADR 0011 — RAG como tool MCP (`search_knowledge_base`)

**Status:** Aceito · **Data:** 2026-08-03 · **Fase:** 2

## Contexto
O RAG precisa entrar no agente sem tocar o núcleo (loop), reforçando o
plug-and-play já estabelecido no [ADR 0007](0007-tools-via-mcp-stdio.md). Há
duas formas de usar a Knowledge Base: `retrieve` (só recupera trechos) ou
`retrieve_and_generate` (a KB também compõe a resposta).

## Decisão
Expor a busca como **mais uma tool no servidor MCP de conhecimento**:
`search_knowledge_base` usa **`bedrock-agent-runtime.retrieve` puro** e devolve
os trechos **com a citação (arquivo/URI)** de cada um. **Quem compõe a resposta
fundamentada e cita é o agente (Claude)** no loop — a composição fica no agente,
não na KB.

A integração vive isolada em `retrieval.py` (`retrieve` + `format_passages`,
erro tipado `RetrievalError`); o `server.py` só declara a tool fina. A tool lê
`KNOWLEDGE_BASE_ID`/`AWS_REGION` do ambiente (o subprocesso MCP herda o env da
Lambda; a KB id é injetada pelo cross-stack — [ADR 0009](0009-memoria-dynamodb-single-table.md)
e a `agent-stack`). Sem `KNOWLEDGE_BASE_ID`, degrada de forma graciosa.

## Consequências
- **Positivo:** o núcleo do agente permanece intacto — RAG é descoberto/invocado
  como qualquer tool (5ª tool listada); reprova o plug-and-play do ADR 0007.
- **Positivo:** `retrieve` puro mantém a composição e a citação no controle do
  agente (melhor para transparência e para o system prompt exigir citar fontes).
- **Custo/limite:** a tool consulta a KB, que embeda a query — sujeita à mesma
  cota de embeddings do [ADR 0010](0010-rag-bedrock-kb-s3-vectors.md); enquanto a
  cota estiver zerada, a tool retorna erro tratado (não quebra o loop).
- **IAM:** a Lambda do agente recebe `bedrock:Retrieve` escopado no ARN da KB
  (least-privilege, via cross-stack).

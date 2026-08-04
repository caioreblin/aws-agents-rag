# Conceitos — RAG vs. KB vs. MCP (quem faz o quê)

Nota de estudo (não é um ADR). Esclarece três termos que se confundem com
facilidade neste projeto, porque vivem em **camadas diferentes** e ainda por
cima **se cruzam**: no nosso design o RAG é entregue *através* do MCP.

Decisões relacionadas: [ADR 0007](0007-tools-via-mcp-stdio.md) (tools via MCP),
[ADR 0010](0010-rag-bedrock-kb-s3-vectors.md) (RAG com KB + S3 Vectors),
[ADR 0011](0011-rag-como-tool-mcp.md) (RAG exposto como tool MCP).

## Vocabulário

| Sigla | Significa | O que é no projeto |
|---|---|---|
| **RAG** | Retrieval-Augmented Generation | O **padrão**: recuperar conhecimento relevante e injetar no contexto do modelo, respondendo com citações. |
| **KB** | (Bedrock) Knowledge Base | O **serviço gerenciado** que *implementa* o RAG: ingere os `.md` do S3, gera embeddings (Titan V2), guarda no S3 Vectors e faz o `retrieve`. |
| **MCP** | Model Context Protocol | O **cano** plug-and-play de ferramentas: expõe e transporta chamadas de tools. Não decide nada. |

Resumo de uma linha: **MCP = encanamento · Inteligência = agente · Conhecimento = RAG (implementado pela KB).**

## A confusão clássica (e a correção)

> ❌ "O MCP é o que sabe o que procurar no RAG."

**MCP não sabe nada** — é burro de propósito, e é isso que o torna plug-and-play.

**Quem decide o que procurar é o agente** (o modelo — Claude no loop Strands).
O agente lê a pergunta, decide que precisa buscar, **formula a query** e chama a
tool `search_knowledge_base`. O MCP só transporta essa chamada até a KB; a KB faz
a busca por similaridade e devolve os trechos (com citação) pelo mesmo cano.

## Fluxo (quem faz o quê)

```
Usuário pergunta
   │
   ▼
AGENTE (o "cérebro" — decide E formula a query)
   │  "buscar: X"
   ▼
MCP  (o cano — só transporta, não decide nada)
   │
   ▼
RAG / KB  (busca por similaridade nos embeddings; retrieve)
   │  devolve passages + citações
   ▼
MCP  (transporta de volta)
   │
   ▼
AGENTE  (usa os trechos para compor a resposta com fontes)
```

## Notas para não tropeçar

- **RAG ≠ memória.** A memória de conversa (DynamoDB, [ADR 0009](0009-memoria-dynamodb-single-table.md))
  é o histórico *desta* conversa, injetado direto no handler. RAG é conhecimento
  *externo e permanente*, recuperado por similaridade. São coisas distintas.
- **KB é *uma* forma de fazer RAG.** Daria para fazer RAG na mão (gerar embeddings
  e `PutVectors`/`QueryVectors` direto no S3 Vectors). Escolhemos a KB gerenciada
  para não manter esse encanamento e ficar no orçamento (< US$ 10/mês, nada
  always-on). Ver [ADR 0010](0010-rag-bedrock-kb-s3-vectors.md).
- **RAG corre por dentro do MCP** aqui: a busca é a 5ª tool do servidor de
  conhecimento ([ADR 0011](0011-rag-como-tool-mcp.md)). Poderia ser embutida no
  handler; foi feita como tool para o agente decidir *quando* buscar e manter o
  núcleo desacoplado.

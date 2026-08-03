# Fase 2 — Memória + RAG · `design.md`

## Arquitetura (textual)

```
[Frontend] --(msg + conversationId)--> [API GW + JWT] --> [Lambda do agente]
     │                                                        │
     │  memória por usuário                                   │  RAG (tool MCP)
     ▼                                                        ▼
[DynamoDB single-table]                        [Servidor MCP] --retrieve--> [Bedrock KB]
  PK=SESSION#<sub>#<conv>                         search_knowledge_base        │  S3 Vectors
  SK=MSG#<ts>  (+TTL)                                                          ▼
                                                                          [S3: docs do projeto]
```

## Decisões

### Memória (DynamoDB)
- **Single-table**: `PK = SESSION#<cognitoSub>#<conversationId>`, `SK = MSG#<isoTs>`;
  atributos `role` (`user`/`assistant`), `content`, `ttl` (epoch, ~30 dias). *(R1)*
- **Isolamento por usuário**: o `cognitoSub` vem dos claims do JWT
  (`event.requestContext.authorizer.jwt.claims.sub`) — nunca do corpo. O
  `conversationId` vem do frontend (localStorage). *(R2)*
- **Billing on-demand**, TTL habilitado no atributo `ttl`. *(R7)*
- **Repositório** em `services/agent/src/agent/memory/` (encapsula o acesso; o loop
  só pede "histórico da sessão" e "grava turno"). O handler carrega as últimas N
  mensagens e o loop as injeta como histórico do `Agent` (Strands). *(R3)*

### RAG (Bedrock Knowledge Base + S3 Vectors)
- **Vector store: S3 Vectors** (pay-per-use, sem compute ligado) — decisivo pelo
  orçamento. **Embeddings: Titan Text Embeddings V2**. *(R7)*
- **Bedrock Knowledge Base gerenciada** com data source no **S3** (docs do projeto).
- **Tool `search_knowledge_base`** no servidor MCP: usa
  `bedrock-agent-runtime.retrieve` (retrieve puro, não `retrieve_and_generate`) para
  devolver **trechos + citações (source URI/arquivo)**; **o agente (Claude) compõe a
  resposta fundamentada** e cita. Mantém a composição no loop, não na KB. *(R4, R6)*

### IaC
- Nova **`memory-rag-stack.ts`**: DynamoDB, bucket S3, KB (+ data source) e a role da
  KB. Exporta `table` e `knowledgeBaseId`; o `bin` passa para a **`agent-stack`**
  (cross-stack), que concede à Lambda `dynamodb:*Item` na tabela e `bedrock:Retrieve`
  na KB, e injeta os nomes/ids via env.

## Riscos / trade-offs
- **⚠️ CDK × S3 Vectors:** por ser recente, o suporte de CloudFormation à
  configuração de **S3 Vectors** na `AWS::Bedrock::KnowledgeBase` pode ser parcial.
  Plano: tentar via **L1 `CfnKnowledgeBase`** com `storageConfiguration` de S3
  Vectors; se o CFN ainda não suportar, **provisionar a KB via CLI/console** e
  referenciar o `knowledgeBaseId` por parâmetro (documentar no ADR). Verificar a doc
  oficial na hora de implementar (regra: consultar a versão adotada).
- **Cota Bedrock (embeddings):** ingestão/consulta dependem do modelo de embeddings —
  mesma trava de conta nova. Memória é independente e testável já; RAG valida quando
  a cota liberar.
- **Contexto grande:** limitar o histórico injetado (últimas N mensagens) e os
  trechos de RAG (top-k) para controlar tokens/custo.

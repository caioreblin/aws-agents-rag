# ADR 0010 — RAG com Bedrock Knowledge Base + S3 Vectors

**Status:** Aceito · **Data:** 2026-08-03 · **Fase:** 2

## Contexto
O agente precisa responder sobre o próprio projeto com base em fatos
recuperados (RAG com citações). O corpus são os docs do repo (`PLAN.md`,
`README.md`, `docs/*.md`). Restrição decisiva: **nada always-on** (orçamento
< US$ 10/mês). O vector store clássico gerenciado (OpenSearch Serverless)
custaria ~US$ 300–700/mês só ligado — inviável.

## Decisão
**Bedrock Knowledge Base gerenciada** com vector store **S3 Vectors**
(pay-per-use, sem compute ligado) e embeddings **Titan Text Embeddings V2**
(1024 dims, `float32`, `cosine`). Data source no bucket S3 dos docs. Tudo em
**CDK** (`infra/lib/memory-rag-stack.ts`): vector bucket + índice + role da KB
(least-privilege, políticas conforme a doc oficial) + KB + data source.

## Consequências
- **Positivo:** RAG gerenciado com custo essencialmente nulo em repouso; ingerir
  o corpus inteiro (~6K tokens) custa frações de centavo.
- **Risco do design eliminado (provado 2026-08-03):** havia dúvida se o
  CloudFormation suportava S3 Vectors (com fallback via CLI/console). O
  `aws-cdk-lib` **2.262.2** tem L1 nativo (`AWS::S3Vectors::VectorBucket`/
  `Index`) e `s3VectorsConfiguration` na KB — deploy real chegou a
  `CREATE_COMPLETE`, sem fallback.
- **Gotchas descobertos no deploy:**
  - O S3 Vectors **reserva o prefixo `aws`** no nome do vector bucket
    (`InvalidRequest: bucket name is reserved`) — o bucket S3 comum aceita
    `aws-`, o S3 Vectors não. Usar `agents-rag-vectors-<account>`.
  - O índice exige `nonFilterableMetadataKeys` = `AMAZON_BEDROCK_METADATA` +
    `AMAZON_BEDROCK_TEXT` (a KB guarda o chunk como metadado não-filtrável).
  - `cdk synth`/`deploy` do app inteiro bundla a Lambda do AgentStack (Docker);
    para o MemoryRagStack usar `--exclusively`.
- **Bloqueio externo:** ingestão e consulta dependem do modelo de embeddings —
  a cota on-demand do Titan V2 em conta nova é **0 e não-ajustável**
  (`ThrottlingException`). A infra está pronta; a prova de RAG com citação fica
  pendente da AWS liberar a cota. Memória é independente e já provada.

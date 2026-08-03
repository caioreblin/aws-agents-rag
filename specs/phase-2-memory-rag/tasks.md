# Fase 2 — Memória + RAG · `tasks.md`

Execução **item por item**. `( )` = requisito atendido (ver `requirements.md`).
Ordem: memória primeiro (independe do Bedrock), depois RAG (depende da cota).

## Memória (DynamoDB) — independe do Bedrock

- [x] **2.1 — Tabela DynamoDB single-table.** Na nova `memory-rag-stack.ts`: tabela on-demand, `PK` (string) + `SK` (string), atributo de **TTL** `ttl`, `removalPolicy` DESTROY. *Motivação:* base da memória; single-table + TTL é o padrão pedido, barato e sem manutenção. *(R1, R7)* _(tabela `aws-agents-rag-memory`, synth ok. Deploy independe de Docker: `cdk deploy MemoryRagStack --exclusively --profile poc`.)_
- [x] **2.2 — Repositório de memória (Python).** Em `services/agent/src/agent/memory/`: funções para **gravar** um turno (`user`/`assistant`) e **ler** as últimas N mensagens de uma sessão; chave `SESSION#<sub>#<conv>` / `MSG#<isoTs>`; define `ttl`. *Motivação:* encapsular a persistência; o loop não conhece DynamoDB. *(R1)* _(`MemoryRepository` boto3; SK com sufixo rand anti-colisão; TTL 30d; validado offline. Round-trip real no 2.10.)_
- [x] **2.3 — Integrar memória no handler/loop.** Handler extrai `sub` dos **claims do JWT** e `conversationId` do corpo; carrega histórico e passa ao `run_agent`; grava o turno ao final. *Motivação:* continuidade entre turnos, isolada por usuário (sub do token, nunca do corpo). *(R2, R3)* _(loop injeta histórico via `Agent(messages=...)`; memória best-effort (warning sem quebrar resposta); validado em mock.)_
- [x] **2.4 — Frontend: conversationId.** Gerar/persistir um `conversationId` (localStorage) e enviá-lo no corpo; botão "nova conversa" limpa e cria outro. *Motivação:* separar conversas e permitir continuidade real no teste. *(R3)* _(conversationId via localStorage/crypto.randomUUID, enviado no body; botão "Nova conversa"; build ok.)_

## RAG (Bedrock KB + S3 Vectors) — depende da cota Bedrock

- [x] **2.5 — Bucket S3 dos documentos.** Bucket com **Block Public Access** na `memory-rag-stack`. *Motivação:* origem do corpus; nunca público. *(R7)* _(`aws-agents-rag-docs-<account>`, BlockPublicAccess ALL, SSE-S3, enforceSSL, autoDelete; synth ok.)_
- [ ] **2.6 — Knowledge Base + S3 Vectors.** KB gerenciada com data source S3 e vector store **S3 Vectors** (embeddings **Titan V2**) + role da KB. **Verificar suporte CFN**; se faltar, provisionar via CLI/console e parametrizar o `knowledgeBaseId`. *Motivação:* RAG gerenciado e barato; risco de CFN documentado no design. *(R4, R5, R7)*
- [ ] **2.7 — Tool `search_knowledge_base` (MCP).** No servidor MCP: `bedrock-agent-runtime.retrieve` → retorna trechos + citações (arquivo/URI). *Motivação:* RAG entra como **mais uma tool**, sem tocar o núcleo (prova de novo o plug-and-play). *(R4, R6)*
- [ ] **2.8 — IAM (cross-stack).** Lambda do agente: `dynamodb:PutItem/Query` na tabela + `bedrock:Retrieve` na KB (least-privilege). Role da KB: ler o bucket + invocar o embeddings. *Motivação:* menor privilégio possível por função. *(R2)*
- [ ] **2.9 — Ingestão do corpus.** Subir `PLAN.md`, `README.md`, `docs/*.md` no S3 e rodar o **sync** da KB. *Motivação:* dados reais e verificáveis para testar citações. *(R5)*
- [ ] **2.10 — Deploy e provas.** (a) memória: dois turnos na mesma conversa mantêm contexto e ficam isolados por usuário; (b) RAG: pergunta sobre o projeto retorna resposta **com citação** (após cota liberar). *Motivação:* critério de "pronto". *(R1–R6)*
- [ ] **2.11 — Documentar.** README + ADRs (single-table design, KB + S3 Vectors, RAG via tool MCP). *Motivação:* rastro de decisões.

## Critério de "pronto" da Fase 2
R1–R7 satisfeitos: contexto entre turnos por usuário + resposta fundamentada com
citação sobre o corpus; núcleo intacto. Ao fechar, gerar o spec da **Fase 3**
(Step Functions + EventBridge).

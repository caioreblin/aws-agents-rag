# infra/ — AWS CDK (TypeScript)

Toda a Infraestrutura como Código do projeto. Um único app CDK v2 em TypeScript
(`bin/infra.ts`). Região alvo: `us-east-1`.

## Stacks (`lib/`)

- ✅ `foundation-stack.ts` — OIDC provider (GitHub), role de deploy, Lambda "hello" + API Gateway HTTP API (Fase 0).
- ✅ `agent-stack.ts` — Cognito + Lambda do agente (bundling Docker) + HTTP API protegido por JWT (Fase 1). Recebe do `MemoryRagStack` (cross-stack) a tabela de memória e a KB: injeta env `MEMORY_TABLE_NAME`/`KNOWLEDGE_BASE_ID` e concede `dynamodb:PutItem/Query` + `bedrock:Retrieve`.
- ✅ `memory-rag-stack.ts` — DynamoDB (memória) + S3 (docs) + Bedrock Knowledge Base com **S3 Vectors** + role da KB + data source (Fase 2).
- ⬜ `orchestration-stack.ts` — Step Functions + EventBridge + ingestão (Fase 3).
- ⬜ `observability-stack.ts` — dashboards, alarmes, X-Ray, retenção de logs (Fase 5).

## Deploy

```bash
aws sso login --profile poc
# MemoryRagStack não bundla Docker; use --exclusively (o synth do app inteiro
# bundlaria a Lambda do AgentStack).
cdk deploy MemoryRagStack --exclusively --profile poc
cdk deploy AgentStack --exclusively --profile poc   # requer Docker (bundling da Lambda)
```

**Gotchas (Fase 2):** o S3 Vectors reserva o prefixo `aws` no nome do vector
bucket; as refs cross-stack resolvem via `Fn::GetStackOutput` (não Export/
ImportValue). Detalhes nos ADRs [0010](../docs/0010-rag-bedrock-kb-s3-vectors.md)
e [0011](../docs/0011-rag-como-tool-mcp.md).

Ver [`../PLAN.md`](../PLAN.md).

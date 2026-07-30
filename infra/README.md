# infra/ — AWS CDK (TypeScript)

Toda a Infraestrutura como Código do projeto. Um único app CDK v2 em TypeScript.

**Ainda não inicializado.** Na task **0.8** da Fase 0, rodar aqui:

```bash
cdk init app --language typescript
```

## Stacks planejadas (`lib/`)

- `foundation-stack.ts` — OIDC provider (GitHub), role de deploy, budget (quando via IaC), Lambda "hello" + API Gateway HTTP API.
- `agent-stack.ts` — API Gateway + Cognito + Lambda do agente (Fase 1).
- `memory-rag-stack.ts` — DynamoDB + S3 + Bedrock Knowledge Base com S3 Vectors (Fase 2).
- `orchestration-stack.ts` — Step Functions + EventBridge + ingestão (Fase 3).
- `observability-stack.ts` — dashboards, alarmes, X-Ray, retenção de logs (Fase 5).

Região alvo: `us-east-1`. Ver [`../PLAN.md`](../PLAN.md).

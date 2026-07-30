# aws-agents-rag

Projeto de estudos: um **agente de IA** que responde perguntas sobre uma base de
conhecimento própria (**RAG com citações**) e executa **ações via ferramentas
expostas por MCP**, construído na **AWS** com foco em agentes de IA e infra/DevOps.

Stack poliglota: **Python** no núcleo do agente, **TypeScript** para IaC (AWS CDK)
e frontend.

## Status

Em construção — **Fase 0 (Fundação)**. Roadmap completo em [`PLAN.md`](PLAN.md).

## Metodologia

Spec-Driven Development (trio estilo Kiro). Cada fase tem um spec em
[`specs/`](specs/) com `requirements.md` + `design.md` + `tasks.md`. A execução
segue **fase por fase e item por item**.

- Fase atual: [`specs/phase-0-foundation/`](specs/phase-0-foundation/)

## Arquitetura de referência (alvo)

- Cliente → **API Gateway + Cognito** (entrada e auth)
- **Agente em Lambda (Python)** com **Amazon Bedrock (Claude)** — loop agêntico (**Strands Agents**)
- **DynamoDB** como memória (single-table, TTL)
- **Bedrock Knowledge Base** + **S3 Vectors** para RAG sobre docs no **S3**
- Ferramentas/ações via **MCP (Model Context Protocol)** — plug-and-play
- **Step Functions** (workflows duráveis) + **EventBridge** (ingestão event-driven)
- Transversal: **AWS CDK (TypeScript)**, **CI/CD via GitHub Actions com OIDC**,
  observabilidade (CloudWatch, X-Ray, tracing de LLM)

## Estrutura do repositório

```
specs/        specs por fase (requirements/design/tasks)
infra/        AWS CDK (TypeScript) — toda a IaC
services/     serviços Python (agent, mcp-servers, ingestion)
packages/     TS compartilhado (frontend, tipos) — opcional
docs/         ADRs, diagramas, anotações
scripts/      helpers
.github/      workflows de CI/CD
```

## Custo

Alvo: **< US$ 10/mês**. Tudo serverless pay-per-use, **nada always-on**.
Ver seção de custo e armadilhas em [`PLAN.md`](PLAN.md).

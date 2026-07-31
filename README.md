# aws-agents-rag

Projeto de estudos: um **agente de IA** que responde perguntas sobre uma base de
conhecimento própria (**RAG com citações**) e executa **ações via ferramentas
expostas por MCP**, construído na **AWS** com foco em agentes de IA e infra/DevOps.

Stack poliglota: **Python** no núcleo do agente, **TypeScript** para IaC (AWS CDK)
e frontend.

## Status

**Fase 1 (Agente v1) concluída** — agente com loop agêntico (Strands), tools via
MCP, atrás de API Gateway + Cognito, deployado. Bedrock roda em **modo mock** até
a cota de conta nova liberar (ver [spec da Fase 1](specs/phase-1-agent-v1/)).
Roadmap completo em [`PLAN.md`](PLAN.md).

## Metodologia

Spec-Driven Development (trio estilo Kiro). Cada fase tem um spec em
[`specs/`](specs/) com `requirements.md` + `design.md` + `tasks.md`. A execução
segue **fase por fase e item por item**.

- [`specs/phase-0-foundation/`](specs/phase-0-foundation/) — ✅ concluída
- [`specs/phase-1-agent-v1/`](specs/phase-1-agent-v1/) — ✅ concluída

## Rodar (Fase 1)

O backend (Lambda do agente + Cognito + API) já está deployado via CDK. Para
conversar com o agente pelo frontend local:

```bash
cd packages/frontend
npm install
npm run dev          # http://localhost:5173 — login via Cognito Hosted UI
```

Desenvolvimento local do agente (sem AWS), em modo mock:

```bash
cd services/agent
uv sync
BEDROCK_MOCK=true uv run python -c "from agent.loop import run_agent; print(run_agent('quanto é 12*9?', 'local'))"
```

Infra (deploy):

```bash
cd infra
aws sso login --profile poc
cdk deploy AgentStack --profile poc   # requer Docker rodando (bundling da Lambda)
```

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

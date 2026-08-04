# aws-agents-rag

Projeto de estudos: um **agente de IA** que responde perguntas sobre uma base de
conhecimento própria (**RAG com citações**) e executa **ações via ferramentas
expostas por MCP**, construído na **AWS** com foco em agentes de IA e infra/DevOps.

Stack poliglota: **Python** no núcleo do agente, **TypeScript** para IaC (AWS CDK)
e frontend.

## Status

**Fase 2 (Memória + RAG) em andamento** — memória e RAG completos em código e
infra, ambos os stacks deployados.
- **Memória (DynamoDB single-table)** — ✅ **provada end-to-end**: contexto entre
  turnos e isolamento por usuário, contra a Lambda + tabela reais.
- **RAG (Bedrock Knowledge Base + S3 Vectors)** — infra deployada e validada
  (`CREATE_COMPLETE`); ingestão e prova com citação **pendentes da cota de
  embeddings** (Titan V2 on-demand = 0, não-ajustável em conta nova).

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
- [`specs/phase-2-memory-rag/`](specs/phase-2-memory-rag/) — 🚧 memória provada; RAG pendente de cota

> **Fonte da verdade do progresso:** o `tasks.md` de cada fase. O estado detalhado,
> item a item, com notas e gotchas, está em
> [`specs/phase-2-memory-rag/tasks.md`](specs/phase-2-memory-rag/tasks.md).

## Pré-requisitos

- **Node.js 18+** — AWS CDK (IaC) e frontend.
- **Python 3.12+** e **[`uv`](https://docs.astral.sh/uv/)** — serviço do agente.
- **Docker** — o deploy do `AgentStack` faz bundling da Lambda em container.
- **AWS CLI v2** com **SSO** configurado (profile `poc`, ver abaixo).
- **Git**.

## Configuração AWS

| Item | Valor |
|---|---|
| Conta | `106537046215` |
| Região | `us-east-1` (fixa em todo o projeto) |
| Profile CLI | `poc` (session SSO `aws-poc`) |

Numa **máquina nova**, configurar o SSO uma vez e depois logar:

```bash
aws configure sso --profile poc     # informe a Start URL do Identity Center + região us-east-1
aws sso login --profile poc         # renova a sessão (validade curta; repita quando expirar)
aws sts get-caller-identity --profile poc   # confere que está logado
```

> A conta **já está bootstrapada** para o CDK (o `cdk bootstrap` é por conta+região,
> não por máquina) — não precisa refazer numa máquina nova.

## Retomar em outra máquina (setup do zero)

```bash
git clone <URL-do-repo> aws-agents-rag
cd aws-agents-rag

# IaC (TypeScript)
cd infra && npm install && cd ..

# Serviço do agente (Python)
cd services/agent && uv sync && cd ../..

# Frontend (opcional, para conversar com o agente)
cd packages/frontend && npm install && cd ../..

# AWS (ver seção acima)
aws sso login --profile poc
```

Os stacks **já estão deployados na conta** (persistem independente da máquina).
Para ver os outputs/IDs atuais a qualquer momento:

```bash
aws cloudformation describe-stacks --stack-name AgentStack \
  --query "Stacks[0].Outputs" --region us-east-1 --profile poc --output table
aws cloudformation describe-stacks --stack-name MemoryRagStack \
  --query "Stacks[0].Outputs" --region us-east-1 --profile poc --output table
```

## Recursos deployados (referência — valores em 2026-08)

| Recurso | Valor |
|---|---|
| Knowledge Base ID | `O83T3ZY0SE` |
| Bucket de docs (corpus do RAG) | `aws-agents-rag-docs-106537046215` |
| Vector bucket (S3 Vectors) | `agents-rag-vectors-106537046215` |
| Tabela de memória (DynamoDB) | `aws-agents-rag-memory` |
| API do agente (POST, requer JWT) | `https://e5ehfyqr0f.execute-api.us-east-1.amazonaws.com/chat` |
| Cognito User Pool | `us-east-1_k8ZpPIWkN` |
| Cognito App Client | `75g4nfjl92o1oo7g424q1p3qtk` |
| Hosted UI (login) | `https://agents-rag-caioreblin.auth.us-east-1.amazoncognito.com` |

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
# Memória + RAG (DynamoDB, S3, S3 Vectors, KB). --exclusively evita bundlar a
# Lambda do AgentStack (sem Docker); o AgentStack lê os outputs deste stack.
cdk deploy MemoryRagStack --exclusively --profile poc
# Agente (Cognito + Lambda + HTTP API) — requer Docker (bundling da Lambda).
cdk deploy AgentStack --exclusively --profile poc
```

## Estado atual: aguardando cota do Bedrock (como retomar)

O projeto está **pausado aguardando a AWS liberar a cota do Bedrock** em conta
nova. As cotas on-demand estão em **0 e não-ajustáveis** (a AWS libera sozinha,
em horas a dias); toda invocação dá `ThrottlingException`. Enquanto isso:
- O agente roda em **`BEDROCK_MOCK=true`** (responde exercitando as tools via MCP,
  sem chamar o modelo).
- A **memória** já foi provada end-to-end (independe do Bedrock).
- O **RAG** está pronto em código/infra, mas a **ingestão e a prova com citação
  dependem dos embeddings** (Titan V2), também travados pela cota.

**Passo 1 — testar se a cota liberou** (embeddings e LLM):

```bash
# Embeddings (Titan V2) — usado pela ingestão/consulta do RAG
printf '%s' '{"inputText":"teste"}' > /tmp/emb.json
aws bedrock-runtime invoke-model --model-id amazon.titan-embed-text-v2:0 \
  --body fileb:///tmp/emb.json --cli-binary-format raw-in-base64-out \
  --region us-east-1 --profile poc /tmp/emb_out.json

# LLM (Haiku 4.5) — cérebro do agente. Use JSON por arquivo (inline quebra no Windows).
aws bedrock-runtime converse --model-id us.anthropic.claude-haiku-4-5-20251001-v1:0 \
  --cli-input-json file://<seu-json> --region us-east-1 --profile poc
```

Se **não** der `ThrottlingException`, a cota liberou. Aí seguir os itens abaixo
(detalhes em [`specs/phase-2-memory-rag/tasks.md`](specs/phase-2-memory-rag/tasks.md)):

**Passo 2 — item 2.9 (ingestão do corpus):** subir `PLAN.md`, `README.md` e
`docs/*.md` no bucket de docs e rodar o ingestion job da KB:

```bash
aws s3 cp PLAN.md   s3://aws-agents-rag-docs-106537046215/ --profile poc
aws s3 cp README.md s3://aws-agents-rag-docs-106537046215/ --profile poc
aws s3 cp docs/     s3://aws-agents-rag-docs-106537046215/docs/ --recursive --exclude "*" --include "*.md" --profile poc
# Descobrir o DataSourceId da KB e disparar o sync:
aws bedrock-agent list-data-sources --knowledge-base-id O83T3ZY0SE --region us-east-1 --profile poc
aws bedrock-agent start-ingestion-job --knowledge-base-id O83T3ZY0SE \
  --data-source-id <DATA_SOURCE_ID> --region us-east-1 --profile poc
```

**Passo 3 — item 2.10b (prova de RAG + sair do mock):** no
[`infra/lib/agent-stack.ts`](infra/lib/agent-stack.ts) trocar `BEDROCK_MOCK: 'true'`
para `'false'`, redeployar o agente (`cdk deploy AgentStack --exclusively --profile poc`,
requer Docker) e fazer uma pergunta sobre o projeto pelo frontend — a resposta deve
vir **com citação** da fonte (arquivo do corpus).

**Passo 4 — fechar a Fase 2** (item 2.11 já feito) e **gerar o spec da Fase 3**
(Step Functions + EventBridge).

> **Gotchas já documentados** (ADRs em [`docs/`](docs/)): o S3 Vectors reserva o
> prefixo `aws` no nome do vector bucket; refs cross-stack usam `Fn::GetStackOutput`;
> use sempre `--exclusively` no `MemoryRagStack` para não bundlar Docker do AgentStack.

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

# PLAN.md — Agente de IA (RAG + Ferramentas) na AWS

## Context

Projeto **greenfield de estudos** para dominar dois eixos: **agentes de IA** (profundidade) e **infra/DevOps na AWS** (força prática), stack poliglota — **Python** no núcleo do agente, **TypeScript** para IaC (CDK) e frontend. Usuário iniciante em AWS (conhece EC2/S3, nunca fez IaC nem serverless a sério).

Objetivo: agente que responde perguntas sobre uma base de conhecimento própria (**RAG com citações**) e executa **ações via ferramentas expostas por MCP**, evoluindo em fases crawl → walk → run até produção (observabilidade, guardrails, evals, FinOps). Requisito-chave transversal: **camada de ferramentas atrás de MCP desde a v1**, para que trocar tools de conhecimento por tools read-only de Ops da AWS no futuro seja plug-and-play **sem tocar no núcleo do agente**.

Restrições confirmadas:
- **Conta AWS:** criar do zero.
- **Região:** `us-east-1`.
- **Orçamento:** < US$ 10/mês → **nada always-on** (sem OpenSearch Serverless dedicado, sem NAT Gateway, sem Aurora ligada).
- **Corpus RAG:** indefinido → começar com corpus de exemplo; arquitetura idêntica quando trocar.

Decisões de processo confirmadas:
- **Monorepo.**
- **Spec-Driven Development** com specs no padrão **trio estilo Kiro** (`requirements.md` + `design.md` + `tasks.md`) por fase.
- **Execução fase por fase e item por item:** cada item do checklist tem instrução clara de execução e, quando relevante, a motivação da decisão.
- Detalhar agora **somente a Fase 0** por completo (template); demais fases em roadmap, com spec detalhado gerado logo antes de executar.

O spec completo da Fase 0 vive em [`specs/phase-0-foundation/`](specs/phase-0-foundation/).

---

## Metodologia: Spec-Driven Development (trio estilo Kiro)

Cada fase (ou feature) vira uma pasta em `specs/` com três arquivos:

- **`requirements.md`** — o *quê* e o *porquê*. Objetivos + **critérios de aceite testáveis** em estilo EARS (`QUANDO <gatilho>, O SISTEMA DEVE <resposta>`). Nada de "como".
- **`design.md`** — o *como* arquitetural. Decisões, trade-offs, diagrama textual, serviços AWS tocados, riscos. Referencia ADRs em `docs/`.
- **`tasks.md`** — o plano de execução **item por item**. Cada tarefa: instrução clara, motivação (quando não óbvia), e link para o critério de aceite que satisfaz. É o checklist que você marca.

**Fluxo por fase:** aprovar `requirements` → aprovar `design` → executar `tasks` uma a uma → validar contra os critérios de aceite → fechar a fase. Só então geramos o spec da fase seguinte. Isso mantém as decisões das fases finais abertas até haver contexto real (spec-driven de verdade).

**Regra de ouro:** implementação sempre rastreável a um critério de aceite; se algo não está no spec, primeiro atualiza o spec.

---

## Decisões de arquitetura (com trade-offs)

### 1. Framework do agente: **Strands Agents SDK** (recomendado) vs LangGraph
**Recomendo Strands Agents (Python).** Nativo AWS, "model-driven" com pouco boilerplate, Bedrock first-class, **cliente MCP nativo**, traces via OpenTelemetry, empacota limpo em Lambda. A orquestração durável/complexa mora no **Step Functions** (Fase 3), não no processo do agente — logo o motor de grafos do LangGraph é dispensável aqui. LangGraph vence se você precisar de branching determinístico complexo *in-process*; nesse caso, faça um spike — o contrato MCP protege a troca.

### 2. RAG: **Bedrock Knowledge Base gerenciada + S3 Vectors** (recomendado) vs pgvector
**Recomendo KB gerenciada com S3 Vectors.** Decisivo pelo orçamento: com teto < US$ 10/mês o vector store **não pode ser always-on**. OpenSearch Serverless tem piso de OCUs ligadas; Aurora Serverless v2 tem piso de ACU. **S3 Vectors é pay-per-use** (preço de storage/consulta) e integra nativo com Bedrock KB → encaixe perfeito. A KB entrega chunking, embeddings e **citações** prontas. pgvector ensina mais os internos mas tem piso de custo e ops → fica como **spike opcional** futuro.

### 3. IaC: **AWS CDK (TypeScript)** (recomendado) vs SAM
**Recomendo CDK v2 em TS.** Propósito geral — modela todos os serviços (Cognito, DynamoDB, Step Functions, EventBridge, KB), usa TS (meta poliglota), escala com o projeto. SAM é mais simples para Lambda+API puro e tem ótimo `sam local`, mas apertaria nas Fases 3–5. Use CDK; `sam local invoke` fica como debug local pontual.

### 4. Camada de ferramentas via MCP (o requisito plug-and-play)
Núcleo do agente só conhece **"conectar a servidor(es) MCP, listar tools, invocar tools"** — nunca a implementação concreta.
- **v1 (Fases 1–3):** um servidor MCP de conhecimento (Python) expõe as tools; começa in-process/stdio.
- **Fase 4:** consolidar todas as tools atrás de MCP e (opcional) separar em deployable próprio com **IAM role restrita e distinta**.
- **Migração v2 (fora de escopo):** trocar conhecimento por Ops read-only = apontar para **outro servidor MCP** com role própria, **zero mudança no loop**.

---

## Pré-requisitos e setup de ambiente

Windows 11 + Git Bash:
- [ ] **Node.js 20 LTS** (`node -v`)
- [ ] **AWS CDK v2** (`npm i -g aws-cdk`; `cdk --version`)
- [ ] **AWS CLI v2** (`aws --version`)
- [ ] **Python 3.12** (runtime alvo Lambda) + **uv**
- [ ] **Docker Desktop** (bundling de Lambdas Python via CDK)
- [ ] **Git** + conta GitHub (repo para OIDC)
- [ ] **pnpm** (opcional, workspace TS de frontend/tipos)
- [ ] E-mail dedicado para o root da AWS

---

## Estrutura de repositório (monorepo poliglota)

Fronteira clara **TS (infra/frontend)** × **Python (serviços)**; specs versionados no repo.

```
aws-agents-rag/
  README.md
  PLAN.md
  specs/                      # Spec-Driven Development (trio por fase)
    phase-0-foundation/
      requirements.md
      design.md
      tasks.md
    # phase-1-agent-v1/ ...   # criadas logo antes de cada fase
  .github/workflows/          # CI/CD OIDC (deploy CDK, testes, evals)
  infra/                      # AWS CDK (TypeScript)
    bin/app.ts
    lib/
      foundation-stack.ts     # OIDC provider, roles base, budget (via IaC quando fizer sentido)
      agent-stack.ts          # API GW + Cognito + Lambda do agente
      memory-rag-stack.ts     # DynamoDB + S3 + Bedrock KB (S3 Vectors)
      orchestration-stack.ts  # Step Functions + EventBridge + ingestion
      observability-stack.ts  # dashboards, alarmes, X-Ray, retenção de logs
    cdk.json  package.json  tsconfig.json
  services/
    agent/                    # Núcleo do agente (Python Lambda)
      src/agent/handler.py    # entrypoint Lambda (fino)
      src/agent/loop.py       # loop agêntico (Strands)
      src/agent/mcp_client.py # descoberta/invocação de tools via MCP
      src/agent/memory/       # repositório DynamoDB (single-table)
      src/agent/prompts/
      tests/  pyproject.toml
    mcp-servers/
      knowledge/              # Servidor MCP de conhecimento (tools RAG/ação)
        src/  tests/  pyproject.toml
      # ops/  (FUTURO v2: read-only AWS) — não criar agora
    ingestion/                # Lambda de ingestão S3→KB (event-driven)
      src/  tests/  pyproject.toml
  packages/
    frontend/                 # cliente simples (TS) — opcional
    shared-types/             # tipos TS compartilhados — opcional
  docs/                       # ADRs, diagramas, anotações de estudo
  scripts/                    # helpers (seed corpus, etc.)
```

---

## Roadmap fase a fase (resumo)

Formato: **Objetivo · Serviços · Entregável · Pronto quando**. O detalhe item-a-item vive no `tasks.md` de cada fase (Fase 0 já detalhada em [`specs/phase-0-foundation/tasks.md`](specs/phase-0-foundation/tasks.md)).

- **Fase 0 — Fundação:** conta segura, CDK operante, "hello Lambda" via CI/CD com OIDC. **Pronto:** push no GitHub deploya a Lambda e `curl` no API Gateway retorna 200, sem chaves AWS no repo, budget ativo.
- **Fase 1 — Agente v1:** Bedrock (Claude) + Lambda + Cognito + 2–3 tools **atrás de MCP** (Strands). **Pronto:** usuário autenticado dispara uma tool via MCP; adicionar tool não altera o núcleo.
- **Fase 2 — Memória + RAG:** DynamoDB single-table (TTL) + Bedrock KB com **S3 Vectors** + citações. **Pronto:** resposta com citação verificável e contexto entre turnos; idle ≈ US$ 0.
- **Fase 3 — Orquestração + eventos:** Step Functions + EventBridge (ingestão S3→KB). **Pronto:** upload no S3 dispara ingestão; workflow multi-step com retry.
- **Fase 4 — MCP + multi-agente:** todas as tools atrás de MCP, troca por config, roles isoladas por servidor. **Pronto:** trocar tools só por config; v2 destravada (mas fora de escopo).
- **Fase 5 — Produção:** observabilidade (X-Ray + tracing LLM), Bedrock Guardrails, evals no CI (gating), FinOps. **Pronto:** PR roda evals com gate; guardrails ativos; fatura < US$ 10.

---

## Segurança desde o início

- **Root:** MFA + uso zero após setup; administração via Identity Center.
- **Least-privilege:** cada Lambda/servidor MCP com role própria e mínima; núcleo do agente **nunca** ganha permissões de Ops.
- **CI/CD:** GitHub **OIDC** com trust escopada a repo/branch; sem chaves longas.
- **Segredos/config:** **SSM Parameter Store (SecureString)** grátis; evitar Secrets Manager salvo necessidade.
- **Dados:** S3 com Block Public Access; sem PII em URLs/logs; guardrails de PII na Fase 5.
- **Auditoria:** CloudTrail ligado.

---

## Estimativa de custo por fase e como não tomar susto

Uso de estudo, esporádico, tudo serverless pay-per-use em `us-east-1`:

| Fase | Custo (idle → uso leve) | Observações |
|------|-------------------------|-------------|
| 0 | **~US$ 0** | Lambda/API GW/CloudFormation/Budgets no free tier. |
| 1 | **US$ 0–2** | Só tokens Bedrock; **Haiku** no loop, Sonnet pontual. |
| 2 | **US$ 1–3** | Embeddings/ingestão por uso; **S3 Vectors** sem compute ligado; DynamoDB on-demand ≈ grátis. |
| 3 | **~US$ 0** | Step Functions (4.000 transições/mês grátis) e EventBridge no free tier. |
| 4 | **~US$ 0** | Lambda extra do MCP no free tier. |
| 5 | **US$ 0–2** | Guardrails/tracing por uso; evals gastam tokens no CI. |

**Regras anti-susto:** budget alarms US$ 5/10 + free tier; on-demand em tudo; **evitar** NAT Gateway (~US$ 32/mês), OpenSearch Serverless, Aurora ligada, Secrets Manager desnecessário; retenção de logs curta; sampling do X-Ray; **cap de iterações + `max_tokens`** no agente; `cdk destroy` do que não usa.

---

## Riscos e armadilhas comuns (iniciante) + mitigação

- **NAT Gateway acidental (~US$ 32/mês):** não colocar Lambda em VPC — Bedrock/KB/S3 Vectors/DynamoDB funcionam sem VPC. → Sem VPC nesta fase.
- **OpenSearch Serverless como vector store:** piso alto. → **S3 Vectors**.
- **Acesso Bedrock não solicitado:** AccessDenied. → Resolver na Fase 0.
- **Mismatch de região:** KB/modelo/embeddings em regiões diferentes. → Tudo `us-east-1`.
- **IAM largo demais em runtime:** → role mínima por função.
- **Logs infinitos:** custo silencioso. → Retenção 7–14 dias.
- **Loop agêntico sem limite:** gasto de tokens/timeout. → Cap de iterações + `max_tokens`.
- **S3 público por engano:** → Block Public Access.
- **Chaves AWS no GitHub:** → OIDC, nunca chaves.
- **Re-ingestão desnecessária da KB:** embeddings pagos. → Sync incremental/idempotente (Fase 3).

---

## Verificação (prova real por fase)

1. **Fase 0:** `curl` no API Gateway = 200 após deploy automático via CI; zero chaves no GitHub; budget/CloudTrail ativos.
2. **Fase 1:** requisição autenticada (Cognito) → tool via MCP → resposta correta; nova tool sem alterar o núcleo.
3. **Fase 2:** pergunta do corpus → resposta com citação verificável; contexto entre turnos (DynamoDB).
4. **Fase 3:** upload no S3 dispara ingestão (EventBridge); state machine completa com retry.
5. **Fase 4:** trocar tools só por config; roles MCP independentes.
6. **Fase 5:** PR aciona evals (gating); guardrails bloqueiam caso de teste; dashboard + fatura < US$ 10.

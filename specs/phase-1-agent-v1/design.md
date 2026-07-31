# Fase 1 — Agente v1 · `design.md`

## Arquitetura (textual)

```
[Frontend local (TS)] --login--> [Cognito Hosted UI] --JWT-->
   --> [API Gateway HTTP API + JWT authorizer]
        --> [Lambda do agente (Python, Strands)]
              --Bedrock InvokeModel--> [Claude Haiku]
              --MCP client (stdio)---> [Servidor MCP de conhecimento (subprocesso)]
                                         tools: get_current_time, calculator, echo_note
```

## Decisões

- **Framework: Strands Agents SDK (Python).** Nativo AWS, loop model-driven, Bedrock
  first-class, **cliente MCP nativo**. (Ver ADR do PLAN.) *(R2, R3)*
- **Modelo: Claude Haiku 4.5** via inference profile
  **`us.anthropic.claude-haiku-4-5-20251001-v1:0`** (o modelo base
  `anthropic.claude-haiku-4-5-20251001-v1:0` só aceita INFERENCE_PROFILE em
  us-east-1). Fallback: Claude 3 Haiku on-demand
  `anthropic.claude-3-haiku-20240307-v1:0`. *(R7)*
- **⚠️ Bloqueio de cota (conta nova):** a cota *"Model invocation max tokens per day"*
  está em **0 e é não-ajustável** para os modelos Claude nesta conta (criada em
  2026-07-30) — a AWS libera automaticamente com o tempo (24h a poucos dias). Por
  isso construímos tudo primeiro; a invocação do Bedrock "acende" quando a cota subir.
  Para desenvolver/testar sem depender disso, usar um **modo mock** do cliente Bedrock
  no loop (flag de ambiente) até a cota liberar.
- **Tools atrás de MCP desde a v1:** um **servidor MCP de conhecimento** (Python, em
  `services/mcp-servers/knowledge/`) expõe as tools via **transporte stdio**. O núcleo
  do agente (`services/agent/`) conecta como **cliente MCP**, faz `list_tools` e
  `call_tool` — **nunca importa a implementação das tools**. Na Fase 1 os dois são
  empacotados na mesma Lambda; o agente sobe o servidor MCP como **subprocesso stdio**.
  Isso já materializa o contrato plug-and-play (trocar tools = trocar/reconfigurar o
  servidor MCP, sem tocar no loop). *(R3)*
- **Auth: Cognito User Pool + Hosted UI**; **HTTP API JWT authorizer**
  (`aws-cdk-lib/aws-apigatewayv2-authorizers`) validando o issuer/audience do pool.
  Frontend usa o Hosted UI (OAuth2) com **callback em `http://localhost`**. *(R1, R6)*
- **Frontend mínimo (TS) em `packages/frontend/`:** roda local (ex.: Vite), faz login
  no Hosted UI, guarda o JWT e chama o endpoint do agente. **Sem hospedagem** nesta
  fase (custo zero). *(R6)*
- **Bundling Python:** as deps (`strands-agents`, `mcp`, `boto3`) exigem bundling —
  usar **Docker** (via `PythonFunction` do módulo alpha `@aws-cdk/aws-lambda-python-alpha`
  **ou** `lambda.Function` + `Code.fromAsset` com bundling `uv`/`pip`). Decidir no 1.x.
- **Caps de segurança:** máx. de iterações do loop, `max_tokens` no Bedrock, timeout
  da Lambda (ex.: 30s) e validação da entrada no handler. *(R4)*
- **Observabilidade:** logger JSON com `correlationId` (segue os Backend Standards);
  handler fino (valida → delega → traduz resposta/erro). *(R5)*

## Nova stack CDK
`agent-stack.ts`: Cognito (user pool, app client, domain do Hosted UI), Lambda do
agente (com bundling), rota no HTTP API protegida pelo JWT authorizer, permissões IAM
mínimas (invocar Bedrock do modelo escolhido; logs). Reusa/estende o HTTP API da
`foundation-stack` ou cria um dedicado — decidir no 1.x.

## Riscos / trade-offs
- **Cota Bedrock de conta nova** (throttling) pode aparecer ao invocar de verdade →
  pedir aumento em Service Quotas se travar (pendência herdada da Fase 0).
- **Subprocesso MCP stdio na Lambda** adiciona latência de cold start → aceitável para
  estudo; na Fase 4 avaliamos servidor MCP como deployable próprio.
- **Módulo alpha** de bundling Python pode mudar de API → confirmar na doc oficial ao
  implementar (regra: consultar doc da versão adotada).
- **Hosted UI + localhost** simplifica, mas exige configurar o callback no app client.

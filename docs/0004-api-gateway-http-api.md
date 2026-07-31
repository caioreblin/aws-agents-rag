# ADR 0004 — API Gateway HTTP API em vez de REST API

**Status:** Aceito · **Data:** 2026-07-30 · **Fase:** 0

## Contexto
A Lambda "hello" (e depois o agente) precisa de um endpoint HTTP. O API Gateway
oferece dois tipos: REST API (v1, mais recursos) e HTTP API (v2, mais simples e
barato). No CDK v2, os constructs L2 de HTTP API (`HttpApi`,
`HttpLambdaIntegration`) já são estáveis dentro de `aws-cdk-lib`.

## Decisão
Usar **HTTP API (apigatewayv2)** para os endpoints do projeto.

## Consequências
- **Positivo:** mais barato e simples; integra direto com Lambda; suficiente para
  os fluxos do agente; menos configuração.
- **Negativo:** não tem alguns recursos do REST API (usage plans/API keys nativos,
  request/response transforms avançados) — nenhum necessário agora. Reavaliar se
  algum surgir.
- Autorização com Cognito (JWT authorizer) na Fase 1 é suportada nativamente por
  HTTP API.

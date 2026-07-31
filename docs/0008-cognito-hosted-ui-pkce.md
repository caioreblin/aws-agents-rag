# ADR 0008 — Auth com Cognito Hosted UI + PKCE

**Status:** Aceito · **Data:** 2026-07-31 · **Fase:** 1

## Contexto
O endpoint do agente precisa de autenticação. Queríamos auth gerenciada, sem
implementar login/armazenar senhas, e um frontend público (SPA) que não pode
guardar client secret.

## Decisão
Usar **Amazon Cognito** (User Pool) com **Hosted UI** e o fluxo **OAuth2
Authorization Code + PKCE** (App Client sem secret). O API Gateway HTTP API valida
o JWT via `HttpUserPoolAuthorizer`. O frontend envia o **id_token** no header
`Authorization` (é ele que tem o claim `aud` = client id que o authorizer valida).
O frontend roda local (`localhost:5173`) com callback registrado no App Client.

## Consequências
- **Positivo:** zero senha no nosso código; fluxo OAuth real e didático (PKCE
  hand-rolled em `packages/frontend/src/auth.ts`).
- **Gotcha (custou um deploy):** o **prefixo do domínio do Hosted UI não pode
  conter "aws", "cognito" ou "amazon"** — senão `InvalidRequest`. Usamos
  `agents-rag-caioreblin`.
- **Escopo/token:** usar o **id_token** (não o access token) evita ambiguidade de
  `aud`/`client_id` no authorizer.
- Frontend sem hospedagem nesta fase (custo zero); hospedar em S3/CloudFront fica
  para depois, se necessário.

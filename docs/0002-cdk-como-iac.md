# ADR 0002 — AWS CDK (TypeScript) como IaC, em vez de SAM

**Status:** Aceito · **Data:** 2026-07-30 · **Fase:** 0

## Contexto
O projeto vai tocar muitos serviços além de Lambda/API (Cognito, DynamoDB, Step
Functions, EventBridge, Bedrock Knowledge Base). Precisamos de uma ferramenta de
Infraestrutura como Código. Candidatos: AWS SAM (foco serverless) e AWS CDK
(propósito geral).

## Decisão
Usar **AWS CDK v2 em TypeScript**. Um único app CDK em `infra/`, uma stack por
domínio (`foundation-stack`, e futuras `agent`, `memory-rag`, `orchestration`,
`observability`).

## Consequências
- **Positivo:** modela todos os serviços do roadmap com constructs de alto nível;
  usa TypeScript (cumpre a meta poliglota do projeto); escala melhor nas fases 3–5.
- **Negativo:** curva de aprendizado maior que SAM; depende de `cdk bootstrap` e de
  Docker para bundling de Lambdas com dependências (Fase 1+).
- `sam local invoke` continua disponível como ferramenta pontual de debug local.
